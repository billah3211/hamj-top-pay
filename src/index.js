const express = require('express')
const path = require('path')
const expressLayouts = require('express-ejs-layouts')
console.log('Starting application with dependencies refreshed...');
require('dotenv').config()
const session = require('express-session')
const { RedisStore } = require('connect-redis')
const { prisma } = require('./db/prisma')
const { redis } = require('./redis/client')

// Check if public/uploads exists, if not create it (Required for Render)
const fs = require('fs')
if (!fs.existsSync('public/uploads')){
    fs.mkdirSync('public/uploads', { recursive: true });
}

const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const superAdminRoutes = require('./routes/super_admin')
const storeRoutes = require('./routes/store')
const promoteRoutes = require('./routes/promote')
const topupRoutes = require('./routes/topup')
const notificationRoutes = require('./routes/notifications')
const guildRoutes = require('./routes/guild')
const leaderboardRoutes = require('./routes/leaderboard')
const profileRoutes = require('./routes/profile')
const apiRoutes = require('./routes/api')

const { createServer } = require('http')
const { Server } = require('socket.io')
const { getAIResponse } = require('./services/aiService')

const app = express()

// View Engine Setup
app.use(expressLayouts)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.set('layout', 'admin/layout') // Set default layout

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Socket.io Logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('join_chat', async ({ userId, role }) => {
    socket.join(`user_${userId}`)
    if (role === 'admin' || role === 'SUPER_ADMIN') {
      socket.join('admin_room')
    }

    // Load Chat History
    try {
      if (userId) {
        const session = await prisma.supportSession.findFirst({
          where: { userId: parseInt(userId), status: { not: 'RESOLVED' } },
          include: { messages: { orderBy: { createdAt: 'asc' } } }
        })

        if (session && session.messages.length > 0) {
          socket.emit('chat_history', session.messages)
        }
      } else {
        console.warn('Skipping chat history: userId is missing')
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  })

  socket.on('send_message', async ({ userId, message, sender }) => {
    try {
      // 1. Find or create session
      let session = await prisma.supportSession.findFirst({
        where: { userId: parseInt(userId), status: { not: 'RESOLVED' } }
      })

      if (!session) {
        session = await prisma.supportSession.create({
          data: { userId: parseInt(userId), status: 'AI_MODE' }
        })
      }

      // 2. Save User Message
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          sender: sender, // 'user' or 'admin'
          message: message
        }
      })

      // 3. AI Logic or Live Chat
      if (session.status === 'AI_MODE' && sender === 'user') {
        const aiRes = await getAIResponse(message)
        
        // Save AI Response
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            sender: 'ai',
            message: aiRes.text
          }
        })

        // Emit to user
        io.to(`user_${userId}`).emit('receive_message', {
          sender: 'ai',
          message: aiRes.text
        })

        // Check for handover
        if (aiRes.handover) {
          await prisma.supportSession.update({
            where: { id: session.id },
            data: { status: 'LIVE_CHAT' }
          })
          // Notify Admins
          io.to('admin_room').emit('new_support_request', {
            userId: userId,
            message: message
          })
        }
      } 
      else if (session.status === 'LIVE_CHAT') {
        // Forward to admins if user sent it
        if (sender === 'user') {
          io.to('admin_room').emit('receive_admin_message', {
            userId: userId,
            message: message,
            sender: 'user'
          })
        } 
        // Forward to user if admin sent it
        else if (sender === 'admin') {
           io.to(`user_${userId}`).emit('receive_message', {
            sender: 'admin',
            message: message
          })
        }
      }

    } catch (error) {
      console.error('Socket Error:', error)
    }
  })
})

app.set('trust proxy', 1) // Trust Render proxy for secure cookies
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Initialize Session Store (Redis or Memory Fallback)
let sessionStore;
if (process.env.REDIS_URL) {
  const redisStore = new RedisStore({
    client: redis,
    prefix: "hamj:",
  })
  redis.connect().catch(err => {
    console.error('Redis connection error:', err)
  })
  sessionStore = redisStore
  console.log('Using Redis for session storage')
} else {
  console.log('REDIS_URL not found. Using MemoryStore. (Sessions will be lost on restart)')
}

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 } // 1 day
}))
app.use(express.static('public'))
app.use('/admin_p', (req, res, next) => { if (req.session && req.session.admin) return next(); return res.redirect('/admin/login') })
app.use('/admin_p', express.static('admin_p'))

app.get('/health', async (req, res) => {
  const status = { app: true, db: false, redis: false }
  try {
    await prisma.$queryRaw`SELECT 1`
    status.db = true
  }
  catch (_) {}
  try {
    if (!redis.isOpen) await redis.connect()
    const pong = await redis.ping()
    status.redis = pong === 'PONG'
  } catch (_) {}
  res.status(200).json(status)
})

app.use('/', authRoutes)
app.use('/admin/withdrawals', require('./routes/admin/withdrawals'))
app.use('/admin/reported', require('./routes/admin/reported'))
app.use('/admin', adminRoutes)
app.use('/super-admin', superAdminRoutes)
app.use('/store', storeRoutes)
app.use('/promote', promoteRoutes)
app.use('/topup', topupRoutes)
app.use('/notifications', notificationRoutes)
app.use('/guild', guildRoutes)
app.use('/leaderboard', leaderboardRoutes)
app.use('/profile', profileRoutes)
app.use('/api', apiRoutes)

const port = process.env.PORT || 3000
httpServer.listen(port, () => {
  console.log('server listening on ' + port)
  console.log('Store routes registered and uploads directory checked.')
})

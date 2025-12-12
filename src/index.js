const express = require('express')
require('dotenv').config()
const session = require('express-session')
const { RedisStore } = require('connect-redis')
const { prisma } = require('./db/prisma')
const { redis } = require('./redis/client')

// Check if public/uploads exists, if not create it
const fs = require('fs')
if (!fs.existsSync('public/uploads')){
    fs.mkdirSync('public/uploads', { recursive: true });
}

const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const superAdminRoutes = require('./routes/super_admin')
const storeRoutes = require('./routes/store')

const app = express()
app.set('trust proxy', 1) // Trust Render proxy for secure cookies
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Initialize Redis client connection with error handling
const redisStore = new RedisStore({
  client: redis,
  prefix: "hamj:",
})

redis.connect().catch(err => {
  console.error('Redis connection error:', err)
})

app.use(session({
  store: redisStore,
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
app.use('/admin', adminRoutes)
app.use('/super-admin', superAdminRoutes)
app.use('/store', storeRoutes)

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log('server listening on ' + port)
})

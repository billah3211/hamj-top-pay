const express = require('express')
require('dotenv').config()
const session = require('express-session')
const { redis } = require('./redis/client')
const { prisma } = require('./db/prisma')
const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-secret', resave: false, saveUninitialized: false }))
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

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log('server listening on ' + port)
})

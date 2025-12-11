const { createClient } = require('redis')

const url = process.env.REDIS_URL || 'redis://localhost:6379'

const redis = createClient({
  url,
  socket: {
    reconnectStrategy: (retries) => {
      // Retry connection with exponential backoff, max 3s delay
      if (retries > 10) return new Error('Redis connection retries exhausted')
      return Math.min(retries * 100, 3000)
    }
  }
})

redis.on('error', (err) => {
  // Prevent crash on error, just log
  console.error('Redis Client Error:', err.message)
})

redis.on('connect', () => {
  console.log('Connected to Redis')
})

module.exports = { redis }

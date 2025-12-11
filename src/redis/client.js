const { createClient } = require('redis')
const url = process.env.REDIS_URL || 'redis://localhost:6379'
const redis = createClient({ url })
redis.on('error', () => {})
module.exports = { redis }

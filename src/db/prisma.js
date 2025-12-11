const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

const connectionString = process.env.DATABASE_URL

// Configure PostgreSQL connection pool
const pool = new Pool({ 
  connectionString,
  // Add reasonable defaults for pool size if needed
  max: 10,
  idleTimeoutMillis: 30000
})

// Create Prisma adapter for PostgreSQL
const adapter = new PrismaPg(pool)

// Initialize Prisma Client with the adapter
const prisma = new PrismaClient({ adapter })

module.exports = { prisma }

const { PrismaClient } = require('@prisma/client')

// Explicitly provide the datasource URL to avoid accidental "adapter" options
// being picked up by the generated client (this prevents the "driverAdapters"
// preview-feature error during startup on some environments).
const prismaOptions = {
	datasources: {
		db: {
			url: process.env.DATABASE_URL,
		},
	},
}

let prisma
try {
	prisma = new PrismaClient(prismaOptions)
} catch (err) {
	// Rethrow after logging more context so deploy logs are clearer.
	console.error('PrismaClient initialization failed. prismaOptions:', prismaOptions)
	console.error(err)
	throw err
}

module.exports = { prisma }

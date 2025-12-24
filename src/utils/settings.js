const { prisma } = require('../db/prisma')

/**
 * Get system settings (site name, logo, etc.)
 * @returns {Promise<Object>}
 */
async function getSystemSettings() {
  const settings = await prisma.systemSetting.findMany()
  
  const config = {
    site_name: 'HaMJ toP PaY',
    site_logo: null,
    show_logo: 'false',
    github_link: '',
    currency: 'BDT', // Default currency
    dollar_rate: '120', // Default exchange rate
    // Add other defaults as needed
  }
  
  settings.forEach(s => {
    config[s.key] = s.value
  })
  
  return config
}

module.exports = {
  getSystemSettings
}

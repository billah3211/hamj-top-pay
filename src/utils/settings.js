const { prisma } = require('../db/prisma')

/**
 * Get system settings (site name, logo, etc.)
 * @returns {Promise<Object>}
 */
async function getSystemSettings() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['site_name', 'site_logo', 'show_logo'] } }
  })
  
  const config = {
    site_name: 'HaMJ toP PaY',
    site_logo: null,
    show_logo: 'false'
  }
  
  settings.forEach(s => {
    config[s.key] = s.value
  })
  
  return config
}

module.exports = {
  getSystemSettings
}

require('dotenv').config()
const { prisma } = require('./src/db/prisma')
const bcrypt = require('bcryptjs')

async function reset() {
  const email = 'mdmasumbilla272829@gmail.com'
  const newPassword = 'password123'
  
  try {
    const user = await prisma.user.findFirst({
      where: { email }
    })

    if (!user) {
      console.log('User not found!')
      return
    }

    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash }
    })
    
    console.log(`Password for ${email} has been reset to: ${newPassword}`)
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

reset()
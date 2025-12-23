const express = require('express')
const router = express.Router()
const { prisma } = require('../../db/prisma')

// Middleware to ensure admin access
const requireAdmin = (req, res, next) => {
  if (!req.session.role || (req.session.role !== 'ADMIN' && req.session.role !== 'SUPER_ADMIN')) {
    return res.redirect('/admin/login')
  }
  next()
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawalRequest.findMany({
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    res.render('admin/withdrawals', {
      title: 'Withdrawals',
      active: 'withdrawals',
      user: req.session,
      withdrawals
    })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    res.status(500).send('Server Error')
  }
})

router.post('/approve', requireAdmin, async (req, res) => {
  const { id } = req.body
  try {
    await prisma.withdrawalRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'APPROVED', processedAt: new Date() }
    })
  } catch (e) {
    console.error(e)
  }
  res.redirect('/admin/withdrawals')
})

router.post('/reject', requireAdmin, async (req, res) => {
  const { id } = req.body
  try {
    await prisma.withdrawalRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED', processedAt: new Date() }
    })
  } catch (e) {
    console.error(e)
  }
  res.redirect('/admin/withdrawals')
})

module.exports = router

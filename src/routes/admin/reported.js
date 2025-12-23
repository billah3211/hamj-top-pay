const express = require('express')
const router = express.Router()
const { prisma } = require('../../db/prisma')
const fs = require('fs')

// Middleware
const requireAdmin = (req, res, next) => {
  if (!req.session.role || (req.session.role !== 'ADMIN' && req.session.role !== 'SUPER_ADMIN')) {
    return res.redirect('/admin/login')
  }
  next()
}

// Helper: Get Settings (Duplicated from promote.js for now)
async function getSettings() {
  const keys = ['promote_reward']
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
  
  const getVal = (k, def) => {
    const s = settings.find(s => s.key === k)
    return s ? s.value : def
  }

  const rewardDefault = JSON.stringify({ coin: 5, diamond: 0, tk: 0 })
  return {
    rewards: JSON.parse(getVal('promote_reward', rewardDefault))
  }
}

// List Reported Tasks
router.get('/', requireAdmin, async (req, res) => {
  try {
    const tasks = await prisma.linkSubmission.findMany({
      where: { status: 'REPORTED' },
      include: {
        promotedLink: {
          include: { user: true }
        },
        visitor: true
      },
      orderBy: { reportedAt: 'desc' }
    })

    res.render('admin/reported_tasks', {
      title: 'Reported Tasks',
      active: 'reported-tasks',
      user: req.session,
      tasks
    })
  } catch (error) {
    console.error('Error fetching reported tasks:', error)
    res.status(500).send('Server Error')
  }
})

// Handle Action
router.post('/action', requireAdmin, async (req, res) => {
  const { id, action } = req.body
  const taskId = parseInt(id)

  try {
    const settings = await getSettings()

    await prisma.$transaction(async (tx) => {
      const task = await tx.linkSubmission.findUnique({
        where: { id: taskId },
        include: { promotedLink: true }
      })

      if (!task) throw new Error('Task not found')
      if (task.status !== 'REPORTED') throw new Error('Task is not in REPORTED status')

      if (action === 'approve') {
        // Option 1: Visitor Wins (Report Approved, Rejection Overturned)
        // 1. Update Status
        await tx.linkSubmission.update({
          where: { id: taskId },
          data: { status: 'APPROVED' }
        })

        // 2. Pay Visitor
        await tx.user.update({
          where: { id: task.visitorId },
          data: { 
            coin: { increment: settings.rewards.coin },
            diamond: { increment: settings.rewards.diamond },
            tk: { increment: settings.rewards.tk }
          }
        })

        // 3. Delete Screenshots (Optional, to save space)
        if(task.screenshots && task.screenshots.length) {
          task.screenshots.forEach(p => {
            try { fs.unlinkSync('public' + p) } catch(e) {}
          })
        }

        // Note: promotedLink.completedVisits was ALREADY incremented when Owner Rejected it.
        // Since we are Approving it, it counts as a valid visit. So we DO NOT change completedVisits.

      } else if (action === 'reject') {
        // Option 2: Owner Wins (Report Rejected, Rejection Upheld)
        // 1. Update Status
        await tx.linkSubmission.update({
          where: { id: taskId },
          data: { status: 'ADMIN_REJECTED' } // Final status
        })

        // 2. Refund View to Owner
        // Since completedVisits was incremented on Rejection, we must decrement it now to "give back" the slot.
        await tx.promotedLink.update({
          where: { id: task.promotedLinkId },
          data: { completedVisits: { decrement: 1 } }
        })
      }
    })

    res.redirect('/admin/reported')
  } catch (error) {
    console.error('Error processing report action:', error)
    res.redirect('/admin/reported?error=' + encodeURIComponent(error.message))
  }
})

module.exports = router

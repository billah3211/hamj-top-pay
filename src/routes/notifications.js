const express = require('express')
const router = express.Router()
const { prisma } = require('../db/prisma')

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login')
  }
  next()
}

// Helper to render layout
const renderLayout = (title, content, user) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - HaMJ toP PaY</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    /* Notification Specific Styles */
    .notification-list { display: flex; flex-direction: column; gap: 12px; }
    .notification-item {
      background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: 12px; padding: 16px;
      display: flex; gap: 16px; align-items: flex-start; transition: all 0.2s;
      position: relative;
    }
    .notification-item.unread { border-left: 4px solid var(--primary); background: rgba(99, 102, 241, 0.05); }
    .notification-icon {
      width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.05);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .notification-content { flex: 1; }
    .notification-message { color: var(--text-main); font-size: 15px; margin-bottom: 4px; line-height: 1.4; }
    .notification-time { color: var(--text-muted); font-size: 12px; }
    .mark-read-btn {
      background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;
      transition: color 0.2s;
    }
    .mark-read-btn:hover { color: var(--primary); }
    .empty-state { text-align: center; padding: 40px; color: var(--text-muted); }
  </style>
</head>
<body>
  <button class="menu-trigger" id="mobileMenuBtn">☰</button>
  <div class="app-layout">
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/dashboard"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/topup"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up</a></li>
        <li class="nav-item"><a href="/notifications" class="${title === 'Notifications' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
      </ul>
    </nav>
    <div class="main-content">
      <div class="container content">
         ${content}
      </div>
    </div>
  </div>
  <script>
    // Mobile menu toggle
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('active');
    });
  </script>
</body>
</html>
`

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const unreadCount = notifications.filter(n => !n.isRead).length

    const content = `
      <div class="section-header">
        <div>
          <div class="section-title">Notifications</div>
          <div style="color:var(--text-muted);font-size:14px">Stay updated with your latest activities</div>
        </div>
        ${unreadCount > 0 ? `
          <form action="/notifications/read-all" method="POST" style="margin:0;">
            <button type="submit" class="btn-secondary" style="font-size:12px; padding: 6px 12px;">Mark all as read</button>
          </form>
        ` : ''}
      </div>

      <div class="notification-list">
        ${notifications.length > 0 ? notifications.map(n => `
          <div class="notification-item ${!n.isRead ? 'unread' : ''}">
            <div class="notification-icon">
              <img src="https://api.iconify.design/lucide:${getIconForType(n.type)}.svg?color=%2394a3b8" width="20">
            </div>
            <div class="notification-content">
              <div class="notification-message">${n.message}</div>
              <div class="notification-time">${new Date(n.createdAt).toLocaleString()}</div>
            </div>
            ${!n.isRead ? `
              <form action="/notifications/read/${n.id}" method="POST" style="margin:0;">
                <button type="submit" class="mark-read-btn" title="Mark as read">
                  <img src="https://api.iconify.design/lucide:check.svg?color=currentColor" width="16">
                </button>
              </form>
            ` : ''}
          </div>
        `).join('') : `
          <div class="empty-state">
            <img src="https://api.iconify.design/lucide:bell-off.svg?color=%23475569" width="48" style="margin-bottom:16px; opacity:0.5;">
            <div>No notifications yet</div>
          </div>
        `}
      </div>
    `
    res.send(renderLayout('Notifications', content, user, unreadCount))
  } catch (error) {
    console.error(error)
    res.status(500).send('Server Error')
  }
})

router.post('/read/:id', requireAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { 
        id: parseInt(req.params.id),
        userId: req.session.userId
      },
      data: { isRead: true }
    })
    res.redirect('/notifications')
  } catch (error) {
    console.error(error)
    res.redirect('/notifications')
  }
})

router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.session.userId, isRead: false },
      data: { isRead: true }
    })
    res.redirect('/notifications')
  } catch (error) {
    console.error(error)
    res.redirect('/notifications')
  }
})

function getIconForType(type) {
  switch(type) {
    case 'credit': return 'arrow-down-left';
    case 'debit': return 'arrow-up-right';
    case 'alert': return 'alert-circle';
    case 'success': return 'check-circle';
    default: return 'info';
  }
}

module.exports = router

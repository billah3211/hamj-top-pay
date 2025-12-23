const express = require('express')
const router = express.Router()
const { prisma } = require('../db/prisma')

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login')
  }
  next()
}

// Helper: Calculate User Level
const calculateLevel = (count) => {
  if (count < 100) return 0;
  if (count < 500) return 1;
  if (count < 1200) return 2;
  if (count < 2000) return 3;
  if (count < 5000) return 4;
  if (count < 10000) return 5;
  if (count < 15000) return 6;
  return 7 + Math.floor((count - 15000) / 5000);
}

// Helper: Get Level Progress
const getLevelProgress = (count) => {
  let start = 0, next = 100;
  if (count < 100) { start = 0; next = 100; }
  else if (count < 500) { start = 100; next = 500; }
  else if (count < 1200) { start = 500; next = 1200; }
  else if (count < 2000) { start = 1200; next = 2000; }
  else if (count < 5000) { start = 2000; next = 5000; }
  else if (count < 10000) { start = 5000; next = 10000; }
  else if (count < 15000) { start = 10000; next = 15000; }
  else {
    const base = 15000;
    const step = 5000;
    const diff = count - base;
    const levelOffset = Math.floor(diff / step);
    start = base + levelOffset * step;
    next = start + step;
  }
  
  const percent = Math.min(100, Math.max(0, ((count - start) / (next - start)) * 100));
  
  return { current: count, next, start, percent };
}

// Helper: Profile Modal
const getProfileModal = (user, level, levelProgress) => `
    <div id="profileModal" class="modal-premium" style="align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-content" style="background: transparent; border: none; box-shadow: none; width: 100%; max-width: 600px; padding: 0;">
        <div style="position: relative;">
            <button class="modal-close" id="profileBack" style="position: absolute; top: -15px; right: -15px; background: rgba(0,0,0,0.5); color: white; border: 2px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 100; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
            <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 30px 20px 20px; border-radius: 24px; position: relative; overflow: visible; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <div style="background: #000; padding: 20px; border-radius: 16px; margin-bottom: 20px; margin-left: 60px; position: relative; border: 1px solid rgba(255,255,255,0.1);">
                   <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: 0.5px;">${user.firstName} ${user.lastName}</div>
                   <div style="color: #4ade80; font-weight: 600; font-size: 14px; margin-bottom: 8px;">@${user.username}</div>
                   
                   <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                     <div style="display: flex; align-items: center; gap: 10px;">
                       <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 12px; padding: 2px 10px; border-radius: 20px;">Level ${level}</div>
                       ${levelProgress ? `<div style="font-size: 11px; color: #94a3b8;">${levelProgress.current} / ${levelProgress.next} Tasks</div>` : ''}
                     </div>
                     ${levelProgress ? `<div style="width: 100%; max-width: 250px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;" title="${levelProgress.percent.toFixed(1)}% to Level ${level + 1}">
                       <div style="width: ${levelProgress.percent}%; height: 100%; background: #facc15;"></div>
                     </div>` : ''}
                   </div>

                   <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 13px; color: #cbd5e1;">
                       <div>📧 ${user.email}</div>
                       <div>📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}</div>
                   </div>
                </div>
                <div style="display: flex; gap: 20px; align-items: flex-start;">
                    <div style="width: 110px; height: 110px; border-radius: 50%; border: 6px solid #000; overflow: hidden; background: #1a1a2e; flex-shrink: 0; z-index: 10; margin-top: -10px; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                        <img src="${user.currentAvatar || `https://api.iconify.design/lucide:user.svg?color=white`}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="background: #000; padding: 20px; border-radius: 16px; flex-grow: 1; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="font-size: 13px; color: #e2e8f0;">
                                <span style="color: #4ade80; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Country</span><br>
                                ${user.country}
                            </div>
                            <div style="font-size: 13px; color: #e2e8f0;">
                                <span style="color: #4ade80; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Bio</span><br>
                                ${user.bio || '<span style="opacity:0.5">No bio added</span>'}
                            </div>
                            <div style="font-size: 13px; color: #e2e8f0;">
                                <span style="color: #4ade80; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Website</span><br>
                                ${user.website ? `<a href="${user.website}" target="_blank" style="color:#60a5fa">${user.website}</a>` : '<span style="opacity:0.5">No website</span>'}
                            </div>
                            <div style="font-size: 13px; color: #e2e8f0;">
                                <span style="color: #4ade80; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Social</span><br>
                                ${user.social || '<span style="opacity:0.5">No social links</span>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <a href="/settings" class="btn-premium" style="background: rgba(0,0,0,0.5); display: inline-flex; width: auto; padding: 8px 24px;">Edit Profile</a>
            </div>
        </div>
      </div>
    </div>
    <div id="profileOverlay" class="modal-overlay hidden"></div>
`

// Helper to render layout
const renderLayout = (title, content, user, level, levelProgress) => `
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
        <li class="nav-item"><a href="/store"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
        <li class="nav-item"><a href="/store/my"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
        <li class="nav-item"><a href="/leaderboard"><img src="https://api.iconify.design/lucide:trophy.svg?color=%2394a3b8" class="nav-icon"> Leaderboard</a></li>
        <li class="nav-item"><a href="/topup"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up</a></li>
        <li class="nav-item"><a href="/guild"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Guild</a></li>
        <li class="nav-item"><a href="/promote"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Link</a></li>
        <li class="nav-item"><a href="/notifications" class="${title === 'Notifications' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
        <li class="nav-item"><a href="/settings"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
        <li class="nav-item"><a href="#" id="menuProfile"><img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" class="nav-icon"> Profile</a></li>
        <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
    <div class="main-content">
      <div class="container content">
         ${content}
      </div>
    </div>
  </div>
  ${getProfileModal(user, level, levelProgress)}
  <script>
    // Mobile menu toggle
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    if(menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open'); // Changed from active to open to match other files
      });
    }

    // Profile Modal Logic
    const profileBtn = document.getElementById('menuProfile');
    const profileModal = document.getElementById('profileModal');
    const profileOverlay = document.getElementById('profileOverlay');
    const profileBack = document.getElementById('profileBack');

    if(profileBtn) {
      profileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        profileModal.style.display = 'flex';
        profileOverlay.classList.remove('hidden');
      });
    }

    function closeProfile() {
      profileModal.style.display = 'none';
      profileOverlay.classList.add('hidden');
    }

    if(profileBack) profileBack.addEventListener('click', closeProfile);
    if(profileOverlay) profileOverlay.addEventListener('click', closeProfile);
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

    const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
    const level = calculateLevel(taskCount)
    const levelProgress = getLevelProgress(taskCount)

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
    res.send(renderLayout('Notifications', content, user, level, levelProgress))
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

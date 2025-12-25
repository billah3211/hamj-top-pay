const express = require('express')
const { prisma } = require('../db/prisma')
const { getUserSidebar } = require('../utils/sidebar')
const { getSystemSettings } = require('../utils/settings')
const router = express.Router()

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

const renderProfileHtml = (user, sidebar, stats, isOwnProfile) => {
  const { taskCount, pendingCount, rejectedCount, level, progress } = stats;
  
  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${user.firstName}'s Profile - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
      <style>
        .profile-container { max-width: 1000px; margin: 0 auto; }
        .cover-section {
            height: 240px;
            background: linear-gradient(135deg, #4f46e5 0%, #ec4899 100%);
            border-radius: 24px;
            position: relative;
            box-shadow: 0 20px 40px -10px rgba(99, 102, 241, 0.3);
            overflow: hidden;
        }
        .cover-pattern {
            position: absolute;
            inset: 0;
            background-image: radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px);
            background-size: 20px 20px;
            opacity: 0.6;
        }
        .profile-main {
            padding: 0 30px;
            position: relative;
            margin-top: -60px;
            display: flex;
            align-items: flex-end;
            gap: 30px;
            flex-wrap: wrap;
        }
        .avatar-wrapper {
            width: 160px;
            height: 160px;
            border-radius: 50%;
            background: #0f172a;
            padding: 6px;
            flex-shrink: 0;
            z-index: 10;
        }
        .avatar-img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            border: 4px solid #1e293b;
            background: #1e293b;
        }
        .profile-info {
            flex: 1;
            padding-bottom: 10px;
            min-width: 200px;
        }
        .user-name {
            font-size: 32px;
            font-weight: 800;
            color: white;
            line-height: 1.2;
            text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .user-handle {
            font-size: 16px;
            color: #94a3b8;
            margin-top: 4px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .role-badge {
            background: rgba(244, 63, 94, 0.1);
            color: #f43f5e;
            border: 1px solid rgba(244, 63, 94, 0.2);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        .action-btns {
            display: flex;
            gap: 12px;
            padding-bottom: 20px;
        }
        .stats-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 40px;
        }
        .stat-box {
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(255,255,255,0.05);
            padding: 24px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: all 0.3s ease;
        }
        .stat-box:hover {
            background: rgba(30, 41, 59, 0.9);
            transform: translateY(-5px);
            border-color: rgba(255,255,255,0.1);
        }
        .stat-icon {
            width: 50px;
            height: 50px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        .content-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 30px;
            margin-top: 30px;
        }
        .info-card {
            background: rgba(30, 41, 59, 0.4);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 24px;
            padding: 30px;
            height: 100%;
        }
        .card-title {
            font-size: 18px;
            font-weight: 700;
            color: white;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .info-item {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding-bottom: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            margin-bottom: 20px;
        }
        .info-item:last-child { border: none; margin: 0; padding: 0; }
        .info-label { color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
        .info-val { color: #e2e8f0; font-size: 15px; line-height: 1.5; }
        
        @media (max-width: 900px) {
            .content-layout { grid-template-columns: 1fr; }
            .profile-main { flex-direction: column; align-items: center; text-align: center; margin-top: -80px; }
            .profile-info { width: 100%; padding-bottom: 20px; }
            .user-handle { justify-content: center; }
            .action-btns { justify-content: center; width: 100%; }
        }
      </style>
    </head>
    <body>
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
      <div class="app-layout">
        ${sidebar}
        <div class="main-content">
           <div class="profile-container">
              <!-- Cover -->
              <div class="cover-section">
                 <div class="cover-pattern"></div>
                 ${isOwnProfile ? '<a href="/settings" style="position:absolute; top:20px; right:20px; background:rgba(0,0,0,0.4); color:white; padding:8px 16px; border-radius:20px; font-size:13px; text-decoration:none; backdrop-filter:blur(4px); transition:background 0.2s;">Edit Cover</a>' : ''}
              </div>

              <!-- Main Profile Header -->
              <div class="profile-main">
                 <div class="avatar-wrapper">
                    <img src="${user.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" class="avatar-img">
                 </div>
                 
                 <div class="profile-info">
                    <div class="user-name">${user.firstName} ${user.lastName}</div>
                    <div class="user-handle">
                       @${user.username}
                       ${user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? `<span class="role-badge">${user.role}</span>` : ''}
                       <span style="background:rgba(250, 204, 21, 0.1); color:#facc15; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">Level ${level}</span>
                    </div>
                 </div>

                 <div class="action-btns">
                    ${isOwnProfile 
                      ? `<a href="/settings" class="btn-premium" style="padding:10px 24px;">Edit Profile</a>` 
                      : `<button class="btn-premium" style="background:#3b82f6;">Follow</button>`
                    }
                 </div>
              </div>

              <!-- Stats Row -->
              <div class="stats-row">
                 <div class="stat-box">
                    <div class="stat-icon" style="background:rgba(16, 185, 129, 0.1); color:#34d399;">
                       <img src="https://api.iconify.design/lucide:check-circle.svg?color=%2334d399" width="24">
                    </div>
                    <div>
                       <div style="font-size:24px; font-weight:700; color:white;">${taskCount}</div>
                       <div style="font-size:13px; color:#94a3b8;">Tasks Completed</div>
                    </div>
                 </div>

                 ${isOwnProfile ? `
                 <div class="stat-box">
                    <div class="stat-icon" style="background:rgba(245, 158, 11, 0.1); color:#fbbf24;">
                       <img src="https://api.iconify.design/lucide:clock.svg?color=%23fbbf24" width="24">
                    </div>
                    <div>
                       <div style="font-size:24px; font-weight:700; color:white;">${pendingCount}</div>
                       <div style="font-size:13px; color:#94a3b8;">Pending Approval</div>
                    </div>
                 </div>
                 <div class="stat-box">
                    <div class="stat-icon" style="background:rgba(239, 68, 68, 0.1); color:#f87171;">
                       <img src="https://api.iconify.design/lucide:x-circle.svg?color=%23f87171" width="24">
                    </div>
                    <div>
                       <div style="font-size:24px; font-weight:700; color:white;">${rejectedCount}</div>
                       <div style="font-size:13px; color:#94a3b8;">Rejected Tasks</div>
                    </div>
                 </div>
                 ` : `
                 <div class="stat-box">
                    <div class="stat-icon" style="background:rgba(59, 130, 246, 0.1); color:#60a5fa;">
                       <img src="https://api.iconify.design/lucide:calendar.svg?color=%2360a5fa" width="24">
                    </div>
                    <div>
                       <div style="font-size:16px; font-weight:700; color:white;">${new Date(user.createdAt).toLocaleDateString()}</div>
                       <div style="font-size:13px; color:#94a3b8;">Joined Date</div>
                    </div>
                 </div>
                 `}
              </div>

              <!-- Content Grid -->
              <div class="content-layout">
                 <!-- About Column -->
                 <div class="info-card">
                    <div class="card-title">
                       <img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" width="20">
                       Personal Information
                    </div>
                    
                    <div class="info-item">
                       <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:10px;">
                          <img src="https://api.iconify.design/lucide:align-left.svg?color=%2394a3b8" width="20">
                       </div>
                       <div>
                          <div class="info-label">Bio</div>
                          <div class="info-val">${user.bio || '<span style="opacity:0.5; font-style:italic">No bio added</span>'}</div>
                       </div>
                    </div>

                    <div class="info-item">
                       <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:10px;">
                          <img src="https://api.iconify.design/lucide:globe.svg?color=%2394a3b8" width="20">
                       </div>
                       <div>
                          <div class="info-label">Country</div>
                          <div class="info-val" style="display:flex; align-items:center; gap:8px;">
                             <img src="https://flagcdn.com/w20/${user.country.toLowerCase()}.png" onerror="this.style.display='none'">
                             ${user.country}
                          </div>
                       </div>
                    </div>

                    ${isOwnProfile ? `
                    <div class="info-item">
                       <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:10px;">
                          <img src="https://api.iconify.design/lucide:mail.svg?color=%2394a3b8" width="20">
                       </div>
                       <div>
                          <div class="info-label">Email</div>
                          <div class="info-val">${user.email}</div>
                       </div>
                    </div>
                    ` : ''}
                 </div>

                 <!-- Socials Column -->
                 <div class="info-card">
                    <div class="card-title">
                       <img src="https://api.iconify.design/lucide:share-2.svg?color=%2394a3b8" width="20">
                       Social & Web
                    </div>

                    <div style="display:flex; flex-direction:column; gap:20px;">
                       <div>
                          <div class="info-label">Website</div>
                          <div class="info-val">
                             ${user.website ? `<a href="${user.website}" target="_blank" style="color:#60a5fa; text-decoration:none; display:flex; align-items:center; gap:6px;"><img src="https://api.iconify.design/lucide:link.svg?color=%2360a5fa" width="14"> ${user.website}</a>` : '<span style="opacity:0.5">Not provided</span>'}
                          </div>
                       </div>
                       
                       <div>
                          <div class="info-label">Social Links</div>
                          <div class="info-val" style="white-space: pre-wrap;">${user.social || '<span style="opacity:0.5">No links added</span>'}</div>
                       </div>
                    </div>
                 </div>
              </div>
              
              <div style="margin-top: 50px; text-align: center; color: var(--text-muted); font-size: 14px;">
                &copy; ${new Date().getFullYear()} HaMJ toP PaY. All rights reserved.
              </div>
           </div>
        </div>
      </div>
      <script>
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        if(menuBtn) {
          menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
        }
        document.addEventListener('click', (e) => {
          if (window.innerWidth <= 768 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) {
            sidebar.classList.remove('open');
          }
        });
      </script>
    </body>
    </html>
  `
}

router.get('/', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (!user) return res.redirect('/login')
  if (user.isBlocked) {
    req.session.destroy()
    return res.redirect('/login?error=Account+blocked')
  }

  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const pendingCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'PENDING' } })
  const rejectedCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'REJECTED' } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const level = calculateLevel(taskCount)
  const progress = getLevelProgress(taskCount)

  const settings = await getSystemSettings()
  const sidebar = getUserSidebar('profile', unreadCount, user.id, user.role, settings)

  res.send(renderProfileHtml(user, sidebar, { taskCount, pendingCount, rejectedCount, level, progress }, true))
})

router.get('/view/:id', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')

  const viewId = parseInt(req.params.id)
  if (isNaN(viewId)) return res.redirect('/')

  const currentUser = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (!currentUser) return res.redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: viewId } })
  if (!user) return res.status(404).send('User not found')

  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const level = calculateLevel(taskCount)
  
  const unreadCount = await prisma.notification.count({ where: { userId: currentUser.id, isRead: false } })
  const settings = await getSystemSettings()
  const sidebar = getUserSidebar('leaderboard', unreadCount, currentUser.id, currentUser.role, settings)

  const isOwnProfile = currentUser.id === user.id

  res.send(renderProfileHtml(user, sidebar, { taskCount, pendingCount: 0, rejectedCount: 0, level, progress: null }, isOwnProfile))
})

module.exports = router

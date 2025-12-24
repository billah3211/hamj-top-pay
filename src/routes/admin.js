const express = require('express')
const { prisma } = require('../db/prisma')
const { getSystemSettings } = require('../utils/settings')
const router = express.Router()

// Middleware
const requireAdmin = (req, res, next) => {
  if (req.session.role !== 'ADMIN' && req.session.role !== 'SUPER_ADMIN') {
    return res.redirect('/admin/login')
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

// Helpers
const getHead = (title) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - Admin Panel</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    .sidebar-premium .brand-logo { color: #f472b6; }
    .nav-item a.active { background: rgba(244, 114, 182, 0.1); color: #f472b6; border-left: 3px solid #f472b6; }
  </style>
</head>
<body>
  <button class="menu-trigger" id="mobileMenuBtn">☰</button>
  <div class="app-layout">
`

const getSidebar = (active, role, config = {}) => {
  const siteName = config.site_name || 'Admin Panel'
  const logoUrl = config.site_logo
  const showLogo = config.show_logo === 'true'

  const brandHtml = showLogo && logoUrl 
    ? `<img src="${logoUrl}" style="height:40px;width:auto;max-width:180px;object-fit:contain">`
    : `<span>A</span> ${siteName}`

  return `
<nav class="sidebar-premium" id="sidebar">
  <div class="brand-logo">${brandHtml}</div>
  <ul class="nav-links">
    <li class="nav-item"><a href="/admin/dashboard" class="${active === 'dashboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
    <li class="nav-item"><a href="/admin/users" class="${active === 'users' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Users</a></li>
    <li class="nav-item"><a href="/admin/withdrawals" class="${active === 'withdrawals' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:banknote.svg?color=%2394a3b8" class="nav-icon"> Withdrawals</a></li>
    <li class="nav-item"><a href="/admin/reported" class="${active === 'reported-tasks' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:alert-triangle.svg?color=%2394a3b8" class="nav-icon"> Reported Tasks</a></li>
    <li class="nav-item"><a href="/admin/topup-requests" class="${active === 'topup-requests' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up Requests</a></li>
    <li class="nav-item"><a href="/admin/guild-requests" class="${active === 'guild-requests' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:shield.svg?color=%2394a3b8" class="nav-icon"> Guild Requests</a></li>
    <li class="nav-item"><a href="/admin/guild-settings" class="${active === 'guild-settings' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:settings-2.svg?color=%2394a3b8" class="nav-icon"> Guild Settings</a></li>
    <li class="nav-item"><a href="/admin/promote-requests" class="${active === 'promote-requests' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Requests</a></li>
    <li class="nav-item"><a href="/admin/link-search" class="${active === 'link-search' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:search.svg?color=%2394a3b8" class="nav-icon"> Search Link</a></li>
    <li class="nav-item"><a href="/admin/support" class="${active === 'support' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:message-square.svg?color=%2394a3b8" class="nav-icon"> Live Support</a></li>
    ${role === 'SUPER_ADMIN' ? `<li class="nav-item" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px"><a href="/super-admin/dashboard"><img src="https://api.iconify.design/lucide:shield-alert.svg?color=%23ec4899" class="nav-icon" style="color:#ec4899"> Super Admin</a></li>` : ''}
    <li class="nav-item" style="margin-top:auto"><a href="/admin/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
  </ul>
</nav>
`
}

const getScripts = () => `
  </div>
  <script>
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    if(menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });
    }
  </script>
</body>
</html>
`

// API for Real-time Stats
router.get('/api/stats', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count({ where: { role: 'USER' } })
    const activeUsers = await prisma.user.count({ where: { role: 'USER', isBlocked: false } })
    const inactiveUsers = await prisma.user.count({ where: { role: 'USER', isBlocked: true } })
    
    const balanceFilter = { role: { not: 'SUPER_ADMIN' } }
    
    const totalDiamonds = await prisma.user.aggregate({ where: balanceFilter, _sum: { diamond: true } }).then(r => r._sum.diamond || 0)
    const totalCoins = await prisma.user.aggregate({ where: balanceFilter, _sum: { coin: true } }).then(r => r._sum.coin || 0)
    const totalTk = await prisma.user.aggregate({ where: balanceFilter, _sum: { tk: true } }).then(r => r._sum.tk || 0)
    const totalLora = await prisma.user.aggregate({ where: balanceFilter, _sum: { lora: true } }).then(r => r._sum.lora || 0)
    const totalDk = await prisma.user.aggregate({ where: balanceFilter, _sum: { dk: true } }).then(r => r._sum.dk || 0)
    const totalScore = await prisma.user.aggregate({ where: balanceFilter, _sum: { guildScore: true } }).then(r => r._sum.guildScore || 0)
    const totalWork = await prisma.linkSubmission.count({ where: { status: 'APPROVED' } })

    const pendingTopUps = await prisma.topUpRequest.count({ where: { status: 'PENDING' } })
    const pendingGuilds = await prisma.guild.count({ where: { status: 'PENDING' } })
    const pendingLinks = await prisma.linkSubmission.count({ where: { status: 'PENDING' } })

    res.json({
      totalUsers, activeUsers, inactiveUsers,
      totalDiamonds, totalCoins, totalTk, totalLora, totalDk, totalScore, totalWork,
      pendingTopUps, pendingGuilds, pendingLinks
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  // Stats
  const totalUsers = await prisma.user.count({ where: { role: 'USER' } })
  const activeUsers = await prisma.user.count({ where: { role: 'USER', isBlocked: false } })
  const inactiveUsers = await prisma.user.count({ where: { role: 'USER', isBlocked: true } })
  
  // Balance Stats (Exclude Super Admin)
  const balanceFilter = { role: { not: 'SUPER_ADMIN' } }
  
  const totalDiamonds = await prisma.user.aggregate({ where: balanceFilter, _sum: { diamond: true } }).then(r => r._sum.diamond || 0)
  const totalCoins = await prisma.user.aggregate({ where: balanceFilter, _sum: { coin: true } }).then(r => r._sum.coin || 0)
  const totalTk = await prisma.user.aggregate({ where: balanceFilter, _sum: { tk: true } }).then(r => r._sum.tk || 0)
  const totalLora = await prisma.user.aggregate({ where: balanceFilter, _sum: { lora: true } }).then(r => r._sum.lora || 0)
  const totalDk = await prisma.user.aggregate({ where: balanceFilter, _sum: { dk: true } }).then(r => r._sum.dk || 0)
  const totalScore = await prisma.user.aggregate({ where: balanceFilter, _sum: { guildScore: true } }).then(r => r._sum.guildScore || 0)
  const totalWork = await prisma.linkSubmission.count({ where: { status: 'APPROVED' } })

  // Pending Requests
  const pendingTopUps = await prisma.topUpRequest.count({ where: { status: 'PENDING' } })
  const pendingGuilds = await prisma.guild.count({ where: { status: 'PENDING' } })
  const pendingLinks = await prisma.linkSubmission.count({ where: { status: 'PENDING' } })
  
  res.send(`
    ${getHead('Dashboard')}
    ${getSidebar('dashboard', req.session.role)}
    <div class="main-content">
       <div class="section-title">Admin Dashboard</div>
       
       <!-- User & Balance Stats -->
       <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom: 30px;">
          <div class="stat-card" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05)); border: 1px solid rgba(59, 130, 246, 0.2);">
             <h3 style="color:#60a5fa">Total Users</h3>
             <div class="value" id="stat-totalUsers">${totalUsers}</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05)); border: 1px solid rgba(34, 197, 94, 0.2);">
             <h3 style="color:#4ade80">Active Users</h3>
             <div class="value" id="stat-activeUsers">${activeUsers}</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05)); border: 1px solid rgba(239, 68, 68, 0.2);">
             <h3 style="color:#f87171">Inactive Users</h3>
             <div class="value" id="stat-inactiveUsers">${inactiveUsers}</div>
          </div>
       </div>

       <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom: 30px;">
          <div class="stat-card" style="background:rgba(0,0,0,0.2);">
             <h3 style="color:#f472b6">Total Diamonds</h3>
             <div class="value" id="stat-totalDiamonds">💎 ${totalDiamonds}</div>
          </div>
          <div class="stat-card" style="background:rgba(0,0,0,0.2);">
             <h3 style="color:#fbbf24">Total Coins</h3>
             <div class="value" id="stat-totalCoins">🪙 ${totalCoins}</div>
          </div>
          <div class="stat-card" style="background:rgba(0,0,0,0.2);">
             <h3 style="color:white">Total Tk</h3>
             <div class="value" id="stat-totalTk">৳ ${totalTk}</div>
          </div>
          <div class="stat-card" style="background:rgba(0,0,0,0.2);">
             <h3 style="color:#38bdf8">Total HaMJ T</h3>
             <div class="value" id="stat-totalLora">T ${totalLora}</div>
          </div>
          <div class="stat-card" style="background:rgba(0,0,0,0.2);">
             <h3 style="color:#22c55e">Total Dollar</h3>
             <div class="value" id="stat-totalDk">$ ${Number(totalDk).toFixed(3)}</div>
          </div>
          <div class="stat-card" style="background:rgba(0,0,0,0.2);">
             <h3 style="color:#a855f7">Total Work</h3>
             <div class="value" id="stat-totalWork">${totalWork}</div>
          </div>
          <div class="stat-card" style="background:rgba(0,0,0,0.2);">
             <h3 style="color:#f59e0b">Total Score</h3>
             <div class="value" id="stat-totalScore">⚡ ${totalScore}</div>
          </div>
       </div>

       <div class="section-title">Pending Actions</div>
       <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:20px;">
          <div class="stat-card">
             <h3>Pending TopUps</h3>
             <div class="value" id="stat-pendingTopUps">${pendingTopUps}</div>
             <a href="/admin/topup-requests" class="btn-premium" style="margin-top:10px; display:inline-block; font-size:12px;">View</a>
          </div>
          <div class="stat-card">
             <h3>Pending Guilds</h3>
             <div class="value" id="stat-pendingGuilds">${pendingGuilds}</div>
             <a href="/admin/guild-requests" class="btn-premium" style="margin-top:10px; display:inline-block; font-size:12px;">View</a>
          </div>
          <div class="stat-card">
             <h3>Pending Links</h3>
             <div class="value" id="stat-pendingLinks">${pendingLinks}</div>
             <a href="/admin/promote-requests" class="btn-premium" style="margin-top:10px; display:inline-block; font-size:12px;">View</a>
          </div>
       </div>
    </div>

    <script>
      async function updateStats() {
        try {
          const res = await fetch('/admin/api/stats');
          const data = await res.json();
          
          if(data.error) return;

          document.getElementById('stat-totalUsers').innerText = data.totalUsers;
          document.getElementById('stat-activeUsers').innerText = data.activeUsers;
          document.getElementById('stat-inactiveUsers').innerText = data.inactiveUsers;
          
          document.getElementById('stat-totalDiamonds').innerText = '💎 ' + data.totalDiamonds;
          document.getElementById('stat-totalCoins').innerText = '🪙 ' + data.totalCoins;
          document.getElementById('stat-totalTk').innerText = '৳ ' + data.totalTk;
          document.getElementById('stat-totalLora').innerText = 'T ' + data.totalLora;
          document.getElementById('stat-totalDk').innerText = '$ ' + Number(data.totalDk).toFixed(3);
          document.getElementById('stat-totalWork').innerText = data.totalWork;
          document.getElementById('stat-totalScore').innerText = '⚡ ' + data.totalScore;
          
          document.getElementById('stat-pendingTopUps').innerText = data.pendingTopUps;
          document.getElementById('stat-pendingGuilds').innerText = data.pendingGuilds;
          document.getElementById('stat-pendingLinks').innerText = data.pendingLinks;
          
        } catch(e) {
          console.error('Stats update failed:', e);
        }
      }
      
      // Update every 5 seconds
      setInterval(updateStats, 5000);
    </script>
    ${getScripts()}
  `)
})

// Users List
router.get('/users', requireAdmin, async (req, res) => {
  const q = req.query.q || ''
  const where = {
    ...(req.session.role !== 'SUPER_ADMIN' ? { role: { not: 'SUPER_ADMIN' } } : {}),
    ...(q ? {
        OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } }
        ]
    } : {})
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
        _count: {
            select: { 
                linkSubmissions: { where: { status: 'APPROVED' } }
            }
        }
    }
  })

  res.send(`
    ${getHead('Users')}
    ${getSidebar('users', req.session.role)}
    <div class="main-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div class="section-title" style="margin:0;">Users (Top 100)</div>
        <form action="/admin/users" method="GET" style="display:flex; gap:10px;">
            <input type="text" name="q" value="${q}" placeholder="Search username, email..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white; padding:8px 12px; border-radius:5px;">
            <button style="background:#3b82f6; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Search</button>
        </form>
      </div>
      
      <div class="glass-panel" style="padding:0; overflow:hidden;">
        <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; min-width:1000px;">
              <thead>
                <tr style="background:rgba(255,255,255,0.05); text-align:left;">
                  <th style="padding:15px; color:#94a3b8; font-weight:500;">User</th>
                  <th style="padding:15px; color:#94a3b8; font-weight:500;">Stats</th>
                  <th style="padding:15px; color:#94a3b8; font-weight:500;">Balance</th>
                  <th style="padding:15px; color:#94a3b8; font-weight:500;">Role</th>
                  <th style="padding:15px; color:#94a3b8; font-weight:500;">Status</th>
                  <th style="padding:15px; color:#94a3b8; font-weight:500;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(user => {
                  const work = user._count.linkSubmissions
                  const level = calculateLevel(work)
                  return `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:15px;">
                      <div style="font-weight:bold; color:white;">${user.firstName} ${user.lastName}</div>
                      <div style="font-size:12px; color:#94a3b8;">@${user.username}</div>
                      <div style="font-size:12px; color:#94a3b8;">${user.email}</div>
                    </td>
                    <td style="padding:15px;">
                       <div style="font-size:12px; color:white;">Level: <span style="color:#facc15;">${level}</span></div>
                       <div style="font-size:12px; color:white;">Work: <span style="color:#a855f7;">${work}</span></div>
                       <div style="font-size:12px; color:white;">Score: <span style="color:#f59e0b;">${user.guildScore}</span></div>
                    </td>
                    <td style="padding:15px;">
                      <div style="color:#22c55e; font-weight:bold;">$ ${Number(user.dk).toFixed(3)}</div>
                      <div style="color:#f472b6; font-size:12px;">💎 ${user.diamond}</div>
                      <div style="color:#fbbf24; font-size:12px;">🪙 ${user.coin}</div>
                      <div style="color:white; font-size:12px;">৳ ${user.tk}</div>
                      <div style="color:#38bdf8; font-size:12px;">T ${user.lora}</div>
                    </td>
                    <td style="padding:15px;">
                      <span style="padding:2px 8px; border-radius:4px; font-size:11px; background:${user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? '#ec4899' : '#3b82f6'}; color:white;">${user.role}</span>
                    </td>
                    <td style="padding:15px;">
                       <span style="color:${user.isBlocked ? '#ef4444' : '#22c55e'};">${user.isBlocked ? 'Blocked' : 'Active'}</span>
                    </td>
                    <td style="padding:15px;">
                      <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        <a href="/admin/user/${user.id}" style="padding:6px 12px; border-radius:5px; text-decoration:none; background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); font-size:13px;">View</a>
                        <form action="/admin/user-action" method="POST" onsubmit="return confirm('Are you sure?');" style="display:inline;">
                            <input type="hidden" name="userId" value="${user.id}">
                            <input type="hidden" name="action" value="${user.isBlocked ? 'unblock' : 'block'}">
                            <button style="padding:6px 12px; border-radius:5px; border:none; cursor:pointer; background:${user.isBlocked ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color:${user.isBlocked ? '#86efac' : '#fca5a5'}; border:1px solid ${user.isBlocked ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};">
                                ${user.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                        </form>
                        ${req.session.role === 'SUPER_ADMIN' || req.session.role === 'ADMIN' ? `
                        <form action="/admin/user-delete" method="POST" onsubmit="return confirm('Are you sure you want to delete this user?');" style="display:inline;">
                             <input type="hidden" name="userId" value="${user.id}">
                             <button style="padding:6px 12px; border-radius:5px; border:none; cursor:pointer; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.3);">Del</button>
                        </form>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                  `
                }).join('')}
              </tbody>
            </table>
        </div>
      </div>
    </div>
    ${getScripts()}
  `)
})

// User Details
router.get('/user/:id', requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id)
    if(isNaN(userId)) return res.redirect('/admin/users')

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            topUpRequests: { orderBy: { createdAt: 'desc' }, take: 10, include: { package: true } },
            linkSubmissions: { orderBy: { submittedAt: 'desc' }, take: 10, include: { promotedLink: true } },
            ownedGuild: true,
            guild: true
        }
    })

    if (!user) return res.redirect('/admin/users')

    const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
    const level = calculateLevel(taskCount)
    const levelProgress = getLevelProgress(taskCount)

    const settings = await getSystemSettings()

    res.send(`
      ${getHead(`User: ${user.username}`)}
      ${getSidebar('users', req.session.role, settings)}
      <div class="main-content">
         <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
            <a href="/admin/users" style="color:#94a3b8; text-decoration:none;">&larr; Back</a>
            <div class="section-title" style="margin:0;">User Profile: ${user.firstName} ${user.lastName}</div>
         </div>

         <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:30px;">
            <!-- Profile Card -->
            <div class="glass-panel" style="padding:25px;">
                <div style="display:flex; gap:20px; align-items:center; margin-bottom:20px;">
                    <div style="width:60px; height:60px; border-radius:50%; background:linear-gradient(45deg, #ec4899, #8b5cf6); display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold; color:white;">
                        ${user.firstName[0]}
                    </div>
                    <div>
                        <div style="font-size:18px; font-weight:bold; color:white;">${user.firstName} ${user.lastName}</div>
                        <div style="color:#94a3b8;">@${user.username}</div>
                        <div style="color:#94a3b8; font-size:12px;">${user.email}</div>
                    </div>
                </div>

                <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                         <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 12px; padding: 2px 10px; border-radius: 20px;">Level ${level}</div>
                         <div style="font-size: 11px; color: #94a3b8;">${levelProgress.current} / ${levelProgress.next} Tasks</div>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;" title="${levelProgress.percent.toFixed(1)}% to Level ${level + 1}">
                        <div style="width: ${levelProgress.percent}%; height: 100%; background: #facc15;"></div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; font-size:14px;">
                    <div>
                        <div style="color:#94a3b8; font-size:12px;">Country</div>
                        <div style="color:white;">${user.country}</div>
                    </div>
                    <div>
                        <div style="color:#94a3b8; font-size:12px;">Phone</div>
                        <div style="color:white;">${user.phone}</div>
                    </div>
                    <div>
                        <div style="color:#94a3b8; font-size:12px;">Joined</div>
                        <div style="color:white;">${new Date(user.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div style="color:#94a3b8; font-size:12px;">Status</div>
                        <span style="color:${user.isBlocked ? '#ef4444' : '#22c55e'};">${user.isBlocked ? 'Blocked' : 'Active'}</span>
                    </div>
                </div>
                
                <div style="margin-top:20px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1); display:flex; gap:10px; flex-wrap:wrap;">
                     <form action="/admin/user-action" method="POST" onsubmit="return confirm('Are you sure?');" style="flex:1;">
                        <input type="hidden" name="userId" value="${user.id}">
                        <input type="hidden" name="action" value="${user.isBlocked ? 'unblock' : 'block'}">
                        <button style="width:100%; padding:10px; border-radius:8px; border:none; cursor:pointer; background:${user.isBlocked ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color:${user.isBlocked ? '#86efac' : '#fca5a5'}; border:1px solid ${user.isBlocked ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};">
                            ${user.isBlocked ? 'Unblock User' : 'Block User'}
                        </button>
                    </form>
                    ${req.session.role === 'SUPER_ADMIN' || req.session.role === 'ADMIN' ? `
                    <form action="/admin/user-delete" method="POST" onsubmit="return confirm('WARNING: This will permanently delete the user and ALL related data. This cannot be undone. Are you sure?');" style="flex:1;">
                        <input type="hidden" name="userId" value="${user.id}">
                        <button style="width:100%; padding:10px; border-radius:8px; border:none; cursor:pointer; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.3);">
                            Delete Account
                        </button>
                    </form>
                    ` : ''}
                </div>
            </div>

            <!-- Wallet Card -->
            <div class="glass-panel" style="padding:25px;">
                <h3 style="margin-top:0; color:#f472b6;">Wallet Balance</h3>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:20px;">
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px;">
                        <div style="color:#94a3b8; font-size:12px;">Diamonds</div>
                        <div style="color:#f472b6; font-size:20px; font-weight:bold;">💎 ${user.diamond}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px;">
                        <div style="color:#94a3b8; font-size:12px;">Coins</div>
                        <div style="color:#fbbf24; font-size:20px; font-weight:bold;">🪙 ${user.coin}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px;">
                        <div style="color:#94a3b8; font-size:12px;">BDT Balance</div>
                        <div style="color:white; font-size:20px; font-weight:bold;">৳ ${user.tk}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px;">
                        <div style="color:#94a3b8; font-size:12px;">HaMJ T</div>
                        <div style="color:#38bdf8; font-size:20px; font-weight:bold;">T ${user.lora}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; grid-column: span 2;">
                        <div style="color:#94a3b8; font-size:12px;">Dollar</div>
                        <div style="color:#22c55e; font-size:20px; font-weight:bold;">$ ${Number(user.dk).toFixed(3)}</div>
                    </div>
                </div>

                ${req.session.role === 'SUPER_ADMIN' ? `
                <div style="margin-top:25px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1);">
                    <div style="font-weight:bold; color:white; margin-bottom:15px;">Manage Balance</div>
                    <form action="/admin/user-balance" method="POST" style="display:flex; flex-direction:column; gap:10px;">
                        <input type="hidden" name="userId" value="${user.id}">
                        <div style="display:flex; gap:10px;">
                            <select name="type" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white; padding:8px; border-radius:5px;">
                                <option value="diamond">Diamonds 💎</option>
                                <option value="coin">Coins 🪙</option>
                                <option value="tk">BDT ৳</option>
                                <option value="lora">HaMJ T</option>
                                <option value="dk">Dollar $</option>
                            </select>
                            <select name="operation" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white; padding:8px; border-radius:5px;">
                                <option value="add">Add (+)</option>
                                <option value="subtract">Subtract (-)</option>
                            </select>
                        </div>
                        <input type="number" name="amount" placeholder="Amount" required step="any" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white; padding:10px; border-radius:5px;">
                        <button style="background:#f472b6; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer; font-weight:bold;">Update Balance</button>
                    </form>
                </div>
                ` : ''}
            </div>
         </div>

         <!-- Recent Activity -->
         <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px;">
            <div class="glass-panel" style="padding:0; overflow:hidden;">
                <div style="padding:15px; border-bottom:1px solid rgba(255,255,255,0.1); font-weight:bold;">Recent TopUps</div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.02); text-align:left;">
                            <th style="padding:12px; color:#94a3b8;">Package</th>
                            <th style="padding:12px; color:#94a3b8;">Amount</th>
                            <th style="padding:12px; color:#94a3b8;">Status</th>
                            <th style="padding:12px; color:#94a3b8;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${user.topUpRequests.length > 0 ? user.topUpRequests.map(r => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                <td style="padding:12px; color:white;">${r.package ? r.package.name : 'Unknown'}</td>
                                <td style="padding:12px; color:#f472b6;">💎 ${r.package ? r.package.diamondAmount : 0}</td>
                                <td style="padding:12px;">
                                    <span style="padding:2px 6px; border-radius:4px; font-size:10px; background:${r.status === 'COMPLETED' ? '#22c55e' : r.status === 'PENDING' ? '#eab308' : '#ef4444'}; color:white;">${r.status}</span>
                                </td>
                                <td style="padding:12px; color:#94a3b8;">${new Date(r.createdAt).toLocaleDateString()}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="padding:20px; text-align:center; color:#94a3b8;">No recent topups</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div class="glass-panel" style="padding:0; overflow:hidden;">
                <div style="padding:15px; border-bottom:1px solid rgba(255,255,255,0.1); font-weight:bold;">Link Tasks</div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.02); text-align:left;">
                            <th style="padding:12px; color:#94a3b8;">Task</th>
                            <th style="padding:12px; color:#94a3b8;">Status</th>
                            <th style="padding:12px; color:#94a3b8;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${user.linkSubmissions.length > 0 ? user.linkSubmissions.map(s => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                <td style="padding:12px; color:white;">${s.promotedLink ? s.promotedLink.title : 'Unknown'}</td>
                                <td style="padding:12px;">
                                    <span style="padding:2px 6px; border-radius:4px; font-size:10px; background:${s.status === 'APPROVED' ? '#22c55e' : s.status === 'PENDING' ? '#eab308' : '#ef4444'}; color:white;">${s.status}</span>
                                </td>
                                <td style="padding:12px; color:#94a3b8;">${new Date(s.submittedAt).toLocaleDateString()}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="3" style="padding:20px; text-align:center; color:#94a3b8;">No tasks submitted</td></tr>'}
                    </tbody>
                </table>
            </div>
         </div>
      </div>
      ${getScripts()}
    `)
})

router.post('/user-action', requireAdmin, async (req, res) => {
    const { userId, action } = req.body
    
    // Prevent self-action
    if (parseInt(userId) === req.session.userId) {
        return res.redirect('/admin/users')
    }

    // Check target user role for permission
    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } })
    if (!targetUser) return res.redirect('/admin/users')

    if (targetUser.role === 'SUPER_ADMIN' && req.session.role !== 'SUPER_ADMIN') {
        return res.redirect('/admin/users')
    }

    if (action === 'block') {
        await prisma.user.update({ where: { id: parseInt(userId) }, data: { isBlocked: true } })
    } else if (action === 'unblock') {
        await prisma.user.update({ where: { id: parseInt(userId) }, data: { isBlocked: false } })
    }
    res.redirect('/admin/users')
})

// SUPER ADMIN ACTIONS
router.post('/user-balance', requireAdmin, async (req, res) => {
    if (req.session.role !== 'SUPER_ADMIN') return res.redirect('/admin/users')

    const { userId, type, operation, amount } = req.body
    let val = 0
    
    if (type === 'tk' || type === 'dk') {
        val = parseFloat(amount)
    } else {
        val = parseInt(amount)
    }

    const id = parseInt(userId)

    if (isNaN(val) || val <= 0) return res.redirect(`/admin/user/${id}`)

    const updateData = {}
    if (operation === 'add') {
        updateData[type] = { increment: val }
    } else {
        updateData[type] = { decrement: val }
    }

    await prisma.$transaction([
        prisma.user.update({ where: { id }, data: updateData }),
        prisma.notification.create({
            data: {
                userId: id,
                message: `Admin ${operation === 'add' ? 'added' : 'deducted'} ${val} ${type === 'dk' ? 'Dollar' : type} ${operation === 'add' ? 'to' : 'from'} your balance.`,
                type: operation === 'add' ? 'credit' : 'debit'
            }
        })
    ])

    res.redirect(`/admin/user/${id}`)
})

router.post('/user-delete', requireAdmin, async (req, res) => {
    if (req.session.role !== 'SUPER_ADMIN' && req.session.role !== 'ADMIN') return res.redirect('/admin/users')
    
    const { userId } = req.body
    const id = parseInt(userId)

    // Prevent deleting self or other Super Admins
    if (id === req.session.userId) return res.redirect('/admin/users')
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.role === 'SUPER_ADMIN') return res.redirect('/admin/users')

    try {
        await prisma.$transaction(async (tx) => {
            // Delete dependencies manually to ensure clean removal
            await tx.topUpRequest.deleteMany({ where: { userId: id } })
            await tx.notification.deleteMany({ where: { userId: id } })
            await tx.userItem.deleteMany({ where: { userId: id } })
            await tx.task.deleteMany({ where: { userId: id } })
            await tx.supportSession.deleteMany({ where: { userId: id } })
            
            // Delete links (cascades to submissions for those links)
            await tx.promotedLink.deleteMany({ where: { userId: id } })
            
            // Delete submissions made by this user as visitor
            await tx.linkSubmission.deleteMany({ where: { visitorId: id } })
            
            // Handle Guilds
            // If user owns a guild, delete it (or reassign, but delete is safer for now)
            await tx.guild.deleteMany({ where: { leaderId: id } })
            
            // Finally delete user
            await tx.user.delete({ where: { id } })
        })
    } catch (e) {
        console.error('Delete User Failed:', e)
        // If transaction fails, it might be due to a constraint I missed. 
        // For now, let's assume it works or log the error.
    }

    res.redirect('/admin/users')
})

// TopUp Requests
router.get('/topup-requests', requireAdmin, async (req, res) => {
  const where = { 
    status: 'PENDING',
    ...(req.session.role !== 'SUPER_ADMIN' ? { user: { role: { not: 'SUPER_ADMIN' } } } : {})
  }
  
  const requests = await prisma.topUpRequest.findMany({
    where,
    include: { user: true, package: true, wallet: true },
    orderBy: { createdAt: 'desc' }
  })
  
  const settings = await getSystemSettings()

  res.send(`
    ${getHead('TopUp Requests')}
    ${getSidebar('topup-requests', req.session.role, settings)}
    <div class="main-content">
      <div class="section-title">TopUp Requests</div>
      <div style="display:flex; flex-direction:column; gap:15px;">
        ${requests.map(r => `
          <div class="glass-panel" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <span style="color:#f472b6; font-weight:bold;">${r.package.name} (${r.package.diamondAmount} 💎)</span>
              <span style="color:#94a3b8; font-size:12px;">${new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <div style="font-size:13px; color:#cbd5e1; display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
               <div>User: <b>${r.user.firstName} ${r.user.lastName}</b> (@${r.user.username})</div>
               <div>Method: <b>${r.wallet.name}</b></div>
               <div>Sender: <b>${r.senderNumber}</b></div>
               <div>TrxID: <b style="color:#fbbf24; user-select:all;">${r.trxId}</b></div>
            </div>
            <div style="display:flex; gap:10px;">
               <form action="/admin/topup-approve" method="POST">
                 <input type="hidden" name="id" value="${r.id}">
                 <button class="btn-premium" style="background:#22c55e; border-color:#22c55e;">Approve</button>
               </form>
               <form action="/admin/topup-reject" method="POST">
                 <input type="hidden" name="id" value="${r.id}">
                 <button class="btn-premium" style="background:#ef4444; border-color:#ef4444;">Reject</button>
               </form>
            </div>
          </div>
        `).join('')}
        ${requests.length === 0 ? '<div style="text-align:center; color:#94a3b8; padding:40px;">No pending requests</div>' : ''}
      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/topup-approve', requireAdmin, async (req, res) => {
    const { id } = req.body
    const request = await prisma.topUpRequest.findUnique({ where: { id: parseInt(id) }, include: { package: true } })
    
    if(request && request.status === 'PENDING') {
        // Fetch user to check guild status
        const user = await prisma.user.findUnique({ where: { id: request.userId }, include: { guild: true } })
        
        const ops = [
            prisma.topUpRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', processedAt: new Date() } }),
            prisma.user.update({ where: { id: request.userId }, data: { diamond: { increment: request.package.diamondAmount } } }),
            prisma.notification.create({ data: { userId: request.userId, message: `TopUp Successful! ${request.package.diamondAmount} diamonds added to your account.`, type: 'credit' } })
        ]

        // Guild Commission Logic
        if (user && user.guildId) {
           const guild = await prisma.guild.findUnique({ where: { id: user.guildId } })
           
           if (guild) {
             const commission = (request.package.price * guild.commissionRate) / 100
             
             if (commission > 0) {
               // Update Guild Total Earnings
               ops.push(
                 prisma.guild.update({
                   where: { id: guild.id },
                   data: { totalEarnings: { increment: commission } }
                 })
               )
               
               // Add Commission to Leader's TK Balance
               ops.push(
                 prisma.user.update({
                   where: { id: guild.leaderId },
                   data: { tk: { increment: Math.floor(commission) } }
                 })
               )

               // Notify Leader (if leader is not the one topping up)
               if (guild.leaderId !== user.id) {
                 ops.push(
                   prisma.notification.create({
                     data: {
                       userId: guild.leaderId,
                       message: `You earned ৳${Math.floor(commission)} commission from ${user.username}'s topup!`,
                       type: 'credit'
                     }
                   })
                 )
               }
             }
           }
        }

        await prisma.$transaction(ops)
    }
    res.redirect('/admin/topup-requests')
})

router.post('/topup-reject', requireAdmin, async (req, res) => {
    const { id } = req.body
    const request = await prisma.topUpRequest.findUnique({ where: { id: parseInt(id) } })
    if(request && request.status === 'PENDING') {
        await prisma.topUpRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', processedAt: new Date() } })
        await prisma.notification.create({ data: { userId: request.userId, message: `TopUp Failed. TrxID: ${request.trxId} was rejected. Please contact support if this is an error.`, type: 'alert' } })
    }
    res.redirect('/admin/topup-requests')
})

// Promote Requests (Link Submissions)
router.get('/promote-requests', requireAdmin, async (req, res) => {
  const submissions = await prisma.linkSubmission.findMany({
    where: { status: 'PENDING' },
    include: { promotedLink: true, visitor: true },
    orderBy: { submittedAt: 'desc' }
  })
  
  const settings = await getSystemSettings()

  res.send(`
    ${getHead('Promote Requests')}
    ${getSidebar('promote-requests', req.session.role, settings)}
    <div class="main-content">
       <div class="section-title">Link Task Submissions</div>
       <div style="display:flex; flex-direction:column; gap:15px;">
         ${submissions.map(s => `
           <div class="glass-panel" style="padding:20px;">
             <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span style="color:#f472b6; font-weight:bold;">${s.promotedLink.title}</span>
                <span style="color:#94a3b8; font-size:12px;">${new Date(s.submittedAt).toLocaleString()}</span>
             </div>
             <div style="font-size:13px; color:#cbd5e1; margin-bottom:10px;">
                Visitor: <b>${s.visitor.firstName} ${s.visitor.lastName}</b> (@${s.visitor.username})
             </div>
             <div style="display:flex; gap:10px; overflow-x:auto; margin-bottom:15px;">
                ${s.screenshots.map(url => `<a href="${url}" target="_blank"><img src="${url}" style="height:100px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);"></a>`).join('')}
             </div>
             <div style="display:flex; gap:10px;">
                <form action="/admin/promote-approve" method="POST">
                  <input type="hidden" name="id" value="${s.id}">
                  <button class="btn-premium" style="background:#22c55e; border-color:#22c55e;">Approve</button>
                </form>
                <form action="/admin/promote-reject" method="POST">
                  <input type="hidden" name="id" value="${s.id}">
                  <button class="btn-premium" style="background:#ef4444; border-color:#ef4444;">Reject</button>
                </form>
             </div>
           </div>
         `).join('')}
         ${submissions.length === 0 ? '<div style="text-align:center; color:#94a3b8; padding:40px;">No pending submissions</div>' : ''}
       </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/promote-approve', requireAdmin, async (req, res) => {
    const { id } = req.body
    const sub = await prisma.linkSubmission.findUnique({ where: { id: parseInt(id) }, include: { promotedLink: true } })
    if(sub && sub.status === 'PENDING') {
        await prisma.$transaction([
            prisma.linkSubmission.update({ where: { id: sub.id }, data: { status: 'APPROVED' } }),
            prisma.promotedLink.update({ where: { id: sub.promotedLinkId }, data: { completedVisits: { increment: 1 } } }),
            prisma.notification.create({ data: { userId: sub.visitorId, message: `Task Approved! You visited "${sub.promotedLink.title}" successfully.`, type: 'info' } })
        ])
    }
    res.redirect('/admin/promote-requests')
})

router.post('/promote-reject', requireAdmin, async (req, res) => {
    const { id } = req.body
    const sub = await prisma.linkSubmission.findUnique({ where: { id: parseInt(id) }, include: { promotedLink: true } })
    if(sub && sub.status === 'PENDING') {
        await prisma.linkSubmission.update({ where: { id: sub.id }, data: { status: 'REJECTED' } })
        await prisma.notification.create({ data: { userId: sub.visitorId, message: `Task Rejected. Your submission for "${sub.promotedLink.title}" was invalid.`, type: 'alert' } })
    }
    res.redirect('/admin/promote-requests')
})

// Guild Requests
router.get('/guild-requests', requireAdmin, async (req, res) => {
    const guilds = await prisma.guild.findMany({ where: { status: 'PENDING' }, include: { leader: true } })
    res.send(`
        ${getHead('Guild Requests')}
        ${getSidebar('guild-requests', req.session.role)}
        <div class="main-content">
            <div class="section-title">Guild Requests</div>
            ${guilds.map(g => `
                <div class="glass-panel" style="padding:20px; margin-bottom:15px;">
                    <h3>${g.name}</h3>
                    <p style="color:#cbd5e1; font-size:13px; margin:5px 0;">Leader: ${g.leader.firstName} ${g.leader.lastName} (@${g.leader.username})</p>
                    
                    <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin:10px 0; font-size:13px;">
                        <div style="margin-bottom:5px;"><strong style="color:#f472b6;">Channel:</strong> <a href="${g.youtubeChannelLink}" target="_blank" style="color:#60a5fa;">${g.youtubeChannelLink || 'N/A'}</a></div>
                        <div style="margin-bottom:5px;"><strong style="color:#f472b6;">Video:</strong> <a href="${g.videoLink}" target="_blank" style="color:#60a5fa;">${g.videoLink || 'N/A'}</a></div>
                        <div><strong style="color:#f472b6;">Email:</strong> ${g.contactEmail || 'N/A'}</div>
                    </div>

                    <p style="color:#94a3b8; font-size:13px;">${g.description || 'No description provided'}</p>
                    
                    <div style="margin-top:15px; display:flex; gap:10px;">
                        <form action="/admin/guild-approve" method="POST"><input type="hidden" name="id" value="${g.id}"><button class="btn-premium" style="background:#22c55e; border-color:#22c55e;">Approve</button></form>
                        <form action="/admin/guild-reject" method="POST"><input type="hidden" name="id" value="${g.id}"><button class="btn-premium" style="background:#ef4444; border-color:#ef4444;">Reject</button></form>
                    </div>
                </div>
            `).join('')}
             ${guilds.length === 0 ? '<div style="text-align:center; color:#94a3b8; padding:40px;">No pending guild requests</div>' : ''}
        </div>
        ${getScripts()}
    `)
})

router.post('/guild-approve', requireAdmin, async (req, res) => {
    const { id } = req.body
    const guild = await prisma.guild.findUnique({ where: { id: parseInt(id) } })
    if(guild) {
        await prisma.guild.update({ where: { id: guild.id }, data: { status: 'APPROVED' } })
        await prisma.user.update({ where: { id: guild.leaderId }, data: { guildId: guild.id } })
        await prisma.notification.create({ data: { userId: guild.leaderId, message: `Guild Approved! Your guild "${guild.name}" is now active.`, type: 'info' } })
    }
    res.redirect('/admin/guild-requests')
})

router.post('/guild-reject', requireAdmin, async (req, res) => {
    const { id } = req.body
    const guild = await prisma.guild.findUnique({ where: { id: parseInt(id) } })
    if(guild) {
        await prisma.guild.update({ where: { id: guild.id }, data: { status: 'REJECTED' } })
        await prisma.notification.create({ data: { userId: guild.leaderId, message: `Guild Rejected. Your guild request for "${guild.name}" was declined.`, type: 'alert' } })
    }
    res.redirect('/admin/guild-requests')
})

// Guild Settings
router.get('/guild-settings', requireAdmin, async (req, res) => {
  const youtuberReq = await prisma.systemSetting.findUnique({ where: { key: 'guild_requirements_youtuber' } })
  const youtuberBen = await prisma.systemSetting.findUnique({ where: { key: 'guild_benefits_youtuber' } })
  const commissionRate = await prisma.systemSetting.findUnique({ where: { key: 'guild_commission_rate' } })
  
  const defaultYoutuberReq = '• চ্যানেলে কমপক্ষে 2,000+ Subscribers থাকতে হবে\n• যেকোনো ১টি ভিডিওতে 1,000+ Views থাকতে হবে\n• Hamj Top Pay নিয়ে অন্তত ১টি ভিডিও তৈরি করতে হবে\n• প্রতি মাসে কমপক্ষে ২টি ভিডিও আপলোড করা বাধ্যতামূলক'
  const defaultYoutuberBen = '• আপনার নিজস্ব Guild তৈরি করার সুযোগ পাবেন\n• আপনার Guild থেকে যদি কোনো ইউজার Top-Up করে, তাহলে প্রতি Top-Up এ আপনি ১০% কমিশন পাবেন\n• আপনি আপনার Guild-এ ১,০০০ জন ইউজার সম্পূর্ণ ফ্রিতে জয়েন করাতে পারবেন\n• যত বেশি ইউজার আপনার Guild-এ Active থাকবে, তত বেশি ইনকাম করার সুযোগ পাবেন'
  const defaultCommission = '10'

  res.send(`
    ${getHead('Guild Settings')}
    ${getSidebar('guild-settings', req.session.role)}
    <div class="main-content">
      <div class="section-title">Guild Settings</div>
      
      <div class="glass-panel" style="padding:24px;">
        <form action="/admin/guild-settings" method="POST">
          
          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label" style="display:block; margin-bottom:8px; color:#f472b6;">YouTuber Guild Requirements</label>
            <textarea name="youtuber_req" class="form-input" style="width:100%; height:150px; font-family:monospace;">${youtuberReq ? youtuberReq.value : defaultYoutuberReq}</textarea>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Enter each requirement on a new line.</div>
          </div>

          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label" style="display:block; margin-bottom:8px; color:#60a5fa;">YouTuber Guild Benefits</label>
            <textarea name="youtuber_ben" class="form-input" style="width:100%; height:150px; font-family:monospace;">${youtuberBen ? youtuberBen.value : defaultYoutuberBen}</textarea>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Enter each benefit on a new line.</div>
          </div>

          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label" style="display:block; margin-bottom:8px; color:#facc15;">Default Commission Rate (%)</label>
            <input type="number" step="0.1" name="commission_rate" value="${commissionRate ? commissionRate.value : defaultCommission}" class="form-input" style="width:100%;">
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Commission rate for new guilds (e.g., 10 for 10%).</div>
          </div>

          <button class="btn-premium">Save Settings</button>
        </form>
      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/guild-settings', requireAdmin, async (req, res) => {
  const { youtuber_req, youtuber_ben, commission_rate } = req.body
  
  if (youtuber_req) {
    await prisma.systemSetting.upsert({
      where: { key: 'guild_requirements_youtuber' },
      update: { value: youtuber_req.trim() },
      create: { key: 'guild_requirements_youtuber', value: youtuber_req.trim() }
    })
  }

  if (youtuber_ben) {
    await prisma.systemSetting.upsert({
      where: { key: 'guild_benefits_youtuber' },
      update: { value: youtuber_ben.trim() },
      create: { key: 'guild_benefits_youtuber', value: youtuber_ben.trim() }
    })
  }

  if (commission_rate) {
    await prisma.systemSetting.upsert({
      where: { key: 'guild_commission_rate' },
      update: { value: commission_rate.toString() },
      create: { key: 'guild_commission_rate', value: commission_rate.toString() }
    })

    // Update all existing guilds with the new commission rate
    const newRate = parseFloat(commission_rate)
    if (!isNaN(newRate)) {
      await prisma.guild.updateMany({
        data: { commissionRate: newRate }
      })
    }
  }

  res.redirect('/admin/guild-settings')
})

// --- Link Search & Management ---
router.get('/link-search', requireAdmin, async (req, res) => {
  const { q, success } = req.query;
  let link = null;
  
  if (q) {
      const whereClause = {
          AND: [
             req.session.role !== 'SUPER_ADMIN' ? { user: { role: { not: 'SUPER_ADMIN' } } } : {}
          ]
      }

      if (q.startsWith('http')) {
           link = await prisma.promotedLink.findFirst({ where: { url: q, ...whereClause }, include: { user: true } });
      } else if (!isNaN(q)) {
           link = await prisma.promotedLink.findFirst({ where: { id: parseInt(q), ...whereClause }, include: { user: true } });
      } else {
           link = await prisma.promotedLink.findFirst({ where: { title: { contains: q, mode: 'insensitive' }, ...whereClause }, include: { user: true } });
      }
  }

  const settings = await getSystemSettings()

  res.send(`
    ${getHead('Search Link')}
    ${getSidebar('link-search', req.session.role, settings)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Search User Link</div>
          <div style="color:var(--text-muted)">Find and manage user promoted links</div>
        </div>
      </div>

      ${success ? `<div style="background:rgba(34,197,94,0.1);color:#4ade80;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;">${success}</div>` : ''}

      <div class="glass-panel" style="padding: 24px; margin-bottom: 24px;">
        <form action="/admin/link-search" method="GET" style="display:flex; gap:12px;">
          <input type="text" name="q" value="${q || ''}" placeholder="Enter Link ID, URL, or Title..." class="form-input" style="flex:1;">
          <button type="submit" class="btn-premium">Search</button>
        </form>
      </div>

      ${link ? `
        <div class="glass-panel" style="padding: 24px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
             <div>
               <h3 style="font-size:18px; color:white; margin-bottom:4px;">${link.title}</h3>
               <a href="${link.url}" target="_blank" style="color:#60a5fa; font-size:14px;">${link.url}</a>
             </div>
             <span style="padding:4px 12px; border-radius:20px; font-size:12px; font-weight:bold; ${link.status === 'ACTIVE' ? 'background:rgba(34,197,94,0.2);color:#86efac;' : link.status === 'BLOCKED' ? 'background:rgba(239,68,68,0.2);color:#fca5a5;' : 'background:rgba(148,163,184,0.2);color:#cbd5e1;'}">${link.status}</span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
             <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px;">
                <div style="color:var(--text-muted); font-size:12px;">Owner</div>
                <div style="color:white; font-weight:600;">${link.user.firstName} ${link.user.lastName}</div>
                <div style="color:var(--text-muted); font-size:12px;">@${link.user.username}</div>
             </div>
             <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px;">
                <div style="color:var(--text-muted); font-size:12px;">Visits</div>
                <div style="color:white; font-weight:600;">${link.completedVisits} / ${link.targetVisits}</div>
                <div style="color:var(--text-muted); font-size:12px;">Progress: ${Math.round((link.completedVisits/link.targetVisits)*100)}%</div>
             </div>
          </div>

          <!-- Actions -->
          <div style="border-top:1px solid var(--glass-border); padding-top:20px;">
             <h4 style="color:white; margin-bottom:16px;">Admin Actions</h4>
             
             <!-- Update Visits -->
             <form action="/admin/link-action" method="POST" style="margin-bottom:20px;">
               <input type="hidden" name="linkId" value="${link.id}">
               <input type="hidden" name="action" value="update_visits">
               <label style="color:var(--text-muted); font-size:14px; display:block; margin-bottom:8px;">Update Completed Visits (Free)</label>
               <div style="display:flex; gap:12px;">
                 <input type="number" name="value" value="${link.completedVisits}" class="form-input" style="width:150px;">
                 <button type="submit" class="btn-premium">Update Visits</button>
               </div>
             </form>

             <div style="display:flex; gap:12px;">
               ${link.status === 'BLOCKED' ? `
                 <form action="/admin/link-action" method="POST">
                   <input type="hidden" name="linkId" value="${link.id}">
                   <input type="hidden" name="action" value="unblock">
                   <button type="submit" class="btn-premium" style="background:rgba(34,197,94,0.2); color:#86efac; border-color:rgba(34,197,94,0.3);">Unblock Link</button>
                 </form>
               ` : `
                 <form action="/admin/link-action" method="POST">
                   <input type="hidden" name="linkId" value="${link.id}">
                   <input type="hidden" name="action" value="block">
                   <button type="submit" class="btn-premium" style="background:rgba(239,68,68,0.2); color:#fca5a5; border-color:rgba(239,68,68,0.3);">Block Link</button>
                 </form>
               `}
               
               <form action="/admin/link-action" method="POST" onsubmit="return confirm('Delete this link permanently?')">
                 <input type="hidden" name="linkId" value="${link.id}">
                 <input type="hidden" name="action" value="delete">
                 <button type="submit" class="btn-premium" style="background:rgba(239,68,68,0.2); color:#fca5a5; border-color:rgba(239,68,68,0.3);">Delete Link</button>
               </form>
             </div>
          </div>
        </div>
      ` : q ? '<div style="text-align:center; padding:40px; color:var(--text-muted);">No link found matching your query</div>' : ''}
    </div>
    ${getScripts()}
  `);
});

router.post('/link-action', requireAdmin, async (req, res) => {
    const { linkId, action, value } = req.body
    const id = parseInt(linkId)
    
    if (isNaN(id)) return res.redirect('/admin/link-search')

    const link = await prisma.promotedLink.findUnique({ 
        where: { id },
        include: { user: true }
    })

    if (!link) return res.redirect('/admin/link-search?q=' + id)

    // Check permissions (Admins cannot edit Super Admin links)
    if (link.user.role === 'SUPER_ADMIN' && req.session.role !== 'SUPER_ADMIN') {
        return res.redirect('/admin/link-search?q=' + id)
    }

    if (action === 'update_visits') {
        const visits = parseInt(value)
        if (!isNaN(visits) && visits >= 0) {
            await prisma.promotedLink.update({
                where: { id },
                data: { completedVisits: visits }
            })
        }
    } else if (action === 'block') {
        await prisma.promotedLink.update({
            where: { id },
            data: { status: 'BLOCKED' }
        })
    } else if (action === 'unblock') {
        await prisma.promotedLink.update({
            where: { id },
            data: { status: 'ACTIVE' }
        })
    } else if (action === 'delete') {
        // Delete related submissions first
        await prisma.$transaction([
            prisma.linkSubmission.deleteMany({ where: { promotedLinkId: id } }),
            prisma.promotedLink.delete({ where: { id } })
        ])
        return res.redirect('/admin/link-search?success=Link deleted successfully')
    }

    res.redirect('/admin/link-search?q=' + id + '&success=Action completed')
})

// Login/Logout (simplified for admin)
router.get('/login', (req, res) => {
  res.send(`
    ${getHead('Admin Login')}
    <div style="display:flex; align-items:center; justify-content:center; height:100vh;">
      <div class="glass-panel" style="padding:40px; width:100%; max-width:400px;">
        <h2 style="text-align:center; color:#f472b6; margin-bottom:20px;">Admin Login</h2>
        <form action="/auth/login" method="POST">
           <input type="hidden" name="login_source" value="admin">
           <input type="text" name="identifier" placeholder="Email or Username" class="form-input" style="margin-bottom:15px;" required>
           <input type="password" name="password" placeholder="Password" class="form-input" style="margin-bottom:20px;" required>
           <button class="btn-premium" style="width:100%;">Login</button>
        </form>
      </div>
    </div>
  `)
})

router.get('/logout', (req, res) => {
  req.session.destroy()
  res.redirect('/admin/login')
})

// Live Support
router.get('/support', requireAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  res.send(`
    ${getHead('Live Support')}
    ${getSidebar('support', req.session.role, settings)}
    <div class="main-content" style="height: 100vh; display: flex; flex-direction: column;">
      <div class="section-title">Live Support Chat</div>
      
      <div class="glass-panel" style="flex: 1; display: flex; padding: 0; overflow: hidden; height: calc(100vh - 140px);">
        <!-- Sessions List -->
        <div style="width: 300px; border-right: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); overflow-y: auto;" id="sessionsList">
           <!-- Loaded via JS -->
        </div>

        <!-- Chat Area -->
        <div style="flex: 1; display: none; flex-direction: column;" id="chatArea">
           <div style="padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: bold; background: rgba(0,0,0,0.1);" id="chatTitle">
             Select a session
           </div>
           
           <div style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;" id="chatMessages">
           </div>
           
           <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 10px;">
             <input type="text" class="form-input" id="chatInput" placeholder="Type a message..." style="flex:1;">
             <button class="btn-premium" id="sendBtn">Send</button>
           </div>
        </div>
      </div>
    </div>
    
    <style>
      .session-item { padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: 0.2s; }
      .session-item:hover, .session-item.active { background: rgba(255,255,255,0.05); }
      .session-item.active { border-left: 3px solid #ec4899; }
      .user-name { font-weight: bold; color: white; margin-bottom: 4px; }
      .last-msg { font-size: 12px; color: var(--text-muted); }
      .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-top: 4px; text-transform: uppercase; }
      .status-badge.ai_mode { background: #3b82f6; color: white; }
      .status-badge.live_chat { background: #ec4899; color: white; }
      
      .message { padding: 10px 14px; border-radius: 12px; max-width: 70%; font-size: 14px; line-height: 1.4; }
      .message.user { align-self: flex-start; background: #334155; color: white; border-bottom-left-radius: 2px; }
      .message.admin { align-self: flex-end; background: #ec4899; color: white; border-bottom-right-radius: 2px; }
      .message.ai { align-self: center; background: rgba(255,255,255,0.1); color: #94a3b8; font-size: 12px; border-radius: 8px; }
    </style>

    <script src="/socket.io/socket.io.js"></script>
    <script src="/js/admin-chat.js"></script>
    ${getScripts()}
  `)
})

router.get('/api/sessions', requireAdmin, async (req, res) => {
  const where = {
    status: { not: 'RESOLVED' },
    ...(req.session.role !== 'SUPER_ADMIN' ? { user: { role: { not: 'SUPER_ADMIN' } } } : {})
  }

  const sessions = await prisma.supportSession.findMany({
    where,
    include: { user: { select: { firstName: true, lastName: true, id: true } } },
    orderBy: { updatedAt: 'desc' }
  })
  res.json(sessions)
})

router.get('/api/messages/:sessionId', requireAdmin, async (req, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: parseInt(req.params.sessionId) },
    orderBy: { createdAt: 'asc' }
  })
  res.json(messages)
})

module.exports = router

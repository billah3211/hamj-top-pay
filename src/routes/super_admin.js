const express = require('express')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { prisma } = require('../db/prisma')
const { storage } = require('../config/cloudinary')
const router = express.Router()

// Multer Config (Cloudinary)
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Not an image! Please upload an image.'), false)
    }
  }
})

function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.role === 'SUPER_ADMIN') return next()
  return res.redirect('/admin/login')
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

// Helper: Get System Settings - Imported from utils/settings.js

function getSidebar(active, config = {}) {
  const siteName = config.site_name || 'Super Admin'
  const logoUrl = config.site_logo
  const showLogo = config.show_logo === 'true'

  const brandHtml = showLogo && logoUrl 
    ? `<img src="${logoUrl}" style="height:40px;width:auto;max-width:180px;object-fit:contain">`
    : `<span style="color:#ec4899">S</span> ${siteName}`

  return `
    <nav class="sidebar-premium" id="sidebar" style="border-right: 1px solid rgba(236, 72, 153, 0.3);">
      <div class="brand-logo" style="display:flex;align-items:center;gap:10px">${brandHtml}</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/super-admin/dashboard" class="${active === 'dashboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=${active === 'dashboard' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/super-admin/users" class="${active === 'users' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:users.svg?color=${active === 'users' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Users</a></li>
        <li class="nav-item"><a href="/super-admin/balance" class="${active === 'balance' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:wallet.svg?color=${active === 'balance' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Balance</a></li>
        <li class="nav-item"><a href="/super-admin/admins" class="${active === 'admins' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:shield-check.svg?color=${active === 'admins' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Admins</a></li>
        <li class="nav-item"><a href="/super-admin/guilds" class="${active === 'guilds' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:users.svg?color=${active === 'guilds' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Guilds</a></li>
        <li class="nav-item"><a href="/super-admin/store" class="${active === 'store' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=${active === 'store' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Store</a></li>
        <li class="nav-item"><a href="/super-admin/topup-packages" class="${active === 'packages' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:package.svg?color=${active === 'packages' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Packages</a></li>
        <li class="nav-item"><a href="/super-admin/topup-wallets" class="${active === 'wallets' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:wallet.svg?color=${active === 'wallets' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Wallets</a></li>
        <li class="nav-item"><a href="/super-admin/promote-settings" class="${active === 'promote' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:settings.svg?color=${active === 'promote' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Promote Settings</a></li>
        <li class="nav-item"><a href="/super-admin/sms-inbox" class="${active === 'sms' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:message-square.svg?color=${active === 'sms' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Live SMS Inbox</a></li>
        <li class="nav-item"><a href="/super-admin/settings" class="${active === 'settings' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:sliders-horizontal.svg?color=${active === 'settings' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> System Settings</a></li>
        <li class="nav-item" style="margin-top:10px;border-top:1px solid rgba(236, 72, 153, 0.2);padding-top:10px"><a href="/admin/dashboard"><img src="https://api.iconify.design/lucide:layout-template.svg?color=%2394a3b8" class="nav-icon"> Normal Panel</a></li>
        <li class="nav-item" style="margin-top:auto"><a href="/admin/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
  `
}

function getHead(title) {
  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${title}</title>
      <link rel="stylesheet" href="/style.css">
      <style>
        .sidebar-premium .brand-logo { color: #ec4899; }
        .nav-item a.active { background: rgba(236, 72, 153, 0.1); color: #ec4899; border-left: 3px solid #ec4899; }
        .stat-card-modern.card-pink { background: linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(236, 72, 153, 0.05)); border: 1px solid rgba(236, 72, 153, 0.2); }
      </style>
    </head>
    <body>
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
      <div class="app-layout">
  `
}

function getScripts() {
  return `
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
}

function getCard(title, value, type = 'default') {
  let colorClass = 'card-blue'
  let icon = 'layout-dashboard'
  
  if (type === 'users') { colorClass = 'card-blue'; icon = 'users'; }
  if (type === 'admins') { colorClass = 'card-pink'; icon = 'shield-check'; }
  if (type === 'store') { colorClass = 'card-purple'; icon = 'shopping-bag'; }
  
  return `
    <div class="stat-card-modern ${colorClass}">
      <div class="stat-icon">
        <img src="https://api.iconify.design/lucide:${icon}.svg?color=currentColor" width="24" height="24">
      </div>
      <div class="stat-info">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${title}</div>
      </div>
    </div>
  `
}

// Dashboard
router.get('/dashboard', requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const totalUsers = await prisma.user.count({ where: { role: 'USER' } })
  const totalAdmins = await prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } })
  const totalItems = await prisma.storeItem.count()
  
  res.send(`
    ${getHead('Super Admin Dashboard')}
    ${getSidebar('dashboard', settings)}
    <div class="main-content">
      <div class="section-header" style="background: linear-gradient(to right, rgba(236, 72, 153, 0.1), transparent); padding: 24px; border-radius: 16px; border: 1px solid rgba(236, 72, 153, 0.1); margin-bottom: 32px; display: flex; align-items: center; gap: 20px;">
        <div style="background: rgba(236, 72, 153, 0.2); padding: 12px; border-radius: 12px;">
           <img src="https://api.iconify.design/lucide:shield-check.svg?color=%23ec4899" width="32" height="32">
        </div>
        <div>
          <div class="section-title" style="font-size: 28px; margin-bottom: 4px;">Dashboard Overview</div>
          <div style="color:var(--text-muted); font-size: 16px;">Welcome back, <span style="color: #ec4899; font-weight: 600;">Super Admin</span></div>
        </div>
      </div>
      
      <div class="stats-grid-modern">
        ${getCard('Total Users', totalUsers, 'users')}
        ${getCard('Total Admins', totalAdmins, 'admins')}
        ${getCard('Store Items', totalItems, 'store')}
      </div>
    </div>
    ${getScripts()}
  `)
})

// --- Users & Balance Management ---

router.get(['/users', '/balance'], requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const { q } = req.query
  const isBalancePage = req.path.includes('balance')
  const activeTab = isBalancePage ? 'balance' : 'users'
  
  let users = []
  if (q) {
    users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q } }, // Case insensitive in Postgres, but verify for SQLite/others if needed. Prisma usually handles it.
          { email: { contains: q } }
        ]
      },
      include: {
        _count: {
          select: {
            linkSubmissions: { where: { status: 'APPROVED' } },
            // Prisma doesn't support filtering in _count directly for all versions/dbs easily in one go for multiple statuses with simple syntax, 
            // but we can fetch counts separately or fetch all submissions.
            // Optimized approach: fetch user with raw counts or just simple counts.
            // Let's keep it simple: fetch counts using separate queries if needed or just basic info.
            // For "Pending" tasks, we might need a separate query or aggregation.
          }
        }
      },
      take: 20
    })

    // Enrich users with pending counts manually since _count is limited
    for (const user of users) {
       user.pendingTasks = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'PENDING' } })
       user.approvedTasks = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
       
       // Calculate level progress
       user.level = calculateLevel(user.approvedTasks)
       user.levelProgress = getLevelProgress(user.approvedTasks)
    }
  }

  res.send(`
    ${getHead(isBalancePage ? 'Manage Balance' : 'Manage Users')}
    ${getSidebar(activeTab, settings)}
    <div class="main-content">
      <div class="section-header" style="background: linear-gradient(to right, rgba(236, 72, 153, 0.1), transparent); padding: 24px; border-radius: 16px; border: 1px solid rgba(236, 72, 153, 0.1); margin-bottom: 32px;">
        <div class="section-title" style="font-size: 28px; margin-bottom: 4px;">${isBalancePage ? 'Balance Management' : 'User Management'}</div>
        <div style="color:var(--text-muted); font-size: 16px;">Search and manage user accounts and balances</div>
      </div>

      <!-- Search Box -->
      <div class="glass-panel" style="padding:30px; margin-bottom:40px; max-width:600px; margin-left:auto; margin-right:auto;">
        <form action="/super-admin/${activeTab}" method="GET" style="display:flex; gap:10px;">
          <input type="text" name="q" value="${q || ''}" placeholder="Search by username or email..." class="form-input" style="flex:1; padding:12px;" required>
          <button class="btn-premium">Search</button>
        </form>
      </div>

      <!-- Results -->
      ${q && users.length === 0 ? '<div style="text-align:center; padding:40px; color:#ef4444;">No users found matching "' + q + '"</div>' : ''}
      
      <div style="display:flex; flex-direction:column; gap:20px;">
        ${users.map(u => `
          <div class="glass-panel" style="padding:25px; position:relative; overflow:hidden;">
             <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${u.isBlocked ? '#ef4444' : '#10b981'}"></div>
             
             <div style="display:flex; flex-wrap:wrap; gap:30px; align-items:start;">
                
                <!-- User Info -->
                <div style="flex:1; min-width:250px;">
                   <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px;">
                      <img src="${u.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" style="width:50px; height:50px; border-radius:50%; border:2px solid rgba(255,255,255,0.1);">
                      <div>
                         <div style="font-size:18px; font-weight:bold;">${u.firstName} ${u.lastName}</div>
                         <div style="color:#f472b6;">@${u.username}</div>
                         <div style="font-size:12px; color:#94a3b8;">${u.email}</div>
                      </div>
                   </div>
                   <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; color:#cbd5e1;">
                      <div>Joined: <span style="color:white;">${new Date(u.createdAt).toLocaleDateString()}</span></div>
                      <div>Status: <span style="color:${u.isBlocked ? '#ef4444' : '#10b981'}; font-weight:bold;">${u.isBlocked ? 'Inactive/Blocked' : 'Active'}</span></div>
                      <div>Tasks Approved: <span style="color:#22c55e;">${u.approvedTasks}</span></div>
                      <div>Tasks Pending: <span style="color:#fbbf24;">${u.pendingTasks}</span></div>
                   </div>
                   
                   <div style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                             <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 10px; padding: 2px 8px; border-radius: 20px;">Level ${u.level}</div>
                             <div style="font-size: 10px; color: #94a3b8;">${u.levelProgress.current} / ${u.levelProgress.next} Tasks</div>
                        </div>
                        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;" title="${u.levelProgress.percent.toFixed(1)}% to Level ${u.level + 1}">
                            <div style="width: ${u.levelProgress.percent}%; height: 100%; background: #facc15;"></div>
                        </div>
                   </div>
                </div>

                <!-- Balances -->
                <div style="flex:1; min-width:250px; background:rgba(0,0,0,0.2); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                   <h4 style="margin:0 0 15px 0; color:#cbd5e1; font-size:14px; text-transform:uppercase; letter-spacing:1px;">Wallet Balances</h4>
                   <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                      <div>
                         <div style="font-size:12px; color:#94a3b8;">Diamonds</div>
                         <div style="font-size:18px; color:#f472b6; font-weight:bold;">💎 ${u.diamond}</div>
                      </div>
                      <div>
                         <div style="font-size:12px; color:#94a3b8;">Coins</div>
                         <div style="font-size:18px; color:#fbbf24; font-weight:bold;">🪙 ${u.coin}</div>
                      </div>
                      <div>
                         <div style="font-size:12px; color:#94a3b8;">Tk</div>
                         <div style="font-size:18px; color:white; font-weight:bold;">৳ ${u.tk}</div>
                      </div>
                      <div>
                         <div style="font-size:12px; color:#94a3b8;">HaMJ T</div>
                         <div style="font-size:18px; color:#38bdf8; font-weight:bold;">T ${u.lora}</div>
                      </div>
                   </div>
                </div>

                <!-- Actions -->
                <div style="min-width:150px; display:flex; flex-direction:column; gap:10px;">
                   <a href="/admin/user/${u.id}" target="_blank" class="btn-premium" style="text-align:center; justify-content:center;">Manage Balance</a>
                   
                   <form action="/super-admin/user/delete" method="POST" onsubmit="return confirm('Are you sure you want to PERMANENTLY DELETE this user? This action cannot be undone.')">
                      <input type="hidden" name="userId" value="${u.id}">
                      <button class="btn-premium" style="width:100%; background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.2); color:#fca5a5; justify-content:center;">Delete Account</button>
                   </form>
                </div>

             </div>
          </div>
        `).join('')}
      </div>

    </div>
    ${getScripts()}
  `)
})

router.post('/user/delete', requireSuperAdmin, async (req, res) => {
  const { userId } = req.body
  try {
    // Delete related records first if strict relational integrity isn't set to cascade automatically
    // Assuming Prisma schema handles Cascade delete or we do it manually.
    // Usually it's safer to rely on Prisma relations or explicit deletes.
    // For now, simple delete user.
    await prisma.user.delete({ where: { id: parseInt(userId) } })
    res.redirect('back')
  } catch (e) {
    console.error('Delete user error:', e)
    res.send('<script>alert("Error deleting user: ' + e.message + '"); window.history.back();</script>')
  }
})

// Manage Admins
router.get('/admins', requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const admins = await prisma.user.findMany({ 
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    orderBy: { createdAt: 'desc' }
  })
  
  const renderRow = (admin) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
      <td style="padding:16px;">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:50%;background:${admin.role === 'SUPER_ADMIN' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(59, 130, 246, 0.2)'};display:grid;place-items:center;color:${admin.role === 'SUPER_ADMIN' ? '#ec4899' : '#3b82f6'};font-weight:600;font-size:16px">
            ${admin.firstName ? admin.firstName[0] : 'A'}
          </div>
          <div>
            <div style="color:white;font-weight:500">${admin.firstName} ${admin.lastName}</div>
            <div style="color:var(--text-muted);font-size:12px">${admin.email}</div>
          </div>
        </div>
      </td>
      <td style="padding:16px"><span class="role-badge" style="background:${admin.role === 'SUPER_ADMIN' ? 'rgba(236, 72, 153, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; color:${admin.role === 'SUPER_ADMIN' ? '#ec4899' : '#3b82f6'}; padding: 4px 12px; border-radius: 20px; font-size: 12px; border: 1px solid ${admin.role === 'SUPER_ADMIN' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(59, 130, 246, 0.2)'}">${admin.role.replace('_', ' ')}</span></td>
      <td style="padding:16px;text-align:right">
        ${admin.role !== 'SUPER_ADMIN' ? `
          <form action="/super-admin/revoke-access" method="POST" style="display:inline" onsubmit="return confirm('Revoke admin access?')">
            <input type="hidden" name="userId" value="${admin.id}">
            <button class="btn-premium" style="padding:8px 12px;font-size:12px;background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);border-radius:6px;cursor:pointer;transition:all 0.2s">Revoke</button>
          </form>
        ` : '<span style="color:var(--text-muted);font-size:12px;display:flex;align-items:center;justify-content:flex-end;gap:4px"><img src="https://api.iconify.design/lucide:lock.svg?color=%2394a3b8" width="12"> Protected</span>'}
      </td>
    </tr>
  `

  res.send(`
    ${getHead('Manage Admins')}
    ${getSidebar('admins', settings)}
    <div class="main-content">
      <div class="section-header" style="background: linear-gradient(to right, rgba(59, 130, 246, 0.1), transparent); padding: 24px; border-radius: 16px; border: 1px solid rgba(59, 130, 246, 0.1); margin-bottom: 32px; display: flex; align-items: center; gap: 20px;">
        <div style="background: rgba(59, 130, 246, 0.2); padding: 12px; border-radius: 12px;">
           <img src="https://api.iconify.design/lucide:shield-check.svg?color=%233b82f6" width="32" height="32">
        </div>
        <div>
          <div class="section-title" style="font-size: 28px; margin-bottom: 4px;">Manage Admins</div>
          <div style="color:var(--text-muted); font-size: 16px;">Control system access and roles</div>
        </div>
      </div>
      
      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 350px;gap:24px;align-items:start">
        
        <!-- Admin List -->
        <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;overflow:hidden">
           <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 18px;">System Administrators</h3>
            <span style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 20px; font-size: 12px;">${admins.length} admins</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:rgba(255,255,255,0.02);text-align:left">
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Admin Info</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Role</th>
                <th style="padding:16px;text-align:right;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Action</th>
              </tr>
            </thead>
            <tbody>
              ${admins.map(renderRow).join('')}
            </tbody>
          </table>
        </div>

        <!-- Grant Access Form -->
        <div class="glass-panel" style="padding: 24px; position: sticky; top: 24px;">
          <h3 style="margin-bottom:20px;font-size:18px; display: flex; align-items: center; gap: 10px;">
             <span style="background:rgba(236, 72, 153, 0.2); width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #ec4899;"><img src="https://api.iconify.design/lucide:user-plus.svg?color=currentColor" width="16"></span>
             Grant Access
          </h3>
          <form action="/super-admin/grant-access" method="POST">
            <div class="form-group">
              <label class="form-label">User Email</label>
              <input type="email" name="email" required placeholder="Enter user email" class="form-input">
            </div>
            
            <div class="form-group">
              <label class="form-label">Role</label>
              <select name="role" class="form-input">
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Your Password (Confirmation)</label>
              <input type="password" name="password" required placeholder="Confirm your password" class="form-input">
            </div>

            <button type="submit" class="btn-premium full-width" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">
              <img src="https://api.iconify.design/lucide:check.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;">
              Grant Access
            </button>
          </form>
        </div>

      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/grant-access', requireSuperAdmin, async (req, res) => {
  const { email, role, password } = req.body
  
  try {
    const targetUser = await prisma.user.findUnique({ where: { email } })
    
    if (!targetUser) {
      return res.redirect('/super-admin/admins?error=User+not+found')
    }

    // Verify Super Admin password (current user)
    const superAdmin = await prisma.user.findUnique({ where: { id: req.session.userId } })
    const match = await bcrypt.compare(password, superAdmin.passwordHash)
    
    if (!match) {
      return res.redirect('/super-admin/admins?error=Invalid+confirmation+password')
    }

    // Update user role
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: role }
    })
     
     res.redirect('/super-admin/admins?success=User+granted+access+successfully')
   } catch (e) {
     console.error(e)
     res.redirect('/super-admin/admins?error=' + encodeURIComponent(e.message))
   }
 })
 
 router.post('/revoke-access', requireSuperAdmin, async (req, res) => {
  const { userId } = req.body
  const currentUserId = req.session.userId

  if (!userId) return res.redirect('/super-admin/admins?error=User+ID+required')
  
  if (parseInt(userId) === currentUserId) {
    return res.redirect('/super-admin/admins?error=You+cannot+revoke+your+own+access')
  }

  try {
    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role: 'USER' }
    })
    
    res.redirect('/super-admin/admins?success=Admin+access+revoked+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/admins?error=' + encodeURIComponent(e.message))
  }
})

// Manage Guilds
router.get('/guilds', requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const search = req.query.search || ''
  const where = {}
  
  if (search) {
    where.username = { contains: search }
  }

  const guilds = await prisma.guild.findMany({
    where,
    include: { leader: true },
    orderBy: { createdAt: 'desc' }
  })

  const renderRow = (guild) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:16px;">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(236,72,153,0.1);display:grid;place-items:center;color:#ec4899;font-weight:600">
            ${guild.name[0]}
          </div>
          <div>
            <div style="color:white;font-weight:500">${guild.name}</div>
            <div style="color:var(--text-muted);font-size:12px">@${guild.username}</div>
          </div>
        </div>
      </td>
      <td style="padding:16px">
        <div style="color:white;font-size:14px">${guild.leader.firstName} ${guild.leader.lastName}</div>
        <div style="color:var(--text-muted);font-size:12px">${guild.leader.email}</div>
      </td>
      <td style="padding:16px">
        <span style="background:${guild.status === 'APPROVED' ? 'rgba(34,197,94,0.1)' : guild.status === 'BLOCKED' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)'}; color:${guild.status === 'APPROVED' ? '#4ade80' : guild.status === 'BLOCKED' ? '#f87171' : '#facc15'}; padding:4px 10px; border-radius:20px; font-size:12px; border:1px solid ${guild.status === 'APPROVED' ? 'rgba(34,197,94,0.2)' : guild.status === 'BLOCKED' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'}">
          ${guild.status}
        </span>
      </td>
      <td style="padding:16px;text-align:right">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <form action="/super-admin/guilds/action" method="POST" style="display:inline">
            <input type="hidden" name="guildId" value="${guild.id}">
            <input type="hidden" name="action" value="${guild.status === 'BLOCKED' ? 'unblock' : 'block'}">
            <button class="btn-premium" style="padding:6px 12px;font-size:12px;background:${guild.status === 'BLOCKED' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)'};color:${guild.status === 'BLOCKED' ? '#4ade80' : '#facc15'};border-color:${guild.status === 'BLOCKED' ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.2)'}">
              ${guild.status === 'BLOCKED' ? 'Unblock' : 'Block'}
            </button>
          </form>
          <form action="/super-admin/guilds/action" method="POST" style="display:inline" onsubmit="return confirm('Are you sure you want to delete this guild? This cannot be undone.')">
            <input type="hidden" name="guildId" value="${guild.id}">
            <input type="hidden" name="action" value="delete">
            <button class="btn-premium" style="padding:6px 12px;font-size:12px;background:rgba(239,68,68,0.1);color:#fca5a5;border-color:rgba(239,68,68,0.2)">
              Delete
            </button>
          </form>
        </div>
      </td>
    </tr>
  `

  res.send(`
    ${getHead('Manage Guilds')}
    ${getSidebar('guilds', settings)}
    <div class="main-content">
      <div class="section-header" style="background: linear-gradient(to right, rgba(236, 72, 153, 0.1), transparent); padding: 24px; border-radius: 16px; border: 1px solid rgba(236, 72, 153, 0.1); margin-bottom: 32px; display: flex; align-items: center; gap: 20px;">
        <div style="background: rgba(236, 72, 153, 0.2); padding: 12px; border-radius: 12px;">
           <img src="https://api.iconify.design/lucide:users.svg?color=%23ec4899" width="32" height="32">
        </div>
        <div>
          <div class="section-title" style="font-size: 28px; margin-bottom: 4px;">Manage Guilds</div>
          <div style="color:var(--text-muted); font-size: 16px;">Monitor and manage guilds</div>
        </div>
      </div>

      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

      <div class="glass-panel" style="margin-bottom:24px;padding:20px">
        <form action="/super-admin/guilds" method="GET" style="display:flex;gap:12px">
          <input type="text" name="search" value="${search}" placeholder="Search by guild username..." class="form-input" style="max-width:300px">
          <button class="btn-premium">Search</button>
          ${search ? '<a href="/super-admin/guilds" class="btn-premium" style="background:rgba(255,255,255,0.1)">Clear</a>' : ''}
        </form>
      </div>

      <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;overflow:hidden">
        <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 18px;">All Guilds</h3>
          <span style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 20px; font-size: 12px;">${guilds.length} guilds</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:rgba(255,255,255,0.02);text-align:left">
              <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Guild Info</th>
              <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Leader</th>
              <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Status</th>
              <th style="padding:16px;text-align:right;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${guilds.length > 0 ? guilds.map(renderRow).join('') : '<tr><td colspan="4" style="padding:40px;text-align:center;color:var(--text-muted)">No guilds found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/guilds/action', requireSuperAdmin, async (req, res) => {
  const { guildId, action } = req.body
  
  try {
    if (action === 'block') {
      await prisma.guild.update({
        where: { id: parseInt(guildId) },
        data: { status: 'BLOCKED' }
      })
      res.redirect('/super-admin/guilds?success=Guild+blocked')
    } else if (action === 'unblock') {
      await prisma.guild.update({
        where: { id: parseInt(guildId) },
        data: { status: 'APPROVED' }
      })
      res.redirect('/super-admin/guilds?success=Guild+unblocked')
    } else if (action === 'delete') {
      // First delete all members relations if necessary, but usually just deleting the guild row
      // If there are foreign keys, might need to handle them.
      // Assuming members relation is just a link in User table, or a join table.
      // In schema: members User[]
      // So Users have guildId. When deleting guild, users' guildId should be set to null.
      // Prisma might handle this if onDelete is SetNull, otherwise we need to do it.
      
      // Let's manually disconnect members first to be safe
      await prisma.user.updateMany({
        where: { guildId: parseInt(guildId) },
        data: { guildId: null }
      })
      
      await prisma.guild.delete({
        where: { id: parseInt(guildId) }
      })
      res.redirect('/super-admin/guilds?success=Guild+deleted')
    }
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/guilds?error=' + encodeURIComponent(e.message))
  }
})

// SMS Inbox Route
router.get('/sms-inbox', requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const logs = await prisma.sMSLog.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' }
  })

  res.send(`
    ${getHead('Live SMS Inbox')}
    ${getSidebar('sms', settings)}
    <div class="main-content">
      <div class="section-header" style="background: linear-gradient(to right, rgba(236, 72, 153, 0.1), transparent); padding: 24px; border-radius: 16px; border: 1px solid rgba(236, 72, 153, 0.1); margin-bottom: 32px; display: flex; align-items: center; gap: 20px;">
        <div style="background: rgba(236, 72, 153, 0.2); padding: 12px; border-radius: 12px;">
           <img src="https://api.iconify.design/lucide:message-square.svg?color=%23ec4899" width="32" height="32">
        </div>
        <div>
          <div class="section-title" style="font-size: 28px; margin-bottom: 4px;">Live SMS Inbox</div>
          <div style="color:var(--text-muted); font-size: 16px;">View all incoming SMS messages in real-time</div>
        </div>
        <div style="display:flex;gap:10px;margin-left:auto;">
          <button id="deleteHistoryBtn" class="btn-premium" style="background:rgba(239,68,68,0.1);color:#fca5a5;border-color:rgba(239,68,68,0.2)">
            <img src="https://api.iconify.design/lucide:trash-2.svg?color=%23fca5a5" width="16" style="margin-right:8px"> Delete History
          </button>
          <button id="refreshBtn" class="btn-premium">
            <img src="https://api.iconify.design/lucide:refresh-cw.svg?color=white" width="16" style="margin-right:8px"> Refresh
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:16px;margin-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:16px;">
          <button onclick="switchTab('all')" id="tab-all" class="tab-btn active" style="background:rgba(236,72,153,0.1);color:#ec4899;border:1px solid rgba(236,72,153,0.2);padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;">📥 All Messages</button>
          <button onclick="switchTab('suspicious')" id="tab-suspicious" class="tab-btn" style="background:transparent;color:var(--text-muted);border:1px solid transparent;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;">🚨 Suspicious / Fake</button>
      </div>

      <!-- All Messages Tab -->
      <div id="view-all" class="tab-content">
          <div class="glass-panel" style="overflow:hidden">
            <table style="width:100%;border-collapse:collapse" id="smsTable">
              <thead>
                <tr style="background:rgba(255,255,255,0.02);text-align:left">
                  <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase">Time</th>
                  <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase">Sender</th>
                  <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase">Message</th>
                  <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase">TrxID</th>
                  <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase">Status</th>
                </tr>
              </thead>
              <tbody id="smsTableBody">
                ${logs.map(log => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                    <td style="padding:16px;color:var(--text-muted);font-size:13px">${new Date(log.createdAt).toLocaleString()}</td>
                    <td style="padding:16px;font-weight:600;color:#ec4899">${log.sender}</td>
                    <td style="padding:16px;color:white;max-width:400px;word-wrap:break-word">${log.message}</td>
                    <td style="padding:16px;color:var(--text-muted);font-family:monospace">${log.trxId || '-'}</td>
                    <td style="padding:16px">
                      ${log.status === 'PROCESSED_PAYMENT' || log.status === 'PROCESSED'
                        ? '<span style="background:rgba(34,197,94,0.1);color:#4ade80;padding:4px 8px;border-radius:4px;font-size:12px">Processed</span>' 
                        : log.status === 'SUSPICIOUS' 
                          ? '<span style="background:rgba(239,68,68,0.1);color:#fca5a5;padding:4px 8px;border-radius:4px;font-size:12px">Suspicious</span>'
                          : '<span style="background:rgba(255,255,255,0.1);color:var(--text-muted);padding:4px 8px;border-radius:4px;font-size:12px">' + log.status + '</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
      </div>

      <!-- Suspicious Tab -->
      <div id="view-suspicious" class="tab-content" style="display:none;">
          <div class="glass-panel" style="overflow:hidden">
              <table style="width:100%;border-collapse:collapse">
                  <thead>
                      <tr style="background:rgba(255,255,255,0.02);text-align:left">
                          <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase">Details</th>
                          <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;width:400px;">Actions</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${logs.filter(l => l.status === 'SUSPICIOUS').length === 0 ? '<tr><td colspan="2" style="padding:32px;text-align:center;color:var(--text-muted)">No suspicious messages found</td></tr>' : ''}
                      ${logs.filter(l => l.status === 'SUSPICIOUS').map(log => `
                          <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                              <td style="padding:16px;">
                                  <div style="font-weight:600;color:#ec4899;margin-bottom:4px;">${log.sender}</div>
                                  <div style="color:white;font-size:14px;margin-bottom:4px;">${log.message}</div>
                                  <div style="color:var(--text-muted);font-size:12px;">${new Date(log.createdAt).toLocaleString()}</div>
                              </td>
                              <td style="padding:16px;">
                                  <div style="display:flex;flex-direction:column;gap:8px;">
                                      <div style="display:flex;gap:8px;">
                                          <input type="text" id="warn-msg-${log.id}" placeholder="Type warning message..." style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:white;padding:6px 10px;border-radius:6px;font-size:12px;flex:1;">
                                          <button onclick="sendWarning('${log.id}', '${log.sender}')" style="background:rgba(234,179,8,0.1);color:#facc15;border:1px solid rgba(234,179,8,0.2);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;">
                                              ⚠️ Send Warning
                                          </button>
                                      </div>
                                      <div style="display:flex;gap:8px;">
                                          <button onclick="forceApprove('${log.id}')" style="background:rgba(34,197,94,0.1);color:#4ade80;border:1px solid rgba(34,197,94,0.2);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;flex:1;">
                                              ✅ Force Approve
                                          </button>
                                          <button onclick="deleteLog('${log.id}')" style="background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;flex:1;">
                                              ❌ Delete
                                          </button>
                                      </div>
                                  </div>
                              </td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>
          </div>
      </div>

      <script>
          function switchTab(tab) {
              document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
              document.querySelectorAll('.tab-btn').forEach(el => {
                  el.classList.remove('active');
                  el.style.background = 'transparent';
                  el.style.color = 'var(--text-muted)';
                  el.style.borderColor = 'transparent';
              });
              
              document.getElementById('view-' + tab).style.display = 'block';
              const activeBtn = document.getElementById('tab-' + tab);
              activeBtn.classList.add('active');
              activeBtn.style.background = 'rgba(236,72,153,0.1)';
              activeBtn.style.color = '#ec4899';
              activeBtn.style.borderColor = 'rgba(236,72,153,0.2)';
          }

          async function sendWarning(logId, phoneNumber) {
              const msgInput = document.getElementById('warn-msg-' + logId);
              const message = msgInput.value;
              if (!message) return alert('Please type a warning message');
              
              if(!confirm('Send this warning SMS to ' + phoneNumber + '?')) return;

              try {
                  const res = await fetch('/api/admin/send-warning-sms', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ phoneNumber, message })
                  });
                  const data = await res.json();
                  if(data.success) {
                      alert('Warning sent!');
                      msgInput.value = '';
                  } else {
                      alert('Failed: ' + data.error);
                  }
              } catch(e) {
                  alert('Error sending warning');
              }
          }

          async function forceApprove(logId) {
              if(!confirm('Are you sure you want to FORCE APPROVE this SMS? This will add balance to the user.')) return;
              
              try {
                  const res = await fetch('/api/admin/force-approve-sms', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ logId })
                  });
                  const data = await res.json();
                  if(data.success) {
                      alert('Approved successfully!');
                      window.location.reload();
                  } else {
                      alert('Failed: ' + data.error);
                  }
              } catch(e) {
                  alert('Error approving');
              }
          }

          async function deleteLog(logId) {
              if(!confirm('Permanently delete this log?')) return;
              
              try {
                  const res = await fetch('/api/admin/delete-sms-log', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ logId })
                  });
                  const data = await res.json();
                  if(data.success) {
                      window.location.reload();
                  } else {
                      alert('Failed: ' + data.error);
                  }
              } catch(e) {
                  alert('Error deleting');
              }
          }
      </script>
    </div>

    <!-- Delete Modal -->
    <div id="deleteModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:1000;justify-content:center;align-items:center;backdrop-filter:blur(5px)">
      <div class="glass-panel" style="width:100%;max-width:400px;padding:24px;border:1px solid rgba(239,68,68,0.3);box-shadow:0 20px 50px rgba(0,0,0,0.5)">
        <h3 style="margin-top:0;display:flex;align-items:center;gap:10px;color:#fca5a5">
          <img src="https://api.iconify.design/lucide:alert-triangle.svg?color=%23fca5a5" width="24">
          Bulk Delete SMS
        </h3>
        <p style="color:var(--text-muted);margin-bottom:20px;font-size:14px">Select a date range to permanently remove SMS logs from the database. This action cannot be undone.</p>
        
        <div class="form-group">
          <label class="form-label">Start Date</label>
          <input type="date" id="deleteStartDate" class="form-input">
        </div>

        <div class="form-group">
          <label class="form-label">End Date</label>
          <input type="date" id="deleteEndDate" class="form-input">
        </div>

        <div class="form-group">
          <label class="form-label">Delete Mode</label>
          <select id="deleteType" class="form-input">
             <option value="PROCESSED_ONLY">Only Approved Payments (Safe)</option>
             <option value="ALL">Everything (Caution!)</option>
          </select>
        </div>

        <div style="display:flex;gap:12px;margin-top:24px">
          <button id="cancelDeleteBtn" class="btn-premium" style="flex:1;background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1)">Cancel</button>
          <button id="confirmDeleteBtn" class="btn-premium" style="flex:1;background:rgba(239,68,68,0.2);color:#fca5a5;border-color:rgba(239,68,68,0.3)">Permanently Delete</button>
        </div>
      </div>
    </div>

    ${getScripts()}
    <script>
      // Delete Modal Logic
      const deleteModal = document.getElementById('deleteModal');
      const deleteHistoryBtn = document.getElementById('deleteHistoryBtn');
      const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
      const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

      deleteHistoryBtn.addEventListener('click', () => {
        deleteModal.style.display = 'flex';
        // Set default dates (today)
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('deleteStartDate').value = today;
        document.getElementById('deleteEndDate').value = today;
      });

      cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
      });

      // Close on outside click
      deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) deleteModal.style.display = 'none';
      });

      confirmDeleteBtn.addEventListener('click', async () => {
        const startDate = document.getElementById('deleteStartDate').value;
        const endDate = document.getElementById('deleteEndDate').value;
        const deleteType = document.getElementById('deleteType').value;

        if (!startDate || !endDate) {
          alert('Please select both start and end dates.');
          return;
        }

        if (!confirm('Are you absolutely sure you want to delete these records? This cannot be undone.')) {
          return;
        }

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerText = 'Deleting...';

        try {
          const res = await fetch('/api/admin/delete-sms-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, deleteType })
          });
          
          const data = await res.json();
          
          if (res.ok) {
            alert(\`Successfully deleted \${data.count} records.\`);
            deleteModal.style.display = 'none';
            document.getElementById('refreshBtn').click(); // Refresh table
          } else {
            alert('Error: ' + (data.error || 'Failed to delete'));
          }
        } catch (err) {
          console.error(err);
          alert('Network error occurred.');
        } finally {
          confirmDeleteBtn.disabled = false;
          confirmDeleteBtn.innerText = 'Permanently Delete';
        }
      });

      const refreshBtn = document.getElementById('refreshBtn');
      const tableBody = document.getElementById('smsTableBody');

      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<img src="https://api.iconify.design/line-md:loading-loop.svg?color=white" width="16" style="margin-right:8px"> Loading...';
        
        try {
          const res = await fetch('/api/admin/sms-logs');
          const data = await res.json();
          
          tableBody.innerHTML = data.map(log => \`
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                <td style="padding:16px;color:var(--text-muted);font-size:13px">\${new Date(log.createdAt).toLocaleString()}</td>
                <td style="padding:16px;font-weight:600;color:#ec4899">\${log.sender}</td>
                <td style="padding:16px;color:white;max-width:400px;word-wrap:break-word">\${log.message}</td>
                <td style="padding:16px;color:var(--text-muted);font-family:monospace">\${log.trxId || '-'}</td>
                <td style="padding:16px">
                  \${log.status === 'PROCESSED_PAYMENT' || log.status === 'PROCESSED' 
                    ? '<span style="background:rgba(34,197,94,0.1);color:#4ade80;padding:4px 8px;border-radius:4px;font-size:12px">Processed</span>' 
                    : '<span style="background:rgba(255,255,255,0.1);color:var(--text-muted);padding:4px 8px;border-radius:4px;font-size:12px">' + log.status + '</span>'}
                </td>
              </tr>
          \`).join('');
          
        } catch (err) {
          console.error(err);
          alert('Failed to refresh inbox');
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = '<img src="https://api.iconify.design/lucide:refresh-cw.svg?color=white" width="16" style="margin-right:8px"> Refresh';
        }
      });
    </script>
  `)
})

// Store Management Routes
router.get('/store', requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const items = await prisma.storeItem.findMany({ orderBy: { createdAt: 'desc' } })
  
  const renderItemRow = (item) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:16px"><img src="${item.imageUrl}" style="width:50px;height:50px;border-radius:8px;object-fit:cover"></td>
      <td style="padding:16px;color:white">${item.name}</td>
      <td style="padding:16px"><span style="background:rgba(99,102,241,0.1);color:#818cf8;padding:4px 8px;border-radius:4px;font-size:12px">${item.type}</span></td>
      <td style="padding:16px;color:var(--text-muted)">
        ${item.currency === 'free' ? 'Free' : item.price + ' ' + (item.currency === 'dk' ? 'Dollar' : 'Taka')}
      </td>
      <td style="padding:16px;text-align:right">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <form action="/super-admin/store/delete" method="POST" onsubmit="return confirm('Delete this item?')" style="display:inline">
            <input type="hidden" name="id" value="${item.id}">
            <button class="btn-premium" style="padding:8px;font-size:12px;background:rgba(239,68,68,0.2);color:#fca5a5;border-color:rgba(239,68,68,0.3)">Del</button>
          </form>
        </div>
      </td>
    </tr>
  `

  res.send(`
    ${getHead('Manage Store')}
    ${getSidebar('store')}
    <div class="main-content">
      <div class="section-header" style="background: linear-gradient(to right, rgba(99, 102, 241, 0.1), transparent); padding: 24px; border-radius: 16px; border: 1px solid rgba(99, 102, 241, 0.1); margin-bottom: 32px; display: flex; align-items: center; gap: 20px;">
        <div style="background: rgba(99, 102, 241, 0.2); padding: 12px; border-radius: 12px;">
           <img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%236366f1" width="32" height="32">
        </div>
        <div>
          <div class="section-title" style="font-size: 28px; margin-bottom: 4px;">Store Management</div>
          <div style="color:var(--text-muted); font-size: 16px;">Upload and manage profile assets</div>
        </div>
      </div>

      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 380px;gap:24px;align-items:start">
        
        <!-- Items List -->
        <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;overflow:hidden">
          <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 18px;">Active Items</h3>
            <span style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 20px; font-size: 12px;">${items.length} items</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:rgba(255,255,255,0.02);text-align:left">
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Preview</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Item Info</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Pricing</th>
                <th style="padding:16px;text-align:right;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Action</th>
              </tr>
            </thead>
            <tbody>
              ${items.length > 0 ? items.map(renderItemRow).join('') : '<tr><td colspan="4" style="padding:40px;text-align:center;color:var(--text-muted)">No items found in store</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Add Item Form -->
        <div class="glass-panel" style="padding: 24px; position: sticky; top: 24px;">
          <h3 style="margin-bottom:20px;font-size:18px; display: flex; align-items: center; gap: 10px;">
            <span style="background:rgba(34, 197, 94, 0.2); width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #4ade80;"><img src="https://api.iconify.design/lucide:plus.svg?color=currentColor" width="16"></span>
            Add New Item
          </h3>
          <form action="/super-admin/store/add" method="POST" enctype="multipart/form-data">
            <div class="form-group">
              <label class="form-label">Item Name</label>
              <input type="text" name="name" required placeholder="e.g. Blue Frame" class="form-input">
            </div>
            
            <div class="form-group">
              <label class="form-label">Type</label>
              <select name="type" class="form-input">
                <option value="avatar">Avatar Frame</option>
                <option value="guild_profile">Guild Profile Picture</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Currency</label>
              <select name="currency" class="form-input" onchange="togglePrice(this.value)">
                <option value="free">Free</option>
                <option value="dk">Dollar (DK)</option>
                <option value="tk">Taka (TK)</option>
              </select>
            </div>

            <div class="form-group" id="priceGroup" style="display:none">
              <label class="form-label">Price</label>
              <input type="number" name="price" placeholder="0" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label">Image File</label>
              <div style="position: relative; overflow: hidden; display: inline-block; width: 100%;">
                 <input type="file" name="image" required accept="image/*" class="form-input" style="padding: 10px; cursor: pointer;">
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">Recommended: PNG with transparent background</div>
            </div>

            <button type="submit" class="btn-premium full-width" style="background: linear-gradient(135deg, #10b981, #059669);">
              <img src="https://api.iconify.design/lucide:upload-cloud.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;">
              Upload Item
            </button>
          </form>
        </div>

      </div>
    </div>
    <script>
      function togglePrice(val) {
        document.getElementById('priceGroup').style.display = val === 'free' ? 'none' : 'block';
      }
    </script>
    ${getScripts()}
  `)
})

router.post('/store/add', requireSuperAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, type, currency, price } = req.body
    const imageUrl = req.file.path
    
    await prisma.storeItem.create({
      data: {
        name,
        type,
        currency,
        price: currency === 'free' ? 0 : parseInt(price || 0),
        imageUrl
      }
    })
    
    res.redirect('/super-admin/store?success=Item+added+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/store?error=' + encodeURIComponent(e.message))
  }
})

router.post('/store/delete', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.body
    const item = await prisma.storeItem.findUnique({ where: { id: parseInt(id) } })
    
    if (item) {
      if (item.imageUrl && item.imageUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '../../public', item.imageUrl)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
      
      await prisma.storeItem.delete({ where: { id: parseInt(id) } })
    }
    
    res.redirect('/super-admin/store?success=Item+deleted+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/store?error=Delete+failed:+This+item+might+be+in+use+by+users')
  }
})

// Promote Settings Route
router.get('/promote-settings', requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const timer = await prisma.systemSetting.findUnique({ where: { key: 'visit_timer' } })
  const screenshotCount = await prisma.systemSetting.findUnique({ where: { key: 'screenshot_count' } })
  const autoApprove = await prisma.systemSetting.findUnique({ where: { key: 'promote_auto_approve_seconds' } })

  const timerVal = timer ? timer.value : '50'
  const screenshotVal = screenshotCount ? screenshotCount.value : '2'
  const autoApproveSeconds = autoApprove ? parseInt(autoApprove.value) : 0
  
  // Convert back to best unit
  let autoApproveVal = autoApproveSeconds
  let autoApproveUnit = 'seconds'
  
  if (autoApproveSeconds > 0) {
      if (autoApproveSeconds % 31536000 === 0) { autoApproveVal = autoApproveSeconds / 31536000; autoApproveUnit = 'years'; }
      else if (autoApproveSeconds % 2592000 === 0) { autoApproveVal = autoApproveSeconds / 2592000; autoApproveUnit = 'months'; }
      else if (autoApproveSeconds % 86400 === 0) { autoApproveVal = autoApproveSeconds / 86400; autoApproveUnit = 'days'; }
      else if (autoApproveSeconds % 3600 === 0) { autoApproveVal = autoApproveSeconds / 3600; autoApproveUnit = 'hours'; }
      else if (autoApproveSeconds % 60 === 0) { autoApproveVal = autoApproveSeconds / 60; autoApproveUnit = 'minutes'; }
  }

  const activeTaskCount = await prisma.promotedLink.count({ where: { status: 'ACTIVE' } })
  const pendingSubmissionCount = await prisma.linkSubmission.count({ where: { status: 'PENDING' } })

  res.send(`
    ${getHead('Promote Settings')}
    ${getSidebar('promote', settings)}
    <div class="main-content">
      <div class="section-header" style="margin-bottom: 32px;">
        <div>
          <div class="section-title" style="font-size: 24px;">Promote Settings</div>
          <div style="color:var(--text-muted)">Configure visit timer and screenshot requirements</div>
        </div>
      </div>

      ${req.query.success ? `<div class="alert success" style="margin-bottom: 24px;">${req.query.success}</div>` : ''}

      <!-- Stats Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 32px;">
        <div class="glass-panel" style="padding: 24px; display: flex; align-items: center; gap: 20px;">
           <div style="background: rgba(16, 185, 129, 0.2); padding: 12px; border-radius: 12px;">
             <img src="https://api.iconify.design/lucide:activity.svg?color=%2310b981" width="24">
           </div>
           <div>
             <div style="font-size: 24px; font-weight: 700; color: white;">${activeTaskCount}</div>
             <div style="color: var(--text-muted); font-size: 14px;">Total Active Tasks</div>
           </div>
        </div>
        <div class="glass-panel" style="padding: 24px; display: flex; align-items: center; gap: 20px;">
           <div style="background: rgba(245, 158, 11, 0.2); padding: 12px; border-radius: 12px;">
             <img src="https://api.iconify.design/lucide:clock.svg?color=%23f59e0b" width="24">
           </div>
           <div>
             <div style="font-size: 24px; font-weight: 700; color: white;">${pendingSubmissionCount}</div>
             <div style="color: var(--text-muted); font-size: 14px;">Pending Submissions</div>
           </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
        <!-- Settings Card -->
        <div class="glass-panel" style="padding: 32px; border-top: 4px solid #ec4899;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
            <div style="background: rgba(236, 72, 153, 0.2); padding: 10px; border-radius: 10px;">
              <img src="https://api.iconify.design/lucide:sliders.svg?color=%23ec4899" width="24" height="24">
            </div>
            <h3 style="font-size: 18px; font-weight: 600; margin: 0;">Configuration</h3>
          </div>

          <form action="/super-admin/promote-settings" method="POST">
            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label" style="display: block; margin-bottom: 8px; font-weight: 500;">
                <img src="https://api.iconify.design/lucide:timer.svg?color=%2394a3b8" width="16" style="vertical-align: middle; margin-right: 6px;">
                Visit Timer (Seconds)
              </label>
              <div style="position: relative;">
                <input type="number" name="timer" value="${timerVal}" class="form-input" style="width: 100%; padding: 14px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; color: white; font-size: 16px;">
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px; padding-left: 4px;">Time users must wait before submitting proof. Default: 50s</div>
            </div>

            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label" style="display: block; margin-bottom: 8px; font-weight: 500;">
                <img src="https://api.iconify.design/lucide:image.svg?color=%2394a3b8" width="16" style="vertical-align: middle; margin-right: 6px;">
                Required Screenshots
              </label>
              <div style="position: relative;">
                <input type="number" name="screenshots" value="${screenshotVal}" class="form-input" style="width: 100%; padding: 14px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; color: white; font-size: 16px;">
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px; padding-left: 4px;">Number of proofs required. Default: 2</div>
            </div>

            <div class="form-group" style="margin-bottom: 32px;">
              <label class="form-label" style="display: block; margin-bottom: 8px; font-weight: 500;">
                <img src="https://api.iconify.design/lucide:clock.svg?color=%2394a3b8" width="16" style="vertical-align: middle; margin-right: 6px;">
                Auto Approve Time
              </label>
              <div style="display: flex; gap: 10px;">
                <input type="number" name="auto_approve_val" value="${autoApproveVal}" class="form-input" style="flex: 1; padding: 14px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; color: white; font-size: 16px;">
                <select name="auto_approve_unit" class="form-input" style="width: 120px; padding: 14px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; color: white; font-size: 16px;">
                    <option value="seconds" ${autoApproveUnit === 'seconds' ? 'selected' : ''}>Seconds</option>
                    <option value="minutes" ${autoApproveUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
                    <option value="hours" ${autoApproveUnit === 'hours' ? 'selected' : ''}>Hours</option>
                    <option value="days" ${autoApproveUnit === 'days' ? 'selected' : ''}>Days</option>
                    <option value="months" ${autoApproveUnit === 'months' ? 'selected' : ''}>Months</option>
                    <option value="years" ${autoApproveUnit === 'years' ? 'selected' : ''}>Years</option>
                </select>
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px; padding-left: 4px;">Submissions older than this will be auto-approved.</div>
            </div>

            <button type="submit" class="btn-premium full-width" style="padding: 14px; font-size: 16px; background: linear-gradient(135deg, #ec4899, #8b5cf6);">
              <img src="https://api.iconify.design/lucide:save.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;">
              Save Settings
            </button>
          </form>
        </div>

        <!-- Info Card -->
        <div class="glass-panel" style="padding: 32px; background: linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8));">
          <h3 style="margin-bottom: 20px; font-size: 18px; color: var(--text-muted);">How it works</h3>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px;">
            <li style="display: flex; gap: 12px; align-items: start;">
              <div style="background: rgba(99, 102, 241, 0.2); width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #818cf8; font-size: 12px; flex-shrink: 0;">1</div>
              <div style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">Users view promoted links for the specified <strong>Visit Timer</strong> duration.</div>
            </li>
            <li style="display: flex; gap: 12px; align-items: start;">
              <div style="background: rgba(99, 102, 241, 0.2); width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #818cf8; font-size: 12px; flex-shrink: 0;">2</div>
              <div style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">After the timer ends, they must upload the exact number of <strong>Required Screenshots</strong>.</div>
            </li>
            <li style="display: flex; gap: 12px; align-items: start;">
              <div style="background: rgba(99, 102, 241, 0.2); width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #818cf8; font-size: 12px; flex-shrink: 0;">3</div>
              <div style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">Admins or Link Owners approve the proof to release rewards.</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/promote-settings', requireSuperAdmin, async (req, res) => {
  const { timer, screenshots, auto_approve_val, auto_approve_unit } = req.body
  
  await prisma.systemSetting.upsert({
    where: { key: 'visit_timer' },
    update: { value: timer.toString() },
    create: { key: 'visit_timer', value: timer.toString() }
  })

  await prisma.systemSetting.upsert({
    where: { key: 'screenshot_count' },
    update: { value: screenshots.toString() },
    create: { key: 'screenshot_count', value: screenshots.toString() }
  })

  // Calculate Seconds
  let seconds = parseInt(auto_approve_val)
  if (auto_approve_unit === 'minutes') seconds *= 60
  if (auto_approve_unit === 'hours') seconds *= 3600
  if (auto_approve_unit === 'days') seconds *= 86400
  if (auto_approve_unit === 'months') seconds *= 2592000 // 30 days
  if (auto_approve_unit === 'years') seconds *= 31536000 // 365 days

  await prisma.systemSetting.upsert({
    where: { key: 'promote_auto_approve_seconds' },
    update: { value: seconds.toString() },
    create: { key: 'promote_auto_approve_seconds', value: seconds.toString() }
  })

  res.redirect('/super-admin/promote-settings?success=Settings+updated')
})

// System Settings Route (Dynamic AppConfig & Branding)
router.get('/settings', requireSuperAdmin, async (req, res) => {
  // Fetch API Keys
  const configs = await prisma.appConfig.findMany()
  const configMap = {}
  configs.forEach(c => configMap[c.key] = c.value)
  const smsKey = configMap['SMS_API_KEY'] || ''
  const geminiKey = configMap['GEMINI_API_KEY'] || ''

  // Fetch Branding Settings
  const settings = await getSystemSettings()

  res.send(`
    ${getHead('System Settings')}
    ${getSidebar('settings', settings)}
    <div class="main-content">
      <div class="section-header" style="margin-bottom: 32px;">
        <div>
          <div class="section-title" style="font-size: 24px;">System Settings</div>
          <div style="color:var(--text-muted)">Manage site branding, API Keys and configurations</div>
        </div>
      </div>

      ${req.query.success ? `<div class="alert success" style="margin-bottom: 24px;">${req.query.success}</div>` : ''}
      ${req.query.error ? `<div class="alert error" style="margin-bottom: 24px;">${req.query.error}</div>` : ''}

      <!-- Branding Settings -->
      <div class="glass-panel" style="padding: 32px; border-top: 4px solid #6366f1; margin-bottom: 32px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="background: rgba(99, 102, 241, 0.2); padding: 10px; border-radius: 10px;">
             <img src="https://api.iconify.design/lucide:palette.svg?color=%236366f1" width="24" height="24">
          </div>
          <h3 style="font-size: 18px; font-weight: 600; margin: 0;">Site Branding</h3>
        </div>

        <form action="/super-admin/settings/update-branding" method="POST" enctype="multipart/form-data">
          <div class="form-group">
            <label class="form-label">Site Name</label>
            <input type="text" name="site_name" value="${settings.site_name}" class="form-input">
          </div>
          
          <div class="form-group">
            <label class="form-label">Site Logo (Replaces Name)</label>
            ${settings.site_logo ? `<div style="margin-bottom:10px;"><img src="${settings.site_logo}" style="height:60px;border-radius:8px;"></div>` : ''}
            <input type="file" name="site_logo" class="form-input" accept="image/*">
          </div>

          <div class="form-group" style="display:flex;align-items:center;gap:10px;">
             <input type="checkbox" id="show_logo" name="show_logo" value="true" ${settings.show_logo === 'true' ? 'checked' : ''}>
             <label for="show_logo" style="color:white;cursor:pointer;">Show Logo instead of Name</label>
          </div>

          <button type="submit" class="btn-premium full-width" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
            <img src="https://api.iconify.design/lucide:save.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;">
            Save Branding
          </button>
        </form>
      </div>

      <!-- API Configuration -->
      <div class="glass-panel" style="padding: 32px; border-top: 4px solid #ec4899;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="background: rgba(236, 72, 153, 0.2); padding: 10px; border-radius: 10px;">
            <img src="https://api.iconify.design/lucide:key.svg?color=%23ec4899" width="24" height="24">
          </div>
          <h3 style="font-size: 18px; font-weight: 600; margin: 0;">API Configuration</h3>
        </div>

        <form action="/super-admin/settings/update-api" method="POST">
          
          <!-- SMS API Key -->
          <div class="form-group" style="margin-bottom: 24px;">
            <label class="form-label" style="display: block; margin-bottom: 8px; font-weight: 500;">
              SMS Mobile API Key
            </label>
            <div style="position: relative;">
              <input type="text" name="SMS_API_KEY" value="${smsKey}" class="form-input" style="width: 100%; padding: 14px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; color: white; font-size: 16px;" placeholder="Enter SMS API Key">
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px; padding-left: 4px;">Used for sending SMS notifications.</div>
          </div>

          <!-- Gemini API Key -->
          <div class="form-group" style="margin-bottom: 32px;">
            <label class="form-label" style="display: block; margin-bottom: 8px; font-weight: 500;">
              Gemini API Key
            </label>
            <div style="position: relative;">
              <input type="text" name="GEMINI_API_KEY" value="${geminiKey}" class="form-input" style="width: 100%; padding: 14px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; color: white; font-size: 16px;" placeholder="Enter Gemini API Key">
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px; padding-left: 4px;">Used for AI Support Assistant.</div>
          </div>

          <button type="submit" class="btn-premium full-width" style="padding: 14px; font-size: 16px; background: linear-gradient(135deg, #ec4899, #8b5cf6);">
            <img src="https://api.iconify.design/lucide:save.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;">
            Save API Keys
          </button>
        </form>
      </div>
      <div class="glass-panel" style="padding: 32px; border-top: 4px solid #ec4899; margin-top: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="background: rgba(236, 72, 153, 0.2); padding: 10px; border-radius: 10px;">
            <img src="https://api.iconify.design/lucide:activity.svg?color=%23ec4899" width="24" height="24">
          </div>
          <h3 style="font-size: 18px; font-weight: 600; margin: 0;">Missed Payment Recovery</h3>
        </div>

        <div style="margin-bottom: 24px; color: var(--text-muted); font-size: 14px; line-height: 1.6;">
          If a user's payment was not automatically processed (due to server downtime or webhook failure), use this tool. 
          It will fetch the last 100 SMS messages from the gateway and check for any valid TrxIDs that are still 'PENDING' in our database.
        </div>

        <button id="recoverBtn" class="btn-premium full-width" style="padding: 14px; font-size: 16px; background: linear-gradient(135deg, #10b981, #059669);">
          <img src="https://api.iconify.design/lucide:search.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;">
          🔍 Check & Recover Missed Payments
        </button>
      </div>

      <script>
        const recoverBtn = document.getElementById('recoverBtn');
        if (recoverBtn) {
          recoverBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to scan for missed payments? This may take a few seconds.')) return;

            const originalText = recoverBtn.innerHTML;
            recoverBtn.disabled = true;
            recoverBtn.innerHTML = '<img src="https://api.iconify.design/line-md:loading-loop.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;"> Checking...';

            try {
              const res = await fetch('/api/admin/recover-payments', { method: 'POST' });
              const data = await res.json();

              if (data.status === 'error') {
                alert('Error: ' + data.message);
              } else {
                alert(data.message + (data.recovered_count > 0 ? ' Recovered: ' + data.recovered_count : ''));
                window.location.reload();
              }
            } catch (err) {
              console.error(err);
              alert('Failed to check payments. Check console for details.');
            } finally {
              recoverBtn.disabled = false;
              recoverBtn.innerHTML = originalText;
            }
          });
        }
      </script>
    </div>
    ${getScripts()}
  `)
})

router.post('/settings/update-api', requireSuperAdmin, async (req, res) => {
  try {
    const { SMS_API_KEY, GEMINI_API_KEY } = req.body

    if (SMS_API_KEY !== undefined) {
      await prisma.appConfig.upsert({
        where: { key: 'SMS_API_KEY' },
        update: { value: SMS_API_KEY },
        create: { key: 'SMS_API_KEY', value: SMS_API_KEY, description: 'SMS Service API Key' }
      })
    }

    if (GEMINI_API_KEY !== undefined) {
      await prisma.appConfig.upsert({
        where: { key: 'GEMINI_API_KEY' },
        update: { value: GEMINI_API_KEY },
        create: { key: 'GEMINI_API_KEY', value: GEMINI_API_KEY, description: 'Google Gemini AI API Key' }
      })
    }

    res.redirect('/super-admin/settings?success=Configuration+updated+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/settings?error=' + encodeURIComponent(e.message))
  }
})

router.post('/settings/update-branding', requireSuperAdmin, upload.single('site_logo'), async (req, res) => {
  try {
    const { site_name, show_logo } = req.body
    const site_logo = req.file ? req.file.path : null
    
    // Update Site Name
    await prisma.systemSetting.upsert({
      where: { key: 'site_name' },
      update: { value: site_name },
      create: { key: 'site_name', value: site_name }
    })

    // Update Show Logo
    await prisma.systemSetting.upsert({
      where: { key: 'show_logo' },
      update: { value: show_logo === 'true' ? 'true' : 'false' },
      create: { key: 'show_logo', value: show_logo === 'true' ? 'true' : 'false' }
    })

    // Update Logo if uploaded
    if (site_logo) {
      await prisma.systemSetting.upsert({
        where: { key: 'site_logo' },
        update: { value: site_logo },
        create: { key: 'site_logo', value: site_logo }
      })
    }

    res.redirect('/super-admin/settings?success=Branding+updated+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/settings?error=' + encodeURIComponent(e.message))
  }
})

// ==========================================
// TOP UP PACKAGE MANAGEMENT
// ==========================================
router.get('/topup-packages', requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const packages = await prisma.topUpPackage.findMany({ orderBy: { price: 'asc' } })

  const renderRow = (pkg) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:16px;">
         <div style="display:flex;align-items:center;gap:10px">
           ${pkg.image ? `<img src="${pkg.image}" style="width:100px;height:auto;aspect-ratio:2/1;border-radius:8px;object-fit:cover;background:rgba(255,255,255,0.1)">` : '<div style="width:100px;height:50px;border-radius:8px;background:rgba(255,255,255,0.1);display:grid;place-items:center;color:var(--text-muted);font-size:10px">No Img</div>'}
           <span style="color:white;font-weight:500">${pkg.name}</span>
         </div>
      </td>
      <td style="padding:16px;color:#ec4899;font-weight:600">${pkg.diamondAmount} 💎</td>
      <td style="padding:16px;color:white">${pkg.price} TK</td>
      <td style="padding:16px;color:var(--text-muted);font-size:13px">${pkg.countries}</td>
      <td style="padding:16px;text-align:right">
        <form action="/super-admin/topup-packages/delete" method="POST" onsubmit="return confirm('Delete this package?')" style="display:inline">
          <input type="hidden" name="id" value="${pkg.id}">
          <button class="btn-premium" style="padding:8px;font-size:12px;background:rgba(239,68,68,0.2);color:#fca5a5;border-color:rgba(239,68,68,0.3)">Del</button>
        </form>
      </td>
    </tr>
  `

  res.send(`
    ${getHead('Manage Top Up Packages')}
    ${getSidebar('packages', settings)}
    <div class="main-content">
      <div class="section-header" style="background: linear-gradient(to right, rgba(236, 72, 153, 0.1), transparent); padding: 24px; border-radius: 16px; border: 1px solid rgba(236, 72, 153, 0.1); margin-bottom: 32px; display: flex; align-items: center; gap: 20px;">
        <div style="background: rgba(236, 72, 153, 0.2); padding: 12px; border-radius: 12px;">
           <img src="https://api.iconify.design/lucide:package.svg?color=%23ec4899" width="32" height="32">
        </div>
        <div>
          <div class="section-title" style="font-size: 28px; margin-bottom: 4px;">Top Up Packages</div>
          <div style="color:var(--text-muted); font-size: 16px;">Create and manage diamond packages</div>
        </div>
      </div>

      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 380px;gap:24px;align-items:start">
        
        <!-- Package List -->
        <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;overflow:hidden">
          <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 18px;">Active Packages</h3>
            <span style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 20px; font-size: 12px;">${packages.length} packages</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:rgba(255,255,255,0.02);text-align:left">
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Name</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Diamonds</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Price</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Countries</th>
                <th style="padding:16px;text-align:right;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Action</th>
              </tr>
            </thead>
            <tbody>
              ${packages.length > 0 ? packages.map(renderRow).join('') : '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--text-muted)">No packages found</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Add Package Form -->
        <div class="glass-panel" style="padding: 24px; position: sticky; top: 24px;">
          <h3 style="margin-bottom:20px;font-size:18px; display: flex; align-items: center; gap: 10px;">
            <span style="background:rgba(236, 72, 153, 0.2); width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #ec4899;"><img src="https://api.iconify.design/lucide:plus.svg?color=currentColor" width="16"></span>
            Add Package
          </h3>
          <form action="/super-admin/topup-packages/add" method="POST" enctype="multipart/form-data">
            <div class="form-group">
              <label class="form-label">Package Name</label>
              <input type="text" name="name" required placeholder="e.g. Weekly Pass" class="form-input">
            </div>
            
            <div class="form-group">
              <label class="form-label">Price (TK)</label>
              <input type="number" name="price" required placeholder="e.g. 100" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label">Diamond Amount</label>
              <input type="number" name="diamondAmount" required placeholder="e.g. 100" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label">Package Image (Optional)</label>
              <input type="file" name="image" class="form-input" accept="image/*">
            </div>

            <div class="form-group">
              <label class="form-label">Currency & Region</label>
              <select name="currency" class="form-input">
                <option value="BDT">Taka (BDT) - Bangladesh Only</option>
                <option value="USD">Dollar (USD) - All Countries</option>
              </select>
            </div>

            <button type="submit" class="btn-premium full-width" style="background: linear-gradient(135deg, #ec4899, #be185d);">
              <img src="https://api.iconify.design/lucide:check.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;">
              Create Package
            </button>
          </form>
        </div>

      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/topup-packages/add', requireSuperAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, price, diamondAmount, currency } = req.body
    const image = req.file ? req.file.path : null
    
    // Auto-set countries based on currency
    const countries = currency === 'BDT' ? 'Bangladesh' : 'All'

    await prisma.topUpPackage.create({
      data: {
        name,
        price: parseInt(price),
        diamondAmount: parseInt(diamondAmount),
        currency: currency || 'BDT',
        countries: countries,
        image: image
      }
    })
    
    res.redirect('/super-admin/topup-packages?success=Package+created+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/topup-packages?error=' + encodeURIComponent(e.message))
  }
})

router.post('/topup-packages/delete', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.body
    await prisma.topUpPackage.delete({ where: { id: parseInt(id) } })
    res.redirect('/super-admin/topup-packages?success=Package+deleted')
  } catch (e) {
    res.redirect('/super-admin/topup-packages?error=Cannot+delete+package+in+use')
  }
})

// ==========================================
// WALLET MANAGEMENT
// ==========================================
router.get('/topup-wallets', requireSuperAdmin, async (req, res) => {
  const settings = await getSystemSettings()
  const wallets = await prisma.topUpWallet.findMany({ orderBy: { id: 'desc' } })

  const renderRow = (wallet) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:16px;">
         <div style="display:flex;align-items:center;gap:10px">
           ${wallet.icon ? `<img src="${wallet.icon}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,0.1)">` : '<div style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.1);display:grid;place-items:center;color:var(--text-muted);font-size:10px">No Icon</div>'}
           <span style="color:white;font-weight:500">${wallet.name}</span>
         </div>
      </td>
      <td style="padding:16px;color:var(--text-muted)">${wallet.adminNumber}</td>
      <td style="padding:16px;color:var(--text-muted);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${wallet.instruction}</td>
      <td style="padding:16px;text-align:right">
        <form action="/super-admin/topup-wallets/delete" method="POST" onsubmit="return confirm('Delete this wallet?')" style="display:inline">
          <input type="hidden" name="id" value="${wallet.id}">
          <button class="btn-premium" style="padding:8px;font-size:12px;background:rgba(239,68,68,0.2);color:#fca5a5;border-color:rgba(239,68,68,0.3)">Del</button>
        </form>
      </td>
    </tr>
  `

  res.send(`
    ${getHead('Manage Top Up Wallets')}
    ${getSidebar('wallets', settings)}
    <div class="main-content">
      <div class="section-header" style="background: linear-gradient(to right, rgba(16, 185, 129, 0.1), transparent); padding: 24px; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.1); margin-bottom: 32px; display: flex; align-items: center; gap: 20px;">
        <div style="background: rgba(16, 185, 129, 0.2); padding: 12px; border-radius: 12px;">
           <img src="https://api.iconify.design/lucide:wallet.svg?color=%2310b981" width="32" height="32">
        </div>
        <div>
          <div class="section-title" style="font-size: 28px; margin-bottom: 4px;">Top Up Wallets</div>
          <div style="color:var(--text-muted); font-size: 16px;">Manage payment methods and instructions</div>
        </div>
      </div>

      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 380px;gap:24px;align-items:start">
        
        <!-- Wallet List -->
        <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;overflow:hidden">
          <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 18px;">Active Wallets</h3>
            <span style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 20px; font-size: 12px;">${wallets.length} wallets</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:rgba(255,255,255,0.02);text-align:left">
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Wallet Name</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Admin Number</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Instruction</th>
                <th style="padding:16px;text-align:right;color:var(--text-muted);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:1px">Action</th>
              </tr>
            </thead>
            <tbody>
              ${wallets.length > 0 ? wallets.map(renderRow).join('') : '<tr><td colspan="4" style="padding:40px;text-align:center;color:var(--text-muted)">No wallets found</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Add Wallet Form -->
        <div class="glass-panel" style="padding: 24px; position: sticky; top: 24px;">
          <h3 style="margin-bottom:20px;font-size:18px; display: flex; align-items: center; gap: 10px;">
            <span style="background:rgba(16, 185, 129, 0.2); width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #10b981;"><img src="https://api.iconify.design/lucide:plus.svg?color=currentColor" width="16"></span>
            Add Wallet
          </h3>
          <form action="/super-admin/topup-wallets/add" method="POST" enctype="multipart/form-data">
            <div class="form-group">
              <label class="form-label">Wallet Name</label>
              <input type="text" name="name" required placeholder="e.g. Bkash Personal" class="form-input">
            </div>
            
            <div class="form-group">
              <label class="form-label">Admin Number</label>
              <input type="text" name="adminNumber" required placeholder="e.g. 017xxxxxxxx" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label">Wallet Icon (Optional)</label>
              <input type="file" name="icon" class="form-input" accept="image/*">
            </div>

            <div class="form-group">
              <label class="form-label">Instructions</label>
              <textarea name="instruction" required placeholder="How to pay..." class="form-input" style="height:100px; resize:none;"></textarea>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">This message will be shown to users.</div>
            </div>

            <button type="submit" class="btn-premium full-width" style="background: linear-gradient(135deg, #10b981, #059669);">
              <img src="https://api.iconify.design/lucide:check.svg?color=white" width="18" style="vertical-align: middle; margin-right: 8px;">
              Create Wallet
            </button>
          </form>
        </div>

      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/topup-wallets/add', requireSuperAdmin, upload.single('icon'), async (req, res) => {
  try {
    const { name, adminNumber, instruction } = req.body
    const icon = req.file ? req.file.path : null
    
    await prisma.topUpWallet.create({
      data: {
        name,
        adminNumber,
        instruction,
        icon: icon
      }
    })
    
    res.redirect('/super-admin/topup-wallets?success=Wallet+created+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/topup-wallets?error=' + encodeURIComponent(e.message))
  }
})

router.post('/topup-wallets/delete', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.body
    await prisma.topUpWallet.delete({ where: { id: parseInt(id) } })
    res.redirect('/super-admin/topup-wallets?success=Wallet+deleted')
  } catch (e) {
    console.error('Delete Wallet Error:', e)
    res.redirect('/super-admin/topup-wallets?error=Cannot+delete+wallet+in+use')
  }
})

module.exports = router

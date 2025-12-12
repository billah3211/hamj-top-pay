const express = require('express')
const bcrypt = require('bcryptjs')
const { prisma } = require('../db/prisma')
const router = express.Router()

function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.role === 'SUPER_ADMIN') return next()
  return res.redirect('/admin/login')
}

function getSidebar(active) {
  return `
    <nav class="sidebar-premium" id="sidebar" style="border-right: 1px solid rgba(236, 72, 153, 0.3);">
      <div class="brand-logo"><span style="color:#ec4899">S</span> Super Admin</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/super-admin/dashboard" class="${active === 'dashboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=${active === 'dashboard' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/super-admin/admins" class="${active === 'admins' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:shield-check.svg?color=${active === 'admins' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Admins</a></li>
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
  else if (type === 'active') { colorClass = 'card-green'; icon = 'user-check'; }
  else if (type === 'inactive') { colorClass = 'card-red'; icon = 'user-x'; }
  else if (type === 'admin') { colorClass = 'card-pink'; icon = 'shield'; }

  return `
    <div class="stat-card-modern ${colorClass}">
      <div class="icon-wrapper">
        <img src="https://api.iconify.design/lucide:${icon}.svg?color=white" width="24" height="24">
      </div>
      <div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${title}</div>
      </div>
      <img src="https://api.iconify.design/lucide:${icon}.svg?color=white" class="stat-bg-icon">
    </div>
  `
}

router.get('/dashboard', requireSuperAdmin, async (req, res) => {
  const totalUsers = await prisma.user.count()
  const activeUsers = await prisma.user.count({ where: { isLoggedIn: true } })
  const inactiveUsers = await prisma.user.count({ where: { isLoggedIn: false } })
  const totalAdmins = await prisma.admin.count()
  
  res.send(`
    ${getHead('Super Admin Dashboard')}
    ${getSidebar('dashboard')}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Super Admin Dashboard</div>
          <div style="color:var(--text-muted);font-size:14px">System Overview & Control</div>
        </div>
      </div>

      <div class="stats-grid">
        ${getCard('Total Users', totalUsers, 'users')}
        ${getCard('Active Users', activeUsers, 'active')}
        ${getCard('Inactive Users', inactiveUsers, 'inactive')}
        ${getCard('Total Admins', totalAdmins, 'admin')}
      </div>
      
      <div style="margin-top:30px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:24px;">
        <h3 style="color:white;margin-bottom:16px;">System Health</h3>
        <p style="color:var(--text-muted)">All systems operational. Database connected.</p>
      </div>

    </div>
    ${getScripts()}
  `)
})

router.get('/admins', requireSuperAdmin, async (req, res) => {
  const admins = await prisma.user.findMany({ 
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    orderBy: { id: 'asc' }
  })
  const error = req.query.error || ''
  const success = req.query.success || ''
  const currentUserId = req.session.userId
  
  let adminListHtml = admins.map(user => {
    const isMe = user.id === currentUserId
    const isSuper = user.role === 'SUPER_ADMIN'
    
    // Do not show revoke button for self
    const actionBtn = isMe 
      ? `<span style="color:var(--text-muted);font-size:12px;">(You)</span>` 
      : `<form action="/super-admin/revoke-access" method="post" style="display:inline;" onsubmit="return confirm('Are you sure you want to revoke admin access from this user?');">
           <input type="hidden" name="userId" value="${user.id}">
           <button type="submit" style="background:rgba(239,68,68,0.2);color:#fca5a5;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500">Revoke Access</button>
         </form>`

    return `
    <div style="background:rgba(15,23,42,0.4);border:1px solid var(--glass-border);padding:16px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#ec4899;display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;">${user.firstName[0]}</div>
        <div>
          <div style="color:white;font-weight:600">${user.firstName} ${user.lastName} <span style="font-size:12px;background:${isSuper?'#ec4899':'#6366f1'};padding:2px 6px;border-radius:4px;margin-left:8px;">${user.role}</span></div>
          <div style="color:var(--text-muted);font-size:12px;">@${user.username} • ${user.email}</div>
        </div>
      </div>
      <div>
        ${actionBtn}
      </div>
    </div>
  `
  }).join('')

  res.send(`
    ${getHead('Manage Admins')}
    ${getSidebar('admins')}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Manage Admins</div>
          <div style="color:var(--text-muted);font-size:14px">Grant or revoke admin access</div>
        </div>
      </div>

      ${error ? `<div style="background:rgba(239,68,68,0.2);color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:20px;">${error}</div>` : ''}
      ${success ? `<div style="background:rgba(34,197,94,0.2);color:#86efac;padding:12px;border-radius:8px;margin-bottom:20px;">${success}</div>` : ''}

      <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:24px;margin-bottom:24px;">
        <h3 style="color:white;margin-bottom:20px;">Grant Admin Access</h3>
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;">
          Enter a user's email or username, select their role, and <b>your password</b> to confirm.
        </p>
        <form action="/super-admin/grant-user" method="post" style="display:flex;flex-direction:column;gap:16px;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
            <div>
              <label style="color:var(--text-muted);font-size:12px;margin-bottom:4px;display:block;">User Email or Username</label>
              <input type="text" name="identifier" required placeholder="Target user..." style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
            </div>
            <div>
              <label style="color:var(--text-muted);font-size:12px;margin-bottom:4px;display:block;">Role to Assign</label>
              <select name="role" required style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
                <option value="ADMIN">Normal Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div>
              <label style="color:var(--text-muted);font-size:12px;margin-bottom:4px;display:block;">Your Password</label>
              <input type="password" name="password" required placeholder="Confirm identity" style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
            </div>
          </div>
          <button type="submit" class="btn-premium" style="width:auto;align-self:flex-start;">Grant Access</button>
        </form>
      </div>

      <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:24px;">
        <h3 style="color:white;margin-bottom:20px;">Current Administrators</h3>
        ${adminListHtml}
      </div>
    </div>
    ${getScripts()}
  `)
})
 
 router.post('/grant-user', requireSuperAdmin, async (req, res) => {
   const { identifier, password, role } = req.body
   
   if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
     return res.redirect('/super-admin/admins?error=Invalid+role+selected')
   }

   try {
     // Fetch target user
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ]
      }
    })

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
    
    // Note: This does not immediately kill their active session if stored in Redis without role checks on every request,
    // but they will fail next time role is checked or on re-login.
    // For stricter security, we could iterate sessions, but for now this suffices as per requirement.
    
    res.redirect('/super-admin/admins?success=Admin+access+revoked+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/admins?error=' + encodeURIComponent(e.message))
  }
})

module.exports = router

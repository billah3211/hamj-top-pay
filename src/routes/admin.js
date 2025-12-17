const express = require('express')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const { prisma } = require('../db/prisma')
const router = express.Router()

function requireAdmin(req, res, next) {
  if (req.session && (req.session.admin || req.session.role === 'ADMIN' || req.session.role === 'SUPER_ADMIN')) return next()
  return res.status(400).send('400 Bad Request: Unauthorized Access')
}

function getSidebar(active, role) {
  const superLink = role === 'SUPER_ADMIN' ? 
    `<li class="nav-item" style="margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px"><a href="/super-admin/dashboard"><img src="https://api.iconify.design/lucide:shield.svg?color=%23ec4899" class="nav-icon"> <span style="color:#ec4899">Super Panel</span></a></li>` 
    : ''

  return `
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        ${superLink}
        <li class="nav-item"><a href="/admin/dashboard" class="${active === 'dashboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/admin/topup-requests" class="${active === 'topup-requests' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:inbox.svg?color=%2394a3b8" class="nav-icon"> TopUp Requests</a></li>
        <li class="nav-item"><a href="/admin/users" class="${active === 'users' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Users</a></li>
        <li class="nav-item"><a href="/admin/balances" class="${active === 'balances' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:wallet.svg?color=%2394a3b8" class="nav-icon"> Balances</a></li>
        <li class="nav-item"><a href="/admin/task-reports" class="${active === 'task-reports' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:alert-octagon.svg?color=%2394a3b8" class="nav-icon"> Task Reports</a></li>
        <li class="nav-item"><a href="/admin/promote-settings" class="${active === 'promote-settings' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Settings</a></li>
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

        (function(){
          var dt=document.querySelectorAll('.device-toggle-settings .tab');
          function applySkin(m){
            document.body.classList.remove('skin-desktop','skin-mobile');
            document.body.classList.add('skin-'+m);
            if(dt.length){dt.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-device')===m)})}
            try{localStorage.setItem('siteSkin',m)}catch(e){}
          }
          if(dt.length){dt.forEach(function(b){
            b.addEventListener('click',function(){applySkin(b.getAttribute('data-device'))})
          })}
          var init='desktop';
          try{init=localStorage.getItem('siteSkin')||'desktop';if(init!=='desktop'&&init!=='mobile'){init='mobile'}}catch(e){}
          applySkin(init);
        })();
      </script>
    </body>
    </html>
  `
}

router.get('/login', async (req, res) => {
  // Check if user is already logged in as admin
  if (req.session && (req.session.admin || req.session.role === 'ADMIN' || req.session.role === 'SUPER_ADMIN')) {
     if (req.session.role === 'SUPER_ADMIN') return res.redirect('/super-admin/dashboard')
     return res.redirect('/admin/dashboard')
  }

  // Security Check: Only allow if logged in as a user with ADMIN/SUPER_ADMIN role
  if (!req.session || !req.session.userId) {
     return res.status(400).send('400 Bad Request: Unauthorized Access')
  }

  try {
     const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
     const isSuperEmail = user && user.email === 'mdmasumbilla272829@gmail.com'
     
     if (!user || (!isSuperEmail && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
       return res.status(400).send('400 Bad Request: Unauthorized Access')
     }
   } catch(e) {
    return res.status(400).send('400 Bad Request: System Error')
  }

  const error = req.query.error || ''
  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Admin Login - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div class="glass-panel" style="width:100%;max-width:400px;padding:40px;">
          <div style="text-align:center;margin-bottom:30px;">
            <div style="font-size:24px;font-weight:800;color:white;">Admin Portal</div>
            <div style="color:var(--text-muted)">Please sign in to continue</div>
          </div>
          ${error ? `<div style="background:rgba(239,68,68,0.2);color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:14px">${error}</div>` : ''}
          <form method="post" action="/admin/auth/login" style="display:flex;flex-direction:column;gap:20px;">
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label style="color:var(--text-muted);font-size:14px;font-weight:500">Email Address</label>
              <input type="email" name="email" required style="background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:10px;color:white;font-size:16px;">
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label style="color:var(--text-muted);font-size:14px;font-weight:500">Password</label>
              <input type="password" name="password" required style="background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:10px;color:white;font-size:16px;">
            </div>
            <button type="submit" class="btn-premium" style="justify-content:center;margin-top:10px;">Sign In</button>
          </form>
        </div>
      </div>
      <script>
        (function(){
          var dt=document.querySelectorAll('.device-toggle-settings .tab');
          function applySkin(m){
            document.body.classList.remove('skin-desktop','skin-mobile');
            document.body.classList.add('skin-'+m);
            if(dt.length){dt.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-device')===m)})}
            try{localStorage.setItem('siteSkin',m)}catch(e){}
          }
          if(dt.length){dt.forEach(function(b){
            b.addEventListener('click',function(){applySkin(b.getAttribute('data-device'))})
          })}
          var init='desktop';
          try{init=localStorage.getItem('siteSkin')||'desktop';if(init!=='desktop'&&init!=='mobile'){init='mobile'}}catch(e){}
          applySkin(init);
        })();
      </script>
    </body>
    </html>
  `)
})

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  
  // Strict Security: Must be logged in as user
  if (!req.session || !req.session.userId) {
     return res.status(400).send('400 Bad Request: Unauthorized Access')
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    if (!user) return res.status(400).send('User not found')

    // Whitelist check
    const isSuperEmail = user.email === 'mdmasumbilla272829@gmail.com'

    if (!isSuperEmail && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return res.status(400).send('Unauthorized')
    }

    // Verify email matches session user (prevent confusion)
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
       return res.redirect(`/admin/login?error=Please login as ${user.email} first`)
    }

    const match = await bcrypt.compare(password, user.passwordHash)
    if (match) {
      req.session.admin = true
      req.session.role = user.role
      req.session.adminId = user.id // Use user ID as admin ID
      req.session.email = user.email

      // Auto-promote Super Admin
      if (isSuperEmail) {
        req.session.role = 'SUPER_ADMIN'
        if (user.role !== 'SUPER_ADMIN') {
          await prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } })
        }
      }

      if (req.session.role === 'SUPER_ADMIN') return res.redirect('/super-admin/dashboard')
      return res.redirect('/admin/dashboard')
    } else {
      return res.redirect('/admin/login?error=Invalid+credentials')
    }
  } catch (e) {
    console.error('Admin login db error:', e)
    return res.redirect('/admin/login?error=System+error')
  }
})

router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.admin = false
    req.session.role = null
    req.session.adminId = null
  }
  return res.redirect('/admin/login')
})

function getCard(title, value, type = 'default') {
  let colorClass = 'card-blue'
  let icon = 'layout-dashboard'
  
  if (type === 'users') { colorClass = 'card-blue'; icon = 'users'; }
  else if (type === 'active') { colorClass = 'card-green'; icon = 'user-check'; }
  else if (type === 'inactive') { colorClass = 'card-red'; icon = 'user-x'; }
  else if (type === 'diamond') { colorClass = 'card-purple'; icon = 'gem'; }
  else if (type === 'dollar') { colorClass = 'card-green'; icon = 'dollar-sign'; }
  else if (type === 'coin') { colorClass = 'card-orange'; icon = 'coins'; }
  else if (type === 'hamjt') { colorClass = 'card-pink'; icon = 'layers'; }
  else if (type === 'tk') { colorClass = 'card-indigo'; icon = 'banknote'; }

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

router.get('/dashboard', requireAdmin, async (req, res) => {
  const totalUsers = await prisma.user.count()
  const activeUsers = await prisma.user.count({ where: { isLoggedIn: true } })
  const inactiveUsers = await prisma.user.count({ where: { isLoggedIn: false } })
  const sums = await prisma.user.aggregate({ _sum: { diamond: true, dk: true, coin: true, lora: true, tk: true } })
  
  res.send(`
    ${getHead('Admin Dashboard')}
    ${getSidebar('dashboard', req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Dashboard Overview</div>
          <div style="color:var(--text-muted);font-size:14px">System statistics and metrics</div>
        </div>
      </div>

      <div class="balance-section">
        <div class="cards-scroll" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
          ${getCard('Total Users', totalUsers, 'users')}
          ${getCard('Active Users', activeUsers, 'active')}
          ${getCard('Inactive Users', inactiveUsers, 'inactive')}
          ${getCard('Total Diamond', sums._sum.diamond||0, 'diamond')}
          ${getCard('Total Dollar', '$' + (sums._sum.dk||0), 'dollar')}
          ${getCard('Total Coin', sums._sum.coin||0, 'coin')}
          ${getCard('Total HaMJ T', sums._sum.lora||0, 'hamjt')}
          ${getCard('Total Tk', (sums._sum.tk||0) + ' tk', 'tk')}
        </div>
      </div>
    </div>
    ${getScripts()}
  `)
})

router.get('/api/stats', requireAdmin, async (req, res) => {
  const totalUsers = await prisma.user.count()
  const activeUsers = await prisma.user.count({ where: { isLoggedIn: true } })
  const inactiveUsers = await prisma.user.count({ where: { isLoggedIn: false } })
  const sums = await prisma.user.aggregate({ _sum: { diamond: true, dk: true, coin: true, lora: true, tk: true } })
  res.json({ totalUsers, activeUsers, inactiveUsers, totals: { diamond: sums._sum.diamond||0, dk: sums._sum.dk||0, coin: sums._sum.coin||0, lora: sums._sum.lora||0, tk: sums._sum.tk||0 } })
})

router.get('/users', requireAdmin, async (req, res) => {
  const { q } = req.query
  let users = []

  if (q) {
    const where = {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } }
      ]
    }

    users = await prisma.user.findMany({ 
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  }

  const userList = users.map(u => {
    // Access Control Logic
    const isTargetAdmin = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'
    const isTargetMainAdmin = u.email === 'mdmasumbilla272829@gmail.com'
    const isCurrentMainAdmin = req.session.email === 'mdmasumbilla272829@gmail.com'

    // 1. Hide Main Admin from everyone except themselves
    if (isTargetMainAdmin && !isCurrentMainAdmin) return ''

    // 2. Determine Action Button
    let actionBtn = ''
    if (isTargetAdmin) {
       // Only Main Admin can manage other admins
       if (isCurrentMainAdmin) {
          actionBtn = `<a href="/admin/user/${u.id}" class="btn-premium" style="padding:8px 16px;font-size:12px;">Manage</a>`
       } else {
          // Others just see label
          actionBtn = `<span style="color:var(--text-muted);font-size:12px;background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:4px;">${u.role}</span>`
       }
    } else {
       // Everyone can manage normal users
       actionBtn = `<a href="/admin/user/${u.id}" class="btn-premium" style="padding:8px 16px;font-size:12px;">Manage</a>`
    }

    return `
    <div class="user-row" style="background:rgba(255,255,255,0.05);padding:16px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;">${u.firstName[0]}</div>
        <div>
          <div style="font-weight:600;color:white;">
            ${u.firstName} ${u.lastName} 
            ${u.isBlocked ? '<span style="color:red;font-size:12px">(Blocked)</span>' : ''}
            ${isTargetAdmin ? `<span style="font-size:10px;background:#ec4899;padding:2px 6px;border-radius:4px;margin-left:6px;">${u.role}</span>` : ''}
          </div>
          <div style="color:var(--text-muted);font-size:12px;">@${u.username} • ${u.email}</div>
        </div>
      </div>
      ${actionBtn}
    </div>
  `
  }).join('')
  
  res.send(`
    ${getHead('User Management')}
    ${getSidebar('users', req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">User Management</div>
          <div style="color:var(--text-muted);font-size:14px">Manage registered users</div>
        </div>
      </div>

      <div class="glass-panel" style="padding: 20px; margin-bottom: 24px;">
        <form action="/admin/users" method="get" style="display:flex;gap:12px;">
          <input type="text" name="q" value="${q || ''}" placeholder="Search by name, username, email..." class="form-input" style="flex:1;">
          <button type="submit" class="btn-premium">Search</button>
        </form>
      </div>

      <div class="user-list">
        ${userList || '<div style="color:var(--text-muted);text-align:center;padding:20px;">No users found</div>'}
      </div>
    </div>
    ${getScripts()}
  `)
})

router.get('/user/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } })
  if (!user) return res.send('User not found')

  // Access Control: Protect Admin/Super Admin accounts
  const isTargetAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
  const isTargetMainAdmin = user.email === 'mdmasumbilla272829@gmail.com'
  const isCurrentMainAdmin = req.session.email === 'mdmasumbilla272829@gmail.com'

  // 1. Main Admin is invisible/untouchable to everyone else
  if (isTargetMainAdmin && !isCurrentMainAdmin) {
    return res.status(400).send('Unauthorized Access')
  }

  // 2. Only Main Admin can manage other Admins
  if (isTargetAdmin && !isCurrentMainAdmin) {
    return res.status(400).send('Unauthorized: Only Main Admin can manage other admins')
  }

  res.send(`
    ${getHead('Manage ' + user.username)}
    ${getSidebar('users', req.session.role)}
    <style>
        .balance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .balance-card { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 16px; border: 1px solid transparent; }
        .balance-title { color: var(--text-muted); font-size: 14px; margin-bottom: 8px; }
        .balance-val { font-size: 24px; font-weight: 700; color: white; }
        
        /* New Form Styles */
        .selection-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .selection-card { position: relative; }
        .selection-card input { position: absolute; opacity: 0; cursor: pointer; inset: 0; z-index: 10; }
        .selection-content { 
          background: rgba(15, 23, 42, 0.6); border: 2px solid var(--glass-border); padding: 16px; border-radius: 12px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s; cursor: pointer; height: 100%;
        }
        .selection-card input:checked + .selection-content {
          border-color: var(--primary); background: rgba(99, 102, 241, 0.1); box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
        }
        .selection-icon { font-size: 24px; }
        .selection-label { font-weight: 600; font-size: 14px; }
        .check-mark { position: absolute; top: 8px; right: 8px; color: var(--primary); opacity: 0; transform: scale(0.5); transition: all 0.2s; }
        .selection-card input:checked + .selection-content .check-mark { opacity: 1; transform: scale(1); }

        .action-group { display: flex; gap: 16px; margin-bottom: 24px; }
        .action-label { flex: 1; cursor: pointer; }
        .action-content {
          padding: 16px; background: rgba(15, 23, 42, 0.6); border: 2px solid var(--glass-border); border-radius: 12px;
          text-align: center; font-weight: 600; transition: all 0.2s;
        }
        .action-label input { display: none; }
        .action-label input:checked + .action-content { border-color: var(--primary); background: rgba(99, 102, 241, 0.1); }
        .action-label input[value="cut"]:checked + .action-content { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }
    </style>
    <div class="main-content">
      <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="section-title">${user.firstName} ${user.lastName}</div>
          <div style="color:var(--text-muted)">@${user.username} • ${user.email}</div>
        </div>
        <a href="/admin/users" class="btn-premium">Back</a>
      </div>

      <div class="section-title" style="font-size:18px;margin-bottom:16px;">Current Balances</div>
      <div class="balance-grid">
        <div class="balance-card">
          <div class="balance-title">Diamond 💎</div>
          <div class="balance-val">${user.diamond}</div>
        </div>
        <div class="balance-card">
          <div class="balance-title">Dollar 💵</div>
          <div class="balance-val">$${user.dk}</div>
        </div>
        <div class="balance-card">
          <div class="balance-title">Coin 🪙</div>
          <div class="balance-val">${user.coin}</div>
        </div>
        <div class="balance-card">
          <div class="balance-title">HaMJ T 🔷</div>
          <div class="balance-val">${user.lora}</div>
        </div>
        <div class="balance-card">
          <div class="balance-title">Tk ৳</div>
          <div class="balance-val">${user.tk}</div>
        </div>
      </div>

      <div class="glass-panel" style="padding: 24px; margin-bottom: 32px;">
        <h3 class="section-title" style="margin-bottom: 24px; border-bottom: 1px solid var(--glass-border); padding-bottom: 16px;">Update Balance</h3>
        <form action="/admin/user/${user.id}/balance" method="post">
            
            <label class="form-label" style="margin-bottom: 12px; display:block; color:var(--text-muted);">1. Select Currency (Click to tick)</label>
            <div class="selection-grid">
                <label class="selection-card">
                    <input type="radio" name="type" value="diamond" required>
                    <div class="selection-content">
                        <span class="selection-icon">💎</span>
                        <span class="selection-label">Diamond</span>
                        <div class="check-mark">✔</div>
                    </div>
                </label>
                <label class="selection-card">
                    <input type="radio" name="type" value="dk">
                    <div class="selection-content">
                        <span class="selection-icon">💵</span>
                        <span class="selection-label">Dollar</span>
                        <div class="check-mark">✔</div>
                    </div>
                </label>
                <label class="selection-card">
                    <input type="radio" name="type" value="coin">
                    <div class="selection-content">
                        <span class="selection-icon">🪙</span>
                        <span class="selection-label">Coin</span>
                        <div class="check-mark">✔</div>
                    </div>
                </label>
                <label class="selection-card">
                    <input type="radio" name="type" value="lora">
                    <div class="selection-content">
                        <span class="selection-icon">🔷</span>
                        <span class="selection-label">HaMJ T</span>
                        <div class="check-mark">✔</div>
                    </div>
                </label>
                <label class="selection-card">
                    <input type="radio" name="type" value="tk">
                    <div class="selection-content">
                        <span class="selection-icon">৳</span>
                        <span class="selection-label">Tk</span>
                        <div class="check-mark">✔</div>
                    </div>
                </label>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div>
                    <label class="form-label" style="margin-bottom: 12px; display:block; color:var(--text-muted);">2. Select Action</label>
                    <div class="action-group">
                        <label class="action-label">
                            <input type="radio" name="action" value="add" checked>
                            <div class="action-content">Add (+)</div>
                        </label>
                        <label class="action-label">
                            <input type="radio" name="action" value="cut">
                            <div class="action-content">Cut (-)</div>
                        </label>
                    </div>
                </div>
                <div>
                    <label class="form-label" style="margin-bottom: 12px; display:block; color:var(--text-muted);">3. Enter Amount</label>
                    <input type="number" name="amount" class="form-input" required min="1" placeholder="0" style="width: 100%; padding: 16px; background: rgba(15,23,42,0.6); border: 2px solid var(--glass-border); border-radius: 12px; color: white; font-size: 18px;">
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <label class="form-label" style="margin-bottom: 12px; display:block; color:var(--text-muted);">4. Reason / Message</label>
                <textarea name="message" class="form-input" required placeholder="Write a message explaining this update..." style="width: 100%; padding: 16px; background: rgba(15,23,42,0.6); border: 2px solid var(--glass-border); border-radius: 12px; color: white; font-size: 16px; min-height: 100px;"></textarea>
            </div>

            <button type="submit" class="btn-premium" style="width: 100%; justify-content: center; font-size: 18px; padding: 16px;">Submit Update</button>
        </form>
      </div>

      <div class="section-title" style="font-size:18px;margin-bottom:16px;color:#ef4444;">Danger Zone</div>
      <div style="display:flex;gap:16px;">
        <form action="/admin/user/${user.id}/status" method="post" onsubmit="return confirm('Are you sure?')">
          <input type="hidden" name="action" value="${user.isBlocked ? 'unblock' : 'block'}">
          <button class="btn-premium" style="background:${user.isBlocked ? '#22c55e' : '#ef4444'};border:none;">
            ${user.isBlocked ? 'Unblock User' : 'Block User'}
          </button>
        </form>
        <form action="/admin/user/${user.id}/delete" method="post" onsubmit="return confirm('Delete this user permanently? This cannot be undone.')">
          <button class="btn-premium" style="background:#dc2626;border:none;">Delete Account</button>
        </form>
      </div>
    </div>

    ${getScripts()}
  `)
})

router.post('/user/:id/balance', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { type, action, amount, message } = req.body
  const val = parseInt(amount)
  
  if (isNaN(val) || val <= 0) return res.redirect('/admin/user/'+id)

  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } })
  if (!user) return res.send('User not found')

  // Access Control
  const isTargetAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
  const isTargetMainAdmin = user.email === 'mdmasumbilla272829@gmail.com'
  const isCurrentMainAdmin = req.session.email === 'mdmasumbilla272829@gmail.com'

  if (isTargetMainAdmin && !isCurrentMainAdmin) return res.status(400).send('Unauthorized')
  if (isTargetAdmin && !isCurrentMainAdmin) return res.status(400).send('Unauthorized')

  const updateData = {}
  if (action === 'add') {
    updateData[type] = { increment: val }
  } else {
    if (user[type] < val) return res.send('Insufficient balance to cut')
    updateData[type] = { decrement: val }
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: parseInt(id) }, data: updateData }),
    prisma.notification.create({
      data: {
        userId: parseInt(id),
        message: `Balance Update: ${action === 'add' ? '+' : '-'}${val} ${type.toUpperCase()}. Reason: ${message}`,
        type: action === 'add' ? 'credit' : 'debit'
      }
    })
  ])

  res.redirect('/admin/user/'+id)
})

router.post('/user/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { action } = req.body
  
  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } })
  if (!user) return res.send('User not found')

  // Access Control
  const isTargetAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
  const isTargetMainAdmin = user.email === 'mdmasumbilla272829@gmail.com'
  const isCurrentMainAdmin = req.session.email === 'mdmasumbilla272829@gmail.com'

  if (isTargetMainAdmin && !isCurrentMainAdmin) return res.status(400).send('Unauthorized')
  if (isTargetAdmin && !isCurrentMainAdmin) return res.status(400).send('Unauthorized')

  await prisma.user.update({
    where: { id: parseInt(id) },
    data: { isBlocked: action === 'block' }
  })
  res.redirect('/admin/user/'+id)
})

router.post('/user/:id/delete', requireAdmin, async (req, res) => {
  const { id } = req.params
  
  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } })
  if (!user) return res.send('User not found')

  // Access Control
  const isTargetAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
  const isTargetMainAdmin = user.email === 'mdmasumbilla272829@gmail.com'
  const isCurrentMainAdmin = req.session.email === 'mdmasumbilla272829@gmail.com'

  if (isTargetMainAdmin && !isCurrentMainAdmin) return res.status(400).send('Unauthorized')
  if (isTargetAdmin && !isCurrentMainAdmin) return res.status(400).send('Unauthorized')

  await prisma.user.delete({ where: { id: parseInt(id) } })
  res.redirect('/admin/users')
})

router.get('/balances', requireAdmin, async (req, res) => {
  const sums = await prisma.user.aggregate({ _sum: { diamond: true, dk: true, coin: true, lora: true, tk: true } })
  
  res.send(`
    ${getHead('Balance Overview')}
    ${getSidebar('balances', req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">System Balances</div>
          <div style="color:var(--text-muted);font-size:14px">Overview of all user balances</div>
        </div>
      </div>

      <div class="balance-section">
        <div class="cards-scroll" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
          ${getCard('Total Diamond', sums._sum.diamond||0, 'diamond')}
          ${getCard('Total Dollar', '$' + (sums._sum.dk||0), 'dollar')}
          ${getCard('Total Coin', sums._sum.coin||0, 'coin')}
          ${getCard('Total HaMJ T', sums._sum.lora||0, 'hamjt')}
          ${getCard('Total Tk', (sums._sum.tk||0) + ' tk', 'tk')}
        </div>
      </div>
    </div>
    ${getScripts()}
  `)
})

// Promote Settings
router.get('/promote-settings', requireAdmin, async (req, res) => {
  // Fetch settings
  const pkgSetting = await prisma.systemSetting.findUnique({ where: { key: 'promote_packages' } })
  const rewardSetting = await prisma.systemSetting.findUnique({ where: { key: 'promote_reward' } })
  const autoApproveSetting = await prisma.systemSetting.findUnique({ where: { key: 'promote_auto_approve_minutes' } })
  const timerSetting = await prisma.systemSetting.findUnique({ where: { key: 'visit_timer' } })
  const ssCountSetting = await prisma.systemSetting.findUnique({ where: { key: 'screenshot_count' } })

  // Defaults
  let packages = pkgSetting ? JSON.parse(pkgSetting.value) : [
    { visits: 500, coin: 200, diamond: 50 },
    { visits: 1000, coin: 400, diamond: 100 },
    { visits: 2000, coin: 800, diamond: 200 },
    { visits: 5000, coin: 2000, diamond: 500 },
    { visits: 10000, coin: 4000, diamond: 1000 }
  ]
  
  let rewards = rewardSetting ? JSON.parse(rewardSetting.value) : { coin: 5, diamond: 0, tk: 0 }
  let autoApproveMinutes = autoApproveSetting ? parseInt(autoApproveSetting.value) : 2880 // 48 hours
  let visitTimer = timerSetting ? parseInt(timerSetting.value) : 50
  let screenshotCount = ssCountSetting ? parseInt(ssCountSetting.value) : 2

  // Generate Package Rows
  const packageRows = packages.map((pkg, index) => `
    <div class="package-row" style="display:flex;gap:10px;margin-bottom:10px;align-items:center">
      <input type="number" name="pkg_visits[]" value="${pkg.visits}" placeholder="Visits" class="form-input" style="width:100px">
      <span style="color:var(--text-muted)">=</span>
      <input type="number" name="pkg_coin[]" value="${pkg.coin}" placeholder="Coins" class="form-input" style="width:100px">
      <span style="color:#fb923c">Coins</span>
      <span style="color:var(--text-muted)">+</span>
      <input type="number" name="pkg_diamond[]" value="${pkg.diamond}" placeholder="Diamonds" class="form-input" style="width:100px">
      <span style="color:#a855f7">Diamonds</span>
      <button type="button" onclick="this.parentElement.remove()" class="btn-premium" style="background:#ef4444;padding:4px 8px">×</button>
    </div>
  `).join('')

  res.send(`
    ${getHead('Promote Settings')}
    ${getSidebar('promote-settings', req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Promote System Settings</div>
          <div style="color:var(--text-muted);font-size:14px">Configure costs, rewards, and automation</div>
        </div>
      </div>

      <form action="/admin/promote-settings" method="POST">
        
        <!-- 1. Reward Settings -->
        <div class="glass-panel" style="padding:24px;margin-bottom:24px">
          <h3 class="section-title" style="margin-bottom:20px;font-size:18px">Visitor Rewards (Per Visit)</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:20px">
            <div class="form-group">
              <label class="form-label" style="display:block;margin-bottom:8px">Coins 🪙</label>
              <input type="number" name="reward_coin" value="${rewards.coin}" class="form-input" style="width:100%">
            </div>
            <div class="form-group">
              <label class="form-label" style="display:block;margin-bottom:8px">Diamonds 💎</label>
              <input type="number" name="reward_diamond" value="${rewards.diamond}" class="form-input" style="width:100%">
            </div>
            <div class="form-group">
              <label class="form-label" style="display:block;margin-bottom:8px">Taka/Cash ৳</label>
              <input type="number" name="reward_tk" value="${rewards.tk}" class="form-input" style="width:100%">
            </div>
          </div>
        </div>

        <!-- 2. Automation & Requirements -->
        <div class="glass-panel" style="padding:24px;margin-bottom:24px">
          <h3 class="section-title" style="margin-bottom:20px;font-size:18px">Automation & Rules</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:20px">
            <div class="form-group">
              <label class="form-label" style="display:block;margin-bottom:8px">Visit Timer (Seconds)</label>
              <input type="number" name="visit_timer" value="${visitTimer}" class="form-input" style="width:100%">
            </div>
            <div class="form-group">
              <label class="form-label" style="display:block;margin-bottom:8px">Screenshots Required</label>
              <input type="number" name="screenshot_count" value="${screenshotCount}" class="form-input" style="width:100%">
            </div>
            <div class="form-group">
              <label class="form-label" style="display:block;margin-bottom:8px">Auto-Approve After (Minutes)</label>
              <input type="number" name="auto_approve_minutes" value="${autoApproveMinutes}" class="form-input" style="width:100%">
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">1 day = 1440 min, 2 days = 2880 min</div>
            </div>
          </div>
        </div>

        <!-- 3. Package Costs -->
        <div class="glass-panel" style="padding:24px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h3 class="section-title" style="font-size:18px;margin:0">Promotion Packages</h3>
            <button type="button" onclick="addPackageRow()" class="btn-premium" style="font-size:12px">+ Add Package</button>
          </div>
          <div id="packageContainer">
            ${packageRows}
          </div>
        </div>

        <button type="submit" class="btn-premium full-width" style="font-size:16px;padding:12px">Save Settings</button>
      </form>
    </div>
    ${getScripts()}
    <script>
      function addPackageRow() {
        const div = document.createElement('div');
        div.className = 'package-row';
        div.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;align-items:center';
        div.innerHTML = \`
          <input type="number" name="pkg_visits[]" placeholder="Visits" class="form-input" style="width:100px">
          <span style="color:var(--text-muted)">=</span>
          <input type="number" name="pkg_coin[]" placeholder="Coins" class="form-input" style="width:100px">
          <span style="color:#fb923c">Coins</span>
          <span style="color:var(--text-muted)">+</span>
          <input type="number" name="pkg_diamond[]" placeholder="Diamonds" class="form-input" style="width:100px">
          <span style="color:#a855f7">Diamonds</span>
          <button type="button" onclick="this.parentElement.remove()" class="btn-premium" style="background:#ef4444;padding:4px 8px">×</button>
        \`;
        document.getElementById('packageContainer').appendChild(div);
      }
    </script>
  `)
})

router.post('/promote-settings', requireAdmin, async (req, res) => {
  try {
    const { 
      reward_coin, reward_diamond, reward_tk,
      visit_timer, screenshot_count, auto_approve_minutes,
      pkg_visits, pkg_coin, pkg_diamond
    } = req.body

    // Process Rewards
    const rewards = {
      coin: parseInt(reward_coin) || 0,
      diamond: parseInt(reward_diamond) || 0,
      tk: parseInt(reward_tk) || 0
    }

    // Process Packages
    let packages = []
    if (pkg_visits) {
      // If single item, it might not be an array, ensure array
      const visits = Array.isArray(pkg_visits) ? pkg_visits : [pkg_visits]
      const coins = Array.isArray(pkg_coin) ? pkg_coin : [pkg_coin]
      const diamonds = Array.isArray(pkg_diamond) ? pkg_diamond : [pkg_diamond]

      for (let i = 0; i < visits.length; i++) {
        if (visits[i] && (coins[i] || diamonds[i])) {
          packages.push({
            visits: parseInt(visits[i]),
            coin: parseInt(coins[i]) || 0,
            diamond: parseInt(diamonds[i]) || 0
          })
        }
      }
    }
    // Sort packages by visits
    packages.sort((a, b) => a.visits - b.visits)

    // Save all settings
    const upsert = async (key, val) => {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: val },
        create: { key, value: val }
      })
    }

    await prisma.$transaction([
      prisma.systemSetting.upsert({ where: { key: 'promote_reward' }, update: { value: JSON.stringify(rewards) }, create: { key: 'promote_reward', value: JSON.stringify(rewards) } }),
      prisma.systemSetting.upsert({ where: { key: 'promote_packages' }, update: { value: JSON.stringify(packages) }, create: { key: 'promote_packages', value: JSON.stringify(packages) } }),
      prisma.systemSetting.upsert({ where: { key: 'promote_auto_approve_minutes' }, update: { value: auto_approve_minutes.toString() }, create: { key: 'promote_auto_approve_minutes', value: auto_approve_minutes.toString() } }),
      prisma.systemSetting.upsert({ where: { key: 'visit_timer' }, update: { value: visit_timer.toString() }, create: { key: 'visit_timer', value: visit_timer.toString() } }),
      prisma.systemSetting.upsert({ where: { key: 'screenshot_count' }, update: { value: screenshot_count.toString() }, create: { key: 'screenshot_count', value: screenshot_count.toString() } })
    ])

    res.redirect('/admin/promote-settings?success=Settings+Saved')
  } catch (e) {
    console.error(e)
    res.redirect('/admin/promote-settings?error=Save+Failed')
  }
})

// ----------------------------------------------------------------------
// TOP UP REQUEST MANAGEMENT
// ----------------------------------------------------------------------

router.get('/topup-requests', requireAdmin, async (req, res) => {
  const requests = await prisma.topUpRequest.findMany({
    where: { status: 'PENDING' },
    include: { user: true, package: true, wallet: true },
    orderBy: { createdAt: 'desc' }
  })

  res.send(`
    ${getHead('Top Up Requests')}
    ${getSidebar('topup-requests', req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
           <div class="section-title">Pending Requests</div>
           <div style="color:var(--text-muted)">Manage incoming top up requests</div>
        </div>
      </div>

      <div class="glass-panel" style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="text-align: left; border-bottom: 1px solid var(--glass-border);">
              <th style="padding: 12px; color: var(--text-muted);">User</th>
              <th style="padding: 12px; color: var(--text-muted);">Package</th>
              <th style="padding: 12px; color: var(--text-muted);">Details</th>
              <th style="padding: 12px; color: var(--text-muted);">Action</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(req => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px;">
                  <div style="font-weight: 600; color: white;">${req.user.firstName} ${req.user.lastName}</div>
                  <div style="font-size: 12px; color: var(--text-muted);">${req.user.email}</div>
                </td>
                <td style="padding: 12px;">
                  <div style="font-weight: 700; color: #60a5fa;">${req.package.diamondAmount} 💎</div>
                  <div style="font-size: 13px; color: #fff;">${req.package.price} TK</div>
                </td>
                <td style="padding: 12px;">
                  <div style="font-size: 13px; color: var(--text-muted);">Wallet: <span style="color:white">${req.wallet.name}</span></div>
                  <div style="font-size: 13px; color: var(--text-muted);">Sender: <span style="color:white">${req.senderNumber}</span></div>
                  <div style="font-size: 13px; color: var(--text-muted);">TrxID: <span style="color:#facc15; font-family: monospace;">${req.trxId}</span></div>
                </td>
                <td style="padding: 12px;">
                  <div style="display: flex; gap: 8px;">
                     <form action="/admin/topup/action" method="POST" style="display:inline;">
                        <input type="hidden" name="reqId" value="${req.id}">
                        <input type="hidden" name="action" value="approve">
                        <button class="btn-premium" style="padding: 6px 12px; background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.3);">Approve</button>
                     </form>
                     <form action="/admin/topup/action" method="POST" style="display:inline;">
                        <input type="hidden" name="reqId" value="${req.id}">
                        <input type="hidden" name="action" value="reject">
                        <button class="btn-premium" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3);">Reject</button>
                     </form>
                  </div>
                </td>
              </tr>
            `).join('')}
            ${requests.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding: 30px;">No pending requests</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/topup/action', requireAdmin, async (req, res) => {
  const { reqId, action } = req.body
  
  try {
    const request = await prisma.topUpRequest.findUnique({ 
      where: { id: parseInt(reqId) },
      include: { package: true, user: true }
    })

    if (!request || request.status !== 'PENDING') return res.redirect('/admin/topup-requests')

    if (action === 'approve') {
       // Transaction: Update status + Add Diamonds + Notify
       await prisma.$transaction([
         prisma.topUpRequest.update({
           where: { id: request.id },
           data: { status: 'APPROVED', processedAt: new Date() }
         }),
         prisma.user.update({
           where: { id: request.userId },
           data: { diamond: { increment: request.package.diamondAmount } }
         }),
         prisma.notification.create({
           data: {
             userId: request.userId,
             message: `Top Up Approved! ${request.package.diamondAmount} Diamonds added to your account.`,
             type: 'credit'
           }
         })
       ])
    } else {
       // Reject
       await prisma.$transaction([
         prisma.topUpRequest.update({
           where: { id: request.id },
           data: { status: 'REJECTED', processedAt: new Date() }
         }),
         prisma.notification.create({
           data: {
             userId: request.userId,
             message: `Top Up Rejected. Transaction ID ${request.trxId} was invalid or not found.`,
             type: 'alert'
           }
         })
       ])
    }

    res.redirect('/admin/topup-requests')
  } catch (error) {
    console.error(error)
    res.status(500).send('Server Error')
  }
})

// Task Reports
router.get('/task-reports', requireAdmin, async (req, res) => {
  const reports = await prisma.linkSubmission.findMany({
    where: { status: 'REPORTED' },
    include: { 
      promotedLink: { include: { user: true } }, 
      visitor: true 
    },
    orderBy: { reportedAt: 'asc' }
  })

  const renderReport = (report) => `
    <tr>
      <td>
        <div style="font-weight:bold">${report.visitor.username}</div>
        <div style="font-size:12px;color:var(--text-muted)">User (Visitor)</div>
      </td>
      <td>
        <div style="font-weight:bold">${report.promotedLink.user.username}</div>
        <div style="font-size:12px;color:var(--text-muted)">Link Owner</div>
      </td>
      <td>
        <div style="color:#fca5a5;font-size:13px;margin-bottom:4px">Owner Reason: "${report.rejectionReason}"</div>
        <div style="color:#c4b5fd;font-size:13px">User Report: "${report.reportMessage}"</div>
      </td>
      <td>
         <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${report.screenshots.map(url => `<a href="${url}" target="_blank"><img src="${url}" style="height:40px;width:40px;object-fit:cover;border-radius:4px"></a>`).join('')}
         </div>
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <form action="/admin/report/${report.id}/resolve" method="POST" style="display:inline">
            <input type="hidden" name="decision" value="APPROVE">
            <button class="btn-premium" style="background:#22c55e;padding:6px 10px;font-size:12px">User Wins</button>
          </form>
          <form action="/admin/report/${report.id}/resolve" method="POST" style="display:inline">
            <input type="hidden" name="decision" value="REJECT">
            <button class="btn-premium" style="background:#ef4444;padding:6px 10px;font-size:12px">Owner Wins</button>
          </form>
        </div>
      </td>
    </tr>
  `

  res.send(`
    ${getHead('Task Reports')}
    ${getSidebar('task-reports', req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Task Reports</div>
          <div style="color:var(--text-muted)">Resolve disputes between users and link owners</div>
        </div>
      </div>
      
      <div class="glass-panel" style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Owner</th>
              <th>Dispute Details</th>
              <th>Proof</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${reports.length ? reports.map(renderReport).join('') : '<tr><td colspan="5" style="text-align:center;padding:30px">No pending reports</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/report/:id/resolve', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { decision } = req.body // APPROVE (User Wins) or REJECT (Owner Wins)

  try {
    await prisma.$transaction(async (tx) => {
      const sub = await tx.linkSubmission.findUnique({ where: { id: parseInt(id) } })
      if (!sub || sub.status !== 'REPORTED') return

      // Get rewards config
      const settingsKey = await tx.systemSetting.findUnique({ where: { key: 'promote_reward' } })
      const rewards = settingsKey ? JSON.parse(settingsKey.value) : { coin: 5, diamond: 0, tk: 0 }

      if (decision === 'APPROVE') {
         // User Wins
         // 1. Status -> ADMIN_APPROVED
         // 2. Reward User
         // 3. Visit remains CONSUMED (Locked). It was already incremented on rejection. We keep it that way.
         
         await tx.linkSubmission.update({ where: { id: sub.id }, data: { status: 'ADMIN_APPROVED' } })
         
         // Delete Screenshots
         if(sub.screenshots && sub.screenshots.length) {
           sub.screenshots.forEach(p => {
             try { fs.unlinkSync('public' + p) } catch(e) {}
           })
         }

         await tx.user.update({
           where: { id: sub.visitorId },
           data: {
             coin: { increment: rewards.coin },
             diamond: { increment: rewards.diamond },
             tk: { increment: rewards.tk }
           }
         })
         
         await tx.notification.create({
            data: {
              userId: sub.visitorId,
              message: `Dispute Resolved: Your task #${sub.id} has been approved by Admin! You received ${rewards.coin} coins.`,
              type: 'credit'
            }
         })

      } else {
         // Owner Wins
         // 1. Status -> ADMIN_REJECTED
         // 2. No Reward
         // 3. Visit RETURNED (Unlock). We decrement completedVisits.
         
         await tx.linkSubmission.update({ where: { id: sub.id }, data: { status: 'ADMIN_REJECTED' } })
         
         await tx.promotedLink.update({
            where: { id: sub.promotedLinkId },
            data: { completedVisits: { decrement: 1 } }
         })

         await tx.notification.create({
            data: {
              userId: sub.visitorId,
              message: `Dispute Resolved: Your task #${sub.id} was rejected by Admin.`,
              type: 'alert'
            }
         })
      }
    })
    
    res.redirect('/admin/task-reports')
  } catch (e) {
    console.error(e)
    res.status(500).send('Error resolving report')
  }
})

module.exports = router

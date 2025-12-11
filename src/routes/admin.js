const express = require('express')
const bcrypt = require('bcryptjs')
const { prisma } = require('../db/prisma')
const router = express.Router()

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next()
  return res.redirect('/admin/login')
}

function getSidebar(active) {
  return `
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/admin/dashboard" class="${active === 'dashboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/admin/users" class="${active === 'users' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Users</a></li>
        <li class="nav-item"><a href="/admin/balances" class="${active === 'balances' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:wallet.svg?color=%2394a3b8" class="nav-icon"> Balances</a></li>
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

router.get('/login', (req, res) => {
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
  const adminEmail = process.env.ADMIN_EMAIL
  const hash = process.env.ADMIN_PASSWORD_HASH
  const plain = process.env.ADMIN_PASSWORD
  if (!adminEmail || (!hash && !plain)) return res.redirect('/admin/login?error=Configuration+error')
  if (email !== adminEmail) return res.redirect('/admin/login?error=Invalid+credentials')
  let ok = false
  try {
    if (hash) ok = await bcrypt.compare(password, hash)
    else ok = password === plain
  } catch (_) {}
  if (!ok) return res.redirect('/admin/login?error=Invalid+credentials')
  req.session.admin = true
  return res.redirect('/admin/dashboard')
})

router.get('/logout', (req, res) => {
  if (req.session) req.session.admin = false
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
  const activeUsers = await prisma.user.count({ where: { OR: [ { diamond: { gt: 0 } }, { dk: { gt: 0 } }, { coin: { gt: 0 } }, { lora: { gt: 0 } }, { tk: { gt: 0 } } ] } })
  const inactiveUsers = totalUsers - activeUsers
  const sums = await prisma.user.aggregate({ _sum: { diamond: true, dk: true, coin: true, lora: true, tk: true } })
  
  res.send(`
    ${getHead('Admin Dashboard')}
    ${getSidebar('dashboard')}
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
  const activeUsers = await prisma.user.count({ where: { OR: [ { diamond: { gt: 0 } }, { dk: { gt: 0 } }, { coin: { gt: 0 } }, { lora: { gt: 0 } }, { tk: { gt: 0 } } ] } })
  const inactiveUsers = totalUsers - activeUsers
  const sums = await prisma.user.aggregate({ _sum: { diamond: true, dk: true, coin: true, lora: true, tk: true } })
  res.json({ totalUsers, activeUsers, inactiveUsers, totals: { diamond: sums._sum.diamond||0, dk: sums._sum.dk||0, coin: sums._sum.coin||0, lora: sums._sum.lora||0, tk: sums._sum.tk||0 } })
})

router.get('/users', requireAdmin, async (req, res) => {
  const totalUsers = await prisma.user.count()
  const activeUsers = await prisma.user.count({ where: { OR: [ { diamond: { gt: 0 } }, { dk: { gt: 0 } }, { coin: { gt: 0 } }, { lora: { gt: 0 } }, { tk: { gt: 0 } } ] } })
  const inactiveUsers = totalUsers - activeUsers
  
  res.send(`
    ${getHead('User Management')}
    ${getSidebar('users')}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">User Management</div>
          <div style="color:var(--text-muted);font-size:14px">Manage registered users</div>
        </div>
      </div>

      <div class="balance-section">
        <div class="cards-scroll" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
          ${getCard('Total Users', totalUsers, 'users')}
          ${getCard('Active Users', activeUsers, 'active')}
          ${getCard('Inactive Users', inactiveUsers, 'inactive')}
        </div>
      </div>
      
      <!-- Future: Add User List Table Here -->
      <div class="glass-panel" style="padding: 20px; text-align: center; color: var(--text-muted);">
        User list table coming soon...
      </div>
    </div>
    ${getScripts()}
  `)
})

router.get('/balances', requireAdmin, async (req, res) => {
  const sums = await prisma.user.aggregate({ _sum: { diamond: true, dk: true, coin: true, lora: true, tk: true } })
  
  res.send(`
    ${getHead('Balance Overview')}
    ${getSidebar('balances')}
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

module.exports = router

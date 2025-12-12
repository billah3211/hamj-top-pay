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
  // Default credentials for initial setup
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@hamjtoppay.com'
  const plain = process.env.ADMIN_PASSWORD || 'admin123'
  const hash = process.env.ADMIN_PASSWORD_HASH
  
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
  const activeUsers = await prisma.user.count({ where: { isLoggedIn: true } })
  const inactiveUsers = await prisma.user.count({ where: { isLoggedIn: false } })
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
  const activeUsers = await prisma.user.count({ where: { isLoggedIn: true } })
  const inactiveUsers = await prisma.user.count({ where: { isLoggedIn: false } })
  const sums = await prisma.user.aggregate({ _sum: { diamond: true, dk: true, coin: true, lora: true, tk: true } })
  res.json({ totalUsers, activeUsers, inactiveUsers, totals: { diamond: sums._sum.diamond||0, dk: sums._sum.dk||0, coin: sums._sum.coin||0, lora: sums._sum.lora||0, tk: sums._sum.tk||0 } })
})

router.get('/users', requireAdmin, async (req, res) => {
  const { q } = req.query
  let where = {}
  if (q) {
    where = {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } }
      ]
    }
  }

  const users = await prisma.user.findMany({ 
    where,
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  const userList = users.map(u => `
    <div class="user-row" style="background:rgba(255,255,255,0.05);padding:16px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;">${u.firstName[0]}</div>
        <div>
          <div style="font-weight:600;color:white;">${u.firstName} ${u.lastName} ${u.isBlocked ? '<span style="color:red;font-size:12px">(Blocked)</span>' : ''}</div>
          <div style="color:var(--text-muted);font-size:12px;">@${u.username} • ${u.email}</div>
        </div>
      </div>
      <a href="/admin/user/${u.id}" class="btn-premium" style="padding:8px 16px;font-size:12px;">Manage</a>
    </div>
  `).join('')
  
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

  res.send(`
    ${getHead('Manage ' + user.username)}
    ${getSidebar('users')}
    <style>
        .balance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .balance-card { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 16px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
        .balance-card:hover { border-color: var(--primary); background: rgba(99, 102, 241, 0.1); }
        .balance-title { color: var(--text-muted); font-size: 14px; margin-bottom: 8px; }
        .balance-val { font-size: 24px; font-weight: 700; color: white; }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 1000; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
        .modal.open { opacity: 1; pointer-events: auto; }
        .modal-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); }
        .modal-box { position: relative; background: #0f172a; padding: 24px; border-radius: 16px; width: 90%; max-width: 400px; border: 1px solid rgba(255,255,255,0.1); transform: scale(0.9); transition: transform 0.3s; }
        .modal.open .modal-box { transform: scale(1); }
    </style>
    <div class="main-content">
      <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="section-title">${user.firstName} ${user.lastName}</div>
          <div style="color:var(--text-muted)">@${user.username} • ${user.email}</div>
        </div>
        <a href="/admin/users" class="btn-premium">Back</a>
      </div>

      <div class="section-title" style="font-size:18px;margin-bottom:16px;">Balances (Click to Edit)</div>
      <div class="balance-grid">
        <div class="balance-card" onclick="openModal('diamond', ${user.diamond})">
          <div class="balance-title">Diamond 💎</div>
          <div class="balance-val">${user.diamond}</div>
        </div>
        <div class="balance-card" onclick="openModal('dk', ${user.dk})">
          <div class="balance-title">Dollar 💵</div>
          <div class="balance-val">$${user.dk}</div>
        </div>
        <div class="balance-card" onclick="openModal('coin', ${user.coin})">
          <div class="balance-title">Coin 🪙</div>
          <div class="balance-val">${user.coin}</div>
        </div>
        <div class="balance-card" onclick="openModal('lora', ${user.lora})">
          <div class="balance-title">HaMJ T 🔷</div>
          <div class="balance-val">${user.lora}</div>
        </div>
        <div class="balance-card" onclick="openModal('tk', ${user.tk})">
          <div class="balance-title">Tk ৳</div>
          <div class="balance-val">${user.tk}</div>
        </div>
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

    <!-- Balance Modal -->
      <div id="balanceModal" class="modal">
        <div class="modal-bg" onclick="closeModal()"></div>
        <div class="modal-box">
          <h3 style="margin-top:0;color:white;margin-bottom:16px;">Update Balance</h3>
          <form action="/admin/user/${user.id}/balance" method="post">
            <input type="hidden" name="type" id="balType">
            
            <div style="margin-bottom:16px;">
              <label class="form-label">Current Balance: <span id="currentBal" style="color:var(--primary)"></span></label>
            </div>

            <div style="margin-bottom:16px;">
              <label class="form-label">Action</label>
              <div style="display:flex;gap:8px;">
                <label style="flex:1;background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;cursor:pointer;text-align:center;">
                  <input type="radio" name="action" value="add" checked> Add
                </label>
                <label style="flex:1;background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;cursor:pointer;text-align:center;">
                  <input type="radio" name="action" value="cut"> Cut
                </label>
              </div>
            </div>

            <div style="margin-bottom:16px;">
              <label class="form-label">Amount</label>
              <input type="number" name="amount" class="form-input" required min="1">
            </div>

            <div style="margin-bottom:24px;">
              <label class="form-label">Reason (Notification Message)</label>
              <textarea name="message" class="form-input" required placeholder="Why are you changing the balance?"></textarea>
            </div>

            <button type="submit" class="btn-premium" style="width:100%">Update Balance</button>
          </form>
        </div>
      </div>

    <script>
        const modal = document.getElementById('balanceModal');
        const balType = document.getElementById('balType');
        const currentBal = document.getElementById('currentBal');

        function openModal(type, current) {
          balType.value = type;
          currentBal.innerText = current;
          modal.classList.add('open');
        }
        function closeModal() {
          modal.classList.remove('open');
        }
        
        // Mobile menu logic is already in getScripts() but we need to ensure it works
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        if(menuBtn && sidebar) {
            menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            });
        }
    </script>
    </body>
    </html>
  `)
})

router.post('/user/:id/balance', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { type, action, amount, message } = req.body
  const val = parseInt(amount)
  
  if (isNaN(val) || val <= 0) return res.redirect('/admin/user/'+id)

  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } })
  if (!user) return res.send('User not found')

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
        message: \`Balance Update: \${action === 'add' ? '+' : '-'}\${val} \${type.toUpperCase()}. Reason: \${message}\`,
        type: action === 'add' ? 'credit' : 'debit'
      }
    })
  ])

  res.redirect('/admin/user/'+id)
})

router.post('/user/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { action } = req.body
  await prisma.user.update({
    where: { id: parseInt(id) },
    data: { isBlocked: action === 'block' }
  })
  res.redirect('/admin/user/'+id)
})

router.post('/user/:id/delete', requireAdmin, async (req, res) => {
  const { id } = req.params
  await prisma.user.delete({ where: { id: parseInt(id) } })
  res.redirect('/admin/users')
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

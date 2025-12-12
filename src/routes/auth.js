const express = require('express')
const bcrypt = require('bcryptjs')
const { prisma } = require('../db/prisma')
const router = express.Router()

function makeBaseUsername(firstName, lastName) {
  const a = (firstName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const b = (lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return (a + b) || 'user'
}

async function ensureUniqueUsername(base) {
  let u = base
  let i = 0
  while (true) {
    const found = await prisma.user.findUnique({ where: { username: u } })
    if (!found) return u
    i += 1
    u = base + i
  }
}

function getUserCard(title, value, type, code) {
  let colorClass = 'card-blue'
  let icon = 'layout-dashboard'
  
  if (type === 'diamond') { colorClass = 'card-purple'; icon = 'gem'; }
  else if (type === 'dollar') { colorClass = 'card-green'; icon = 'dollar-sign'; }
  else if (type === 'coin') { colorClass = 'card-orange'; icon = 'coins'; }
  else if (type === 'hamjt') { colorClass = 'card-pink'; icon = 'layers'; }
  else if (type === 'tk') { colorClass = 'card-indigo'; icon = 'banknote'; }

  return `
    <div class="stat-card-modern ${colorClass}">
      <div class="icon-wrapper">
        <img src="https://api.iconify.design/lucide:${icon}.svg?color=white" width="24" height="24">
      </div>
      <div style="flex:1">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${title}</div>
        <div style="font-family:monospace;opacity:0.6;font-size:12px;margin-top:4px;letter-spacing:1px">${code}</div>
      </div>
      <img src="https://api.iconify.design/lucide:${icon}.svg?color=white" class="stat-bg-icon">
    </div>
  `
}

router.get('/get-start', (req, res) => {
  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      
      
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;position:relative;overflow:hidden">
        <!-- Background Shapes -->
        <div style="position:absolute;width:600px;height:600px;background:var(--primary);filter:blur(150px);opacity:0.2;border-radius:50%;top:-100px;left:-100px;z-index:-1"></div>
        <div style="position:absolute;width:500px;height:500px;background:var(--secondary);filter:blur(150px);opacity:0.15;border-radius:50%;bottom:-50px;right:-50px;z-index:-1"></div>

        <div class="glass-panel" style="text-align:center;padding:60px 40px;max-width:480px;width:100%;position:relative">
          <div style="font-size:48px;font-weight:900;margin-bottom:16px;background:linear-gradient(135deg, #fff 0%, #94a3b8 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">HaMJ toP PaY</div>
          <p style="color:var(--text-muted);font-size:18px;line-height:1.6;margin-bottom:40px;">The next generation of digital payments. Secure, fast, and beautiful.</p>
          
          <div style="display:flex;flex-direction:column;gap:16px;">
            <a href="/signup" class="btn-premium" style="justify-content:center;font-size:18px;">Get Started</a>
            <a href="/login" style="color:var(--text-muted);text-decoration:none;font-size:14px;margin-top:8px">Already have an account? <span style="color:var(--primary)">Login</span></a>
          </div>
        </div>
      </div>

      <script>(function(){var dt=document.querySelectorAll('.device-toggle-settings .tab');function applySkin(m){document.body.classList.remove('skin-desktop','skin-mobile');document.body.classList.add('skin-'+m);if(dt.length){dt.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-device')===m)})}try{localStorage.setItem('siteSkin',m)}catch(e){}}if(dt.length){dt.forEach(function(b){b.addEventListener('click',function(){applySkin(b.getAttribute('data-device'))})})}var init='desktop';try{init=localStorage.getItem('siteSkin')||'desktop';if(init!=='desktop'&&init!=='mobile'){init='mobile'}}catch(e){}applySkin(init);})();</script>
    </body>
    </html>
  `)
})

router.get('/auth/signup', (req, res) => res.redirect('/signup'))
router.get('/auth/login', (req, res) => res.redirect('/login'))

router.get('/signup', (req, res) => {
  const error = req.query.error || ''
  const defaultCountry = 'Bangladesh'
  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Sign Up - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
      <style>
        .form-group { margin-bottom: 20px; text-align: left; }
        .form-label { display: block; color: var(--text-muted); font-size: 14px; margin-bottom: 8px; font-weight: 500; }
        .form-input { 
          width: 100%; 
          background: rgba(15, 23, 42, 0.6); 
          border: 1px solid var(--glass-border); 
          color: white; 
          padding: 12px 16px; 
          border-radius: 12px; 
          font-size: 16px; 
          transition: all 0.3s ease; 
        }
        .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); background: rgba(15, 23, 42, 0.8); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        select.form-input option { background: #0f172a; color: white; }
        @media (max-width: 640px) { .form-row { grid-template-columns: 1fr; gap: 0; } }
      </style>
    </head>
    <body>
      
      
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px 20px 40px;">
        <div class="glass-panel" style="width:100%;max-width:500px;padding:40px;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="font-size:28px;font-weight:800;color:white;margin-bottom:8px;">Create Account</div>
            <div style="color:var(--text-muted)">Join HaMJ toP PaY today</div>
          </div>

          ${error ? `<div style="background:rgba(248, 113, 113, 0.2);border:1px solid #f87171;color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:14px;">${error}</div>` : ''}

          <form method="post" action="/signup">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">First Name</label>
                <input class="form-input" name="firstName" required placeholder="John">
              </div>
              <div class="form-group">
                <label class="form-label">Last Name</label>
                <input class="form-input" name="lastName" required placeholder="Doe">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input class="form-input" type="email" name="email" required placeholder="john@example.com">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Country</label>
                <select class="form-input" name="country">
                  <option ${defaultCountry==='Bangladesh'?'selected':''}>Bangladesh</option>
                  <option>India</option>
                  <option>Pakistan</option>
                  <option>Nepal</option>
                  <option>Sri Lanka</option>
                  <option>USA</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Country Code</label>
                <select class="form-input" name="countryCode">
                  <option value="+880" selected>+880 (BD)</option>
                  <option value="+91">+91 (IN)</option>
                  <option value="+92">+92 (PK)</option>
                  <option value="+977">+977 (NP)</option>
                  <option value="+94">+94 (LK)</option>
                  <option value="+1">+1 (US)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Mobile Number</label>
              <input class="form-input" name="phone" required placeholder="1XXXXXXXXX">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Password</label>
                <input class="form-input" type="password" name="password" required placeholder="••••••••">
              </div>
              <div class="form-group">
                <label class="form-label">Confirm Password</label>
                <input class="form-input" type="password" name="confirmPassword" required placeholder="••••••••">
              </div>
            </div>

            <button class="btn-premium" type="submit" style="width:100%;justify-content:center;margin-top:10px;">Create Account</button>
            
            <div style="text-align:center;margin-top:24px;color:var(--text-muted);font-size:14px;">
              Already have an account? <a href="/login" style="color:var(--primary);text-decoration:none;font-weight:600">Log in</a>
            </div>
          </form>
        </div>
      </div>

      <script>(function(){var dt=document.querySelectorAll('.device-toggle-settings .tab');function applySkin(m){document.body.classList.remove('skin-desktop','skin-mobile');document.body.classList.add('skin-'+m);if(dt.length){dt.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-device')===m)})}try{localStorage.setItem('siteSkin',m)}catch(e){}}if(dt.length){dt.forEach(function(b){b.addEventListener('click',function(){applySkin(b.getAttribute('data-device'))})})}var init='desktop';try{init=localStorage.getItem('siteSkin')||'desktop';if(init!=='desktop'&&init!=='mobile'){init='mobile'}}catch(e){}applySkin(init);})();</script>
    </body>
    </html>
  `)
})

router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, country, countryCode, phone, password, confirmPassword } = req.body
    if (!firstName || !lastName || !email || !country || !countryCode || !phone || !password || !confirmPassword) {
      return res.redirect('/signup?error=Missing+fields')
    }
    if (password !== confirmPassword) {
      return res.redirect('/signup?error=Passwords+do+not+match')
    }
    const fullPhone = `${countryCode}${phone}`
    const base = makeBaseUsername(firstName, lastName)
    const username = await ensureUniqueUsername(base)
    const hash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({ data: { firstName, lastName, username, email, country, phone: fullPhone, passwordHash: hash, isLoggedIn: true } })
    req.session.userId = user.id
    return res.redirect('/dashboard')
  } catch (e) {
    console.error('Signup error:', e)
    if (e.code === 'P2002') {
      const target = e.meta?.target || []
      if (Array.isArray(target)) {
        if (target.includes('email')) return res.redirect('/signup?error=Email+already+exists')
        if (target.includes('username')) return res.redirect('/signup?error=Username+taken')
        if (target.includes('phone')) return res.redirect('/signup?error=Phone+number+already+used')
      }
      return res.redirect('/signup?error=Account+already+exists')
    }
    return res.redirect('/signup?error=Internal+Server+Error')
  }
})

router.get('/login', (req, res) => {
  const error = req.query.error || ''
  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Login - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
      <style>
        .form-group { margin-bottom: 20px; text-align: left; }
        .form-label { display: block; color: var(--text-muted); font-size: 14px; margin-bottom: 8px; font-weight: 500; }
        .form-input { 
          width: 100%; 
          background: rgba(15, 23, 42, 0.6); 
          border: 1px solid var(--glass-border); 
          color: white; 
          padding: 12px 16px; 
          border-radius: 12px; 
          font-size: 16px; 
          transition: all 0.3s ease; 
        }
        .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); background: rgba(15, 23, 42, 0.8); }
      </style>
    </head>
    <body>
      
      
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div class="glass-panel" style="width:100%;max-width:420px;padding:40px;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="font-size:28px;font-weight:800;color:white;margin-bottom:8px;">Welcome Back</div>
            <div style="color:var(--text-muted)">Login to your account</div>
          </div>

          ${error ? `<div style="background:rgba(248, 113, 113, 0.2);border:1px solid #f87171;color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:14px;">${error}</div>` : ''}

          <form method="post" action="/login">
            <div class="form-group">
              <label class="form-label">Email, Username or Phone</label>
              <input class="form-input" name="identifier" required placeholder="Enter your ID">
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input class="form-input" type="password" name="password" required placeholder="••••••••">
            </div>

            <div style="text-align:right;margin-bottom:24px;">
              <a href="#" style="color:var(--text-muted);font-size:13px;text-decoration:none">Forgot Password?</a>
            </div>

            <button class="btn-premium" type="submit" style="width:100%;justify-content:center;">Login</button>
            
            <div style="text-align:center;margin-top:24px;color:var(--text-muted);font-size:14px;">
              Don't have an account? <a href="/signup" style="color:var(--primary);text-decoration:none;font-weight:600">Sign Up</a>
            </div>
          </form>
        </div>
      </div>

      <script>(function(){var dt=document.querySelectorAll('.device-toggle-settings .tab');function applySkin(m){document.body.classList.remove('skin-desktop','skin-mobile');document.body.classList.add('skin-'+m);if(dt.length){dt.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-device')===m)})}try{localStorage.setItem('siteSkin',m)}catch(e){}}if(dt.length){dt.forEach(function(b){b.addEventListener('click',function(){applySkin(b.getAttribute('data-device'))})})}var init='desktop';try{init=localStorage.getItem('siteSkin')||'desktop';if(init!=='desktop'&&init!=='mobile'){init='mobile'}}catch(e){}applySkin(init);})();</script>
    </body>
    </html>
  `)
})

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body
  if (!identifier || !password) return res.redirect('/login?error=Missing+credentials')
  const user = await prisma.user.findFirst({ where: { OR: [ { email: identifier }, { username: identifier }, { phone: identifier } ] } })
  if (!user) return res.redirect('/login?error=User+not+found')
  if (user.isBlocked) return res.redirect('/login?error=Account+blocked+by+admin')
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.redirect('/login?error=Invalid+password')
  await prisma.user.update({ where: { id: user.id }, data: { isLoggedIn: true } })
  req.session.userId = user.id
  req.session.role = user.role
  req.session.email = user.email
  return res.redirect('/dashboard')
})

router.get('/dashboard', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (user.isBlocked) {
    req.session.destroy()
    return res.redirect('/login?error=Account+blocked')
  }
  
  // Generate Codes for Cards
  const digitsPhone = String(user.phone || '').replace(/\D/g,'')
  const prefix = digitsPhone.slice(0,3).padEnd(3,'0')
  const tailBase = digitsPhone.slice(-8).padStart(8,'0')
  const codes = {
    diamond: `${prefix}${tailBase}1`,
    dollar: `${prefix}${tailBase}2`,
    coin: `${prefix}${tailBase}3`,
    hamjt: `${prefix}${tailBase}4`,
    tk: `${prefix}${tailBase}5`
  }

  const adminBtn = (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') 
    ? `<a href="/admin/login" class="btn-premium full-width" style="margin-top:10px;background:linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)">Admin Panel</a>` 
    : ''

  const profileModal = `
    <div id="profileModal" class="modal-premium">
      <div class="modal-content">
        <div class="modal-header ${user.currentBanner ? 'has-banner' : ''}" style="${user.currentBanner ? `background-image:url('${user.currentBanner}')` : ''}">
          <button class="modal-close" id="profileBack">×</button>
          <div class="profile-avatar">
            ${user.currentAvatar ? `<img src="${user.currentAvatar}" alt="Profile">` : `${user.firstName[0]}${user.lastName[0]}`}
          </div>
          <div class="profile-title">
            <div class="name">${user.firstName} ${user.lastName}</div>
            <div class="username">@${user.username}</div>
          </div>
        </div>
        
        <div class="modal-body">
          <div class="info-group">
            <div class="label">Email Address</div>
            <div class="value">${user.email}</div>
          </div>
          <div class="info-group">
            <div class="label">Role</div>
            <div class="value" style="color:var(--primary);font-weight:600">${user.role}</div>
          </div>
          <div class="info-group">
            <div class="label">Phone Number</div>
            <div class="value">${user.phone}</div>
          </div>
          <div class="info-group">
            <div class="label">Country</div>
            <div class="value">${user.country}</div>
          </div>
          
          <div class="modal-footer">
            <a href="/settings" class="btn-premium full-width">Edit Profile</a>
            ${adminBtn}
          </div>
        </div>
      </div>
    </div>
    <div id="profileOverlay" class="modal-overlay hidden"></div>
  `

  const sidebar = `
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/dashboard" class="active"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/store"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
        <li class="nav-item"><a href="/store/my"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
        <li class="nav-item"><a href="/promote"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Link</a></li>
        <li class="nav-item"><a href="/notifications"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
        <li class="nav-item"><a href="/settings"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
        <li class="nav-item"><a href="#" id="menuProfile"><img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" class="nav-icon"> Profile</a></li>
        <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
  `

  const html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Dashboard - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
      
      <div class="app-layout">
        ${sidebar}
        
        <div class="main-content">
          <div class="section-header">
            <div>
              <div class="section-title">Welcome back, ${user.firstName}</div>
              <div style="color:var(--text-muted);font-size:14px">Here's your wallet overview</div>
            </div>
            <div class="actions" style="display:flex;gap:12px;">
              <a href="/notifications" class="btn-premium" style="padding:10px;"><img src="https://api.iconify.design/lucide:bell.svg?color=white" width="20"></a>
              <a href="/settings" class="btn-premium">Edit Profile</a>
            </div>
          </div>

          <!-- Balance Cards -->
          <div class="balance-section">
            <div class="cards-scroll" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
              ${getUserCard('Diamond Balance', user.diamond, 'diamond', codes.diamond)}
              ${getUserCard('Dollar Balance', '$' + user.dk, 'dollar', codes.dollar)}
              ${getUserCard('Coin Balance', user.coin, 'coin', codes.coin)}
              ${getUserCard('HaMJ T Balance', user.lora, 'hamjt', codes.hamjt)}
              ${getUserCard('Tk Balance', user.tk + ' tk', 'tk', codes.tk)}
            </div>
          </div>

          <!-- Stats Grid Removed -->


        </div>
      </div>
      
      ${profileModal}

      <script>
        // Mobile Menu
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('profileOverlay'); // Reuse overlay? No create new one if needed, but clicking outside is better.
        
        menuBtn.addEventListener('click', () => {
          sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
          if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          }
        });

        // Profile Modal
        const profileTrigger = document.getElementById('menuProfile');
        const profileModal = document.getElementById('profileModal');
        const profileOverlay = document.getElementById('profileOverlay');
        const profileBack = document.getElementById('profileBack');

        function openProfile() {
          profileModal.classList.add('open');
          profileOverlay.classList.remove('hidden');
        }
        function closeProfile() {
          profileModal.classList.remove('open');
          profileOverlay.classList.add('hidden');
        }

        if(profileTrigger) profileTrigger.addEventListener('click', (e) => { e.preventDefault(); openProfile(); });
        if(profileBack) profileBack.addEventListener('click', closeProfile);
        if(profileOverlay) profileOverlay.addEventListener('click', closeProfile);

        // Device Skin Logic (Preserved)
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
  res.send(html)
})

router.get('/notifications', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (user.isBlocked) return res.redirect('/login?error=Account+blocked')

  const notifs = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  // Mark all as read
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true }
  })

  const sidebar = `
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/dashboard"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/store"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
        <li class="nav-item"><a href="/store/my"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
        <li class="nav-item"><a href="/notifications" class="active"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
        <li class="nav-item"><a href="/settings"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
        <li class="nav-item"><a href="#" id="menuProfile"><img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" class="nav-icon"> Profile</a></li>
        <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
  `

  const list = notifs.map(n => `
    <div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:12px;margin-bottom:12px;border-left:4px solid ${n.type === 'credit' ? '#22c55e' : (n.type === 'debit' ? '#ef4444' : '#6366f1')}">
      <div style="font-size:14px;color:white;margin-bottom:4px;">${n.message}</div>
      <div style="font-size:12px;color:var(--text-muted);">${new Date(n.createdAt).toLocaleString()}</div>
    </div>
  `).join('')

  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Notifications - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
      <div class="app-layout">
        ${sidebar}
        <div class="main-content">
          <div class="section-header">
            <div class="section-title">Notifications</div>
            <div style="color:var(--text-muted)">Your recent updates</div>
          </div>
          <div class="notif-list">
            ${list || '<div class="glass-panel" style="padding:20px;text-align:center;color:var(--text-muted)">No notifications yet</div>'}
          </div>
        </div>
      </div>
      <script>
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
        document.addEventListener('click', (e) => {
          if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          }
        });
        
        // Profile Modal Logic
        const profileTrigger = document.getElementById('menuProfile');
        // (Simplified for this page, usually we include the full modal script)
      </script>
    </body>
    </html>
  `)
})

router.get('/settings', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })

  const sidebar = `
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/dashboard"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/store"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
        <li class="nav-item"><a href="/store/my"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
        <li class="nav-item"><a href="/notifications"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
        <li class="nav-item"><a href="/settings" class="active"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
        <li class="nav-item"><a href="#" id="menuProfile"><img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" class="nav-icon"> Profile</a></li>
        <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
  `

  const profileModal = `
    <div id="profileModal" class="modal-premium">
      <div class="modal-content">
        <div class="modal-header">
          <button class="modal-close" id="profileBack">×</button>
          <div class="profile-avatar">
            ${user.firstName[0]}${user.lastName[0]}
          </div>
          <div class="profile-title">
            <div class="name">${user.firstName} ${user.lastName}</div>
            <div class="username">@${user.username}</div>
          </div>
        </div>
        
        <div class="modal-body">
          <div class="info-group">
            <div class="label">Email Address</div>
            <div class="value">${user.email}</div>
          </div>
          <div class="info-group">
            <div class="label">Phone Number</div>
            <div class="value">${user.phone}</div>
          </div>
          <div class="info-group">
            <div class="label">Country</div>
            <div class="value">${user.country}</div>
          </div>
          
          <div class="modal-footer">
            <a href="/settings" class="btn-premium full-width">Edit Profile</a>
          </div>
        </div>
      </div>
    </div>
    <div id="profileOverlay" class="modal-overlay hidden"></div>
  `

  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Settings - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
      <style>
        .form-group { margin-bottom: 24px; }
        .form-label { display: block; color: var(--text-muted); font-size: 14px; margin-bottom: 8px; font-weight: 500; }
        .form-input { 
          width: 100%; 
          background: rgba(15, 23, 42, 0.6); 
          border: 1px solid var(--glass-border); 
          color: white; 
          padding: 12px 16px; 
          border-radius: 12px; 
          font-size: 16px; 
          transition: all 0.3s ease; 
        }
        .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); background: rgba(15, 23, 42, 0.8); }
        .section-header { margin-bottom: 32px; border-bottom: 1px solid var(--glass-border); padding-bottom: 24px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
      
      <div class="app-layout">
        ${sidebar}
        
        <div class="main-content">
          <div class="glass-panel" style="padding: 32px; max-width: 800px; margin: 0 auto;">
            <div class="section-header">
              <div class="section-title">Account Settings</div>
              <div class="device-toggle-settings">
                <button class="tab active" data-device="desktop" title="Desktop View"><img src="https://api.iconify.design/lucide:monitor.svg?color=white" width="20" height="20"></button>
                <button class="tab" data-device="mobile" title="Mobile View"><img src="https://api.iconify.design/lucide:smartphone.svg?color=white" width="20" height="20"></button>
              </div>
              <div style="color:var(--text-muted)">Update your profile information</div>
            </div>

            <form method="post" action="/settings">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">First Name</label>
                  <input class="form-input" name="firstName" value="${user.firstName}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Last Name</label>
                  <input class="form-input" name="lastName" value="${user.lastName}" required>
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Username</label>
                  <input class="form-input" name="username" value="${user.username}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Email Address</label>
                  <input class="form-input" type="email" name="email" value="${user.email}" required>
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Country</label>
                  <input class="form-input" name="country" value="${user.country}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Phone Number</label>
                  <input class="form-input" name="phone" value="${user.phone}" required>
                </div>
              </div>

              <div style="margin-top: 32px; display: flex; gap: 16px; justify-content: flex-end;">
                <button type="button" class="btn-premium" style="background:transparent;border:1px solid var(--glass-border);box-shadow:none" onclick="window.location.href='/dashboard'">Cancel</button>
                <button type="submit" class="btn-premium">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      ${profileModal}

      <script>
        // Mobile Menu
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        
        menuBtn.addEventListener('click', () => {
          sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
          if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          }
        });

        // Profile Modal
        const profileTrigger = document.getElementById('menuProfile');
        const profileModal = document.getElementById('profileModal');
        const profileOverlay = document.getElementById('profileOverlay');
        const profileBack = document.getElementById('profileBack');

        function openProfile() {
          profileModal.classList.add('open');
          profileOverlay.classList.remove('hidden');
        }
        function closeProfile() {
          profileModal.classList.remove('open');
          profileOverlay.classList.add('hidden');
        }

        if(profileTrigger) profileTrigger.addEventListener('click', (e) => { e.preventDefault(); openProfile(); });
        if(profileBack) profileBack.addEventListener('click', closeProfile);
        if(profileOverlay) profileOverlay.addEventListener('click', closeProfile);

        // Device Skin Logic
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

router.post('/settings', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  const { firstName, lastName, username, email, country, phone } = req.body
  try {
    await prisma.user.update({ where: { id: req.session.userId }, data: { firstName, lastName, username, email, country, phone } })
    return res.redirect('/dashboard')
  } catch (e) {
    return res.status(400).send('Update failed')
  }
})

router.get('/balance', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  const u = await prisma.user.findUnique({ where: { id: req.session.userId } })
  const digitsPhone = String(u.phone || '').replace(/\D/g,'')
  const prefix = digitsPhone.slice(0,3).padEnd(3,'0')
  const tailBase = digitsPhone.slice(-8).padStart(8,'0')
  const codeDiamond = `${prefix}${tailBase}1`
  const codeDollar = `${prefix}${tailBase}2`
  const codeCoin = `${prefix}${tailBase}3`
  const codeHamjT = `${prefix}${tailBase}4`
  const codeTk = `${prefix}${tailBase}5`
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balance - HaMJ toP PaY</title><link rel="stylesheet" href="/style.css"></head><body><div class="container"><div class="card card3d panel"><div class="title">Balance</div><div class="balance-nav"><button class="tab active" data-type="diamond">Diamond 💎</button><button class="tab" data-type="dollar">Dollar 💵</button><button class="tab" data-type="coin">Coin 🪙</button><button class="tab" data-type="hamjt">HaMJ T 🔷</button><button class="tab" data-type="tk">Tk ৳</button></div><div class="center"><div id="balanceCard" class="card card3d cardpay cardpay-large visa" data-code-diamond="${codeDiamond}" data-code-dollar="${codeDollar}" data-code-coin="${codeCoin}" data-code-hamjt="${codeHamjT}" data-code-tk="${codeTk}" data-val-diamond="${u.diamond}" data-val-dollar="${u.dk}" data-val-coin="${u.coin}" data-val-hamjt="${u.lora}" data-val-tk="${u.tk} tk" data-user="${u.id}"><div class="brand">HaMJ toP PaY</div><div class="chip"></div><div id="qr" class="qr"></div><div class="code">${codeDiamond}</div><div class="meta"><div class="name">Diamond 💎</div><div class="val">${u.diamond}</div></div></div></div><div class="modal-actions"><a class="back-btn" href="/dashboard">Back</a></div></div></div><div id="qrModal" class="modal"><div class="modal-card center"><div id="qrLarge"></div><div class="modal-actions"><a href="#" class="back-btn" id="qrBack">Back</a></div></div></div><div id="qrOverlay" class="modal-overlay hidden"></div><script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script><script>(function(){var card=document.getElementById('balanceCard');var tabs=document.querySelectorAll('.balance-nav .tab');var qrBox=document.getElementById('qr');var qrModal=document.getElementById('qrModal');var qrOverlay=document.getElementById('qrOverlay');var qrBack=document.getElementById('qrBack');function genQR(payload, target, size){try{var qr=qrcode(0,'M');qr.addData(payload);qr.make();target.innerHTML=qr.createSvgTag(size||4);return true;}catch(e){return false;}}function apply(type){tabs.forEach(function(t){t.classList.toggle('active',t.getAttribute('data-type')===type)});var user=card.getAttribute('data-user');var code=card.getAttribute('data-code-'+type);var val=card.getAttribute('data-val-'+type);var name=type==='diamond'?'Diamond 💎':type==='dollar'?'Dollar 💵':type==='coin'?'Coin 🪙':type==='hamjt'?'HamJ T 🔷':'Tk ৳';card.querySelector('.code').textContent=code;card.querySelector('.meta .name').textContent=name;card.querySelector('.meta .val').textContent=val;genQR('hamjpay://send?to='+user+'&type='+type,qrBox);try{localStorage.setItem('balanceType',type)}catch(e){}}tabs.forEach(function(t){t.addEventListener('click',function(){apply(t.getAttribute('data-type'))})});var init='diamond';try{init=localStorage.getItem('balanceType')||'diamond'}catch(e){}apply(init);})();
  // Device Skin Logic
  (function(){var dt=document.querySelectorAll('.device-toggle-settings .tab');function applySkin(m){document.body.classList.remove('skin-desktop','skin-mobile');document.body.classList.add('skin-'+m);if(dt.length){dt.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-device')===m)})}try{localStorage.setItem('siteSkin',m)}catch(e){}}if(dt.length){dt.forEach(function(b){b.addEventListener('click',function(){applySkin(b.getAttribute('data-device'))})})}var init='desktop';try{init=localStorage.getItem('siteSkin')||'desktop';if(init!=='desktop'&&init!=='mobile'){init='mobile'}}catch(e){}applySkin(init);})();</script></body></html>`)
})

router.get('/', (req, res) => res.redirect('/get-start'))

router.get('/auth/logout', async (req, res) => {
  if (!req.session) return res.redirect('/login')
  if (req.session.userId) {
    try {
      await prisma.user.update({ where: { id: req.session.userId }, data: { isLoggedIn: false } })
    } catch (_) {}
  }
  req.session.destroy(() => {
    res.redirect('/login')
  })
})

module.exports = router

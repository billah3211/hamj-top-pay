const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { prisma } = require('../db/prisma')
const path = require('path')
const countries = require('../data/countries')
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
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <div style="font-family:monospace;opacity:0.6;font-size:12px;letter-spacing:1px">${code}</div>
          <button onclick="copyToClipboard('${code}')" style="background:rgba(255,255,255,0.1);border:none;cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;transition:0.2s" title="Copy Code">
             <img src="https://api.iconify.design/lucide:copy.svg?color=white" width="12" height="12">
          </button>
        </div>
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
                <select class="form-input" name="country" id="countrySelect">
                  ${countries.map(c => `<option value="${c.name}" data-code="${c.code}" ${c.name === defaultCountry ? 'selected' : ''}>${c.flag} ${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Country Code</label>
                <select class="form-input" name="countryCode" id="countryCodeSelect">
                  ${countries.map(c => `<option value="${c.code}" ${c.name === defaultCountry ? 'selected' : ''}>${c.flag} ${c.code} (${c.iso})</option>`).join('')}
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
          <script>
            var cSel = document.getElementById('countrySelect');
            if(cSel){
              cSel.addEventListener('change', function() {
                var code = this.options[this.selectedIndex].getAttribute('data-code');
                if(code) document.getElementById('countryCodeSelect').value = code;
              });
            }
          </script>
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
              <a href="/forgot-password" style="color:var(--text-muted);font-size:13px;text-decoration:none">Forgot Password?</a>
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

const loginHandler = async (req, res) => {
  const { identifier, password, login_source } = req.body
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
  
  // Redirect based on role and login source
  if ((user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && login_source === 'admin') {
    return res.redirect('/admin/dashboard')
  }

  return res.redirect('/dashboard')
}

router.post('/login', loginHandler)
router.post('/auth/login', loginHandler)

// Forgot Password Routes
router.get('/forgot-password', (req, res) => {
  const error = req.query.error || ''
  const message = req.query.message || ''
  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Forgot Password - HaMJ toP PaY</title>
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
            <div style="font-size:28px;font-weight:800;color:white;margin-bottom:8px;">Forgot Password</div>
            <div style="color:var(--text-muted)">Enter your email to reset password</div>
          </div>

          ${error ? `<div style="background:rgba(248, 113, 113, 0.2);border:1px solid #f87171;color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:14px;">${error}</div>` : ''}
          ${message ? `<div style="background:rgba(74, 222, 128, 0.2);border:1px solid #4ade80;color:#4ade80;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:14px;">${message}</div>` : ''}

          <form method="post" action="/forgot-password">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input class="form-input" type="email" name="email" required placeholder="john@example.com">
            </div>

            <button class="btn-premium" type="submit" style="width:100%;justify-content:center;">Send Reset Link</button>
            
            <div style="text-align:center;margin-top:24px;color:var(--text-muted);font-size:14px;">
              Remember password? <a href="/login" style="color:var(--primary);text-decoration:none;font-weight:600">Login</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
  `)
})

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // Don't reveal if user exists or not
      return res.redirect('/forgot-password?message=If an account exists, a reset link has been sent.')
    }

    const token = crypto.randomBytes(20).toString('hex')
    const expires = new Date(Date.now() + 3600000) // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: expires
      }
    })

    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`
    
    // Send Email
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER || 'noreply@hamjtoppay.com',
      subject: 'Password Reset Request',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
            `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
            `${resetUrl}\n\n` +
            `If you did not request this, please ignore this email and your password will remain unchanged.\n`
    }

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail(mailOptions)
    } else {
        console.log('RESET LINK (Dev Mode):', resetUrl)
    }

    return res.redirect('/forgot-password?message=If an account exists, a reset link has been sent.')

  } catch (error) {
    console.error('Forgot Password Error:', error)
    return res.redirect('/forgot-password?error=Something went wrong')
  }
})

router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: token,
      resetPasswordExpires: { gt: new Date() }
    }
  })

  if (!user) {
    return res.redirect('/forgot-password?error=Password reset token is invalid or has expired.')
  }

  const error = req.query.error || ''
  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Reset Password - HaMJ toP PaY</title>
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
            <div style="font-size:28px;font-weight:800;color:white;margin-bottom:8px;">Reset Password</div>
            <div style="color:var(--text-muted)">Create a new password</div>
          </div>

          ${error ? `<div style="background:rgba(248, 113, 113, 0.2);border:1px solid #f87171;color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-size:14px;">${error}</div>` : ''}

          <form method="post" action="/reset-password/${token}">
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input class="form-input" type="password" name="password" required placeholder="••••••••">
            </div>
            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <input class="form-input" type="password" name="confirm" required placeholder="••••••••">
            </div>

            <button class="btn-premium" type="submit" style="width:100%;justify-content:center;">Reset Password</button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `)
})

router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params
  const { password, confirm } = req.body

  if (password !== confirm) {
    return res.redirect(`/reset-password/${token}?error=Passwords do not match`)
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() }
      }
    })

    if (!user) {
      return res.redirect('/forgot-password?error=Password reset token is invalid or has expired.')
    }

    const hash = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        resetPasswordToken: null,
        resetPasswordExpires: null
      }
    })

    res.redirect('/login?message=Password+changed+successfully')

  } catch (error) {
    console.error('Reset Password Error:', error)
    return res.redirect(`/reset-password/${token}?error=Something went wrong`)
  }
})

router.get('/dashboard', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  const settings = await getSystemSettings()
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (user.isBlocked) {
    req.session.destroy()
    return res.redirect('/login?error=Account+blocked')
  }
  
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const level = calculateLevel(taskCount)
  const levelProgress = getLevelProgress(taskCount)
  
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
  
  const sidebar = getUserSidebar('dashboard', unreadCount, user.id, user.role, settings)

  const profileModal = `
    <div id="profileModal" class="modal-premium" style="align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-content" style="background: transparent; border: none; box-shadow: none; width: 100%; max-width: 600px; padding: 0;">
        
        <div style="position: relative;">
            <button class="modal-close" id="profileBack" style="position: absolute; top: -15px; right: -15px; background: rgba(0,0,0,0.5); color: white; border: 2px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 100; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
            
            <!-- Profile Card Design -->
            <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 30px 20px 20px; border-radius: 24px; position: relative; overflow: visible; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                
                <!-- Top Info Box -->
                <div style="background: #000; padding: 20px; border-radius: 16px; margin-bottom: 20px; margin-left: 60px; position: relative; border: 1px solid rgba(255,255,255,0.1);">
                   <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: 0.5px;">${user.firstName} ${user.lastName}</div>
                   <div style="color: #4ade80; font-weight: 600; font-size: 14px; margin-bottom: 8px;">@${user.username}</div>
                   
                   <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                     <div style="display: flex; align-items: center; gap: 10px;">
                       <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 12px; padding: 2px 10px; border-radius: 20px;">Level ${level}</div>
                       <div style="font-size: 11px; color: #94a3b8;">${levelProgress.current} / ${levelProgress.next} Tasks</div>
                     </div>
                     <div style="width: 100%; max-width: 250px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;" title="${levelProgress.percent.toFixed(1)}% to Level ${level + 1}">
                       <div style="width: ${levelProgress.percent}%; height: 100%; background: #facc15;"></div>
                     </div>
                   </div>
                   
                   <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 13px; color: #cbd5e1;">
                       <div>📧 ${user.email}</div>
                       <div>📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}</div>
                   </div>
                </div>

                <div style="display: flex; gap: 20px; align-items: flex-start;">
                    <!-- Avatar (Bottom Left overlap) -->
                    <div style="width: 110px; height: 110px; border-radius: 50%; border: 6px solid #000; overflow: hidden; background: #1a1a2e; flex-shrink: 0; z-index: 10; margin-top: -10px; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                        <img src="${user.currentAvatar || `https://api.iconify.design/lucide:user.svg?color=white`}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>

                    <!-- Bottom Info Box -->
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
  `
  
  // Public Profile API


  // API Endpoint (moved up)

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

        function copyToClipboard(text) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
              const toast = document.createElement('div');
              toast.textContent = 'Copied!';
              toast.style.position = 'fixed';
              toast.style.bottom = '20px';
              toast.style.left = '50%';
              toast.style.transform = 'translateX(-50%)';
              toast.style.background = '#22c55e';
              toast.style.color = 'white';
              toast.style.padding = '8px 16px';
              toast.style.borderRadius = '20px';
              toast.style.zIndex = '1000';
              toast.style.fontSize = '14px';
              toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 2000);
            }).catch(e => console.error(e));
          } else {
             const ta = document.createElement('textarea');
             ta.value = text;
             document.body.appendChild(ta);
             ta.select();
             document.execCommand('copy');
             document.body.removeChild(ta);
             alert('Copied!');
          }
        }

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

  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const level = calculateLevel(taskCount)

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

  const sidebar = getUserSidebar('notifications', 0, user.id, user.role, settings)

  const list = notifs.map(n => `
    <div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:12px;margin-bottom:12px;border-left:4px solid ${n.type === 'credit' ? '#22c55e' : (n.type === 'debit' ? '#ef4444' : '#6366f1')}">
      <div style="font-size:14px;color:white;margin-bottom:4px;">${n.message}</div>
      <div style="font-size:12px;color:var(--text-muted);">${new Date(n.createdAt).toLocaleString()}</div>
    </div>
  `).join('')

  const profileModal = `
    <div id="profileModal" class="modal-premium" style="align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-content" style="background: transparent; border: none; box-shadow: none; width: 100%; max-width: 600px; padding: 0;">
        <div style="position: relative;">
            <button class="modal-close" id="profileBack" style="position: absolute; top: -15px; right: -15px; background: rgba(0,0,0,0.5); color: white; border: 2px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 100; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
            <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 30px 20px 20px; border-radius: 24px; position: relative; overflow: visible; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <div style="background: #000; padding: 20px; border-radius: 16px; margin-bottom: 20px; margin-left: 60px; position: relative; border: 1px solid rgba(255,255,255,0.1);">
                   <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: 0.5px;">${user.firstName} ${user.lastName}</div>
                   <div style="color: #4ade80; font-weight: 600; font-size: 14px; margin-bottom: 8px;">@${user.username}</div>
                   <div style="display:inline-block; background:linear-gradient(90deg, #facc15, #fbbf24); color:black; font-weight:bold; font-size:12px; padding:2px 8px; border-radius:4px; margin-bottom:8px;">Level ${level}</div>
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
      ${profileModal}
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
      </script>
    </body>
    </html>
  `)
})

router.get('/settings', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const level = calculateLevel(taskCount)
  const levelProgress = getLevelProgress(taskCount)
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const settings = await getSystemSettings()

  const sidebar = getUserSidebar('settings', unreadCount, user.id, user.role, settings)

  const profileModal = `
    <div id="profileModal" class="modal-premium" style="align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-content" style="background: transparent; border: none; box-shadow: none; width: 100%; max-width: 600px; padding: 0;">
        
        <div style="position: relative;">
            <button class="modal-close" id="profileBack" style="position: absolute; top: -15px; right: -15px; background: rgba(0,0,0,0.5); color: white; border: 2px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 100; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
            
            <!-- Profile Card Design -->
            <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 30px 20px 20px; border-radius: 24px; position: relative; overflow: visible; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                
                <!-- Top Info Box -->
                <div style="background: #000; padding: 20px; border-radius: 16px; margin-bottom: 20px; margin-left: 60px; position: relative; border: 1px solid rgba(255,255,255,0.1);">
                   <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: 0.5px;">${user.firstName} ${user.lastName}</div>
                   <div style="color: #4ade80; font-weight: 600; font-size: 14px; margin-bottom: 8px;">@${user.username}</div>
                   
                   <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                     <div style="display: flex; align-items: center; gap: 10px;">
                       <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 12px; padding: 2px 10px; border-radius: 20px;">Level ${level}</div>
                       <div style="font-size: 11px; color: #94a3b8;">${levelProgress.current} / ${levelProgress.next} Tasks</div>
                     </div>
                     <div style="width: 100%; max-width: 250px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;" title="${levelProgress.percent.toFixed(1)}% to Level ${level + 1}">
                       <div style="width: ${levelProgress.percent}%; height: 100%; background: #facc15;"></div>
                     </div>
                   </div>
                   
                   <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 13px; color: #cbd5e1;">
                       <div>📧 ${user.email}</div>
                       <div>📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}</div>
                   </div>
                </div>

                <div style="display: flex; gap: 20px; align-items: flex-start;">
                    <!-- Avatar (Bottom Left overlap) -->
                    <div style="width: 110px; height: 110px; border-radius: 50%; border: 6px solid #000; overflow: hidden; background: #1a1a2e; flex-shrink: 0; z-index: 10; margin-top: -10px; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                        <img src="${user.currentAvatar || `https://api.iconify.design/lucide:user.svg?color=white`}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>

                    <!-- Bottom Info Box -->
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

              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Bio</label>
                  <input class="form-input" name="bio" value="${user.bio || ''}">
                </div>
                <div class="form-group">
                  <label class="form-label">Website</label>
                  <input class="form-input" name="website" value="${user.website || ''}">
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Social</label>
                  <input class="form-input" name="social" value="${user.social || ''}">
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
  const { firstName, lastName, username, email, country, phone, bio, website, social } = req.body
  
  const data = { firstName, lastName, username, email, country, phone, bio, website, social }

  try {
    await prisma.user.update({ where: { id: req.session.userId }, data })
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

router.get('/api/profile/:username', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        firstName: true,
        lastName: true,
        username: true,
        email: true,
        country: true,
        bio: true,
        website: true,
        social: true,
        createdAt: true,
        currentAvatar: true,
        role: true
      }
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
    const pendingCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'PENDING' } })
    const rejectedCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'REJECTED' } })
    const level = calculateLevel(taskCount)
    const levelProgress = getLevelProgress(taskCount)

    res.json({ ...user, level, taskCount, pendingCount, rejectedCount, levelProgress })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

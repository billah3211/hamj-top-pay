const express = require('express')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { prisma } = require('../db/prisma')
const router = express.Router()

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads')
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else {
    cb(new Error('Not an image! Please upload an image.'), false)
  }
}

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter
})

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
        <li class="nav-item"><a href="/super-admin/store" class="${active === 'store' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=${active === 'store' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Store</a></li>
        <li class="nav-item"><a href="/super-admin/promote-settings" class="${active === 'promote' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:settings.svg?color=${active === 'promote' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Promote Settings</a></li>
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
  const totalUsers = await prisma.user.count({ where: { role: 'USER' } })
  const totalAdmins = await prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } })
  const totalItems = await prisma.storeItem.count()
  
  res.send(`
    ${getHead('Super Admin Dashboard')}
    ${getSidebar('dashboard')}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Dashboard Overview</div>
          <div style="color:var(--text-muted)">Welcome back, Super Admin</div>
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

// Manage Admins
router.get('/admins', requireSuperAdmin, async (req, res) => {
  const admins = await prisma.user.findMany({ 
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    orderBy: { createdAt: 'desc' }
  })
  
  const renderRow = (admin) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:16px;color:white">${admin.firstName} ${admin.lastName}</td>
      <td style="padding:16px;color:var(--text-muted)">${admin.email}</td>
      <td style="padding:16px"><span class="role-badge ${admin.role === 'SUPER_ADMIN' ? 'role-admin' : 'role-user'}" style="background:${admin.role === 'SUPER_ADMIN' ? '#ec4899' : '#3b82f6'}">${admin.role}</span></td>
      <td style="padding:16px;text-align:right">
        ${admin.role !== 'SUPER_ADMIN' ? `
          <form action="/super-admin/revoke-access" method="POST" style="display:inline" onsubmit="return confirm('Revoke admin access?')">
            <input type="hidden" name="userId" value="${admin.id}">
            <button class="btn-premium" style="padding:8px;font-size:12px;background:rgba(239,68,68,0.2);color:#fca5a5;border-color:rgba(239,68,68,0.3)">Revoke</button>
          </form>
        ` : '<span style="color:var(--text-muted);font-size:12px">Protected</span>'}
      </td>
    </tr>
  `

  res.send(`
    ${getHead('Manage Admins')}
    ${getSidebar('admins')}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Manage Admins</div>
          <div style="color:var(--text-muted)">Control system access</div>
        </div>
      </div>
      
      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 350px;gap:24px;align-items:start">
        
        <!-- Admin List -->
        <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:rgba(255,255,255,0.02);text-align:left">
                <th style="padding:16px;color:var(--text-muted);font-weight:500">Name</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500">Email</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500">Role</th>
                <th style="padding:16px;text-align:right;color:var(--text-muted);font-weight:500">Action</th>
              </tr>
            </thead>
            <tbody>
              ${admins.map(renderRow).join('')}
            </tbody>
          </table>
        </div>

        <!-- Grant Access Form -->
        <div class="glass-panel">
          <h3 style="margin-bottom:20px;font-size:18px">Grant Admin Access</h3>
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

            <button type="submit" class="btn-premium full-width">Grant Access</button>
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

// Store Management Routes
router.get('/store', requireSuperAdmin, async (req, res) => {
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
      <div class="section-header">
        <div>
          <div class="section-title">Store Management</div>
          <div style="color:var(--text-muted)">Upload and manage profile assets</div>
        </div>
      </div>

      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 350px;gap:24px;align-items:start">
        
        <!-- Items List -->
        <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:rgba(255,255,255,0.02);text-align:left">
                <th style="padding:16px;color:var(--text-muted);font-weight:500">Image</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500">Name</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500">Type</th>
                <th style="padding:16px;color:var(--text-muted);font-weight:500">Price</th>
                <th style="padding:16px;text-align:right;color:var(--text-muted);font-weight:500">Action</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(renderItemRow).join('')}
            </tbody>
          </table>
        </div>

        <!-- Add Item Form -->
        <div class="glass-panel">
          <h3 style="margin-bottom:20px;font-size:18px">Add New Item</h3>
          <form action="/super-admin/store/add" method="POST" enctype="multipart/form-data">
            <div class="form-group">
              <label class="form-label">Item Name</label>
              <input type="text" name="name" required placeholder="e.g. Blue Frame" class="form-input">
            </div>
            
            <div class="form-group">
              <label class="form-label">Type</label>
              <select name="type" class="form-input">
                <option value="avatar">Avatar Frame</option>
                <option value="banner">Profile Banner</option>
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
              <input type="file" name="image" required accept="image/*" class="form-input" style="padding:8px">
            </div>

            <button type="submit" class="btn-premium full-width">Upload Item</button>
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
    const imageUrl = '/uploads/' + req.file.filename
    
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
  const timer = await prisma.systemSetting.findUnique({ where: { key: 'visit_timer' } })
  const screenshotCount = await prisma.systemSetting.findUnique({ where: { key: 'screenshot_count' } })

  const timerVal = timer ? timer.value : '50'
  const screenshotVal = screenshotCount ? screenshotCount.value : '2'

  res.send(`
    ${getHead('Promote Settings')}
    ${getSidebar('promote')}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Promote Settings</div>
          <div style="color:var(--text-muted)">Configure visit timer and screenshot requirements</div>
        </div>
      </div>

      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

      <div class="glass-panel" style="max-width:500px">
        <form action="/super-admin/promote-settings" method="POST">
          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px">Visit Timer (Seconds)</label>
            <input type="number" name="timer" value="${timerVal}" class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white">
            <div style="font-size:12px;color:var(--text-muted);margin-top:5px">Default: 50 seconds</div>
          </div>

          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px">Required Screenshots</label>
            <input type="number" name="screenshots" value="${screenshotVal}" class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white">
            <div style="font-size:12px;color:var(--text-muted);margin-top:5px">Default: 2 screenshots</div>
          </div>

          <button type="submit" class="btn-premium">Save Settings</button>
        </form>
      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/promote-settings', requireSuperAdmin, async (req, res) => {
  const { timer, screenshots } = req.body
  
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

  res.redirect('/super-admin/promote-settings?success=Settings+updated')
})

module.exports = router

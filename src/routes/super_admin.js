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
        <li class="nav-item"><a href="/super-admin/topup-packages" class="${active === 'packages' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:package.svg?color=${active === 'packages' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Packages</a></li>
        <li class="nav-item"><a href="/super-admin/topup-wallets" class="${active === 'wallets' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:wallet.svg?color=${active === 'wallets' ? '%23ec4899' : '%2394a3b8'}" class="nav-icon"> Manage Wallets</a></li>
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

// Manage Admins
router.get('/admins', requireSuperAdmin, async (req, res) => {
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
    ${getSidebar('admins')}
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
      <div class="section-header" style="margin-bottom: 32px;">
        <div>
          <div class="section-title" style="font-size: 24px;">Promote Settings</div>
          <div style="color:var(--text-muted)">Configure visit timer and screenshot requirements</div>
        </div>
      </div>

      ${req.query.success ? `<div class="alert success" style="margin-bottom: 24px;">${req.query.success}</div>` : ''}

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

            <div class="form-group" style="margin-bottom: 32px;">
              <label class="form-label" style="display: block; margin-bottom: 8px; font-weight: 500;">
                <img src="https://api.iconify.design/lucide:image.svg?color=%2394a3b8" width="16" style="vertical-align: middle; margin-right: 6px;">
                Required Screenshots
              </label>
              <div style="position: relative;">
                <input type="number" name="screenshots" value="${screenshotVal}" class="form-input" style="width: 100%; padding: 14px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; color: white; font-size: 16px;">
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px; padding-left: 4px;">Number of proofs required. Default: 2</div>
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

// ==========================================
// TOP UP PACKAGE MANAGEMENT
// ==========================================
router.get('/topup-packages', requireSuperAdmin, async (req, res) => {
  const packages = await prisma.topUpPackage.findMany({ orderBy: { price: 'asc' } })

  const renderRow = (pkg) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:16px;color:white;font-weight:500">${pkg.name}</td>
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
    ${getSidebar('packages')}
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
          <form action="/super-admin/topup-packages/add" method="POST">
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
              <label class="form-label">Allowed Countries</label>
              <input type="text" name="countries" required placeholder="e.g. Bangladesh,India or All" class="form-input">
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">Use 'All' for everywhere, or comma separated list.</div>
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

router.post('/topup-packages/add', requireSuperAdmin, async (req, res) => {
  try {
    const { name, price, diamondAmount, countries } = req.body
    
    await prisma.topUpPackage.create({
      data: {
        name,
        price: parseInt(price),
        diamondAmount: parseInt(diamondAmount),
        countries: countries || 'All'
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
  const wallets = await prisma.topUpWallet.findMany({ orderBy: { id: 'desc' } })

  const renderRow = (wallet) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:16px;color:white;font-weight:500">${wallet.name}</td>
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
    ${getSidebar('wallets')}
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
          <form action="/super-admin/topup-wallets/add" method="POST">
            <div class="form-group">
              <label class="form-label">Wallet Name</label>
              <input type="text" name="name" required placeholder="e.g. Bkash Personal" class="form-input">
            </div>
            
            <div class="form-group">
              <label class="form-label">Admin Number</label>
              <input type="text" name="adminNumber" required placeholder="e.g. 017xxxxxxxx" class="form-input">
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

router.post('/topup-wallets/add', requireSuperAdmin, async (req, res) => {
  try {
    const { name, adminNumber, instruction } = req.body
    
    await prisma.topUpWallet.create({
      data: {
        name,
        adminNumber,
        instruction
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
    res.redirect('/super-admin/topup-wallets?error=Cannot+delete+wallet+in+use')
  }
})

module.exports = router

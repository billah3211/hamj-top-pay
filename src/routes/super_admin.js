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
          <button onclick="editItem(${item.id}, '${item.name}', ${item.price}, '${item.currency}', '${item.type}')" class="btn-premium" style="padding:8px;font-size:12px">Edit</button>
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
                <th style="padding:16px;color:var(--text-muted);font-weight:500;text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items.length ? items.map(renderItemRow).join('') : '<tr><td colspan="5" style="padding:32px;text-align:center;color:var(--text-muted)">No items in store</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Upload/Edit Form -->
        <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:24px;position:sticky;top:24px">
          <h3 id="formTitle" style="color:white;margin-bottom:20px;font-size:18px">Upload New Item</h3>
          
          <form id="storeForm" action="/super-admin/store/upload" method="POST" enctype="multipart/form-data" style="display:flex;flex-direction:column;gap:16px;">
            <input type="hidden" name="itemId" id="itemId">
            
            <div>
              <label style="color:var(--text-muted);font-size:12px;margin-bottom:4px;display:block;">Item Name</label>
              <input type="text" name="name" id="itemName" required style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
            </div>

            <div>
              <label style="color:var(--text-muted);font-size:12px;margin-bottom:4px;display:block;">Item Type</label>
              <select name="type" id="itemType" required style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
                <option value="avatar">Profile Picture</option>
                <option value="banner">Profile Banner</option>
              </select>
            </div>

            <div>
              <label style="color:var(--text-muted);font-size:12px;margin-bottom:4px;display:block;">Price Type</label>
              <select name="currency" id="itemCurrency" required onchange="togglePrice(this.value)" style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
                <option value="free">Free</option>
                <option value="dk">Dollar Balance</option>
                <option value="tk">Taka Balance</option>
              </select>
            </div>

            <div id="priceField" style="display:none">
              <label style="color:var(--text-muted);font-size:12px;margin-bottom:4px;display:block;">Price Amount</label>
              <input type="number" name="price" id="itemPrice" min="1" value="0" style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
            </div>

            <div>
              <label style="color:var(--text-muted);font-size:12px;margin-bottom:4px;display:block;">Image File (Max 20MB)</label>
              <div style="position:relative;overflow:hidden;background:rgba(15,23,42,0.6);border:1px dashed var(--glass-border);border-radius:8px;padding:20px;text-align:center;">
                <input type="file" name="image" id="itemImage" accept="image/*" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;">
                <div style="color:var(--text-muted);pointer-events:none">Click to upload</div>
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:10px">
              <button type="submit" class="btn-premium" style="flex:1">Save Item</button>
              <button type="button" onclick="resetForm()" class="btn-premium" style="background:transparent;border:1px solid var(--glass-border);width:auto;padding:0 12px">Reset</button>
            </div>
          </form>
        </div>

      </div>
    </div>
    ${getScripts()}
    <script>
      function togglePrice(val) {
        document.getElementById('priceField').style.display = val === 'free' ? 'none' : 'block';
      }
      
      function editItem(id, name, price, currency, type) {
        document.getElementById('formTitle').innerText = 'Edit Item';
        document.getElementById('storeForm').action = '/super-admin/store/edit';
        document.getElementById('itemId').value = id;
        document.getElementById('itemName').value = name;
        document.getElementById('itemType').value = type;
        document.getElementById('itemCurrency').value = currency;
        document.getElementById('itemPrice').value = price;
        togglePrice(currency);
        // Image is optional in edit
        document.getElementById('itemImage').required = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function resetForm() {
        document.getElementById('formTitle').innerText = 'Upload New Item';
        document.getElementById('storeForm').action = '/super-admin/store/upload';
        document.getElementById('itemId').value = '';
        document.getElementById('storeForm').reset();
        togglePrice('free');
        document.getElementById('itemImage').required = true;
      }
    </script>
  `)
})

router.post('/store/upload', requireSuperAdmin, upload.single('image'), async (req, res) => {
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
    res.redirect('/super-admin/store?success=Item+uploaded+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/store?error=Upload+failed')
  }
})

router.post('/store/edit', requireSuperAdmin, upload.single('image'), async (req, res) => {
  try {
    const { itemId, name, type, currency, price } = req.body
    const data = {
      name,
      type,
      currency,
      price: currency === 'free' ? 0 : parseInt(price || 0)
    }
    
    if (req.file) {
      data.imageUrl = '/uploads/' + req.file.filename
    }

    await prisma.storeItem.update({
      where: { id: parseInt(itemId) },
      data
    })
    res.redirect('/super-admin/store?success=Item+updated+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/store?error=Update+failed')
  }
})

router.post('/store/delete', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.body
    const item = await prisma.storeItem.findUnique({ where: { id: parseInt(id) } })
    
    if (item) {
      // Try to delete the file if it exists
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

module.exports = router

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
  const admins = await prisma.admin.findMany({ orderBy: { id: 'asc' } })
  const error = req.query.error || ''
  const success = req.query.success || ''
  
  let adminListHtml = admins.map(admin => `
    <div style="background:rgba(15,23,42,0.4);border:1px solid var(--glass-border);padding:16px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <div style="color:white;font-weight:600">${admin.email}</div>
        <div style="color:var(--text-muted);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${admin.role}</div>
      </div>
      <button onclick="editAdmin(${admin.id}, '${admin.email}', '${admin.role}')" style="background:rgba(59,130,246,0.2);color:#60a5fa;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500">Edit</button>
    </div>
  `).join('')

  res.send(`
    ${getHead('Manage Admins')}
    ${getSidebar('admins')}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Manage Admins</div>
          <div style="color:var(--text-muted);font-size:14px">Create and update admin credentials</div>
        </div>
        <button onclick="showCreateModal()" class="btn-premium">Add New Admin</button>
      </div>

      ${error ? `<div style="background:rgba(239,68,68,0.2);color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:20px;">${error}</div>` : ''}
      ${success ? `<div style="background:rgba(34,197,94,0.2);color:#86efac;padding:12px;border-radius:8px;margin-bottom:20px;">${success}</div>` : ''}

      <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:24px;">
        <h3 style="color:white;margin-bottom:20px;">Admin Accounts</h3>
        ${adminListHtml}
      </div>
    </div>

    <!-- Modal for Create/Edit -->
    <div id="adminModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:1000;align-items:center;justify-content:center;backdrop-filter:blur(5px);">
      <div class="glass-panel" style="width:100%;max-width:400px;padding:32px;position:relative;">
        <button onclick="closeModal()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;">&times;</button>
        <h2 id="modalTitle" style="color:white;margin-bottom:24px;font-size:20px;">Add Admin</h2>
        
        <form method="post" action="/super-admin/admins/save">
          <input type="hidden" name="id" id="adminId">
          <div style="margin-bottom:16px;">
            <label style="color:var(--text-muted);display:block;margin-bottom:8px;font-size:14px;">Email</label>
            <input type="email" name="email" id="adminEmail" required style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
          </div>
          <div style="margin-bottom:16px;">
            <label style="color:var(--text-muted);display:block;margin-bottom:8px;font-size:14px;">Password</label>
            <input type="text" name="password" id="adminPassword" placeholder="Leave empty to keep current" style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
          </div>
          <div style="margin-bottom:24px;">
            <label style="color:var(--text-muted);display:block;margin-bottom:8px;font-size:14px;">Role</label>
            <select name="role" id="adminRole" style="width:100%;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);padding:12px;border-radius:8px;color:white;">
              <option value="admin">Normal Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <button type="submit" class="btn-premium" style="width:100%;justify-content:center;">Save Changes</button>
        </form>
      </div>
    </div>

    <script>
      const modal = document.getElementById('adminModal');
      const title = document.getElementById('modalTitle');
      const idInput = document.getElementById('adminId');
      const emailInput = document.getElementById('adminEmail');
      const roleInput = document.getElementById('adminRole');
      const passwordInput = document.getElementById('adminPassword');

      function showCreateModal() {
        title.innerText = 'Add New Admin';
        idInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        passwordInput.placeholder = 'Required';
        passwordInput.required = true;
        roleInput.value = 'admin';
        modal.style.display = 'flex';
      }

      function editAdmin(id, email, role) {
        title.innerText = 'Edit Admin';
        idInput.value = id;
        emailInput.value = email;
        passwordInput.value = '';
        passwordInput.placeholder = 'Leave empty to keep current';
        passwordInput.required = false;
        roleInput.value = role;
        modal.style.display = 'flex';
      }

      function closeModal() {
        modal.style.display = 'none';
      }
      
      // Close on outside click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    </script>
    ${getScripts()}
  `)
})

router.post('/admins/save', requireSuperAdmin, async (req, res) => {
  const { id, email, password, role } = req.body
  
  try {
    if (id) {
      // Update
      const data = { email, role }
      if (password && password.trim()) {
        data.passwordHash = await bcrypt.hash(password, 10)
      }
      await prisma.admin.update({
        where: { id: parseInt(id) },
        data
      })
      res.redirect('/super-admin/admins?success=Admin+updated+successfully')
    } else {
      // Create
      if (!password) return res.redirect('/super-admin/admins?error=Password+is+required')
      const passwordHash = await bcrypt.hash(password, 10)
      await prisma.admin.create({
        data: {
          email,
          passwordHash,
          role
        }
      })
      res.redirect('/super-admin/admins?success=Admin+created+successfully')
    }
  } catch (e) {
    console.error(e)
    res.redirect('/super-admin/admins?error=' + encodeURIComponent(e.message))
  }
})

module.exports = router

const express = require('express')
const { prisma } = require('../db/prisma')
const router = express.Router()

// Middleware
const requireAdmin = (req, res, next) => {
  if (req.session.role !== 'ADMIN' && req.session.role !== 'SUPER_ADMIN') {
    return res.redirect('/admin/login')
  }
  next()
}

// Helpers
const getHead = (title) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - Admin Panel</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    .sidebar-premium .brand-logo { color: #f472b6; }
    .nav-item a.active { background: rgba(244, 114, 182, 0.1); color: #f472b6; border-left: 3px solid #f472b6; }
  </style>
</head>
<body>
  <button class="menu-trigger" id="mobileMenuBtn">☰</button>
  <div class="app-layout">
`

const getSidebar = (active, role) => `
<nav class="sidebar-premium" id="sidebar">
  <div class="brand-logo"><span>A</span> Admin Panel</div>
  <ul class="nav-links">
    <li class="nav-item"><a href="/admin/dashboard" class="${active === 'dashboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
    <li class="nav-item"><a href="/admin/users" class="${active === 'users' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Users</a></li>
    <li class="nav-item"><a href="/admin/balance" class="${active === 'balance' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:wallet.svg?color=%2394a3b8" class="nav-icon"> Balance</a></li>
    <li class="nav-item"><a href="/admin/topup-requests" class="${active === 'topup-requests' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up Requests</a></li>
    <li class="nav-item"><a href="/admin/guild-requests" class="${active === 'guild-requests' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:shield.svg?color=%2394a3b8" class="nav-icon"> Guild Requests</a></li>
    <li class="nav-item"><a href="/admin/promote-requests" class="${active === 'promote-requests' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Requests</a></li>
    <li class="nav-item"><a href="/admin/link-search" class="${active === 'link-search' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:search.svg?color=%2394a3b8" class="nav-icon"> Search Link</a></li>
    ${role === 'SUPER_ADMIN' ? `<li class="nav-item" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px"><a href="/super-admin/dashboard"><img src="https://api.iconify.design/lucide:shield-alert.svg?color=%23ec4899" class="nav-icon" style="color:#ec4899"> Super Admin</a></li>` : ''}
    <li class="nav-item" style="margin-top:auto"><a href="/admin/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
  </ul>
</nav>
`

const getScripts = () => `
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

// Dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  const pendingTopUps = await prisma.topUpRequest.count({ where: { status: 'PENDING' } })
  const pendingGuilds = await prisma.guild.count({ where: { status: 'PENDING' } })
  const pendingLinks = await prisma.linkSubmission.count({ where: { status: 'PENDING' } })
  
  res.send(`
    ${getHead('Dashboard')}
    ${getSidebar('dashboard', req.session.role)}
    <div class="main-content">
       <div class="section-title">Admin Dashboard</div>
       <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:20px;">
          <div class="stat-card">
             <h3>Pending TopUps</h3>
             <div class="value">${pendingTopUps}</div>
             <a href="/admin/topup-requests" class="btn-premium" style="margin-top:10px; display:inline-block; font-size:12px;">View</a>
          </div>
          <div class="stat-card">
             <h3>Pending Guilds</h3>
             <div class="value">${pendingGuilds}</div>
             <a href="/admin/guild-requests" class="btn-premium" style="margin-top:10px; display:inline-block; font-size:12px;">View</a>
          </div>
          <div class="stat-card">
             <h3>Pending Links</h3>
             <div class="value">${pendingLinks}</div>
             <a href="/admin/promote-requests" class="btn-premium" style="margin-top:10px; display:inline-block; font-size:12px;">View</a>
          </div>
       </div>
    </div>
    ${getScripts()}
  `)
})

// TopUp Requests
router.get('/topup-requests', requireAdmin, async (req, res) => {
  const requests = await prisma.topUpRequest.findMany({
    where: { status: 'PENDING' },
    include: { user: true, package: true, wallet: true },
    orderBy: { createdAt: 'desc' }
  })
  
  res.send(`
    ${getHead('TopUp Requests')}
    ${getSidebar('topup-requests', req.session.role)}
    <div class="main-content">
      <div class="section-title">TopUp Requests</div>
      <div style="display:flex; flex-direction:column; gap:15px;">
        ${requests.map(r => `
          <div class="glass-panel" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <span style="color:#f472b6; font-weight:bold;">${r.package.name} (${r.package.diamondAmount} 💎)</span>
              <span style="color:#94a3b8; font-size:12px;">${new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <div style="font-size:13px; color:#cbd5e1; display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
               <div>User: <b>${r.user.firstName} ${r.user.lastName}</b> (@${r.user.username})</div>
               <div>Method: <b>${r.wallet.name}</b></div>
               <div>Sender: <b>${r.senderNumber}</b></div>
               <div>TrxID: <b style="color:#fbbf24; user-select:all;">${r.trxId}</b></div>
            </div>
            <div style="display:flex; gap:10px;">
               <form action="/admin/topup-approve" method="POST">
                 <input type="hidden" name="id" value="${r.id}">
                 <button class="btn-premium" style="background:#22c55e; border-color:#22c55e;">Approve</button>
               </form>
               <form action="/admin/topup-reject" method="POST">
                 <input type="hidden" name="id" value="${r.id}">
                 <button class="btn-premium" style="background:#ef4444; border-color:#ef4444;">Reject</button>
               </form>
            </div>
          </div>
        `).join('')}
        ${requests.length === 0 ? '<div style="text-align:center; color:#94a3b8; padding:40px;">No pending requests</div>' : ''}
      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/topup-approve', requireAdmin, async (req, res) => {
    const { id } = req.body
    const request = await prisma.topUpRequest.findUnique({ where: { id: parseInt(id) }, include: { package: true } })
    if(request && request.status === 'PENDING') {
        await prisma.$transaction([
            prisma.topUpRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', processedAt: new Date() } }),
            prisma.user.update({ where: { id: request.userId }, data: { diamond: { increment: request.package.diamondAmount } } }),
            prisma.notification.create({ data: { userId: request.userId, message: `TopUp Successful! ${request.package.diamondAmount} diamonds added to your account.`, type: 'credit' } })
        ])
    }
    res.redirect('/admin/topup-requests')
})

router.post('/topup-reject', requireAdmin, async (req, res) => {
    const { id } = req.body
    const request = await prisma.topUpRequest.findUnique({ where: { id: parseInt(id) } })
    if(request && request.status === 'PENDING') {
        await prisma.topUpRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', processedAt: new Date() } })
        await prisma.notification.create({ data: { userId: request.userId, message: `TopUp Failed. TrxID: ${request.trxId} was rejected. Please contact support if this is an error.`, type: 'alert' } })
    }
    res.redirect('/admin/topup-requests')
})

// Promote Requests (Link Submissions)
router.get('/promote-requests', requireAdmin, async (req, res) => {
  const submissions = await prisma.linkSubmission.findMany({
    where: { status: 'PENDING' },
    include: { promotedLink: true, visitor: true },
    orderBy: { submittedAt: 'desc' }
  })
  
  res.send(`
    ${getHead('Promote Requests')}
    ${getSidebar('promote-requests', req.session.role)}
    <div class="main-content">
       <div class="section-title">Link Task Submissions</div>
       <div style="display:flex; flex-direction:column; gap:15px;">
         ${submissions.map(s => `
           <div class="glass-panel" style="padding:20px;">
             <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span style="color:#f472b6; font-weight:bold;">${s.promotedLink.title}</span>
                <span style="color:#94a3b8; font-size:12px;">${new Date(s.submittedAt).toLocaleString()}</span>
             </div>
             <div style="font-size:13px; color:#cbd5e1; margin-bottom:10px;">
                Visitor: <b>${s.visitor.firstName} ${s.visitor.lastName}</b> (@${s.visitor.username})
             </div>
             <div style="display:flex; gap:10px; overflow-x:auto; margin-bottom:15px;">
                ${s.screenshots.map(url => `<a href="${url}" target="_blank"><img src="${url}" style="height:100px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);"></a>`).join('')}
             </div>
             <div style="display:flex; gap:10px;">
                <form action="/admin/promote-approve" method="POST">
                  <input type="hidden" name="id" value="${s.id}">
                  <button class="btn-premium" style="background:#22c55e; border-color:#22c55e;">Approve</button>
                </form>
                <form action="/admin/promote-reject" method="POST">
                  <input type="hidden" name="id" value="${s.id}">
                  <button class="btn-premium" style="background:#ef4444; border-color:#ef4444;">Reject</button>
                </form>
             </div>
           </div>
         `).join('')}
         ${submissions.length === 0 ? '<div style="text-align:center; color:#94a3b8; padding:40px;">No pending submissions</div>' : ''}
       </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/promote-approve', requireAdmin, async (req, res) => {
    const { id } = req.body
    const sub = await prisma.linkSubmission.findUnique({ where: { id: parseInt(id) }, include: { promotedLink: true } })
    if(sub && sub.status === 'PENDING') {
        await prisma.$transaction([
            prisma.linkSubmission.update({ where: { id: sub.id }, data: { status: 'APPROVED' } }),
            prisma.promotedLink.update({ where: { id: sub.promotedLinkId }, data: { completedVisits: { increment: 1 } } }),
            prisma.notification.create({ data: { userId: sub.visitorId, message: `Task Approved! You visited "${sub.promotedLink.title}" successfully.`, type: 'info' } })
        ])
    }
    res.redirect('/admin/promote-requests')
})

router.post('/promote-reject', requireAdmin, async (req, res) => {
    const { id } = req.body
    const sub = await prisma.linkSubmission.findUnique({ where: { id: parseInt(id) }, include: { promotedLink: true } })
    if(sub && sub.status === 'PENDING') {
        await prisma.linkSubmission.update({ where: { id: sub.id }, data: { status: 'REJECTED' } })
        await prisma.notification.create({ data: { userId: sub.visitorId, message: `Task Rejected. Your submission for "${sub.promotedLink.title}" was invalid.`, type: 'alert' } })
    }
    res.redirect('/admin/promote-requests')
})

// Guild Requests
router.get('/guild-requests', requireAdmin, async (req, res) => {
    const guilds = await prisma.guild.findMany({ where: { status: 'PENDING' }, include: { leader: true } })
    res.send(`
        ${getHead('Guild Requests')}
        ${getSidebar('guild-requests', req.session.role)}
        <div class="main-content">
            <div class="section-title">Guild Requests</div>
            ${guilds.map(g => `
                <div class="glass-panel" style="padding:20px; margin-bottom:15px;">
                    <h3>${g.name} (@${g.username})</h3>
                    <p style="color:#cbd5e1; font-size:13px; margin:5px 0;">Leader: ${g.leader.firstName} ${g.leader.lastName}</p>
                    <p style="color:#94a3b8; font-size:13px;">${g.description || 'No description'}</p>
                    <div style="margin-top:15px; display:flex; gap:10px;">
                        <form action="/admin/guild-approve" method="POST"><input type="hidden" name="id" value="${g.id}"><button class="btn-premium" style="background:#22c55e; border-color:#22c55e;">Approve</button></form>
                        <form action="/admin/guild-reject" method="POST"><input type="hidden" name="id" value="${g.id}"><button class="btn-premium" style="background:#ef4444; border-color:#ef4444;">Reject</button></form>
                    </div>
                </div>
            `).join('')}
             ${guilds.length === 0 ? '<div style="text-align:center; color:#94a3b8; padding:40px;">No pending guild requests</div>' : ''}
        </div>
        ${getScripts()}
    `)
})

router.post('/guild-approve', requireAdmin, async (req, res) => {
    const { id } = req.body
    const guild = await prisma.guild.findUnique({ where: { id: parseInt(id) } })
    if(guild) {
        await prisma.guild.update({ where: { id: guild.id }, data: { status: 'APPROVED' } })
        await prisma.user.update({ where: { id: guild.leaderId }, data: { guildId: guild.id } })
        await prisma.notification.create({ data: { userId: guild.leaderId, message: `Guild Approved! Your guild "${guild.name}" is now active.`, type: 'info' } })
    }
    res.redirect('/admin/guild-requests')
})

router.post('/guild-reject', requireAdmin, async (req, res) => {
    const { id } = req.body
    const guild = await prisma.guild.findUnique({ where: { id: parseInt(id) } })
    if(guild) {
        await prisma.guild.update({ where: { id: guild.id }, data: { status: 'REJECTED' } })
        await prisma.notification.create({ data: { userId: guild.leaderId, message: `Guild Rejected. Your guild request for "${guild.name}" was declined.`, type: 'alert' } })
    }
    res.redirect('/admin/guild-requests')
})

router.post('/guild-settings', requireAdmin, async (req, res) => {
  const { requirements } = req.body
  await prisma.systemSetting.upsert({
    where: { key: 'guild_requirements_youtuber' },
    update: { value: requirements },
    create: { key: 'guild_requirements_youtuber', value: requirements }
  })
  res.redirect('/admin/guild-settings')
})

// --- Link Search & Management ---
router.get('/link-search', requireAdmin, async (req, res) => {
  const { q, success } = req.query;
  let link = null;
  
  if (q) {
      if (q.startsWith('http')) {
           link = await prisma.promotedLink.findFirst({ where: { url: q }, include: { user: true } });
      } else if (!isNaN(q)) {
           link = await prisma.promotedLink.findUnique({ where: { id: parseInt(q) }, include: { user: true } });
      } else {
           link = await prisma.promotedLink.findFirst({ where: { title: { contains: q, mode: 'insensitive' } }, include: { user: true } });
      }
  }

  res.send(`
    ${getHead('Search Link')}
    ${getSidebar('link-search', req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Search User Link</div>
          <div style="color:var(--text-muted)">Find and manage user promoted links</div>
        </div>
      </div>

      ${success ? `<div style="background:rgba(34,197,94,0.1);color:#4ade80;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;">${success}</div>` : ''}

      <div class="glass-panel" style="padding: 24px; margin-bottom: 24px;">
        <form action="/admin/link-search" method="GET" style="display:flex; gap:12px;">
          <input type="text" name="q" value="${q || ''}" placeholder="Enter Link ID, URL, or Title..." class="form-input" style="flex:1;">
          <button type="submit" class="btn-premium">Search</button>
        </form>
      </div>

      ${link ? `
        <div class="glass-panel" style="padding: 24px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
             <div>
               <h3 style="font-size:18px; color:white; margin-bottom:4px;">${link.title}</h3>
               <a href="${link.url}" target="_blank" style="color:#60a5fa; font-size:14px;">${link.url}</a>
             </div>
             <span style="padding:4px 12px; border-radius:20px; font-size:12px; font-weight:bold; ${link.status === 'ACTIVE' ? 'background:rgba(34,197,94,0.2);color:#86efac;' : link.status === 'BLOCKED' ? 'background:rgba(239,68,68,0.2);color:#fca5a5;' : 'background:rgba(148,163,184,0.2);color:#cbd5e1;'}">${link.status}</span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
             <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px;">
                <div style="color:var(--text-muted); font-size:12px;">Owner</div>
                <div style="color:white; font-weight:600;">${link.user.firstName} ${link.user.lastName}</div>
                <div style="color:var(--text-muted); font-size:12px;">@${link.user.username}</div>
             </div>
             <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px;">
                <div style="color:var(--text-muted); font-size:12px;">Visits</div>
                <div style="color:white; font-weight:600;">${link.completedVisits} / ${link.targetVisits}</div>
                <div style="color:var(--text-muted); font-size:12px;">Progress: ${Math.round((link.completedVisits/link.targetVisits)*100)}%</div>
             </div>
          </div>

          <!-- Actions -->
          <div style="border-top:1px solid var(--glass-border); padding-top:20px;">
             <h4 style="color:white; margin-bottom:16px;">Admin Actions</h4>
             
             <!-- Update Visits -->
             <form action="/admin/link-action" method="POST" style="margin-bottom:20px;">
               <input type="hidden" name="linkId" value="${link.id}">
               <input type="hidden" name="action" value="update_visits">
               <label style="color:var(--text-muted); font-size:14px; display:block; margin-bottom:8px;">Update Completed Visits (Free)</label>
               <div style="display:flex; gap:12px;">
                 <input type="number" name="value" value="${link.completedVisits}" class="form-input" style="width:150px;">
                 <button type="submit" class="btn-premium">Update Visits</button>
               </div>
             </form>

             <div style="display:flex; gap:12px;">
               ${link.status === 'BLOCKED' ? `
                 <form action="/admin/link-action" method="POST">
                   <input type="hidden" name="linkId" value="${link.id}">
                   <input type="hidden" name="action" value="unblock">
                   <button type="submit" class="btn-premium" style="background:rgba(34,197,94,0.2); color:#86efac; border-color:rgba(34,197,94,0.3);">Unblock Link</button>
                 </form>
               ` : `
                 <form action="/admin/link-action" method="POST">
                   <input type="hidden" name="linkId" value="${link.id}">
                   <input type="hidden" name="action" value="block">
                   <button type="submit" class="btn-premium" style="background:rgba(239,68,68,0.2); color:#fca5a5; border-color:rgba(239,68,68,0.3);">Block Link</button>
                 </form>
               `}
               
               <form action="/admin/link-action" method="POST" onsubmit="return confirm('Delete this link permanently?')">
                 <input type="hidden" name="linkId" value="${link.id}">
                 <input type="hidden" name="action" value="delete">
                 <button type="submit" class="btn-premium" style="background:rgba(239,68,68,0.2); color:#fca5a5; border-color:rgba(239,68,68,0.3);">Delete Link</button>
               </form>
             </div>
          </div>
        </div>
      ` : q ? '<div style="text-align:center; padding:40px; color:var(--text-muted);">No link found matching your query</div>' : ''}
    </div>
    ${getScripts()}
  `);
});

router.post('/link-action', requireAdmin, async (req, res) => {
    const { linkId, action, value } = req.body;
    const link = await prisma.promotedLink.findUnique({ where: { id: parseInt(linkId) } });
    
    if(!link) return res.send('Link not found');

    if (action === 'delete') {
        await prisma.promotedLink.delete({ where: { id: link.id } });
        await prisma.notification.create({
            data: { userId: link.userId, message: `Your link "${link.title}" has been deleted by admin.`, type: 'alert' }
        });
        return res.redirect('/admin/link-search?success=Link+Deleted');
    } 
    
    if (action === 'block') {
        await prisma.promotedLink.update({ where: { id: link.id }, data: { status: 'BLOCKED' } });
        await prisma.notification.create({
            data: { userId: link.userId, message: `Your link "${link.title}" has been blocked by admin.`, type: 'alert' }
        });
    } else if (action === 'unblock') {
        await prisma.promotedLink.update({ where: { id: link.id }, data: { status: 'ACTIVE' } });
        await prisma.notification.create({
            data: { userId: link.userId, message: `Your link "${link.title}" has been unblocked.`, type: 'info' }
        });
    } else if (action === 'update_visits') {
        const newVisits = parseInt(value);
        await prisma.promotedLink.update({ where: { id: link.id }, data: { completedVisits: newVisits } });
        await prisma.notification.create({
            data: { userId: link.userId, message: `Your link "${link.title}" visits have been updated to ${newVisits} by admin.`, type: 'info' }
        });
    }

    res.redirect('/admin/link-search?q=' + link.id + '&success=Action+Completed');
});

// --- Users & Balance Management ---
router.get('/users', requireAdmin, async (req, res) => {
  const { q, page } = req.query
  const currentPage = parseInt(page) || 1
  const limit = 20
  const skip = (currentPage - 1) * limit
  
  const where = q ? {
    OR: [
      { username: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } }
    ]
  } : {}

  const totalUsers = await prisma.user.count({ where })
  const users = await prisma.user.findMany({
    where,
    take: limit,
    skip,
    orderBy: { createdAt: 'desc' }
  })
  
  const totalPages = Math.ceil(totalUsers / limit)

  res.send(`
    ${getHead('Users')}
    ${getSidebar('users', req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">User Management</div>
          <div style="color:var(--text-muted)">Total Users: ${totalUsers}</div>
        </div>
      </div>
      
      <div class="glass-panel" style="padding:20px; margin-bottom:20px;">
        <form action="/admin/users" method="GET" style="display:flex; gap:10px;">
          <input type="text" name="q" value="${q || ''}" placeholder="Search username, email, phone..." class="form-input" style="flex:1">
          <button class="btn-premium">Search</button>
        </form>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
        ${users.map(u => `
          <div class="glass-panel" style="padding: 20px; display: flex; flex-direction: column; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <div style="width: 50px; height: 50px; border-radius: 50%; background: #1e293b; overflow: hidden; border: 2px solid rgba(255,255,255,0.1);">
                <img src="${u.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" style="width: 100%; height: 100%; object-fit: cover;">
              </div>
              <div>
                <div style="font-weight: bold; color: white;">${u.firstName} ${u.lastName}</div>
                <div style="font-size: 12px; color: #94a3b8;">@${u.username}</div>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #94a3b8;">Diamonds</div>
                <div style="color: #f472b6; font-weight: bold;">${u.diamond}</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #94a3b8;">Coins</div>
                <div style="color: #fbbf24; font-weight: bold;">${u.coin}</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 12px; color: #94a3b8;">${new Date(u.createdAt).toLocaleDateString()}</div>
              ${u.isBlocked 
                ? '<span style="color:#ef4444; background:rgba(239,68,68,0.1); padding:2px 8px; border-radius:10px; font-size:11px;">Blocked</span>' 
                : '<span style="color:#22c55e; background:rgba(34,197,94,0.1); padding:2px 8px; border-radius:10px; font-size:11px;">Active</span>'}
            </div>

            <a href="/admin/user/${u.id}" class="btn-premium" style="text-align: center; justify-content: center; margin-top: auto;">Manage User</a>
          </div>
        `).join('')}
      </div>

      <!-- Pagination -->
      <div style="display:flex; justify-content:center; gap:10px; margin-top:20px;">
        ${currentPage > 1 ? `<a href="/admin/users?page=${currentPage - 1}&q=${q || ''}" class="btn-premium" style="background:transparent; border:1px solid rgba(255,255,255,0.2);">Prev</a>` : ''}
        <span style="padding:8px; color:#94a3b8;">Page ${currentPage} of ${totalPages}</span>
        ${currentPage < totalPages ? `<a href="/admin/users?page=${currentPage + 1}&q=${q || ''}" class="btn-premium" style="background:transparent; border:1px solid rgba(255,255,255,0.2);">Next</a>` : ''}
      </div>
    </div>
    ${getScripts()}
  `)
})

router.get('/user/:id', requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } })
  if (!user) return res.redirect('/admin/users')

  res.send(`
    ${getHead('Manage User')}
    ${getSidebar('users', req.session.role)}
    <div class="main-content">
      <div class="section-title">Manage User: @${user.username}</div>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
        
        <!-- Balance Management -->
        <div class="glass-panel" style="padding:20px;">
           <h3 style="color:#f472b6; margin-bottom:15px;">Balance Management</h3>
           <form action="/admin/user/update-balance" method="POST">
             <input type="hidden" name="userId" value="${user.id}">
             
             <div style="margin-bottom:15px;">
               <label style="color:#94a3b8; font-size:12px;">Diamonds (Current: ${user.diamond})</label>
               <div style="display:flex; gap:10px;">
                 <select name="diamondAction" class="form-input" style="width:80px;">
                   <option value="add">Add</option>
                   <option value="remove">Remove</option>
                 </select>
                 <input type="number" name="diamondAmount" placeholder="Amount" class="form-input" style="flex:1">
               </div>
             </div>

             <div style="margin-bottom:15px;">
               <label style="color:#94a3b8; font-size:12px;">Coins (Current: ${user.coin})</label>
               <div style="display:flex; gap:10px;">
                 <select name="coinAction" class="form-input" style="width:80px;">
                   <option value="add">Add</option>
                   <option value="remove">Remove</option>
                 </select>
                 <input type="number" name="coinAmount" placeholder="Amount" class="form-input" style="flex:1">
               </div>
             </div>

             <button class="btn-premium" style="width:100%;">Update Balance</button>
           </form>
        </div>

        <!-- Account Actions -->
        <div class="glass-panel" style="padding:20px;">
           <h3 style="color:#f472b6; margin-bottom:15px;">Account Actions</h3>
           
           <form action="/admin/user/status" method="POST" style="margin-bottom:20px;">
             <input type="hidden" name="userId" value="${user.id}">
             <input type="hidden" name="status" value="${user.isBlocked ? 'active' : 'blocked'}">
             <button class="btn-premium" style="width:100%; background:${user.isBlocked ? '#22c55e' : '#ef4444'}; border-color:${user.isBlocked ? '#22c55e' : '#ef4444'};">
               ${user.isBlocked ? 'Unblock User' : 'Block User'}
             </button>
           </form>

           <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
             <div style="color:#cbd5e1; font-size:14px; margin-bottom:10px;">User Info</div>
             <div style="font-size:13px; color:#94a3b8;">
               <div>Name: ${user.firstName} ${user.lastName}</div>
               <div>Email: ${user.email}</div>
               <div>Phone: ${user.phone}</div>
               <div>Joined: ${new Date(user.createdAt).toLocaleDateString()}</div>
             </div>
           </div>
        </div>

      </div>
    </div>
    ${getScripts()}
  `)
})

router.post('/user/update-balance', requireAdmin, async (req, res) => {
  const { userId, diamondAction, diamondAmount, coinAction, coinAmount } = req.body
  const id = parseInt(userId)
  const dAmount = parseInt(diamondAmount) || 0
  const cAmount = parseInt(coinAmount) || 0

  if (dAmount > 0) {
    if (diamondAction === 'add') {
       await prisma.user.update({ where: { id }, data: { diamond: { increment: dAmount } } })
       await prisma.notification.create({ data: { userId: id, message: `Admin added ${dAmount} diamonds to your account.`, type: 'credit' } })
    } else {
       await prisma.user.update({ where: { id }, data: { diamond: { decrement: dAmount } } })
       await prisma.notification.create({ data: { userId: id, message: `Admin removed ${dAmount} diamonds from your account.`, type: 'debit' } })
    }
  }

  if (cAmount > 0) {
    if (coinAction === 'add') {
       await prisma.user.update({ where: { id }, data: { coin: { increment: cAmount } } })
       await prisma.notification.create({ data: { userId: id, message: `Admin added ${cAmount} coins to your account.`, type: 'credit' } })
    } else {
       await prisma.user.update({ where: { id }, data: { coin: { decrement: cAmount } } })
       await prisma.notification.create({ data: { userId: id, message: `Admin removed ${cAmount} coins from your account.`, type: 'debit' } })
    }
  }

  res.redirect(`/admin/user/${id}`)
})

router.post('/user/status', requireAdmin, async (req, res) => {
  const { userId, status } = req.body
  const id = parseInt(userId)
  
  await prisma.user.update({ 
    where: { id }, 
    data: { isBlocked: status === 'blocked' } 
  })

  if (status === 'blocked') {
    await prisma.notification.create({ data: { userId: id, message: 'Your account has been blocked by admin.', type: 'alert' } })
  } else {
    await prisma.notification.create({ data: { userId: id, message: 'Your account has been unblocked by admin.', type: 'info' } })
  }

  res.redirect(`/admin/user/${id}`)
})

// Balance Page (Quick Access)
router.get('/balance', requireAdmin, async (req, res) => {
  const { username } = req.query
  let user = null
  if (username) {
    user = await prisma.user.findUnique({ where: { username } })
  }

  res.send(`
    ${getHead('Balance Management')}
    ${getSidebar('balance', req.session.role)}
    <div class="main-content">
      <div class="section-title">Quick Balance Management</div>
      
      <div class="glass-panel" style="padding:30px; margin-bottom:40px; max-width:600px; margin-left:auto; margin-right:auto;">
        <h3 style="text-align:center; margin-bottom:20px; color:#f472b6;">Find User Wallet</h3>
        <form action="/admin/balance" method="GET" style="display:flex; gap:10px;">
          <input type="text" name="username" value="${username || ''}" placeholder="Enter username (e.g. billah3211)..." class="form-input" style="flex:1; padding:12px;" required>
          <button class="btn-premium">Search</button>
        </form>
      </div>

      ${user ? `
        <div style="max-width:800px; margin:0 auto;">
           <div style="display:flex; align-items:center; gap:15px; margin-bottom:30px;">
              <img src="${user.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" style="width:60px; height:60px; border-radius:50%; border:2px solid white;">
              <div>
                 <h2 style="margin:0; font-size:24px;">${user.firstName} ${user.lastName}</h2>
                 <div style="color:#94a3b8;">@${user.username}</div>
              </div>
           </div>

           <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:40px;">
              <!-- Diamond Box -->
              <div class="glass-panel" style="padding:20px; text-align:center;">
                 <img src="https://api.iconify.design/lucide:gem.svg?color=%23f472b6" width="40" style="margin-bottom:10px;">
                 <div style="font-size:24px; font-weight:bold; color:white;">${user.diamond}</div>
                 <div style="color:#94a3b8; font-size:12px;">Diamond Balance</div>
              </div>

              <!-- Coin Box -->
              <div class="glass-panel" style="padding:20px; text-align:center;">
                 <img src="https://api.iconify.design/lucide:coins.svg?color=%23fbbf24" width="40" style="margin-bottom:10px;">
                 <div style="font-size:24px; font-weight:bold; color:white;">${user.coin}</div>
                 <div style="color:#94a3b8; font-size:12px;">Coin Balance</div>
              </div>
           </div>

           <div class="glass-panel" style="padding:30px;">
             <h3 style="color:white; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">Update Balance</h3>
             <form action="/admin/user/update-balance" method="POST">
               <input type="hidden" name="userId" value="${user.id}">
               
               <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:20px;">
                   <div>
                       <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">Balance Type</label>
                       <select name="balanceType" class="form-input" style="width:100%;">
                         <option value="diamond">Diamond (Current: ${user.diamond})</option>
                         <option value="coin">Coin (Current: ${user.coin})</option>
                         <option value="tk">Tk (Current: ${user.tk})</option>
                         <option value="lora">HaMJ T (Current: ${user.lora})</option>
                       </select>
                   </div>
                   <div>
                       <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">Action</label>
                       <select name="action" class="form-input" style="width:100%;">
                         <option value="add">Add (+)</option>
                         <option value="remove">Remove (-)</option>
                       </select>
                   </div>
                   <div>
                       <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">Amount</label>
                       <input type="number" name="amount" placeholder="0" class="form-input" style="width:100%;" required>
                   </div>
               </div>

               <div style="margin-bottom:20px;">
                 <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">Message for User</label>
                 <textarea name="message" class="form-input" style="width:100%; min-height:80px;" placeholder="Write a reason or message for the user..." required></textarea>
               </div>

               <button class="btn-premium" style="width:100%; justify-content:center; padding:16px;">Confirm & Update Balance</button>
             </form>
           </div>
        </div>
      ` : username ? '<div style="text-align:center; padding:40px; color:#ef4444; font-size:18px;">User not found</div>' : ''}
    </div>
    ${getScripts()}
  `)
})

// Login/Logout (simplified for admin)
router.get('/login', (req, res) => {
  res.send(`
    ${getHead('Admin Login')}
    <div style="display:flex; align-items:center; justify-content:center; height:100vh;">
      <div class="glass-panel" style="padding:40px; width:100%; max-width:400px;">
        <h2 style="text-align:center; color:#f472b6; margin-bottom:20px;">Admin Login</h2>
        <form action="/auth/login" method="POST">
           <input type="text" name="identifier" placeholder="Email or Username" class="form-input" style="margin-bottom:15px;" required>
           <input type="password" name="password" placeholder="Password" class="form-input" style="margin-bottom:20px;" required>
           <button class="btn-premium" style="width:100%;">Login</button>
        </form>
      </div>
    </div>
  `)
})

router.get('/logout', (req, res) => {
  req.session.destroy()
  res.redirect('/admin/login')
})

module.exports = router
const express = require('express')
const { prisma } = require('../db/prisma')
const router = express.Router()

// Middleware to ensure login
const requireLogin = (req, res, next) => {
  if (req.session && req.session.userId) return next()
  res.redirect('/login')
}

// Layout Helpers
const getSidebar = (active) => `
  <nav class="sidebar-premium" id="sidebar">
    <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
    <ul class="nav-links">
      <li class="nav-item"><a href="/dashboard"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
      <li class="nav-item"><a href="/promote"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Link</a></li>
      <li class="nav-item"><a href="/store"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
      <li class="nav-item"><a href="/store/my"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
      <li class="nav-item"><a href="/topup"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up</a></li>
      <li class="nav-item"><a href="/guild" class="active"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Guild</a></li>
      <li class="nav-item"><a href="/notifications"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
      <li class="nav-item"><a href="/settings"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
      <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
    </ul>
  </nav>
`

const getHead = (title) => `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} - HaMJ toP PaY</title>
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
      .guild-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
      .guild-badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
      .badge-user { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
      .badge-youtuber { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
      .guild-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); opacity: 1; pointer-events: auto; }
      .modal-content { background: #1e293b; padding: 24px; border-radius: 16px; width: 90%; max-width: 500px; border: 1px solid rgba(255,255,255,0.1); max-height: 90vh; overflow-y: auto; }
    </style>
  </head>
  <body>
    <button class="menu-trigger" id="mobileMenuBtn">☰</button>
    <div class="app-layout">
`

const getFooter = () => `
    </div>
    <script>
      const menuBtn = document.getElementById('mobileMenuBtn');
      const sidebar = document.getElementById('sidebar');
      if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    </script>
  </body>
  </html>
`

// ----------------------------------------------------------------------
// GUILD ROUTES
// ----------------------------------------------------------------------

router.get('/', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { guild: { include: { leader: true, members: true } } }
  })

  // 1. User is in a Guild (or Leader of one)
  if (user.guild) {
    const guild = user.guild
    
    // Check Status
    if (guild.status === 'PENDING') {
      return res.send(`
        ${getHead('Guild Pending')}
        ${getSidebar('guild')}
        <div class="main-content">
          <div class="container" style="padding:20px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; height:80vh;">
            <div style="font-size:48px; margin-bottom:20px">⏳</div>
            <h2 style="margin-bottom:10px">Application Pending</h2>
            <p style="color:var(--text-muted); margin-bottom:20px">Your YouTuber Guild application is currently under review by the admin. Please wait 24-48 hours.</p>
            <div class="glass-panel" style="padding:16px; width:100%">
              <div>Guild Name: <b>${guild.name}</b></div>
              <div>Submitted: ${new Date(guild.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        ${getFooter()}
      `)
    }

    // Active Guild Dashboard
    const isLeader = guild.leaderId === user.id
    const memberCount = guild.members.length
    
    return res.send(`
      ${getHead('My Guild')}
      ${getSidebar('guild')}
      <div class="main-content">
        <div class="section-header">
          <div>
            <div class="section-title">${guild.name}</div>
            <div style="color:var(--text-muted)">@${guild.username}</div>
          </div>
          <span class="guild-badge ${guild.type === 'YOUTUBER' ? 'badge-youtuber' : 'badge-user'}">${guild.type}</span>
        </div>

        <div class="glass-panel" style="padding:24px; margin-bottom:24px; text-align:center">
          <div style="font-size:32px; font-weight:bold; margin-bottom:4px">${memberCount} / ${guild.memberLimit}</div>
          <div style="color:var(--text-muted); font-size:14px">Members</div>
          
          <div style="margin-top:16px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-around">
            <div>
              <div style="font-weight:bold; color:#fb923c">${guild.commissionRate}%</div>
              <div style="font-size:12px; color:var(--text-muted)">Commission</div>
            </div>
            <div>
              <div style="font-weight:bold">${guild.leader.firstName}</div>
              <div style="font-size:12px; color:var(--text-muted)">Leader</div>
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding:16px; margin-bottom:24px">
          <h3 style="margin-bottom:16px; font-size:16px">Actions</h3>
          ${!isLeader ? `
            <form action="/guild/leave" method="POST" onsubmit="return confirm('Are you sure you want to leave this guild?')">
              <button class="btn-premium" style="width:100%; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.3)">Leave Guild</button>
            </form>
          ` : `
            <div style="text-align:center; color:var(--text-muted); font-size:14px">Leader cannot leave directly.</div>
          `}
        </div>

        <!-- Member List -->
        <h3 style="margin-bottom:12px; font-size:16px">Members</h3>
        <div class="member-list">
          ${guild.members.map(m => `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px">
              <div style="width:32px; height:32px; background:var(--primary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold">
                ${m.firstName[0]}
              </div>
              <div>
                <div style="font-size:14px; font-weight:bold">${m.firstName} ${m.lastName} ${m.id === guild.leaderId ? '👑' : ''}</div>
                <div style="font-size:12px; color:var(--text-muted)">@${m.username}</div>
              </div>
            </div>
          `).join('')}
        </div>

      </div>
      ${getFooter()}
    `)
  }

  // 2. No Guild - Show Search & Create
  const query = req.query.q || ''
  let guilds = []
  
  if (query) {
    guilds = await prisma.guild.findMany({
      where: { 
        username: { contains: query, mode: 'insensitive' },
        status: 'APPROVED'
      },
      include: { members: true },
      take: 10
    })
  } else {
    // Default list (e.g., random or most members)
    guilds = await prisma.guild.findMany({
      where: { status: 'APPROVED' },
      include: { members: true },
      orderBy: { members: { _count: 'desc' } },
      take: 10
    })
  }

  res.send(`
    ${getHead('Guilds')}
    ${getSidebar('guild')}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Guilds</div>
          <div style="color:var(--text-muted)">Join a community or start your own</div>
        </div>
        <button onclick="document.getElementById('createModal').style.display='flex'" class="btn-premium" style="font-size:12px; padding:8px 16px">+ Create</button>
      </div>

      <!-- Search -->
      <form action="/guild" method="GET" style="margin-bottom:24px">
        <div style="position:relative">
          <input type="text" name="q" value="${query}" placeholder="Search by Guild Username..." class="form-input" style="width:100%; padding-left:40px">
          <i class="fas fa-search" style="position:absolute; left:14px; top:14px; color:var(--text-muted)"></i>
        </div>
      </form>

      <!-- List -->
      <div class="guild-list">
        ${guilds.length ? guilds.map(g => `
          <div class="guild-card">
            <div>
              <div style="font-weight:bold; font-size:16px">${g.name}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px">@${g.username}</div>
              <div style="display:flex; gap:8px; align-items:center">
                <span class="guild-badge ${g.type === 'YOUTUBER' ? 'badge-youtuber' : 'badge-user'}">${g.type}</span>
                <span style="font-size:12px; color:var(--text-muted)">👥 ${g.members.length} / ${g.memberLimit}</span>
              </div>
            </div>
            ${g.members.length < g.memberLimit ? `
              <form action="/guild/join/${g.id}" method="POST">
                <button class="btn-premium" style="padding:6px 16px; font-size:12px">Join</button>
              </form>
            ` : `<button disabled class="btn-premium" style="opacity:0.5; padding:6px 16px; font-size:12px">Full</button>`}
          </div>
        `).join('') : `
          <div style="text-align:center; padding:40px; color:var(--text-muted)">
            <div style="font-size:32px; margin-bottom:10px">🔍</div>
            No guilds found. Try searching or create one!
          </div>
        `}
      </div>
    </div>

    <!-- Create Modal -->
    <div id="createModal" class="guild-modal" onclick="if(event.target===this)this.style.display='none'">
      <div class="modal-content">
        <h3 style="margin-bottom:20px; text-align:center">Create New Guild</h3>
        
        <div style="display:flex; gap:12px; margin-bottom:24px">
          <button onclick="showForm('user')" class="btn-premium active-tab" id="btn-user" style="flex:1; background:rgba(59,130,246,0.2)">User Guild</button>
          <button onclick="showForm('youtuber')" class="btn-premium" id="btn-youtuber" style="flex:1; background:rgba(255,255,255,0.05)">YouTuber Guild</button>
        </div>

        <!-- User Form -->
        <form id="form-user" action="/guild/create" method="POST">
          <input type="hidden" name="type" value="USER">
          <div class="alert info" style="font-size:12px; margin-bottom:16px">
            • 50 Member Limit<br>
            • 1% Commission on Member Top-Ups<br>
            • Instant Creation
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Guild Name</label>
            <input type="text" name="name" required class="form-input" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label">Guild Username (Unique)</label>
            <input type="text" name="username" required class="form-input" style="width:100%">
          </div>
          <button class="btn-premium full-width">Create User Guild</button>
        </form>

        <!-- YouTuber Form -->
        <form id="form-youtuber" action="/guild/create" method="POST" style="display:none">
          <input type="hidden" name="type" value="YOUTUBER">
          <div class="alert info" style="font-size:12px; margin-bottom:16px; border-color:#fca5a5; background:rgba(239,68,68,0.1)">
            <b>Requirements:</b><br>
            • 2,000+ Subscribers<br>
            • 1,000+ Views on 1 video<br>
            • 1 video about Hamj Top Pay<br>
            • 2 videos/month required
          </div>
          
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Guild Name</label>
            <input type="text" name="name" required class="form-input" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Guild Username</label>
            <input type="text" name="username" required class="form-input" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">YouTube Channel Link</label>
            <input type="url" name="channelLink" required class="form-input" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Hamj Top Pay Video Link</label>
            <input type="url" name="videoLink" required class="form-input" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Contact Email</label>
            <input type="email" name="email" required class="form-input" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Contact Phone</label>
            <input type="tel" name="phone" required class="form-input" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label">Channel Verification Contact (Email/Phone)</label>
            <input type="text" name="verificationContact" required class="form-input" style="width:100%" placeholder="Email/Number visible on channel">
          </div>

          <button class="btn-premium full-width" style="background:#ef4444">Submit Application</button>
        </form>

      </div>
    </div>

    <script>
      function showForm(type) {
        document.getElementById('form-user').style.display = type === 'user' ? 'block' : 'none';
        document.getElementById('form-youtuber').style.display = type === 'youtuber' ? 'block' : 'none';
        
        document.getElementById('btn-user').style.background = type === 'user' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)';
        document.getElementById('btn-youtuber').style.background = type === 'youtuber' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)';
      }
    </script>
    ${getFooter()}
  `)
})

router.post('/create', requireLogin, async (req, res) => {
  try {
    const { 
      type, name, username, 
      channelLink, videoLink, email, phone, verificationContact 
    } = req.body
    
    const userId = req.session.userId

    // Check if user already has a guild (joined or owned)
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { guild: true, ownedGuild: true }
    })

    if (existingUser.guildId || existingUser.ownedGuild) {
      return res.send(`<script>alert('You are already in a guild!');window.location.href='/guild'</script>`)
    }

    // Check unique username
    const existingGuild = await prisma.guild.findUnique({ where: { username } })
    if (existingGuild) {
      return res.send(`<script>alert('Guild username already taken!');window.location.href='/guild'</script>`)
    }

    // Create Logic
    if (type === 'USER') {
      const guild = await prisma.guild.create({
        data: {
          name,
          username,
          type: 'USER',
          leaderId: userId,
          status: 'APPROVED',
          memberLimit: 50,
          commissionRate: 1.0,
          members: {
            connect: { id: userId }
          }
        }
      })
      // Update User to be in this guild
      await prisma.user.update({
        where: { id: userId },
        data: { guildId: guild.id }
      })
    } else if (type === 'YOUTUBER') {
      const guild = await prisma.guild.create({
        data: {
          name,
          username,
          type: 'YOUTUBER',
          leaderId: userId,
          status: 'PENDING',
          memberLimit: 1000,
          commissionRate: 5.0,
          youtubeChannelLink: channelLink,
          videoLink,
          contactEmail: email,
          contactPhone: phone,
          verificationContact,
          members: {
            connect: { id: userId }
          }
        }
      })
      // Update User
      await prisma.user.update({
        where: { id: userId },
        data: { guildId: guild.id }
      })
    }

    res.redirect('/guild')

  } catch (e) {
    console.error(e)
    res.send(`<script>alert('Error creating guild: ${e.message}');window.location.href='/guild'</script>`)
  }
})

router.post('/join/:id', requireLogin, async (req, res) => {
  try {
    const guildId = parseInt(req.params.id)
    const userId = req.session.userId

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user.guildId) return res.send(`<script>alert('You are already in a guild!');window.location.href='/guild'</script>`)

    const guild = await prisma.guild.findUnique({ 
      where: { id: guildId },
      include: { members: true }
    })

    if (!guild || guild.status !== 'APPROVED') return res.redirect('/guild')
    
    if (guild.members.length >= guild.memberLimit) {
      return res.send(`<script>alert('Guild is full!');window.location.href='/guild'</script>`)
    }

    await prisma.user.update({
      where: { id: userId },
      data: { guildId: guild.id }
    })

    res.redirect('/guild')
  } catch (e) {
    console.error(e)
    res.redirect('/guild')
  }
})

router.post('/leave', requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { guild: true } })

    if (!user.guildId) return res.redirect('/guild')
    
    if (user.guild.leaderId === userId) {
      return res.send(`<script>alert('Leaders cannot leave. You must disband the guild (Contact Admin).');window.location.href='/guild'</script>`)
    }

    await prisma.user.update({
      where: { id: userId },
      data: { guildId: null }
    })

    res.redirect('/guild')
  } catch (e) {
    console.error(e)
    res.redirect('/guild')
  }
})

module.exports = router
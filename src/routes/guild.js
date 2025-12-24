const express = require('express')
const { prisma } = require('../db/prisma')
const { getUserSidebar } = require('../utils/sidebar')
const { formatDate } = require('../utils/date')
const { getSystemSettings } = require('../utils/settings')
const router = express.Router()

// Middleware to ensure login
const requireLogin = (req, res, next) => {
  if (req.session && req.session.userId) return next()
  res.redirect('/login')
}

// Layout Helpers
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

  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })


  // Get Requirements Text
  const [reqSetting, userReqSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'guild_requirements_youtuber' } }),
      prisma.systemSetting.findUnique({ where: { key: 'guild_requirements_user' } })
  ])

  // Youtuber
  const defaultReq = '2,000+ Subscribers\n1,000+ Views on 1 video\n1 video about Hamj Top Pay\n2 videos/month required'
  const rawText = reqSetting ? reqSetting.value : defaultReq
  const requirementsText = `<ul class="notebook-list">` + 
    rawText.split('\n')
    .filter(line => line.trim() !== '')
    .map(line => `<li>${line.replace(/^[•\-\*]\s*/, '')}</li>`)
    .join('') + `</ul>`

  // User
  const defaultUserReq = '• 50 Member Limit\n• 1% Commission on Member Top-Ups\n• Instant Creation'
  const rawUserText = userReqSetting ? userReqSetting.value : defaultUserReq
  const userRequirementsHtml = `<ul class="notebook-list blue" style="background:rgba(59,130,246,0.1); border-color:rgba(59,130,246,0.2)">` + 
    rawUserText.split('\n')
    .filter(line => line.trim() !== '')
    .map(line => `<li style="border-color:rgba(59,130,246,0.1)">${line.replace(/^[•\-\*]\s*/, '')}</li>`)
    .join('') + `</ul>`

  // Get Top Guilds
  const topGuilds = await prisma.guild.findMany({
    take: 5,
    orderBy: { totalEarnings: 'desc' },
    include: { leader: true, members: true }
  })

  // Get My Guild Requests
  const myRequests = await prisma.guildRequest.findMany({
    where: { userId: user.id, status: 'PENDING' },
    include: { guild: true }
  })

  const settings = await getSystemSettings()

  res.send(`
    ${getHead('Guilds')}
    ${getUserSidebar('guild', unreadCount, user.id, user.role, settings)}
    <div class="main-content">
      
      <div class="section-header">
         <div>
            <div class="section-title">Guilds</div>
            <div style="color:var(--text-muted);font-size:14px">Join forces, earn more together</div>
         </div>
         ${!user.guild ? `
           <div style="display:flex; gap:10px">
             <button onclick="openModal('createGuildModal')" class="btn-premium">Create Guild</button>
           </div>
         ` : ''}
      </div>

      ${user.guild ? `
        <!-- MY GUILD DASHBOARD -->
        <div class="glass-panel" style="margin-bottom: 30px; border-color: var(--primary);">
           <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: 20px;">
              <div>
                 <div class="guild-badge ${user.guild.type === 'YOUTUBER' ? 'badge-youtuber' : 'badge-user'}" style="display:inline-block; margin-bottom:8px">
                    ${user.guild.type} GUILD
                 </div>
                 <h2 style="font-size:24px; font-weight:800; color:white; margin:0">${user.guild.name}</h2>
                 <div style="color:var(--text-muted)">Leader: ${user.guild.leader.username}</div>
              </div>
              <div style="text-align:right">
                 <div style="font-size:24px; font-weight:800; color:var(--primary)">${user.guild.totalEarnings.toFixed(2)} TK</div>
                 <div style="font-size:12px; color:var(--text-muted)">Total Earnings</div>
              </div>
           </div>

           <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom: 20px;">
              <div class="stat-card">
                 <div class="stat-value">${user.guild.members.length} / ${user.guild.maxMembers}</div>
                 <div class="stat-label">Members</div>
              </div>
              <div class="stat-card">
                 <div class="stat-value">${user.guild.commissionRate}%</div>
                 <div class="stat-label">Commission</div>
              </div>
           </div>

           <h3 style="margin-bottom:15px; font-size:16px; color:white;">Members</h3>
           <div style="display:grid; gap:10px;">
              ${user.guild.members.map(m => `
                <div class="guild-card">
                   <div style="display:flex; align-items:center; gap:12px;">
                      <div style="width:32px; height:32px; background:#334155; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                         ${m.username[0].toUpperCase()}
                      </div>
                      <div>
                         <div style="font-weight:600; color:white">${m.username}</div>
                         <div style="font-size:12px; color:var(--text-muted)">Joined ${new Date(m.createdAt).toLocaleDateString()}</div>
                      </div>
                   </div>
                   ${m.id === user.guild.leaderId ? '<span class="guild-badge badge-youtuber">LEADER</span>' : ''}
                </div>
              `).join('')}
           </div>

           ${user.id === user.guild.leaderId ? `
             <div style="margin-top:20px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1); display:flex; gap:10px;">
                <a href="/guild/manage" class="btn-premium" style="flex:1; text-align:center">Manage Guild</a>
             </div>
           ` : `
             <div style="margin-top:20px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1);">
                <form action="/guild/leave" method="POST" onsubmit="return confirm('Are you sure you want to leave this guild?')">
                   <button type="submit" class="btn-premium" style="width:100%; background:rgba(239,68,68,0.2); color:#fca5a5; border-color:rgba(239,68,68,0.3)">Leave Guild</button>
                </form>
             </div>
           `}
        </div>
      ` : ''}

      <!-- TOP GUILDS -->
      <h3 style="margin-bottom:15px; font-size:18px; color:white;">Top Guilds</h3>
      <div style="display:grid; gap:15px;">
        ${topGuilds.map(g => `
          <div class="guild-card">
             <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:48px; height:48px; background:#1e293b; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:bold; border:1px solid rgba(255,255,255,0.1);">
                   ${g.name[0]}
                </div>
                <div>
                   <div style="font-weight:bold; color:white; font-size:16px;">${g.name}</div>
                   <div style="font-size:12px; color:var(--text-muted); display:flex; gap:10px; margin-top:4px;">
                      <span class="guild-badge ${g.type === 'YOUTUBER' ? 'badge-youtuber' : 'badge-user'}">${g.type}</span>
                      <span><i class="fas fa-users"></i> ${g.members.length}/${g.memberLimit}</span>
                      <span><i class="fas fa-coins"></i> ${g.totalEarnings.toFixed(0)} TK</span>
                   </div>
                </div>
             </div>
             ${!user.guild ? `
               <form action="/guild/join" method="POST">
                 <input type="hidden" name="guildId" value="${g.id}">
                 <button type="submit" class="btn-premium" style="padding:6px 16px; font-size:12px;">Join</button>
               </form>
             ` : ''}
          </div>
        `).join('')}
      </div>

    </div>

    <!-- CREATE GUILD MODAL -->
    <div id="createGuildModal" class="guild-modal">
       <div class="modal-content">
          <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
             <h3 style="margin:0; color:white;">Create Guild</h3>
             <button onclick="closeModal('createGuildModal')" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
          </div>

          <!-- TABS -->
          <div style="display:flex; background:#0f172a; padding:4px; border-radius:8px; margin-bottom:20px;">
             <button onclick="switchTab('youtuber')" id="tab-youtuber" style="flex:1; padding:10px; background:var(--primary); color:black; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">YouTuber Guild</button>
             <button onclick="switchTab('user')" id="tab-user" style="flex:1; padding:10px; background:transparent; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">User Guild</button>
          </div>

          <!-- YOUTUBER FORM -->
          <div id="form-youtuber">
             <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); padding:15px; border-radius:8px; margin-bottom:20px;">
                <div style="color:#fca5a5; font-weight:bold; margin-bottom:10px; font-size:14px;">Requirements</div>
                ${requirementsText}
             </div>
             <form action="/guild/create" method="POST">
                <input type="hidden" name="type" value="YOUTUBER">
                <div style="margin-bottom:15px;">
                   <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px;">Guild Name</label>
                   <input type="text" name="name" required style="width:100%; background:#0f172a; border:1px solid #334155; padding:10px; border-radius:8px; color:white;">
                </div>
                <div style="margin-bottom:15px;">
                   <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px;">YouTube Channel Link</label>
                   <input type="url" name="proof" required style="width:100%; background:#0f172a; border:1px solid #334155; padding:10px; border-radius:8px; color:white;">
                </div>
                <button type="submit" class="btn-premium" style="width:100%">Submit for Approval</button>
             </form>
          </div>

          <!-- USER FORM -->
          <div id="form-user" style="display:none;">
             <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); padding:15px; border-radius:8px; margin-bottom:20px;">
                <div style="color:#93c5fd; font-weight:bold; margin-bottom:10px; font-size:14px;">Features</div>
                ${userRequirementsHtml}
             </div>
             <form action="/guild/create" method="POST">
                <input type="hidden" name="type" value="USER">
                <div style="margin-bottom:15px;">
                   <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px;">Guild Name</label>
                   <input type="text" name="name" required style="width:100%; background:#0f172a; border:1px solid #334155; padding:10px; border-radius:8px; color:white;">
                </div>
                <div style="margin-bottom:20px;">
                   <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px;">Cost</label>
                   <div style="font-size:18px; font-weight:bold; color:white;">500 Diamonds</div>
                </div>
                <button type="submit" class="btn-premium" style="width:100%">Create Guild (500 Diamonds)</button>
             </form>
          </div>

       </div>
    </div>

    <script>
      function openModal(id) {
        document.getElementById(id).style.display = 'flex';
      }
      function closeModal(id) {
        document.getElementById(id).style.display = 'none';
      }
      function switchTab(type) {
         document.querySelectorAll('[id^="form-"]').forEach(el => el.style.display = 'none');
         document.getElementById('form-' + type).style.display = 'block';
         
         document.getElementById('tab-youtuber').style.background = type === 'youtuber' ? 'var(--primary)' : 'transparent';
         document.getElementById('tab-youtuber').style.color = type === 'youtuber' ? 'black' : 'white';
         
         document.getElementById('tab-user').style.background = type === 'user' ? 'var(--primary)' : 'transparent';
         document.getElementById('tab-user').style.color = type === 'user' ? 'black' : 'white';
      }
    </script>
    ${getFooter()}
  `)
})

module.exports = router

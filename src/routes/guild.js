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
  const defaultReq = '• Must have 2,000+ Subscribers\n• Minimum 1,000+ Views on at least 1 video\n• Must upload 1 dedicated video about Hamj Top Pay\n• Must upload 2 videos/month related to our site\n• Channel must be active and related to Gaming/TopUp\n• Must join our official Discord server\n• No fake subscribers or view botting allowed\n• Must follow community guidelines'
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
               <div style="margin-left: 110px; min-height: 50px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; gap:15px;">
                  <div style="flex: 1; min-width: 200px;">
                     <h2 style="font-size:28px; font-weight:800; color:white; margin:0; line-height:1.2; word-break: break-word;">${user.guild.name}</h2>
                     <div style="color:var(--text-muted); font-size:14px;">Leader: <span style="color:white">${user.guild.leader.username}</span></div>
                  </div>
                  <div style="text-align:right; flex-shrink: 0;">
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
    <div id="toast-container" style="position: fixed; top: 20px; right: 20px; z-index: 9999;"></div>
    <script>
      function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.style.padding = '12px 24px';
        toast.style.marginBottom = '10px';
        toast.style.borderRadius = '8px';
        toast.style.color = 'white';
        toast.style.fontWeight = '500';
        toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        toast.style.animation = 'slideIn 0.3s ease-out';
        toast.style.zIndex = '10000';
        
        if (type === 'success') {
          toast.style.background = '#10b981'; // Green
          toast.style.border = '1px solid #059669';
        } else if (type === 'error') {
          toast.style.background = '#ef4444'; // Red
          toast.style.border = '1px solid #b91c1c';
        } else {
          toast.style.background = '#3b82f6'; // Blue
        }
        
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateX(100%)';
          toast.style.transition = 'all 0.3s ease-out';
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      }

      // Check URL params
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');
      const success = urlParams.get('success');

      if (error) showToast(error, 'error');
      if (success) showToast(success, 'success');
      
      // Clean URL
      if (error || success) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    </script>
    ${getFooter()}
  `)
})

// ----------------------------------------------------------------------
// MANAGE GUILD (DESIGN & SETTINGS)
// ----------------------------------------------------------------------
router.get('/manage', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { guild: true }
  })

  if (!user.guild || user.guild.leaderId !== user.id) {
    return res.redirect('/guild')
  }

  // Fetch User's Inventory (Avatars & Banners)
  const myItems = await prisma.userItem.findMany({
    where: { userId: user.id },
    include: { item: true }
  })

  const avatars = myItems.filter(i => i.item.type === 'avatar')
  const banners = myItems.filter(i => i.item.type === 'banner')
  
  const [settings, unreadCount] = await Promise.all([
    getSystemSettings(),
    prisma.notification.count({ where: { userId: user.id, isRead: false } })
  ])

  res.send(`
    ${getHead('Manage Guild')}
    ${getUserSidebar('guild', unreadCount, user.id, user.role, settings)}
    <div class="main-content">
       <div class="section-header">
          <div>
             <a href="/guild" style="color:var(--text-muted); text-decoration:none; font-size:14px;"><i class="fas fa-arrow-left"></i> Back to Guild</a>
             <div class="section-title" style="margin-top:10px;">Manage Guild</div>
          </div>
       </div>

       <div class="glass-panel">
          <form action="/guild/update-design" method="POST">
             <h3 style="color:white; margin-bottom:20px;">Guild Appearance</h3>
             
             <!-- AVATAR SELECTION -->
             <div style="margin-bottom: 30px;">
                <label style="display:block; color:var(--text-muted); margin-bottom:10px;">Guild Avatar</label>
                <div style="display:flex; gap:15px; overflow-x:auto; padding-bottom:10px;">
                   <!-- Default -->
                   <label style="cursor:pointer;">
                      <input type="radio" name="avatar" value="" ${!user.guild.currentAvatar ? 'checked' : ''} style="display:none;" onchange="this.form.submit()">
                      <div style="width:60px; height:60px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; border:2px solid ${!user.guild.currentAvatar ? 'var(--primary)' : 'transparent'};">
                         <span style="font-weight:bold;">${user.guild.name[0]}</span>
                      </div>
                      <div style="text-align:center; font-size:10px; color:var(--text-muted); margin-top:5px;">Default</div>
                   </label>

                   ${avatars.map(a => `
                     <label style="cursor:pointer;">
                        <input type="radio" name="avatar" value="${a.item.imageUrl}" ${user.guild.currentAvatar === a.item.imageUrl ? 'checked' : ''} style="display:none;" onchange="this.form.submit()">
                        <div style="width:60px; height:60px; border-radius:50%; overflow:hidden; border:2px solid ${user.guild.currentAvatar === a.item.imageUrl ? 'var(--primary)' : 'transparent'};">
                           <img src="${a.item.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                     </label>
                   `).join('')}
                </div>
                ${avatars.length === 0 ? '<div style="font-size:12px; color:var(--text-muted);">Purchase avatars from the <a href="/store" style="color:var(--primary);">Store</a> to use them here.</div>' : ''}
             </div>

             <!-- BANNER SELECTION -->
             <div style="margin-bottom: 30px;">
                <label style="display:block; color:var(--text-muted); margin-bottom:10px;">Guild Banner</label>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:15px;">
                   <!-- Default -->
                   <label style="cursor:pointer;">
                      <input type="radio" name="banner" value="" ${!user.guild.currentBanner ? 'checked' : ''} style="display:none;" onchange="this.form.submit()">
                      <div style="height:80px; border-radius:8px; background:linear-gradient(45deg, #1e293b, #334155); border:2px solid ${!user.guild.currentBanner ? 'var(--primary)' : 'transparent'};"></div>
                      <div style="text-align:center; font-size:10px; color:var(--text-muted); margin-top:5px;">Default</div>
                   </label>

                   ${banners.map(b => `
                     <label style="cursor:pointer;">
                        <input type="radio" name="banner" value="${b.item.imageUrl}" ${user.guild.currentBanner === b.item.imageUrl ? 'checked' : ''} style="display:none;" onchange="this.form.submit()">
                        <div style="height:80px; border-radius:8px; overflow:hidden; border:2px solid ${user.guild.currentBanner === b.item.imageUrl ? 'var(--primary)' : 'transparent'};">
                           <img src="${b.item.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                     </label>
                   `).join('')}
                </div>
                ${banners.length === 0 ? '<div style="font-size:12px; color:var(--text-muted);">Purchase banners from the <a href="/store" style="color:var(--primary);">Store</a> to use them here.</div>' : ''}
             </div>
          </form>

          <div style="margin-top:40px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
             <h3 style="color:white; margin-bottom:20px;">Guild Settings</h3>
             <form action="/guild/update-info" method="POST">
                <div style="margin-bottom:15px;">
                   <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px;">Description</label>
                   <textarea name="description" rows="3" style="width:100%; background:#0f172a; border:1px solid #334155; padding:10px; border-radius:8px; color:white;">${user.guild.description || ''}</textarea>
                </div>
                ${user.guild.type === 'YOUTUBER' ? `
                   <div style="margin-bottom:15px;">
                      <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px;">YouTube Video Link (Featured)</label>
                      <input type="url" name="videoLink" value="${user.guild.videoLink || ''}" style="width:100%; background:#0f172a; border:1px solid #334155; padding:10px; border-radius:8px; color:white;">
                   </div>
                ` : ''}
                <button type="submit" class="btn-premium">Save Settings</button>
             </form>
          </div>
       </div>
    </div>
    ${getFooter()}
  `)
})

router.post('/update-design', requireLogin, async (req, res) => {
  const { avatar, banner } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })
  
  if (!user.guild || user.guild.leaderId !== user.id) return res.redirect('/guild')

  const updateData = {}
  if (avatar !== undefined) updateData.currentAvatar = avatar || null
  if (banner !== undefined) updateData.currentBanner = banner || null

  await prisma.guild.update({
    where: { id: user.guild.id },
    data: updateData
  })

  res.redirect('/guild/manage')
})

router.post('/update-info', requireLogin, async (req, res) => {
  const { description, videoLink } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })
  
  if (!user.guild || user.guild.leaderId !== user.id) return res.redirect('/guild')

  await prisma.guild.update({
    where: { id: user.guild.id },
    data: { 
      description,
      videoLink: videoLink || null
    }
  })

  res.redirect('/guild/manage')
})

// ----------------------------------------------------------------------
// GUILD ACTIONS
// ----------------------------------------------------------------------

router.post('/create', requireLogin, async (req, res) => {
  const { name, type, proof } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })

  if (user.guild) return res.redirect('/guild?error=Already+in+a+guild')

  try {
    if (type === 'USER') {
      if (user.diamonds < 500) return res.redirect('/guild?error=Not+enough+diamonds')
      
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { diamonds: { decrement: 500 } }
        }),
        prisma.guild.create({
          data: {
            name,
            type: 'USER',
            leaderId: user.id,
            status: 'APPROVED',
            memberLimit: 50,
            commissionRate: 1.0,
            members: { connect: { id: user.id } }
          }
        })
      ])
    } else {
      await prisma.guild.create({
        data: {
          name,
          type: 'YOUTUBER',
          leaderId: user.id,
          status: 'PENDING',
          videoLink: proof,
          memberLimit: 100,
          commissionRate: 2.0,
          members: { connect: { id: user.id } }
        }
      })
    }
    res.redirect('/guild?success=Guild+created')
  } catch (err) {
    console.error(err)
    res.redirect('/guild?error=Creation+failed')
  }
})

router.post('/join', requireLogin, async (req, res) => {
  console.log('Join request received:', req.body)
  const { guildId } = req.body
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })

    if (user.guild) return res.redirect('/guild?error=Already+in+a+guild')

    const existing = await prisma.guildRequest.findFirst({
      where: { userId: user.id, status: 'PENDING' }
    })
    if (existing) return res.redirect('/guild?error=Request+pending')

    await prisma.guildRequest.create({
      data: {
        userId: user.id,
        guildId: parseInt(guildId)
      }
    })

    res.redirect('/guild?success=Request+sent')
  } catch (error) {
    console.error('Join Error:', error)
    res.redirect('/guild?error=Join+failed')
  }
})

router.post('/leave', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })
  if (!user.guild) return res.redirect('/guild')
  
  if (user.guild.leaderId === user.id) return res.redirect('/guild?error=Leader+cannot+leave')

  await prisma.user.update({
    where: { id: user.id },
    data: { guildId: null }
  })

  res.redirect('/guild')
})

module.exports = router

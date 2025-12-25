const express = require('express')
const { prisma } = require('../db/prisma')
const { getUserSidebar } = require('../utils/sidebar')
const { getSystemSettings } = require('../utils/settings')
const { getGuildLevelInfo } = require('../utils/guildLevel')
const router = express.Router()

const getHead = (title) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - HaMJ toP PaY</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #d946ef;
      --secondary: #06b6d4;
      --accent: #facc15;
      --bg-body: #020617;
      --bg-card: #0f172a;
      --bg-card-hover: #1e293b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border-color: rgba(217, 70, 239, 0.3);
      --font-head: 'Rajdhani', sans-serif;
      --font-body: 'Inter', sans-serif;
    }
    body { font-family: var(--font-body); background: var(--bg-body); color: var(--text-main); }
    
    .leaderboard-container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
    .leaderboard-title { 
      font-size: 32px; font-family: var(--font-head); font-weight: 800; 
      color: transparent; background: linear-gradient(to right, #facc15, #f59e0b);
      -webkit-background-clip: text; background-clip: text;
      margin-bottom: 30px; display: flex; align-items: center; justify-content: center; gap: 15px; 
      text-transform: uppercase; text-shadow: 0 4px 20px rgba(250, 204, 21, 0.3);
    }
    
    .leaderboard-list { display: flex; flex-direction: column; gap: 15px; }
    
    .guild-row {
      display: grid; grid-template-columns: 60px 1fr auto;
      align-items: center; gap: 20px;
      background: rgba(30, 41, 59, 0.4); 
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px; 
      padding: 16px 24px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
      color: inherit;
    }
    .guild-row:hover { 
      transform: translateX(5px) scale(1.01); 
      background: rgba(30, 41, 59, 0.8); 
      border-color: var(--primary); 
      box-shadow: 0 10px 30px rgba(217, 70, 239, 0.15);
    }

    .rank-badge {
      width: 40px; height: 40px; 
      display: flex; align-items: center; justify-content: center; 
      font-weight: 800; font-size: 18px; 
      border-radius: 12px; 
      background: rgba(255,255,255,0.05);
      color: #94a3b8;
    }
    
    .rank-1 { background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%); color: #000; box-shadow: 0 0 15px rgba(250, 204, 21, 0.4); font-size: 22px; }
    .rank-2 { background: linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%); color: #000; box-shadow: 0 0 15px rgba(226, 232, 240, 0.4); font-size: 20px; }
    .rank-3 { background: linear-gradient(135deg, #fb923c 0%, #c2410c 100%); color: #000; box-shadow: 0 0 15px rgba(251, 146, 60, 0.4); font-size: 20px; }

    .guild-info { display: flex; align-items: center; gap: 16px; }
    .guild-avatar {
      width: 50px; height: 50px; border-radius: 12px;
      background: #334155; object-fit: cover;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 20px; color: white;
    }
    .guild-name { font-weight: 700; font-size: 18px; color: white; font-family: var(--font-head); }
    .guild-leader { font-size: 13px; color: var(--text-muted); }

    .score-badge {
      background: rgba(6, 182, 212, 0.1);
      color: var(--secondary);
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: 700;
      border: 1px solid rgba(6, 182, 212, 0.2);
      font-family: var(--font-head);
      letter-spacing: 1px;
    }

    /* Banner Slider */
    .banner-container {
      width: 100%;
      max-width: 1000px;
      margin: 20px auto 40px;
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      aspect-ratio: 21/9;
      background: #1e293b;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    @media (max-width: 600px) {
      .banner-container { aspect-ratio: 16/9; margin: 10px auto 30px; }
    }
    .banner-slide {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      opacity: 0;
      transition: opacity 0.8s ease-in-out;
      display: flex; align-items: center; justify-content: center;
    }
    .banner-slide.active { opacity: 1; z-index: 1; }
    .banner-slide img { width: 100%; height: 100%; object-fit: cover; }
    .banner-caption {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 40px 20px 20px;
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
      color: white; font-weight: 600; font-size: 16px;
      text-align: center;
    }
    .banner-dots {
      position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; z-index: 10;
    }
    .banner-dot {
      width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3);
      cursor: pointer; transition: all 0.3s;
    }
    .banner-dot.active { background: #fff; width: 24px; border-radius: 4px; }
    
    /* Tabs */
    .leaderboard-tabs {
      display: flex; justify-content: center; gap: 20px; margin-bottom: 30px;
    }
    .tab-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 24px;
      border-radius: 12px;
      color: var(--text-muted);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      font-family: var(--font-head);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .tab-btn.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
      box-shadow: 0 0 15px rgba(217, 70, 239, 0.4);
    }
    .tab-content { display: none; animation: fadeIn 0.5s ease; }
    .tab-content.active { display: flex; flex-direction: column; gap: 15px; }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <button class="menu-trigger" id="mobileMenuBtn"><i class="fas fa-bars"></i></button>
  <div class="app-layout">
`

const getFooter = () => `
    </div>
    <script>
      const menuBtn = document.getElementById('mobileMenuBtn');
      const sidebar = document.getElementById('sidebar');
      if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

      // Banner Slider
      const slides = document.querySelectorAll('.banner-slide');
      const dots = document.querySelectorAll('.banner-dot');
      let currentSlide = 0;
      
      function showSlide(n) {
        if (slides.length === 0) return;
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        
        currentSlide = n;
        if (currentSlide >= slides.length) currentSlide = 0;
        if (currentSlide < 0) currentSlide = slides.length - 1;
        
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
      }
      
      function nextSlide() {
        showSlide(currentSlide + 1);
      }
      
      if (slides.length > 0) {
        setInterval(nextSlide, 5000);
      }
    </script>
  </body>
  </html>
`

router.get('/', async (req, res) => {
  const settings = await getSystemSettings()
  
  // Contest Settings
  const deadline = settings.leaderboard_deadline ? new Date(settings.leaderboard_deadline) : null
  const userWinnerCount = parseInt(settings.leaderboard_user_winners_count) || 10
  const guildWinnerCount = parseInt(settings.leaderboard_guild_winners_count) || 5
  const userMinWork = parseInt(settings.leaderboard_user_min_work) || 0
  const guildMinScore = parseInt(settings.leaderboard_guild_min_score) || 0
  
  const [guilds, banners, users] = await Promise.all([
    prisma.guild.findMany({
      take: 100,
      orderBy: { score: 'desc' }, // Ordered by Score as requested
      include: { leader: true }
    }),
    prisma.leaderboardBanner.findMany({
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.findMany({
      where: { role: 'USER', isBlocked: false },
      take: 100,
      orderBy: { tk: 'desc' },
      select: {
         id: true,
         username: true,
         firstName: true,
         lastName: true,
         currentAvatar: true,
         tk: true,
         country: true,
         _count: {
            select: { linkSubmissions: { where: { status: 'APPROVED' } } }
         }
      }
    })
  ])

  let unreadCount = 0
  let currentUserId = null
  let currentUserRole = 'USER'

  if (req.session.userId) {
    currentUserId = req.session.userId
    const me = await prisma.user.findUnique({ where: { id: req.session.userId } })
    currentUserRole = me ? me.role : 'USER'
    unreadCount = await prisma.notification.count({ where: { userId: req.session.userId, isRead: false } })
  }
  
  const bannerHtml = banners.length > 0 ? `
    <div class="banner-container">
      ${banners.map((b, i) => `
        <div class="banner-slide ${i === 0 ? 'active' : ''}">
          <img src="${b.imageUrl}" alt="Banner">
          ${b.description ? `<div class="banner-caption">${b.description}</div>` : ''}
        </div>
      `).join('')}
      
      <div class="banner-dots">
        ${banners.map((_, i) => `
          <div class="banner-dot ${i === 0 ? 'active' : ''}" onclick="showSlide(${i})"></div>
        `).join('')}
      </div>
    </div>
  ` : ''
  
  // Contest Info Banner
  let contestInfoHtml = ''
  if (deadline) {
      const now = new Date()
      const diffTime = deadline - now
      const isEnded = diffTime < 0
      
      let timerText = ''
      if (isEnded) {
          timerText = '<span style="color:#ef4444;">Contest Ended</span>'
      } else {
          const days = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60))
          timerText = `<span style="color:#facc15;"><i class="fas fa-clock"></i> Ends in: ${days}d ${hours}h ${minutes}m</span>`
      }

      contestInfoHtml = `
        <div style="background:rgba(236, 72, 153, 0.1); border:1px solid rgba(236, 72, 153, 0.3); border-radius:16px; padding:20px; margin-bottom:30px; text-align:center;">
            <h3 style="margin:0 0 10px 0; color:#f472b6; text-transform:uppercase; font-family:var(--font-head);">🏆 Special Leaderboard Event 🏆</h3>
            <div style="font-size:18px; font-weight:bold; margin-bottom:10px;">${timerText}</div>
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; font-size:14px; color:#cbd5e1;">
                <div><i class="fas fa-users"></i> Top ${userWinnerCount} Users Win</div>
                <div><i class="fas fa-shield-alt"></i> Top ${guildWinnerCount} Guilds Win</div>
                <div><i class="fas fa-tasks"></i> Min Work: ${userMinWork}</div>
                <div><i class="fas fa-bolt"></i> Min Score: ${guildMinScore}</div>
            </div>
        </div>
      `
  }

  res.send(`
    ${getHead('Leaderboard')}
    <style>
      .work-badge {
        background: rgba(168, 85, 247, 0.1);
        color: #d8b4fe;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        border: 1px solid rgba(168, 85, 247, 0.2);
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
    </style>
    ${getUserSidebar('leaderboard', unreadCount, currentUserId, currentUserRole, settings)}
    
    <div class="main-content">
      <div class="leaderboard-container">
        ${bannerHtml}
        ${contestInfoHtml}
        
        <div class="leaderboard-title">
          <i class="fas fa-crown"></i> Leaderboard
        </div>

        <div class="leaderboard-tabs">
           <button class="tab-btn active" onclick="switchTab('guilds', this)">Guilds</button>
           <button class="tab-btn" onclick="switchTab('users', this)">Top Users</button>
        </div>

        <!-- Guilds List -->
        <div id="guilds-tab" class="tab-content active">
          ${guilds.map((g, i) => {
            const rank = i + 1
            let rankClass = 'rank-badge'
            if (rank === 1) rankClass += ' rank-1'
            if (rank === 2) rankClass += ' rank-2'
            if (rank === 3) rankClass += ' rank-3'
            
            const avatar = g.currentAvatar 
              ? `<img src="${g.currentAvatar}" class="guild-avatar">`
              : `<div class="guild-avatar">${g.name[0]}</div>`

            return `
              <div class="guild-row-wrapper" style="position:relative;">
                <div class="guild-row">
                  <div class="${rankClass}">#${rank}</div>
                  <div class="guild-info">
                     ${avatar}
                     <div>
                       <div class="guild-name">
                         ${g.name} 
                         ${rank <= 3 ? '<i class="fas fa-check-circle" style="color:#34d399; margin-left:5px;"></i>' : ''}
                       </div>
                       <div class="guild-leader">Leader: ${g.leader.firstName} ${g.leader.lastName}</div>
                       <div style="font-size:12px; color:#facc15; margin-top:2px;">
                         Level ${g.level}
                       </div>
                     </div>
                  </div>
                  <div style="display:flex; flex-direction:column; align-items:flex-end;">
                     <div class="score-badge">
                        ⚡ ${g.score}
                     </div>
                  </div>
                </div>
              </div>
            `
          }).join('')}
          
          ${guilds.length === 0 ? '<div style="text-align:center; color:#94a3b8;">No guilds found</div>' : ''}
        </div>

        <!-- Users List -->
        <div id="users-tab" class="tab-content">
          ${users.map((u, i) => {
            const rank = i + 1
            let rankClass = 'rank-badge'
            if (rank === 1) rankClass += ' rank-1'
            if (rank === 2) rankClass += ' rank-2'
            if (rank === 3) rankClass += ' rank-3'
            
            const avatar = u.currentAvatar 
              ? `<img src="${u.currentAvatar}" class="guild-avatar">`
              : `<div class="guild-avatar">${u.username[0]}</div>`

            return `
              <div class="guild-row" style="flex-wrap:wrap;">
                  <div style="display:flex; align-items:center; width:100%;">
                      <div class="${rankClass}">#${rank}</div>
                      <div class="guild-info">
                         ${avatar}
                         <div>
                           <div class="guild-name">
                             ${u.username} 
                             ${rank <= 3 ? '<i class="fas fa-check-circle" style="color:#34d399; margin-left:5px;"></i>' : ''}
                           </div>
                           <div class="guild-leader">${u.firstName} ${u.lastName} • ${u.country || 'Global'}</div>
                         </div>
                      </div>
                      <div style="margin-left:auto; display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                         <div class="work-badge">
                           <i class="fas fa-briefcase"></i> Work: ${u._count.linkSubmissions}
                         </div>
                         <div class="score-badge" style="font-size:12px; padding:4px 10px;">
                           ৳${u.tk.toFixed(2)}
                         </div>
                      </div>
                  </div>
              </div>
            `
          }).join('')}
          ${users.length === 0 ? '<div style="text-align:center; color:#94a3b8;">No users found</div>' : ''}
        </div>
      </div>
    </div>
    
    <!-- Address Modal -->
    <div id="addressModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; align-items:center; justify-content:center;">
      <div style="background:#1e293b; padding:24px; border-radius:16px; width:90%; max-width:400px; border:1px solid rgba(255,255,255,0.1);">
        <h3 style="margin-top:0; color:white;">Shipping Address</h3>
        <p style="color:#94a3b8; font-size:14px;">Please provide your full address to receive your gift.</p>
        <form action="/leaderboard/submit-address" method="POST">
          <input type="hidden" name="guildId" id="modalGuildId">
          <textarea name="address" required placeholder="Full Address (Street, City, Country, Phone)" style="width:100%; height:100px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; border-radius:8px; padding:10px; margin-bottom:15px; font-family:inherit;"></textarea>
          <div style="display:flex; justify-content:flex-end; gap:10px;">
             <button type="button" onclick="document.getElementById('addressModal').style.display='none'" style="padding:8px 16px; background:transparent; border:1px solid rgba(255,255,255,0.2); color:white; border-radius:8px; cursor:pointer;">Cancel</button>
             <button type="submit" style="padding:8px 16px; background:#ec4899; border:none; color:white; border-radius:8px; cursor:pointer;">Submit</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      function openAddressModal(guildId) {
        document.getElementById('modalGuildId').value = guildId;
        document.getElementById('addressModal').style.display = 'flex';
      }

      function switchTab(tab, btn) {
         // Remove active class from all buttons and contents
         document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
         document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
         
         // Add active class to clicked button
         if (btn) {
             btn.classList.add('active');
         } else {
             // Fallback if btn not provided (should not happen with new onclick)
             if (tab === 'guilds') document.querySelector('button[onclick*="guilds"]').classList.add('active');
             if (tab === 'users') document.querySelector('button[onclick*="users"]').classList.add('active');
         }

         // Show content
         const content = document.getElementById(tab + '-tab');
         if (content) {
             content.classList.add('active');
         }
      }
    </script>
    
    ${getFooter()}
  `)
})

router.post('/claim-reward', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login')

    try {
        const userId = req.session.userId
        const user = await prisma.user.findUnique({ where: { id: userId } })

        if (!user || user.rewardStatus !== 'LOCKED' && user.rewardStatus !== 'CLAIMABLE') {
            throw new Error('No reward available')
        }

        const now = new Date()
        const unlockDate = new Date(user.rewardUnlockDate)

        if (now < unlockDate) {
            throw new Error('Reward is not unlocked yet')
        }

        const type = user.rewardCurrency
        const amount = user.rewardAmount

        const updateData = {
            rewardStatus: 'CLAIMED'
        }
        
        // Add balance
        if (type === 'tk') updateData.tk = { increment: amount }
        else if (type === 'dk') updateData.dk = { increment: amount }
        else if (type === 'diamond') updateData.diamond = { increment: amount }
        else if (type === 'coin') updateData.coin = { increment: amount }

        const transactionOps = [
             prisma.user.update({
                where: { id: userId },
                data: updateData
             }),
             prisma.notification.create({
                data: {
                    userId,
                    message: `You claimed your reward: ${amount} ${type.toUpperCase()}`,
                    type: 'credit'
                }
             })
        ]

        // Sync guild earnings if TK
        if (user.guildId && type === 'tk') {
             transactionOps.push(
                prisma.guild.update({
                    where: { id: user.guildId },
                    data: { totalEarnings: { increment: amount } }
                })
             )
        }

        await prisma.$transaction(transactionOps)

        res.redirect('/leaderboard?success=Reward+claimed!')
    } catch (e) {
        console.error(e)
        res.redirect('/leaderboard?error=' + encodeURIComponent(e.message))
    }
})

router.post('/submit-address', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  
  try {
    const { guildId, address } = req.body
    
    const guild = await prisma.guild.findUnique({ where: { id: parseInt(guildId) } })
    
    if (!guild || guild.leaderId !== req.session.userId) {
       throw new Error('Unauthorized')
    }
    
    await prisma.guild.update({
      where: { id: parseInt(guildId) },
      data: {
        shippingAddress: address,
        rewardStatus: 'PROCESSING'
      }
    })
    
    res.redirect('/leaderboard?success=Address+submitted')
  } catch (e) {
    console.error(e)
    res.redirect('/leaderboard?error=' + encodeURIComponent(e.message))
  }
})

module.exports = router

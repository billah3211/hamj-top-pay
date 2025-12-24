const express = require('express')
const { prisma } = require('../db/prisma')
const { getUserSidebar } = require('../utils/sidebar')
const { getSystemSettings } = require('../utils/settings')
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
    </script>
  </body>
  </html>
`

router.get('/', async (req, res) => {
  const guilds = await prisma.guild.findMany({
    take: 100,
    orderBy: { totalEarnings: 'desc' },
    include: { leader: true }
  })

  let unreadCount = 0
  let currentUserId = null
  let currentUserRole = 'USER'

  if (req.session.userId) {
    currentUserId = req.session.userId
    const me = await prisma.user.findUnique({ where: { id: req.session.userId } })
    currentUserRole = me ? me.role : 'USER'
    unreadCount = await prisma.notification.count({ where: { userId: req.session.userId, isRead: false } })
  }

  const settings = await getSystemSettings()

  res.send(`
    ${getHead('Guild Leaderboard')}
    ${getUserSidebar('leaderboard', unreadCount, currentUserId, currentUserRole, settings)}
    
    <div class="main-content">
      <div class="leaderboard-container">
        <div class="leaderboard-title">
          <i class="fas fa-crown"></i> Top 100 Guilds
        </div>

        <div class="leaderboard-list">
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
              <a href="/guild/view/${g.id}" class="guild-row">
                <div class="${rankClass}">#${rank}</div>
                <div class="guild-info">
                   ${avatar}
                   <div>
                     <div class="guild-name">
                       ${g.name} 
                       ${rank <= 3 ? '<i class="fas fa-check-circle" style="color:#34d399; margin-left:5px;"></i>' : ''}
                     </div>
                     <div class="guild-leader">Leader: ${g.leader.firstName} ${g.leader.lastName}</div>
                   </div>
                </div>
                <div class="score-badge">
                   $${g.totalEarnings.toFixed(2)}
                </div>
              </a>
            `
          }).join('')}
          
          ${guilds.length === 0 ? '<div style="text-align:center; color:#94a3b8;">No guilds found</div>' : ''}
        </div>
      </div>
    </div>
    ${getFooter()}
  `)
})

module.exports = router

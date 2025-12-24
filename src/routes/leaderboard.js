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
  <style>
    .leaderboard-container { max-width: 800px; margin: 0 auto; padding-top: 20px; }
    .leaderboard-title { 
      font-size: 28px; 
      font-weight: 800; 
      color: transparent;
      background: linear-gradient(to right, #facc15, #f59e0b);
      -webkit-background-clip: text;
      background-clip: text;
      margin-bottom: 30px; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      gap: 15px; 
      text-transform: uppercase;
      letter-spacing: 1px;
      text-shadow: 0 4px 20px rgba(250, 204, 21, 0.3);
    }
    
    .leaderboard-list { display: flex; flex-direction: column; gap: 15px; }
    
    .leaderboard-item { 
      background: rgba(30, 41, 59, 0.4); 
      backdrop-filter: blur(10px);
      border-radius: 16px; 
      padding: 16px 24px; 
      display: flex; 
      align-items: center; 
      gap: 20px; 
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    
    .leaderboard-item:hover { 
      transform: translateX(5px) scale(1.01); 
      background: rgba(30, 41, 59, 0.8); 
      border-color: rgba(255, 255, 255, 0.2); 
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    
    .rank-badge {
      width: 40px; height: 40px; 
      display: flex; align-items: center; justify-content: center; 
      font-weight: 800; font-size: 16px; 
      border-radius: 12px; 
      background: rgba(255,255,255,0.05);
      color: #94a3b8;
      flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.1);
    }

    /* Top 3 Styling */
    .item-rank-1 { background: linear-gradient(90deg, rgba(250, 204, 21, 0.1), transparent); border-color: rgba(250, 204, 21, 0.3); }
    .item-rank-2 { background: linear-gradient(90deg, rgba(226, 232, 240, 0.1), transparent); border-color: rgba(226, 232, 240, 0.3); }
    .item-rank-3 { background: linear-gradient(90deg, rgba(251, 146, 60, 0.1), transparent); border-color: rgba(251, 146, 60, 0.3); }

    .rank-1 { background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%); color: #000; box-shadow: 0 0 20px rgba(250, 204, 21, 0.4); border: none; font-size: 20px; }
    .rank-2 { background: linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%); color: #000; box-shadow: 0 0 20px rgba(226, 232, 240, 0.4); border: none; font-size: 18px; }
    .rank-3 { background: linear-gradient(135deg, #fb923c 0%, #c2410c 100%); color: #000; box-shadow: 0 0 20px rgba(251, 146, 60, 0.4); border: none; font-size: 18px; }
    
    .user-avatar { 
      width: 56px; height: 56px; 
      border-radius: 50%; 
      object-fit: cover; 
      background: #1e293b; 
      border: 2px solid rgba(255,255,255,0.1);
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }
    
    .user-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .user-name { font-weight: 700; color: white; font-size: 16px; cursor: pointer; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .user-name:hover { color: var(--primary); }
    .user-username { font-size: 13px; color: #94a3b8; font-weight: 500; }
    
    .task-count { 
      color: #34d399; 
      font-weight: 700; 
      font-size: 16px; 
      background: rgba(52, 211, 153, 0.1);
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid rgba(52, 211, 153, 0.2);
    }

    .crown-icon { position: absolute; top: -18px; left: -10px; font-size: 24px; transform: rotate(-15deg); filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5)); }
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

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      currentAvatar: true,
      _count: { select: { linkSubmissions: { where: { status: 'APPROVED' } } } }
    },
    orderBy: { linkSubmissions: { _count: 'desc' } },
    take: 50
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
    ${getHead('Leaderboard')}
    ${getUserSidebar('leaderboard', unreadCount, currentUserId, currentUserRole, settings)}
    
    <div class="main-content">
      
      <div class="leaderboard-container">
        <div class="leaderboard-title">
          <img src="https://api.iconify.design/lucide:trophy.svg?color=%23facc15" width="36" height="36">
          Top Performers
        </div>

        <div class="leaderboard-list">
          ${users.map((u, i) => {
            const rank = i + 1
            let rankClass = ''
            let itemRankClass = ''
            let icon = ''
            
            if (rank === 1) { 
              rankClass = 'rank-1'
              itemRankClass = 'item-rank-1'
              icon = '<div class="crown-icon">👑</div>'
            } else if (rank === 2) { 
              rankClass = 'rank-2'
              itemRankClass = 'item-rank-2'
            } else if (rank === 3) { 
              rankClass = 'rank-3'
              itemRankClass = 'item-rank-3'
            }

            return `
              <div class="leaderboard-item ${itemRankClass}">
                ${icon}
                <div class="rank-badge ${rankClass}">${rank}</div>
                
                <img src="${u.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" class="user-avatar">
                
                <div class="user-info">
                   <a href="/profile/view/${u.id}" class="user-name">
                     ${u.firstName} ${u.lastName}
                     ${rank <= 3 ? '<img src="https://api.iconify.design/lucide:verified.svg?color=%2334d399" width="16" height="16">' : ''}
                   </a>
                   <div class="user-username">@${u.username}</div>
                </div>

                <div class="task-count">
                  ${u._count.linkSubmissions} Tasks
                </div>
              </div>
            `
          }).join('')}
        </div>
      </div>

    </div>
    ${getFooter()}
  `)
})

module.exports = router

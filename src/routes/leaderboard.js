const express = require('express')
const { prisma } = require('../db/prisma')
const { getUserSidebar } = require('../utils/sidebar')
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
`



const getProfileModal = (user, level) => `
<div id="profileModal" class="modal-premium" style="align-items: center; justify-content: center; padding: 20px;">
  <div class="modal-content" style="background: transparent; border: none; box-shadow: none; width: 100%; max-width: 600px; padding: 0;">
    <div style="position: relative;">
        <button class="modal-close" id="profileBack" style="position: absolute; top: -15px; right: -15px; background: rgba(0,0,0,0.5); color: white; border: 2px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 100; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
        <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 30px 20px 20px; border-radius: 24px; position: relative; overflow: visible; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
            <div style="background: #000; padding: 20px; border-radius: 16px; margin-bottom: 20px; margin-left: 60px; position: relative; border: 1px solid rgba(255,255,255,0.1);">
               <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: 0.5px;">${user.firstName} ${user.lastName}</div>
               <div style="color: #4ade80; font-weight: 600; font-size: 14px; margin-bottom: 8px;">@${user.username}</div>
               <div style="display:inline-block; background:linear-gradient(90deg, #facc15, #fbbf24); color:black; font-weight:bold; font-size:12px; padding:2px 8px; border-radius:4px; margin-bottom:8px;">Level ${level}</div>
               <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 13px; color: #cbd5e1;">
                   <div>📧 ${user.email}</div>
                   <div>📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}</div>
               </div>
            </div>
            <div style="display: flex; gap: 20px; align-items: flex-start;">
                <div style="width: 110px; height: 110px; border-radius: 50%; border: 6px solid #000; overflow: hidden; background: #1a1a2e; flex-shrink: 0; z-index: 10; margin-top: -10px; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                    <img src="${user.currentAvatar || `https://api.iconify.design/lucide:user.svg?color=white`}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="background: #000; padding: 20px; border-radius: 16px; flex-grow: 1; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 13px; color: #e2e8f0;">
                            <span style="color: #4ade80; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Country</span><br>
                            ${user.country}
                        </div>
                        <div style="font-size: 13px; color: #e2e8f0;">
                            <span style="color: #4ade80; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Bio</span><br>
                            ${user.bio || '<span style="opacity:0.5">No bio added</span>'}
                        </div>
                        <div style="font-size: 13px; color: #e2e8f0;">
                            <span style="color: #4ade80; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Website</span><br>
                            ${user.website ? `<a href="${user.website}" target="_blank" style="color:#60a5fa">${user.website}</a>` : '<span style="opacity:0.5">No website</span>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <a href="/settings" class="btn-premium" style="background: rgba(0,0,0,0.5); display: inline-flex; width: auto; padding: 8px 24px;">Edit Profile</a>
        </div>
    </div>
  </div>
</div>
<div id="profileOverlay" class="modal-overlay hidden"></div>
`

// Generic View Profile Modal (Empty initially, populated via JS)
        const getViewProfileModal = () => `
<div id="viewProfileModal" class="modal-premium">
  <div class="modal-content" style="background: transparent; border: none; box-shadow: none; padding: 0;">
    <div style="position: relative;">
        <button class="modal-close" id="viewProfileBack" style="position: absolute; top: -15px; right: -15px; background: rgba(0,0,0,0.5); color: white; border: 2px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 100; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
        <!-- Modal Body: Mimics Profile Page Structure -->
        <div id="viewProfileContent" style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Content will be loaded here -->
            <div style="text-align:center; color:white;">Loading...</div>
        </div>
    </div>
  </div>
</div>
<!-- Overlay removed as it is integrated into modal-premium -->
`

// Helper: Calculate User Level
const calculateLevel = (count) => {
  if (count < 100) return 0;
  if (count < 500) return 1;
  if (count < 1200) return 2;
  if (count < 2000) return 3;
  if (count < 5000) return 4;
  if (count < 10000) return 5;
  if (count < 15000) return 6;
  return 7 + Math.floor((count - 15000) / 5000);
}

// Helper: Get Level Progress
const getLevelProgress = (count) => {
  let start = 0, next = 100;
  if (count < 100) { start = 0; next = 100; }
  else if (count < 500) { start = 100; next = 500; }
  else if (count < 1200) { start = 500; next = 1200; }
  else if (count < 2000) { start = 1200; next = 2000; }
  else if (count < 5000) { start = 2000; next = 5000; }
  else if (count < 10000) { start = 5000; next = 10000; }
  else if (count < 15000) { start = 10000; next = 15000; }
  else {
    const base = 15000;
    const step = 5000;
    const diff = count - base;
    const levelOffset = Math.floor(diff / step);
    start = base + levelOffset * step;
    next = start + step;
  }
  
  const percent = Math.min(100, Math.max(0, ((count - start) / (next - start)) * 100));
  
  return { current: count, next, start, percent };
}

const getFooter = (user, level, levelProgress) => `
  <button class="menu-trigger" id="mobileMenuBtn">☰</button>
  ${getProfileModal(user, level, levelProgress)}
  ${getViewProfileModal()}
  
  <script>
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });

    // My Profile Modal
    const profileTrigger = document.getElementById('menuProfile');
    const profileModal = document.getElementById('profileModal');
    const profileOverlay = document.getElementById('profileOverlay');
    const profileBack = document.getElementById('profileBack');

    function openProfile() {
      profileModal.classList.add('open');
      profileOverlay.classList.remove('hidden');
    }
    function closeProfile() {
      profileModal.classList.remove('open');
      profileOverlay.classList.add('hidden');
    }

    if(profileTrigger) profileTrigger.addEventListener('click', (e) => { e.preventDefault(); openProfile(); });
    if(profileBack) profileBack.addEventListener('click', closeProfile);
    if(profileOverlay) profileOverlay.addEventListener('click', closeProfile);

    // View Other User Profile Logic
    const viewProfileModal = document.getElementById('viewProfileModal');
    const viewProfileOverlay = document.getElementById('viewProfileOverlay');
    const viewProfileBack = document.getElementById('viewProfileBack');
    const viewProfileContent = document.getElementById('viewProfileContent');

    function closeViewProfile() {
        viewProfileModal.classList.remove('open');
        viewProfileOverlay.classList.add('hidden');
    }

    if(viewProfileBack) viewProfileBack.addEventListener('click', closeViewProfile);
    if(viewProfileOverlay) viewProfileOverlay.addEventListener('click', closeViewProfile);

    async function showUserProfile(username) {
        viewProfileModal.classList.add('open');
        viewProfileOverlay.classList.remove('hidden');
        viewProfileContent.innerHTML = '<div style="text-align:center; color:white; padding: 20px;">Loading profile...</div>';
        
        try {
            const res = await fetch('/api/profile/' + username);
            const data = await res.json();
            
            if(data.error) {
                viewProfileContent.innerHTML = '<div style="text-align:center; color:white; padding: 20px;">' + data.error + '</div>';
                return;
            }

            viewProfileContent.innerHTML = \`
                <!-- Profile Header Card (Glass Panel style like main profile) -->
                <div class="glass-panel" style="padding: 0; overflow: hidden; position: relative; background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1);">
                   <div style="height: 150px; background: linear-gradient(135deg, #065f46 0%, #10b981 100%);"></div>
                   
                   <div style="padding: 0 30px 30px; margin-top: -50px; position: relative;">
                     <div style="display: flex; align-items: flex-end; gap: 20px; flex-wrap: wrap;">
                       <div style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid #0f172a; overflow: hidden; background: #1e293b; flex-shrink: 0;">
                         <img src="\${data.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" style="width: 100%; height: 100%; object-fit: cover;">
                       </div>
                       
                       <div style="flex: 1; padding-bottom: 10px;">
                         <div style="font-size: 28px; font-weight: 800; color: white;">\${data.firstName} \${data.lastName}</div>
                         <div style="color: #94a3b8; margin-bottom: 5px;">@\${data.username}</div>
                         <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 5px;">
                          <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 12px; padding: 2px 10px; border-radius: 20px;">Level \${data.level}</div>
                          </div>
                          <div style="color: #64748b; font-size: 12px;">Joined \${new Date(data.createdAt).toLocaleDateString()}</div>
                        </div>
                       </div>
                     </div>
                   </div>
                </div>

                <!-- Stats & Info Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                  
                  <!-- Contact Info (Phone Hidden as requested) -->
                  <div class="glass-panel" style="padding: 25px; background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                      <img src="https://api.iconify.design/lucide:contact.svg?color=%2310b981" width="20"> Contact Info
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                      <div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Email Address</div>
                        <div style="color: white;">\${data.email}</div>
                      </div>
                      <!-- Phone Number HIDDEN per user request -->
                      <div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Country</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="color: white;">\${data.country}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- About & Social -->
                  <div class="glass-panel" style="padding: 25px; background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                      <img src="https://api.iconify.design/lucide:info.svg?color=%233b82f6" width="20"> About & Social
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                      <div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Bio</div>
                        <div style="color: white; line-height: 1.5;">\${data.bio || '<span style="opacity:0.5; font-style:italic;">No bio added yet.</span>'}</div>
                      </div>
                      <div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Website</div>
                        <div>\${data.website ? \`<a href="\${data.website}" target="_blank" style="color: #60a5fa; text-decoration: none;">\${data.website}</a>\` : '<span style="opacity:0.5; font-style:italic;">No website added.</span>'}</div>
                      </div>
                      <div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Social Links</div>
                        <div>\${data.social || '<span style="opacity:0.5; font-style:italic;">No social links added.</span>'}</div>
                      </div>
                    </div>
                  </div>

                </div>

                <!-- Activity Stats -->
                <div class="glass-panel" style="padding: 25px; background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
                   <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                      <img src="https://api.iconify.design/lucide:activity.svg?color=%23f472b6" width="20"> Activity Stats
                   </h3>
                   <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; text-align: center;">
                     <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                       <div style="font-size: 24px; font-weight: bold; color: #4ade80;">\${data.taskCount}</div>
                       <div style="font-size: 12px; color: #94a3b8;">Completed</div>
                     </div>
                     <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                       <div style="font-size: 24px; font-weight: bold; color: #fb923c;">\${data.pendingCount}</div>
                       <div style="font-size: 12px; color: #94a3b8;">Pending</div>
                     </div>
                     <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                       <div style="font-size: 24px; font-weight: bold; color: #f87171;">\${data.rejectedCount}</div>
                       <div style="font-size: 12px; color: #94a3b8;">Rejected</div>
                     </div>
                     <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                       <div style="font-size: 24px; font-weight: bold; color: #fbbf24;">\${data.coin || 0}</div>
                       <div style="font-size: 12px; color: #94a3b8;">Coins</div>
                     </div>
                   </div>
                </div>
            \`;
        } catch (e) {
            viewProfileContent.innerHTML = '<div style="text-align:center; color:white; padding: 20px;">Failed to load profile</div>';
        }
    }
  </script>
</body>
</html>
`

router.get('/', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const level = calculateLevel(taskCount)
  const levelProgress = getLevelProgress(taskCount)

  // Fetch Top 100 Users by Task Count
  // Prisma groupBy + orderBy count
  // LOGIC FIX: Explicitly count LinkSubmission by visitorId (Tasks Completed)
  // NOT visits received (which would be by promotedLink.userId)
  const topStats = await prisma.linkSubmission.groupBy({
    by: ['visitorId'],
    where: { 
        status: 'APPROVED',
        visitorId: { not: null } // Ensure we only count valid users
    },
    _count: {
      visitorId: true
    },
    orderBy: {
      _count: {
        visitorId: 'desc'
      }
    },
    take: 100
  })

  // Get User Details
  const userIds = topStats.map(s => s.visitorId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, username: true, currentAvatar: true }
  })

  // Merge Data
  const leaderboard = topStats.map((stat, index) => {
    const u = users.find(user => user.id === stat.visitorId)
    if (!u) return null
    return {
      rank: index + 1,
      ...u,
      count: stat._count.visitorId
    }
  }).filter(Boolean)

  const renderItem = (item) => `
    <div class="leaderboard-item item-rank-${item.rank}">
      ${item.rank === 1 ? '<div class="crown-icon">👑</div>' : ''}
      <div class="rank-badge rank-${item.rank}">${item.rank}</div>
      <img src="${item.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" class="user-avatar" alt="${item.username}">
      <div class="user-info">
        <a href="#" onclick="event.preventDefault(); showUserProfile('${item.username}')" class="user-name">
            ${item.firstName} ${item.lastName}
            ${item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : ''}
        </a>
        <div class="user-username">@${item.username}</div>
      </div>
      <div class="task-count">${item.count} Tasks</div>
    </div>
  `

  res.send(`
    ${getHead('Leaderboard')}
    ${getUserSidebar('leaderboard', unreadCount)}
    <div class="main-content">
      <div class="leaderboard-container">
        <div class="leaderboard-title">
            <img src="https://api.iconify.design/lucide:trophy.svg?color=gold" width="32">
            Top 100 Leaders
        </div>
        
        <div class="leaderboard-list">
          ${leaderboard.map(renderItem).join('')}
        </div>
        
        ${leaderboard.length === 0 ? '<div style="text-align:center; color:var(--text-muted); margin-top:40px;">No data available yet</div>' : ''}
      </div>
    </div>
    ${getFooter(user, level, levelProgress)}
  `)
})

module.exports = router

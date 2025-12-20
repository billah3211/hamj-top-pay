const express = require('express')
const { prisma } = require('../db/prisma')
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
    .leaderboard-title { font-size: 24px; font-weight: 700; color: white; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
    
    .leaderboard-list { display: flex; flex-direction: column; gap: 10px; }
    .leaderboard-item { 
      background: rgba(30, 41, 59, 0.6); 
      border-radius: 12px; 
      padding: 12px 20px; 
      display: flex; 
      align-items: center; 
      gap: 16px; 
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.2s;
    }
    .leaderboard-item:hover { transform: translateX(5px); background: rgba(30, 41, 59, 0.9); border-color: var(--primary); }
    
    .rank-badge {
      width: 32px; height: 32px; 
      display: flex; align-items: center; justify-content: center; 
      font-weight: 700; font-size: 14px; 
      border-radius: 8px; 
      background: rgba(255,255,255,0.1);
      color: #94a3b8;
    }
    .rank-1 { background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%); color: black; box-shadow: 0 4px 12px rgba(250, 204, 21, 0.3); }
    .rank-2 { background: linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%); color: black; box-shadow: 0 4px 12px rgba(226, 232, 240, 0.3); }
    .rank-3 { background: linear-gradient(135deg, #fb923c 0%, #c2410c 100%); color: black; box-shadow: 0 4px 12px rgba(251, 146, 60, 0.3); }
    
    .user-avatar { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; background: #1e293b; }
    
    .user-info { flex: 1; }
    .user-name { font-weight: 600; color: white; font-size: 15px; cursor: pointer; text-decoration: none; }
    .user-name:hover { color: var(--primary); }
    .user-username { font-size: 12px; color: #94a3b8; }
    
    .task-count { color: #34d399; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
`

const getSidebar = () => `
<nav class="sidebar-premium" id="sidebar">
  <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
  <ul class="nav-links">
    <li class="nav-item"><a href="/dashboard"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
    <li class="nav-item"><a href="/store"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
    <li class="nav-item"><a href="/store/my"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
    <li class="nav-item"><a href="/leaderboard" class="active"><img src="https://api.iconify.design/lucide:trophy.svg?color=%2394a3b8" class="nav-icon"> Leaderboard</a></li>
    <li class="nav-item"><a href="/topup"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up</a></li>
    <li class="nav-item"><a href="/promote"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Link</a></li>
    <li class="nav-item"><a href="/notifications"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
    <li class="nav-item"><a href="/settings"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
    <li class="nav-item"><a href="#" id="menuProfile"><img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" class="nav-icon"> Profile</a></li>
    <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
  </ul>
</nav>
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
<div id="viewProfileModal" class="modal-premium" style="align-items: center; justify-content: center; padding: 20px;">
  <div class="modal-content" style="background: transparent; border: none; box-shadow: none; width: 100%; max-width: 600px; padding: 0;">
    <div style="position: relative;">
        <button class="modal-close" id="viewProfileBack" style="position: absolute; top: -15px; right: -15px; background: rgba(0,0,0,0.5); color: white; border: 2px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 100; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px 20px 20px; border-radius: 24px; position: relative; overflow: visible; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
            <div id="viewProfileContent">
                <!-- Content will be loaded here -->
                <div style="text-align:center; color:white;">Loading...</div>
            </div>
        </div>
    </div>
  </div>
</div>
<div id="viewProfileOverlay" class="modal-overlay hidden"></div>
`

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

const getFooter = (user, level) => `
  <button class="menu-trigger" id="mobileMenuBtn">☰</button>
  ${getProfileModal(user, level)}
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
                <div style="background: #000; padding: 20px; border-radius: 16px; margin-bottom: 20px; margin-left: 60px; position: relative; border: 1px solid rgba(255,255,255,0.1);">
                   <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: 0.5px;">\${data.firstName} \${data.lastName}</div>
                   <div style="color: #60a5fa; font-weight: 600; font-size: 14px; margin-bottom: 8px;">@\${data.username}</div>
                   <div style="display:inline-block; background:linear-gradient(90deg, #facc15, #fbbf24); color:black; font-weight:bold; font-size:12px; padding:2px 8px; border-radius:4px; margin-bottom:8px;">Level \${data.level}</div>
                   <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 13px; color: #cbd5e1;">
                       <div>📧 \${data.email}</div>
                       <div>📅 Joined: \${new Date(data.createdAt).toLocaleDateString()}</div>
                   </div>
                </div>
                <div style="display: flex; gap: 20px; align-items: flex-start;">
                    <div style="width: 110px; height: 110px; border-radius: 50%; border: 6px solid #000; overflow: hidden; background: #1a1a2e; flex-shrink: 0; z-index: 10; margin-top: -10px; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                        <img src="\${data.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="background: #000; padding: 20px; border-radius: 16px; flex-grow: 1; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="font-size: 13px; color: #e2e8f0;">
                                <span style="color: #60a5fa; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Country</span><br>
                                \${data.country}
                            </div>
                            <div style="font-size: 13px; color: #e2e8f0;">
                                <span style="color: #60a5fa; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Bio</span><br>
                                \${data.bio || '<span style="opacity:0.5">No bio added</span>'}
                            </div>
                             <div style="font-size: 13px; color: #e2e8f0;">
                                <span style="color: #60a5fa; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Tasks Completed</span><br>
                                \${data.taskCount}
                            </div>
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
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const level = calculateLevel(taskCount)

  // Fetch Top 100 Users by Task Count
  // Prisma groupBy + orderBy count
  const topStats = await prisma.linkSubmission.groupBy({
    by: ['visitorId'],
    where: { status: 'APPROVED' },
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
    <div class="leaderboard-item">
      <div class="rank-badge rank-${item.rank}">${item.rank}</div>
      <img src="${item.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" class="user-avatar" alt="${item.username}">
      <div class="user-info">
        <a href="#" onclick="event.preventDefault(); showUserProfile('${item.username}')" class="user-name">${item.firstName} ${item.lastName}</a>
        <div class="user-username">@${item.username}</div>
      </div>
      <div class="task-count">${item.count} Tasks</div>
    </div>
  `

  res.send(`
    ${getHead('Leaderboard')}
    ${getSidebar()}
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
    ${getFooter(user, level)}
  `)
})

module.exports = router

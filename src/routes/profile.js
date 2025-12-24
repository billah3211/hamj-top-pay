const express = require('express')
const { prisma } = require('../db/prisma')
const { getUserSidebar } = require('../utils/sidebar')
const { getSystemSettings } = require('../utils/settings')
const router = express.Router()

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

router.get('/', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (!user) return res.redirect('/login')
  if (user.isBlocked) {
    req.session.destroy()
    return res.redirect('/login?error=Account+blocked')
  }

  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const pendingCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'PENDING' } })
  const rejectedCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'REJECTED' } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const level = calculateLevel(taskCount)
  const progress = getLevelProgress(taskCount)

  const settings = await getSystemSettings()
  const sidebar = getUserSidebar('profile', unreadCount, user.id, user.role, settings)

  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>My Profile - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
      
      <div class="app-layout">
        ${sidebar}
        
        <div class="main-content">
          <div class="section-header">
            <div>
              <div class="section-title">My Profile</div>
              <div style="color:var(--text-muted);font-size:14px">Manage your personal information</div>
            </div>
            <div class="actions">
              <a href="/settings" class="btn-premium">Edit Profile</a>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 30px; max-width: 800px; margin: 0 auto;">
            
            <!-- Profile Header Card -->
            <div class="glass-panel" style="padding: 0; overflow: hidden; position: relative;">
               <div style="height: 150px; background: linear-gradient(135deg, #065f46 0%, #10b981 100%);"></div>
               
               <div style="padding: 0 30px 30px; margin-top: -50px; position: relative;">
                 <div style="display: flex; align-items: flex-end; gap: 20px; flex-wrap: wrap;">
                   <div style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid #0f172a; overflow: hidden; background: #1e293b; flex-shrink: 0;">
                     <img src="${user.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" style="width: 100%; height: 100%; object-fit: cover;">
                   </div>
                   
                   <div style="flex: 1; padding-bottom: 10px;">
                     <h2 style="font-size: 28px; font-weight: 800; color: white; margin-bottom: 5px;">${user.firstName} ${user.lastName}</h2>
                     <div style="color: #94a3b8; font-size: 16px;">@${user.username}</div>
                   </div>
                   
                   <div style="display: flex; gap: 10px; padding-bottom: 10px;">
                      <div style="background: rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Level</div>
                        <div style="font-size: 18px; color: #facc15; font-weight: 800;">${level}</div>
                      </div>
                      <div style="background: rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Tasks</div>
                        <div style="font-size: 18px; color: white; font-weight: 800;">${taskCount}</div>
                      </div>
                   </div>
                 </div>
               </div>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;">
               <div class="glass-panel" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2);">
                 <div style="font-size: 14px; color: #6ee7b7; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Approved Tasks</div>
                 <div style="font-size: 32px; font-weight: 800; color: white; margin-top: 10px;">${taskCount}</div>
               </div>
               <div class="glass-panel" style="background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.2);">
                 <div style="font-size: 14px; color: #fcd34d; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Pending Approval</div>
                 <div style="font-size: 32px; font-weight: 800; color: white; margin-top: 10px;">${pendingCount}</div>
               </div>
               <div class="glass-panel" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);">
                 <div style="font-size: 14px; color: #fca5a5; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Rejected</div>
                 <div style="font-size: 32px; font-weight: 800; color: white; margin-top: 10px;">${rejectedCount}</div>
               </div>
            </div>

            <!-- Info Section -->
            <div class="glass-panel">
               <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                  <img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" width="24" height="24">
                  <h3 style="margin: 0; font-size: 18px;">Personal Information</h3>
               </div>
               
               <div style="display: grid; gap: 20px;">
                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: #94a3b8;">Email</div>
                    <div style="color: white;">${user.email}</div>
                  </div>
                  
                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: #94a3b8;">Country</div>
                    <div style="color: white; display: flex; align-items: center; gap: 8px;">
                      <img src="https://flagcdn.com/w20/${user.country.toLowerCase()}.png" onerror="this.style.display='none'">
                      ${user.country}
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: #94a3b8;">Joined Date</div>
                    <div style="color: white;">${new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>

                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: start; gap: 20px;">
                    <div style="color: #94a3b8; padding-top: 5px;">Bio</div>
                    <div style="color: white; line-height: 1.6;">${user.bio || '<span style="color: #94a3b8; font-style: italic;">No bio added yet</span>'}</div>
                  </div>
               </div>
            </div>

            <!-- Social Links -->
            <div class="glass-panel">
               <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                  <img src="https://api.iconify.design/lucide:share-2.svg?color=%2394a3b8" width="24" height="24">
                  <h3 style="margin: 0; font-size: 18px;">Social & Website</h3>
               </div>

               <div style="display: grid; gap: 20px;">
                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: #94a3b8;">Website</div>
                    <div>
                      ${user.website ? `<a href="${user.website}" target="_blank" style="color: #60a5fa; text-decoration: none;">${user.website}</a>` : '<span style="color: #94a3b8; font-style: italic;">Not provided</span>'}
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: start; gap: 20px;">
                    <div style="color: #94a3b8; padding-top: 5px;">Social Links</div>
                    <div style="color: white; white-space: pre-wrap;">${user.social || '<span style="color: #94a3b8; font-style: italic;">No social links added</span>'}</div>
                  </div>
               </div>
            </div>

          </div>
          
          <div style="margin-top: 50px; text-align: center; color: var(--text-muted); font-size: 14px;">
            &copy; ${new Date().getFullYear()} HaMJ toP PaY. All rights reserved.
          </div>
        </div>
      </div>

      <script>
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        
        if(menuBtn) {
          menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
          });
        }

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
          if (window.innerWidth <= 768 && 
              sidebar.classList.contains('open') && 
              !sidebar.contains(e.target) && 
              e.target !== menuBtn) {
            sidebar.classList.remove('open');
          }
        });
      </script>
    </body>
    </html>
  `)
})

router.get('/view/:id', async (req, res) => {
  // Require login to view profiles (to show sidebar properly)
  if (!req.session.userId) return res.redirect('/login')

  const viewId = parseInt(req.params.id)
  if (isNaN(viewId)) return res.redirect('/')

  // Fetch the logged-in user for sidebar
  const currentUser = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (!currentUser) return res.redirect('/login')

  // Fetch the target user
  const user = await prisma.user.findUnique({ where: { id: viewId } })
  if (!user) return res.status(404).send('User not found')

  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  // We might not want to show pending/rejected stats for other users, maybe just approved?
  // Let's show just taskCount (Approved) for public view, or all if we want transparency.
  // Usually public profiles show "Total Completed Tasks".
  
  const level = calculateLevel(taskCount)
  
  const unreadCount = await prisma.notification.count({ where: { userId: currentUser.id, isRead: false } })
  const settings = await getSystemSettings()
  const sidebar = getUserSidebar('leaderboard', unreadCount, currentUser.id, currentUser.role, settings) // 'leaderboard' active since we came from there usually

  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${user.username}'s Profile - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
      
      <div class="app-layout">
        ${sidebar}
        
        <div class="main-content">
          <div class="section-header">
            <div>
              <div class="section-title">User Profile</div>
              <div style="color:var(--text-muted);font-size:14px">Viewing public profile</div>
            </div>
            <div class="actions">
              ${currentUser.id === user.id ? '<a href="/settings" class="btn-premium">Edit Profile</a>' : ''}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 30px; max-width: 800px; margin: 0 auto;">
            
            <!-- Profile Header Card -->
            <div class="glass-panel" style="padding: 0; overflow: hidden; position: relative;">
               <div style="height: 150px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);"></div>
               
               <div style="padding: 0 30px 30px; margin-top: -50px; position: relative;">
                 <div style="display: flex; align-items: flex-end; gap: 20px; flex-wrap: wrap;">
                   <div style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid #0f172a; overflow: hidden; background: #1e293b; flex-shrink: 0;">
                     <img src="${user.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white'}" style="width: 100%; height: 100%; object-fit: cover;">
                   </div>
                   
                   <div style="flex: 1; padding-bottom: 10px;">
                     <h2 style="font-size: 28px; font-weight: 800; color: white; margin-bottom: 5px;">${user.firstName} ${user.lastName}</h2>
                     <div style="color: #94a3b8; font-size: 16px;">@${user.username}</div>
                   </div>
                   
                   <div style="display: flex; gap: 10px; padding-bottom: 10px;">
                      <div style="background: rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Level</div>
                        <div style="font-size: 18px; color: #facc15; font-weight: 800;">${level}</div>
                      </div>
                      <div style="background: rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Tasks</div>
                        <div style="font-size: 18px; color: white; font-weight: 800;">${taskCount}</div>
                      </div>
                   </div>
                 </div>
               </div>
            </div>

            <!-- Info Section -->
            <div class="glass-panel">
               <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                  <img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" width="24" height="24">
                  <h3 style="margin: 0; font-size: 18px;">About</h3>
               </div>
               
               <div style="display: grid; gap: 20px;">
                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: #94a3b8;">Country</div>
                    <div style="color: white; display: flex; align-items: center; gap: 8px;">
                      <img src="https://flagcdn.com/w20/${user.country.toLowerCase()}.png" onerror="this.style.display='none'">
                      ${user.country}
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: #94a3b8;">Joined Date</div>
                    <div style="color: white;">${new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>

                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: start; gap: 20px;">
                    <div style="color: #94a3b8; padding-top: 5px;">Bio</div>
                    <div style="color: white; line-height: 1.6;">${user.bio || '<span style="color: #94a3b8; font-style: italic;">No bio added yet</span>'}</div>
                  </div>
               </div>
            </div>

            <!-- Social Links -->
            <div class="glass-panel">
               <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                  <img src="https://api.iconify.design/lucide:share-2.svg?color=%2394a3b8" width="24" height="24">
                  <h3 style="margin: 0; font-size: 18px;">Social & Website</h3>
               </div>

               <div style="display: grid; gap: 20px;">
                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: #94a3b8;">Website</div>
                    <div>
                      ${user.website ? `<a href="${user.website}" target="_blank" style="color: #60a5fa; text-decoration: none;">${user.website}</a>` : '<span style="color: #94a3b8; font-style: italic;">Not provided</span>'}
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 120px 1fr; align-items: start; gap: 20px;">
                    <div style="color: #94a3b8; padding-top: 5px;">Social Links</div>
                    <div style="color: white; white-space: pre-wrap;">${user.social || '<span style="color: #94a3b8; font-style: italic;">No social links added</span>'}</div>
                  </div>
               </div>
            </div>

          </div>
          
          <div style="margin-top: 50px; text-align: center; color: var(--text-muted); font-size: 14px;">
            &copy; ${new Date().getFullYear()} HaMJ toP PaY. All rights reserved.
          </div>
        </div>
      </div>

      <script>
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        
        if(menuBtn) {
          menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
          });
        }

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
          if (window.innerWidth <= 768 && 
              sidebar.classList.contains('open') && 
              !sidebar.contains(e.target) && 
              e.target !== menuBtn) {
            sidebar.classList.remove('open');
          }
        });
      </script>
    </body>
    </html>
  `)
})

module.exports = router

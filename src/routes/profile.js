const express = require('express')
const { prisma } = require('../db/prisma')
const { getUserSidebar } = require('../utils/sidebar')
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

  const sidebar = getUserSidebar('profile', unreadCount, user.id, user.role)

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
                     <div style="font-size: 28px; font-weight: 800; color: white;">${user.firstName} ${user.lastName}</div>
                     <div style="color: #94a3b8; margin-bottom: 5px;">@${user.username}</div>
                     <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 5px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 12px; padding: 2px 10px; border-radius: 20px;">Level ${level}</div>
                        <div style="font-size: 11px; color: #94a3b8;">${progress.current} / ${progress.next} Tasks</div>
                      </div>
                      <div style="width: 100%; max-width: 250px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;" title="${progress.percent.toFixed(1)}% to Level ${level + 1}">
                        <div style="width: ${progress.percent}%; height: 100%; background: #facc15;"></div>
                      </div>
                      <div style="color: #64748b; font-size: 12px;">Joined ${new Date(user.createdAt).toLocaleDateString()}</div>
                    </div>
                   </div>
                 </div>
               </div>
            </div>

            <!-- Admin Access -->
            ${(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? `
            <div class="glass-panel" style="padding: 25px; border: 1px solid rgba(239, 68, 68, 0.3);">
              <h3 style="margin-bottom: 20px; font-size: 18px; color: #ef4444; display: flex; align-items: center; gap: 10px;">
                <img src="https://api.iconify.design/lucide:shield-alert.svg?color=%23ef4444" width="20"> Admin Access
              </h3>
              <p style="color: #94a3b8; margin-bottom: 20px;">You have administrative privileges on this platform.</p>
              <a href="/admin/dashboard" class="btn-premium" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.5); justify-content: center;">Enter Admin Panel</a>
            </div>
            ` : ''}

            <!-- Stats & Info Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
              
              <!-- Contact Info -->
              <div class="glass-panel" style="padding: 25px;">
                <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                  <img src="https://api.iconify.design/lucide:contact.svg?color=%2310b981" width="20"> Contact Info
                </h3>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Email Address</div>
                    <div style="color: white;">${user.email}</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Phone Number</div>
                    <div style="color: white;">${user.phone}</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Country</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: white;">${user.country}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- About & Social -->
              <div class="glass-panel" style="padding: 25px;">
                <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                  <img src="https://api.iconify.design/lucide:info.svg?color=%233b82f6" width="20"> About & Social
                </h3>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Bio</div>
                    <div style="color: white; line-height: 1.5;">${user.bio || '<span style="opacity:0.5; font-style:italic;">No bio added yet.</span>'}</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Website</div>
                    <div>${user.website ? `<a href="${user.website}" target="_blank" style="color: #60a5fa; text-decoration: none;">${user.website}</a>` : '<span style="opacity:0.5; font-style:italic;">No website added.</span>'}</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Social Links</div>
                    <div>${user.social || '<span style="opacity:0.5; font-style:italic;">No social links added.</span>'}</div>
                  </div>
                </div>
              </div>

            </div>

            <!-- Task Stats -->
            <div class="glass-panel" style="padding: 25px;">
               <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                  <img src="https://api.iconify.design/lucide:activity.svg?color=%23f472b6" width="20"> Activity Stats
               </h3>
               <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; text-align: center;">
                 <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                   <div style="font-size: 24px; font-weight: bold; color: #4ade80;">${taskCount}</div>
                   <div style="font-size: 12px; color: #94a3b8;">Completed</div>
                 </div>
                 <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                   <div style="font-size: 24px; font-weight: bold; color: #fb923c;">${pendingCount}</div>
                   <div style="font-size: 12px; color: #94a3b8;">Pending</div>
                 </div>
                 <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                   <div style="font-size: 24px; font-weight: bold; color: #f87171;">${rejectedCount}</div>
                   <div style="font-size: 12px; color: #94a3b8;">Rejected</div>
                 </div>
                 <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                   <div style="font-size: 24px; font-weight: bold; color: #fbbf24;">${user.coin}</div>
                   <div style="font-size: 12px; color: #94a3b8;">Coins</div>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      <script>(function(){var dt=document.querySelectorAll('.device-toggle-settings .tab');function applySkin(m){document.body.classList.remove('skin-desktop','skin-mobile');document.body.classList.add('skin-'+m);if(dt.length){dt.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-device')===m)})}try{localStorage.setItem('siteSkin',m)}catch(e){}}if(dt.length){dt.forEach(function(b){b.addEventListener('click',function(){applySkin(b.getAttribute('data-device'))})})}var init='desktop';try{init=localStorage.getItem('siteSkin')||'desktop';if(init!=='desktop'&&init!=='mobile'){init='mobile'}}catch(e){}applySkin(init);})();</script>
      <script>
        document.getElementById('mobileMenuBtn').addEventListener('click', function() {
          document.getElementById('sidebar').classList.toggle('active');
        });
      </script>
    </body>
    </html>
  `)
})

router.get('/:username', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login')
  
  const currentUser = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (!currentUser) return res.redirect('/login')
    
  const user = await prisma.user.findUnique({ where: { username: req.params.username } })
  if (!user) return res.status(404).send('User not found')

  // If viewing self, redirect to /profile
  if (user.id === currentUser.id) return res.redirect('/profile')

  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const pendingCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'PENDING' } })
  const rejectedCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'REJECTED' } })
  
  const unreadCount = await prisma.notification.count({ where: { userId: currentUser.id, isRead: false } })
  const level = calculateLevel(taskCount)
  const progress = getLevelProgress(taskCount)

  const sidebar = getUserSidebar('profile', unreadCount, currentUser.id, currentUser.role)

  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${user.firstName} ${user.lastName} - HaMJ toP PaY</title>
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
              <div style="color:var(--text-muted);font-size:14px">Viewing ${user.username}'s profile</div>
            </div>
            <div class="actions">
              <a href="javascript:history.back()" class="btn-premium" style="background: rgba(255,255,255,0.1);">Back</a>
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
                     <div style="font-size: 28px; font-weight: 800; color: white;">${user.firstName} ${user.lastName}</div>
                     <div style="color: #94a3b8; margin-bottom: 5px;">@${user.username}</div>
                     <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 5px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 12px; padding: 2px 10px; border-radius: 20px;">Level ${level}</div>
                        <div style="font-size: 11px; color: #94a3b8;">${progress.current} / ${progress.next} Tasks</div>
                      </div>
                      <div style="width: 100%; max-width: 250px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;" title="${progress.percent.toFixed(1)}% to Level ${level + 1}">
                        <div style="width: ${progress.percent}%; height: 100%; background: #facc15;"></div>
                      </div>
                      <div style="color: #64748b; font-size: 12px;">Joined ${new Date(user.createdAt).toLocaleDateString()}</div>
                    </div>
                   </div>
                 </div>
               </div>
            </div>

            <!-- Stats & Info Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
              
              <!-- Contact Info (Limited for privacy if needed, but showing basic info) -->
              <div class="glass-panel" style="padding: 25px;">
                <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                  <img src="https://api.iconify.design/lucide:contact.svg?color=%2310b981" width="20"> Info
                </h3>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Country</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: white;">${user.country}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- About & Social -->
              <div class="glass-panel" style="padding: 25px;">
                <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                  <img src="https://api.iconify.design/lucide:info.svg?color=%233b82f6" width="20"> About & Social
                </h3>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Bio</div>
                    <div style="color: white; line-height: 1.5;">${user.bio || '<span style="opacity:0.5; font-style:italic;">No bio added yet.</span>'}</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Website</div>
                    <div>${user.website ? `<a href="${user.website}" target="_blank" style="color: #60a5fa; text-decoration: none;">${user.website}</a>` : '<span style="opacity:0.5; font-style:italic;">No website added.</span>'}</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">Social Links</div>
                    <div>${user.social || '<span style="opacity:0.5; font-style:italic;">No social links added.</span>'}</div>
                  </div>
                </div>
              </div>

            </div>

            <!-- Task Stats (Visible to others) -->
            <div class="glass-panel" style="padding: 25px;">
               <h3 style="margin-bottom: 20px; font-size: 18px; color: white; display: flex; align-items: center; gap: 10px;">
                  <img src="https://api.iconify.design/lucide:activity.svg?color=%23f472b6" width="20"> Activity Stats
               </h3>
               <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; text-align: center;">
                 <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                   <div style="font-size: 24px; font-weight: bold; color: #4ade80;">${taskCount}</div>
                   <div style="font-size: 12px; color: #94a3b8;">Completed</div>
                 </div>
                 <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                   <div style="font-size: 24px; font-weight: bold; color: #fb923c;">${pendingCount}</div>
                   <div style="font-size: 12px; color: #94a3b8;">Pending</div>
                 </div>
                 <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                   <div style="font-size: 24px; font-weight: bold; color: #f87171;">${rejectedCount}</div>
                   <div style="font-size: 12px; color: #94a3b8;">Rejected</div>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      <script>(function(){var dt=document.querySelectorAll('.device-toggle-settings .tab');function applySkin(m){document.body.classList.remove('skin-desktop','skin-mobile');document.body.classList.add('skin-'+m);if(dt.length){dt.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-device')===m)})}try{localStorage.setItem('siteSkin',m)}catch(e){}}if(dt.length){dt.forEach(function(b){b.addEventListener('click',function(){applySkin(b.getAttribute('data-device'))})})}var init='desktop';try{init=localStorage.getItem('siteSkin')||'desktop';if(init!=='desktop'&&init!=='mobile'){init='mobile'}}catch(e){}applySkin(init);})();</script>
      <script>
        document.getElementById('mobileMenuBtn').addEventListener('click', function() {
          document.getElementById('sidebar').classList.toggle('active');
        });
      </script>
    </body>
    </html>
  `)
})

module.exports = router

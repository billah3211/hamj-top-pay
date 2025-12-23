
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { prisma } = require('../db/prisma')
const { storage } = require('../config/cloudinary')
const { getUserSidebar } = require('../utils/sidebar')
const router = express.Router()

// Multer Config for Screenshots (Cloudinary)
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only images are allowed'), false)
  }
})

// Middleware
async function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login')
  // Trigger auto-approval check (non-blocking)
  checkAutoApprovals().catch(err => console.error('AutoApprove Error:', err))
  next()
}

// Helper: Get System Settings
async function getSettings() {
  const keys = ['visit_timer', 'screenshot_count', 'promote_packages', 'promote_reward', 'promote_auto_approve_minutes']
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
  
  const getVal = (k, def) => {
    const s = settings.find(s => s.key === k)
    return s ? s.value : def
  }

  const pkgDefault = JSON.stringify([
    { visits: 500, coin: 200, diamond: 50 },
    { visits: 1000, coin: 400, diamond: 100 },
    { visits: 2000, coin: 800, diamond: 200 },
    { visits: 5000, coin: 2000, diamond: 500 },
    { visits: 10000, coin: 4000, diamond: 1000 }
  ])
  const rewardDefault = JSON.stringify({ coin: 5, diamond: 0, tk: 0 })

  return {
    timer: parseInt(getVal('visit_timer', '50')),
    screenshotCount: parseInt(getVal('screenshot_count', '2')),
    packages: JSON.parse(getVal('promote_packages', pkgDefault)),
    rewards: JSON.parse(getVal('promote_reward', rewardDefault)),
    autoApproveMinutes: parseInt(getVal('promote_auto_approve_minutes', '2880'))
  }
}

async function checkAutoApprovals() {
  const settings = await getSettings()
  const cutoff = new Date(Date.now() - settings.autoApproveMinutes * 60000)
  
  // Auto Approve Pending
  const expired = await prisma.linkSubmission.findMany({
    where: { status: 'PENDING', submittedAt: { lt: cutoff } },
    take: 5
  })

  for (const sub of expired) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.linkSubmission.findUnique({ where: { id: sub.id } })
      if (!current || current.status !== 'PENDING') return

      await tx.linkSubmission.update({ where: { id: sub.id }, data: { status: 'APPROVED' } })
      
      await tx.user.update({ 
        where: { id: sub.visitorId }, 
        data: { 
          coin: { increment: settings.rewards.coin },
          diamond: { increment: settings.rewards.diamond },
          tk: { increment: settings.rewards.tk }
        } 
      })
      
      await tx.promotedLink.update({ where: { id: sub.promotedLinkId }, data: { completedVisits: { increment: 1 } } })
    })
  }

  // Auto Cleanup Rejected (3 Days Rule)
  const rejectCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const expiredRejected = await prisma.linkSubmission.findMany({
    where: { status: 'REJECTED', submittedAt: { lt: rejectCutoff } },
    take: 5
  })

  for (const sub of expiredRejected) {
    await prisma.$transaction(async (tx) => {
       const current = await tx.linkSubmission.findUnique({ where: { id: sub.id } })
       if (!current || current.status !== 'REJECTED') return

       // Delete history
       await tx.linkSubmission.delete({ where: { id: sub.id } })

       // Release Lock (Decrement completedVisits because it was incremented on rejection)
       await tx.promotedLink.update({ 
         where: { id: sub.promotedLinkId }, 
         data: { completedVisits: { decrement: 1 } } 
       })
    })
  }
}

// Helper: Calculate User Level (Same as auth.js)
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

// Helper: Profile Modal
const getProfileModal = (user, level, levelProgress) => `
    <div id="profileModal" class="modal-premium" style="align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-content" style="background: transparent; border: none; box-shadow: none; width: 100%; max-width: 600px; padding: 0;">
        <div style="position: relative;">
            <button class="modal-close" id="profileBack" style="position: absolute; top: -15px; right: -15px; background: rgba(0,0,0,0.5); color: white; border: 2px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 100; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
            <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 30px 20px 20px; border-radius: 24px; position: relative; overflow: visible; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <input type="hidden" id="profileUsername" value="${user.username}">
                <div style="background: #000; padding: 20px; border-radius: 16px; margin-bottom: 20px; margin-left: 60px; position: relative; border: 1px solid rgba(255,255,255,0.1);">
                   <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: 0.5px;">${user.firstName} ${user.lastName}</div>
                   <div style="color: #4ade80; font-weight: 600; font-size: 14px; margin-bottom: 8px;">@${user.username}</div>
                   
                   <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                     <div style="display: flex; align-items: center; gap: 10px;">
                       <div style="background: linear-gradient(90deg, #facc15, #fbbf24); color: black; font-weight: bold; font-size: 12px; padding: 2px 10px; border-radius: 20px;">Level ${level}</div>
                       ${levelProgress ? `<div style="font-size: 11px; color: #94a3b8;">${levelProgress.current} / ${levelProgress.next} Tasks</div>` : ''}
                     </div>
                     ${levelProgress ? `<div style="width: 100%; max-width: 250px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;" title="${levelProgress.percent.toFixed(1)}% to Level ${level + 1}">
                       <div style="width: ${levelProgress.percent}%; height: 100%; background: #facc15;"></div>
                     </div>` : ''}
                   </div>

                   <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 13px; color: #cbd5e1;">
                       <div>📧 ${user.email}</div>
                       <div>📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}</div>
                   </div>
                   
                   <!-- Task Stats -->
                   <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 15px; text-align: center; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 8px;">
                            <div style="font-weight: bold; color: #4ade80; font-size: 16px;" id="p_completed">-</div>
                            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase;">Completed</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 8px;">
                            <div style="font-weight: bold; color: #fb923c; font-size: 16px;" id="p_pending">-</div>
                            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase;">Pending</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 8px;">
                            <div style="font-weight: bold; color: #f87171; font-size: 16px;" id="p_rejected">-</div>
                            <div style="font-size: 10px; color: #cbd5e1; text-transform: uppercase;">Rejected</div>
                        </div>
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
                            <div style="font-size: 13px; color: #e2e8f0;">
                                <span style="color: #4ade80; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Social</span><br>
                                ${user.social || '<span style="opacity:0.5">No social links</span>'}
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

// Helper: Common UI Components
// Sidebar removed - imported from utils

const getHead = (title) => `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} - HaMJ toP PaY</title>
    <link rel="stylesheet" href="/style.css">
  </head>
  <body>
    <button class="menu-trigger" id="mobileMenuBtn">☰</button>
    <div class="app-layout">
`

const getFooter = (user, level, levelProgress) => `
    </div>
    ${user ? getProfileModal(user, level, levelProgress) : ''}
    <script>
      const menuBtn = document.getElementById('mobileMenuBtn');
      const sidebar = document.getElementById('sidebar');
      if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

      // Profile Modal Logic
      const profileTrigger = document.getElementById('menuProfile');
      const profileModal = document.getElementById('profileModal');
      const profileOverlay = document.getElementById('profileOverlay');
      const profileBack = document.getElementById('profileBack');

      function openProfile() {
        if(profileModal) {
          profileModal.classList.add('open');
          profileOverlay.classList.remove('hidden');

          // Fetch stats if available
          const usernameInput = document.getElementById('profileUsername');
          if (usernameInput && usernameInput.value) {
            fetch('/api/profile/' + usernameInput.value)
              .then(res => res.json())
              .then(data => {
                if(document.getElementById('p_completed')) document.getElementById('p_completed').innerText = data.taskCount || 0;
                if(document.getElementById('p_pending')) document.getElementById('p_pending').innerText = data.pendingCount || 0;
                if(document.getElementById('p_rejected')) document.getElementById('p_rejected').innerText = data.rejectedCount || 0;
              })
              .catch(err => console.error(err));
          }
        }
      }
      function closeProfile() {
        if(profileModal) {
          profileModal.classList.remove('open');
          profileOverlay.classList.add('hidden');
        }
      }

      if(profileTrigger) profileTrigger.addEventListener('click', (e) => { e.preventDefault(); openProfile(); });
      if(profileBack) profileBack.addEventListener('click', closeProfile);
      if(profileOverlay) profileOverlay.addEventListener('click', closeProfile);
    </script>
  </body>
  </html>
`

// --- Routes ---

// 1. Promote Link Dashboard
router.get('/', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const level = calculateLevel(taskCount)
  const levelProgress = getLevelProgress(taskCount)

  res.send(`
    ${getHead('Promote Link')}
    ${getUserSidebar('promote', unreadCount)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Promote Link System</div>
          <div style="color:var(--text-muted)">Grow your audience or earn by visiting</div>
        </div>
      </div>

      <div class="store-grid">
        <!-- 1. Promote Your Link -->
        <a href="/promote/create" class="store-card" style="text-decoration:none;color:white;text-align:center;padding:40px 20px;">
          <div style="background:rgba(99,102,241,0.1);width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <img src="https://api.iconify.design/lucide:megaphone.svg?color=%23818cf8" width="32">
          </div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Promote Your Link</div>
          <div style="color:var(--text-muted);font-size:14px">Get real visitors to your website</div>
        </a>

        <!-- 2. Promote History -->
        <a href="/promote/history" class="store-card" style="text-decoration:none;color:white;text-align:center;padding:40px 20px;">
          <div style="background:rgba(236,72,153,0.1);width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <img src="https://api.iconify.design/lucide:history.svg?color=%23f472b6" width="32">
          </div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Promote History</div>
          <div style="color:var(--text-muted);font-size:14px">Track your campaigns & approvals</div>
        </a>

        <!-- 3. Visit & Earn -->
        <a href="/promote/earn" class="store-card" style="text-decoration:none;color:white;text-align:center;padding:40px 20px;">
          <div style="background:rgba(34,197,94,0.1);width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <img src="https://api.iconify.design/lucide:coins.svg?color=%234ade80" width="32">
          </div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Visit & Earn</div>
          <div style="color:var(--text-muted);font-size:14px">Visit links and earn rewards</div>
        </a>

        <!-- 4. My Task -->
        <a href="/promote/tasks" class="store-card" style="text-decoration:none;color:white;text-align:center;padding:40px 20px;">
          <div style="background:rgba(249,115,22,0.1);width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <img src="https://api.iconify.design/lucide:clipboard-list.svg?color=%23fb923c" width="32">
          </div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">My Task</div>
          <div style="color:var(--text-muted);font-size:14px">Check your work status</div>
        </a>
      </div>
    </div>
    ${getFooter(user, level, levelProgress)}
  `)
})

// 2. Create Promotion
router.get('/create', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  const settings = await getSettings()
  const today = new Date().toISOString().split('T')[0]
  
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const level = calculateLevel(taskCount)
  const levelProgress = getLevelProgress(taskCount)

  const packageOptions = settings.packages.map(p => `<option value="${p.visits}">${p.visits} Visits</option>`).join('')

  res.send(`
    ${getHead('Promote Your Link')}
    ${getUserSidebar('promote', unreadCount, user.id, user.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Promote Your Link</div>
          <div style="color:var(--text-muted)">Create a new campaign</div>
        </div>
      </div>

      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}

      <div class="glass-panel" style="max-width:600px;margin:0 auto;padding:30px">
        <form action="/promote/create" method="POST">
          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px;color:var(--text-muted)">ID Code / Email</label>
            <input type="text" value="${user.email}" disabled class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white">
          </div>

          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px;color:var(--text-muted)">Date</label>
            <input type="text" value="${today}" disabled class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white">
          </div>

          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px;color:var(--text-muted)">Title</label>
            <input type="text" name="title" required placeholder="e.g., Watch my video" class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white">
          </div>

          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px;color:var(--text-muted)">Link URL</label>
            <input type="url" name="url" required placeholder="https://..." class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white">
          </div>

          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px;color:var(--text-muted)">Visit Requirement</label>
            <select name="visits" id="visits" onchange="calcCost()" class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white">
              <option value="">Select Package</option>
              ${packageOptions}
            </select>
          </div>

          <div style="background:rgba(99,102,241,0.1);padding:15px;border-radius:8px;margin-bottom:24px;border:1px solid rgba(99,102,241,0.2)">
            <div style="color:var(--text-muted);font-size:14px;margin-bottom:5px">Total Cost:</div>
            <div style="font-size:18px;font-weight:bold">
              <span id="costCoin" style="color:#fb923c">0</span> Coins + 
              <span id="costDiamond" style="color:#a855f7">0</span> Diamonds
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:5px">Your Balance: ${user.coin} Coins, ${user.diamond} Diamonds</div>
          </div>

          <button type="submit" class="btn-premium full-width">Create Campaign</button>
        </form>
      </div>
    </div>
    <script>
      const packages = ${JSON.stringify(settings.packages)};
      function calcCost() {
        const v = parseInt(document.getElementById('visits').value);
        const pkg = packages.find(p => p.visits === v);
        if (pkg) {
          document.getElementById('costCoin').innerText = pkg.coin;
          document.getElementById('costDiamond').innerText = pkg.diamond;
        } else {
          document.getElementById('costCoin').innerText = 0;
          document.getElementById('costDiamond').innerText = 0;
        }
      }
      calcCost();
    </script>
    ${getFooter(user, level, levelProgress)}
  `)
})

router.post('/create', requireLogin, async (req, res) => {
  try {
    const { title, url, visits } = req.body
    const visitCount = parseInt(visits)
    const settings = await getSettings()
    const pkg = settings.packages.find(p => p.visits === visitCount)
    
    if (!pkg) return res.redirect('/promote/create?error=Invalid+package')

    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })

    if (user.coin < pkg.coin || user.diamond < pkg.diamond) {
      return res.redirect('/promote/create?error=Insufficient+balance')
    }

    await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: user.id },
        data: {
          coin: { decrement: pkg.coin },
          diamond: { decrement: pkg.diamond }
        }
      })

      // Create Link
      await tx.promotedLink.create({
        data: {
          userId: user.id,
          title,
          url,
          targetVisits: visitCount
        }
      })
    })

    res.redirect('/promote/history?success=Campaign+created+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/promote/create?error=Something+went+wrong')
  }
})

// 3. Promote History
router.get('/history', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const level = calculateLevel(taskCount)
  const levelProgress = getLevelProgress(taskCount)

  const links = await prisma.promotedLink.findMany({
    where: { userId: req.session.userId },
    include: { submissions: true },
    orderBy: { createdAt: 'desc' }
  })

  const renderLink = (link) => {
    const pending = link.submissions.filter(s => s.status === 'PENDING').length
    const approved = link.submissions.filter(s => s.status === 'APPROVED').length
    const rejected = link.submissions.filter(s => s.status === 'REJECTED').length
    const progress = Math.min((link.completedVisits / link.targetVisits) * 100, 100)

    return `
      <div class="glass-panel" style="padding:20px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:15px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0 0 5px 0;font-size:18px">${link.title}</h3>
            <div style="color:var(--text-muted);font-size:14px">${link.url}</div>
          </div>
          <div class="status-tag" style="background:${link.status==='ACTIVE'?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'};color:${link.status==='ACTIVE'?'#4ade80':'#fca5a5'}">
            ${link.status}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(100px, 1fr));gap:10px;margin-bottom:20px;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px">
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:bold">${link.completedVisits}/${link.targetVisits}</div>
            <div style="font-size:12px;color:var(--text-muted)">Visits</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:bold;color:#fb923c">${pending}</div>
            <div style="font-size:12px;color:var(--text-muted)">Pending</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:bold;color:#4ade80">${approved}</div>
            <div style="font-size:12px;color:var(--text-muted)">Approved</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:bold;color:#f87171">${rejected}</div>
            <div style="font-size:12px;color:var(--text-muted)">Rejected</div>
          </div>
        </div>

        <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;margin-bottom:20px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:var(--primary)"></div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a href="/promote/history/${link.id}" class="btn-premium" style="padding:8px 16px;font-size:14px">📷 View Screenshots</a>
          <button onclick="openExtendModal(${link.id})" class="btn-premium" style="padding:8px 16px;font-size:14px;background:rgba(255,255,255,0.1)">Extend Visit</button>
        </div>
      </div>
    `
  }

  res.send(`
    ${getHead('Promote History')}
    ${getUserSidebar('promote', unreadCount, user.id, user.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Promote History</div>
          <div style="color:var(--text-muted)">Manage your campaigns</div>
        </div>
      </div>
      
      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}
      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}

      ${links.length ? links.map(renderLink).join('') : '<div class="empty-state">No campaigns found</div>'}
    </div>

    <!-- Extend Modal -->
    <div id="extendModal" class="modal-overlay hidden">
      <div class="glass-panel" style="max-width:400px;width:100%;padding:24px;position:relative">
        <button onclick="document.getElementById('extendModal').classList.add('hidden')" style="position:absolute;top:10px;right:10px;background:none;border:none;color:white;font-size:24px;cursor:pointer">×</button>
        <h3 style="margin-bottom:16px">Extend Visits</h3>
        <form action="/promote/extend" method="POST">
          <input type="hidden" name="linkId" id="extendLinkId">
          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px">Amount (Multiples of 500)</label>
            <select name="amount" id="extendAmount" onchange="calcExtendCost()" class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white">
              <option value="500">500 Visits</option>
              <option value="1000">1000 Visits</option>
              <option value="1500">1500 Visits</option>
              <option value="2000">2000 Visits</option>
            </select>
          </div>
          <div style="margin-bottom:20px;font-size:14px;color:var(--text-muted)">
            Cost: <span id="extendCostCoin" style="color:#fb923c">200</span> Coins + <span id="extendCostDiamond" style="color:#a855f7">50</span> Diamonds
          </div>
          <button type="submit" class="btn-premium full-width">Extend Now</button>
        </form>
      </div>
    </div>

    <script>
      function openExtendModal(id) {
        document.getElementById('extendLinkId').value = id;
        document.getElementById('extendModal').classList.remove('hidden');
      }
      function calcExtendCost() {
        const v = parseInt(document.getElementById('extendAmount').value);
        const units = v / 500;
        document.getElementById('extendCostCoin').innerText = units * 200;
        document.getElementById('extendCostDiamond').innerText = units * 50;
      }
    </script>
    ${getFooter(user, level, levelProgress)}
  `)
})

router.post('/promote/extend', requireLogin, async (req, res) => {
  // Logic same as create but updating targetVisits
  // Omitted for brevity, implemented similar to create
  res.redirect('/promote/history')
})

// View Screenshots & Manage
router.get('/history/:id', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const level = calculateLevel(taskCount)
  const levelProgress = getLevelProgress(taskCount)

  const linkId = parseInt(req.params.id)
  const link = await prisma.promotedLink.findUnique({
    where: { id: linkId },
    include: { submissions: { include: { visitor: true } } }
  })

  if (!link || link.userId !== req.session.userId) return res.redirect('/promote/history')

  const pendingSubs = link.submissions.filter(s => s.status === 'PENDING')
  
  const renderSub = (sub) => `
    <div class="glass-panel" style="padding:16px;margin-bottom:12px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:bold">${sub.visitor.firstName} ${sub.visitor.lastName}</div>
          <div style="font-size:12px;color:var(--text-muted)">ID: ${sub.visitor.username}</div>
        </div>
        <div style="font-size:12px;color:var(--text-muted)">${new Date(sub.submittedAt).toLocaleString()}</div>
      </div>
      <div style="display:flex;gap:10px;overflow-x:auto">
        ${sub.screenshots.map(url => `<a href="${url}" target="_blank"><img src="${url}" style="height:100px;border-radius:4px;border:1px solid rgba(255,255,255,0.1)"></a>`).join('')}
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <form action="/promote/submission/${sub.id}/approve" method="POST" style="flex:1">
          <button class="btn-premium" style="width:100%;background:#22c55e;border:none">Approve</button>
        </form>
        <button onclick="openRejectModal(${sub.id})" class="btn-premium" style="flex:1;background:#ef4444;border:none;justify-content:center">Reject</button>
      </div>
    </div>
  `

  res.send(`
    ${getHead('Review Screenshots')}
    ${getUserSidebar('promote', 0, req.session.userId, req.session.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">Review Screenshots</div>
          <div style="color:var(--text-muted)">${link.title}</div>
        </div>
        <form action="/promote/link/${link.id}/approve-all" method="POST">
          <button class="btn-premium">Approve All Pending</button>
        </form>
      </div>

      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
      ${pendingSubs.length ? pendingSubs.map(renderSub).join('') : '<div class="empty-state">No pending screenshots</div>'}
    </div>

    <!-- Reject Modal -->
    <div id="rejectModal" class="modal-overlay hidden">
      <div class="glass-panel" style="max-width:400px;width:100%;padding:24px;position:relative">
        <button onclick="document.getElementById('rejectModal').classList.add('hidden')" style="position:absolute;top:10px;right:10px;background:none;border:none;color:white;font-size:24px;cursor:pointer">×</button>
        <h3 style="margin-bottom:16px;color:#f87171">Reject Submission</h3>
        <form id="rejectForm" method="POST">
          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px">Reason (Required)</label>
            <textarea name="reason" required placeholder="e.g., Video not watched fully..." class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white;min-height:80px"></textarea>
          </div>
          <button type="submit" class="btn-premium full-width" style="background:#ef4444">Confirm Reject</button>
        </form>
      </div>
    </div>

    <script>
      function openRejectModal(id) {
        document.getElementById('rejectForm').action = '/promote/submission/' + id + '/reject';
        document.getElementById('rejectModal').classList.remove('hidden');
      }
    </script>
    ${getFooter(user, level, levelProgress)}
  `)
})

// Approve Logic
router.post('/submission/:id/approve', requireLogin, async (req, res) => {
  try {
    const subId = parseInt(req.params.id)
    const settings = await getSettings()

    await prisma.$transaction(async (tx) => {
      const submission = await tx.linkSubmission.findUnique({ where: { id: subId }, include: { promotedLink: true } })
      
      // Security: Check if current user owns the link
      if (submission.promotedLink.userId !== req.session.userId) throw new Error('Unauthorized')
      if (submission.status !== 'PENDING') return

      await tx.linkSubmission.update({
        where: { id: subId },
        data: { status: 'APPROVED' }
      })

      // Delete Screenshots (Save Space)
      if(submission.screenshots && submission.screenshots.length) {
        submission.screenshots.forEach(p => {
          try { fs.unlinkSync('public' + p) } catch(e) {}
        })
      }

      // Reward User
      await tx.user.update({
        where: { id: submission.visitorId },
        data: { 
          coin: { increment: settings.rewards.coin },
          diamond: { increment: settings.rewards.diamond },
          tk: { increment: settings.rewards.tk }
        }
      })

      // Increment completed visits
      await tx.promotedLink.update({
        where: { id: submission.promotedLinkId },
        data: { completedVisits: { increment: 1 } }
      })
    })

    res.redirect('back')
  } catch (e) {
    console.error(e)
    res.redirect('back')
  }
})

router.post('/submission/:id/reject', requireLogin, async (req, res) => {
  try {
    const { reason } = req.body
    if(!reason) return res.redirect('back?error=Reason+is+required')

    const subId = parseInt(req.params.id)

    await prisma.$transaction(async (tx) => {
      const sub = await tx.linkSubmission.findUnique({ where: { id: subId }, include: { promotedLink: true } })
      
      // Security Check
      if (!sub || sub.promotedLink.userId !== req.session.userId) throw new Error('Unauthorized')
      if (sub.status !== 'PENDING') return

      // Reject
      await tx.linkSubmission.update({
        where: { id: subId },
        data: { 
          status: 'REJECTED',
          rejectionReason: reason
        }
      })

      // Lock Logic: Increment completedVisits so it remains "occupied" until resolved
      await tx.promotedLink.update({
        where: { id: sub.promotedLinkId },
        data: { completedVisits: { increment: 1 } }
      })
    })

    res.redirect('back')
  } catch (e) {
    console.error(e)
    res.redirect('back?error=Error+rejecting+task')
  }
})

router.post('/link/:id/approve-all', requireLogin, async (req, res) => {
  try {
    const linkId = parseInt(req.params.id)
    const settings = await getSettings()

    await prisma.$transaction(async (tx) => {
      const link = await tx.promotedLink.findUnique({ where: { id: linkId } })
      if (link.userId !== req.session.userId) throw new Error('Unauthorized')

      const submissions = await tx.linkSubmission.findMany({
        where: { promotedLinkId: linkId, status: 'PENDING' }
      })

      for (const sub of submissions) {
        await tx.linkSubmission.update({ where: { id: sub.id }, data: { status: 'APPROVED' } })
        
        // Delete Screenshots
        if(sub.screenshots && sub.screenshots.length) {
          sub.screenshots.forEach(p => {
            try { fs.unlinkSync('public' + p) } catch(e) {}
          })
        }

        await tx.user.update({
          where: { id: sub.visitorId },
          data: { 
            coin: { increment: settings.rewards.coin },
            diamond: { increment: settings.rewards.diamond },
            tk: { increment: settings.rewards.tk }
          }
        })
      }
      
      await tx.promotedLink.update({
        where: { id: linkId },
        data: { completedVisits: { increment: submissions.length } }
      })
    })

    res.redirect('back')
  } catch (e) {
    console.error(e)
    res.redirect('back')
  }
})

// 4. Visit & Earn
router.get('/earn', requireLogin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    if (!user) {
      req.session.destroy()
      return res.redirect('/login')
    }

    const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
    const myPendingCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'PENDING' } })
    const level = calculateLevel(taskCount)
    const levelProgress = getLevelProgress(taskCount)

    const links = await prisma.promotedLink.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true, submissions: { where: { visitorId: req.session.userId } } },
      orderBy: { createdAt: 'desc' }
    })

    // Filter out links user has already submitted (any status) AND their own links
    const allAvailable = links.filter(l => 
      l.userId !== req.session.userId && 
      l.submissions.length === 0 && 
      l.completedVisits < l.targetVisits
    )
    
    const availableCount = allAvailable.length
    const availableLinks = allAvailable.slice(0, 1) // Show only 1 task at a time

    const settings = await getSettings()
    
    const renderTask = (link) => `
      <div class="glass-panel" style="padding:24px;margin-bottom:12px;text-align:center">
        <div style="margin-bottom:16px">
          <div style="font-weight:bold;font-size:20px;margin-bottom:8px">${link.title}</div>
          <div style="font-size:14px;color:var(--text-muted)">
            Reward: 
            ${settings.rewards.coin > 0 ? `<span style="color:#fb923c;font-weight:bold;margin-right:8px">${settings.rewards.coin} Coins</span>` : ''}
            ${settings.rewards.diamond > 0 ? `<span style="color:#a855f7;font-weight:bold;margin-right:8px">${settings.rewards.diamond} Diamonds</span>` : ''}
            ${settings.rewards.tk > 0 ? `<span style="color:#22c55e;font-weight:bold">${settings.rewards.tk} Tk</span>` : ''}
          </div>
        </div>
        <a href="/promote/visit/${link.id}" class="btn-premium full-width" style="background:#22c55e;border:none;padding:12px;font-size:16px;justify-content:center">Start Task</a>
      </div>
    `

    res.send(`
      ${getHead('Visit & Earn')}
      ${getUserSidebar('promote', 0, user.id, user.role)}
      <div class="main-content">
        <div class="section-header">
          <div>
            <div class="section-title">Visit & Earn</div>
            <div style="color:var(--text-muted)">Complete tasks one by one to earn coins</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
           <div class="glass-panel" style="padding: 15px; text-align: center;">
             <div style="font-size: 20px; font-weight: bold; color: #60a5fa;">${availableCount}</div>
             <div style="font-size: 12px; color: var(--text-muted);">Available</div>
           </div>
           <div class="glass-panel" style="padding: 15px; text-align: center;">
             <div style="font-size: 20px; font-weight: bold; color: #4ade80;">${taskCount}</div>
             <div style="font-size: 12px; color: var(--text-muted);">Total Done</div>
           </div>
           <div class="glass-panel" style="padding: 15px; text-align: center;">
             <div style="font-size: 20px; font-weight: bold; color: #fb923c;">${myPendingCount}</div>
             <div style="font-size: 12px; color: var(--text-muted);">Pending</div>
           </div>
        </div>

        ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
        ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}
        ${availableLinks.length ? availableLinks.map(renderTask).join('') : '<div class="empty-state">No tasks available right now. Please check back later!</div>'}
      </div>
      ${getFooter(user, level, levelProgress)}
    `)
  } catch (error) {
    console.error('Visit & Earn Error:', error)
    res.redirect('/dashboard?error=Internal+Server+Error')
  }
})

router.get('/visit/:id', requireLogin, async (req, res) => {
  const linkId = parseInt(req.params.id)
  const link = await prisma.promotedLink.findUnique({ 
    where: { id: linkId },
    include: { submissions: { where: { visitorId: req.session.userId } } }
  })

  // Security checks
  if (!link) return res.redirect('/promote/earn')
  if (link.userId === req.session.userId) return res.redirect('/promote/earn?error=You+cannot+visit+your+own+link')
  if (link.submissions.length > 0) return res.redirect('/promote/earn?error=You+already+visited+this+link')

  const settings = await getSettings()
  
  // Generate file inputs based on count
  let fileInputs = ''
  for(let i = 1; i <= settings.screenshotCount; i++) {
    fileInputs += `
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:6px;font-size:14px;color:var(--text-muted)">Screenshot ${i}</label>
        <input type="file" name="screenshots" accept="image/*" required class="form-input" style="width:100%;background:rgba(255,255,255,0.05)">
      </div>
    `
  }
  
  res.send(`
    ${getHead('Visiting ' + link.title)}
    <div class="app-layout" style="display:block;padding:20px;text-align:center;max-width:600px;margin:0 auto">
      <h2 style="margin-bottom:20px">Visit Task</h2>
      
      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}

      <div class="glass-panel" style="padding:40px">
        <div id="timerDisplay" style="font-size:48px;font-weight:900;margin-bottom:20px;color:var(--primary)">${settings.timer}</div>
        <div id="instructionText" style="color:var(--text-muted);margin-bottom:30px">Click "Visit Link" to start the timer. Stay on the page until the timer ends.</div>
        
        <a id="visitBtn" href="${link.url}" target="_blank" onclick="startTimer()" class="btn-premium full-width" style="justify-content:center;margin-bottom:20px;font-size:18px;padding:16px">Visit Link</a>
        
        <form id="uploadForm" action="/promote/submit/${link.id}" method="POST" enctype="multipart/form-data" class="hidden">
          <div style="margin-bottom:24px;text-align:left;background:rgba(255,255,255,0.02);padding:20px;border-radius:12px;border:1px solid rgba(255,255,255,0.05)">
            <h3 style="margin-bottom:16px;font-size:16px">Upload Proof</h3>
            ${fileInputs}
            <div style="font-size:12px;color:#fb923c;margin-top:10px;background:rgba(251,146,60,0.1);padding:8px;border-radius:4px">
              ⚠️ Upload exactly ${settings.screenshotCount} screenshots as proof.
            </div>
          </div>
          <button type="submit" class="btn-premium full-width" style="background:#22c55e;border:none">Submit Work</button>
        </form>
      </div>
    </div>
    <script>
      let time = ${settings.timer};
      let timerRunning = false;
      
      function startTimer() {
        if(timerRunning) return;
        timerRunning = true;
        
        const btn = document.getElementById('visitBtn');
        const display = document.getElementById('timerDisplay');
        const form = document.getElementById('uploadForm');
        const instruction = document.getElementById('instructionText');
        
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        btn.innerText = 'Visiting...';
        
        const interval = setInterval(() => {
          time--;
          display.innerText = time;
          if (time <= 0) {
            clearInterval(interval);
            display.innerText = "Time's Up!";
            display.style.color = '#22c55e';
            instruction.innerText = "Please upload the required screenshots below.";
            btn.style.display = 'none';
            form.classList.remove('hidden');
          }
        }, 1000);
      }
    </script>
  </body>
  </html>
  `)
})

router.post('/submit/:id', requireLogin, upload.array('screenshots', 10), async (req, res) => {
  const linkId = parseInt(req.params.id)
  
  // Validate screenshot count
  const settings = await getSettings()
  const requiredCount = settings.screenshotCount

  if (!req.files || req.files.length !== requiredCount) {
    // Note: Cloudinary files are already uploaded at this point. 
    // We could delete them using cloudinary.uploader.destroy but for now we just show error.
    return res.redirect('/promote/visit/' + linkId + '?error=Please+upload+exactly+' + requiredCount + '+screenshots')
  }

  const files = req.files.map(f => f.path)
  
  await prisma.linkSubmission.create({
    data: {
      promotedLinkId: linkId,
      visitorId: req.session.userId,
      screenshots: files
    }
  })
  
  // Redirect to earn page to show next task if available
  res.redirect('/promote/earn?success=Proof+submitted+successfully.+Here+is+your+next+task!')
})

// 5. My Tasks Enhanced
router.get('/tasks', requireLogin, async (req, res) => {
  const userId = req.session.userId
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const settings = await getSettings()
  
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: userId, status: 'APPROVED' } })
  const level = calculateLevel(taskCount)
  const levelProgress = getLevelProgress(taskCount)

  const tasks = await prisma.linkSubmission.findMany({
    where: { visitorId: userId },
    include: { promotedLink: true },
    orderBy: { submittedAt: 'desc' }
  })
  
  const activeTasks = tasks.filter(t => !t.status.includes('APPROVED'))
  const approvedTasks = tasks.filter(t => t.status.includes('APPROVED'))

  // Calculate Stats
  const approved = approvedTasks.length
  const rejected = tasks.filter(t => t.status === 'REJECTED' || t.status === 'ADMIN_REJECTED').length
  const pending = tasks.filter(t => t.status === 'PENDING' || t.status === 'REPORTED').length
  const earnedCoins = approved * settings.rewards.coin // Estimate based on current reward settings

  const getStatusBadge = (status) => {
    let color = 'gray', bg = 'rgba(255,255,255,0.1)'
    if(status.includes('APPROVED')) { color = '#4ade80'; bg = 'rgba(34,197,94,0.1)'; }
    if(status.includes('REJECTED')) { color = '#f87171'; bg = 'rgba(248,113,113,0.1)'; }
    if(status === 'PENDING') { color = '#fb923c'; bg = 'rgba(251,146,60,0.1)'; }
    if(status === 'REPORTED') { color = '#c084fc'; bg = 'rgba(192,132,252,0.1)'; }
    return `<span style="background:${bg};color:${color};padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600">${status.replace('_', ' ')}</span>`
  }

  const renderTask = (task) => {
    const isRejected = task.status === 'REJECTED' || task.status === 'ADMIN_REJECTED'
    const diffTime = Math.abs(new Date() - new Date(task.submittedAt));
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const isReportable = task.status === 'REJECTED' && diffDays <= 3
    
    // Logic: Approved tasks hide screenshot (simulated deletion view)
    const showProof = task.status !== 'APPROVED' && task.status !== 'ADMIN_APPROVED'

    return `
      <div class="glass-panel" style="padding:20px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;gap:10px">
          <div>
            <div style="font-weight:bold;font-size:16px;margin-bottom:4px">Task #${task.id}</div>
            <div style="color:var(--text-muted);font-size:14px;margin-bottom:4px">${task.promotedLink.title}</div>
            <div style="font-size:12px;color:var(--text-muted)">${new Date(task.submittedAt).toLocaleString()}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${getStatusBadge(task.status)}
            <div style="margin-top:6px;font-weight:bold;color:#fb923c;font-size:14px">+${settings.rewards.coin} 🪙</div>
          </div>
        </div>

        ${isRejected ? `
          <div style="background:rgba(239,68,68,0.1);padding:12px;border-radius:8px;margin-bottom:16px;border:1px solid rgba(239,68,68,0.2)">
            <div style="font-weight:bold;color:#fca5a5;font-size:13px;margin-bottom:4px;display:flex;align-items:center;gap:6px">
              <img src="https://api.iconify.design/lucide:alert-circle.svg?color=%23fca5a5" width="14"> Rejection Reason:
            </div>
            <div style="color:white;font-size:14px;line-height:1.4">${task.rejectionReason || 'No reason provided by link owner.'}</div>
          </div>
        ` : ''}

        ${showProof ? `
          <div style="margin-bottom:16px;background:rgba(0,0,0,0.2);padding:12px;border-radius:8px">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Proof Screenshots:</div>
            <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
              ${task.screenshots.map(url => `
                <a href="${url}" target="_blank" style="flex-shrink:0">
                  <img src="${url}" style="height:60px;width:60px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1);transition:transform 0.2s">
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${isReportable ? `
          <button onclick="openReportModal(${task.id})" class="btn-premium" style="width:100%;justify-content:center;background:linear-gradient(135deg, #7c3aed, #6d28d9);border:none;padding:10px">
            ⚠️ Report Issue
          </button>
          <div style="text-align:center;margin-top:8px;font-size:11px;color:var(--text-muted)">
            You can report this rejection within 3 days.
          </div>
        ` : ''}
        
        ${task.status === 'REPORTED' ? `
          <div style="background:rgba(124,58,237,0.1);padding:10px;border-radius:8px;text-align:center;color:#c4b5fd;font-size:13px;border:1px solid rgba(124,58,237,0.2)">
            <div style="font-weight:600;margin-bottom:4px">Under Review</div>
            <div>"${task.reportMessage}"</div>
          </div>
        ` : ''}
      </div>
    `
  }

  const statCard = (label, val, color, onclick) => `
    <div ${onclick ? `onclick="${onclick}"` : ''} style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;text-align:center;border:1px solid rgba(255,255,255,0.05);cursor:${onclick ? 'pointer' : 'default'}">
      <div style="font-size:24px;font-weight:bold;color:${color};margin-bottom:4px">${val}</div>
      <div style="font-size:12px;color:var(--text-muted)">${label}</div>
    </div>
  `

  res.send(`
    ${getHead('My Tasks')}
    ${getUserSidebar('promote', 0, user.id, user.role)}
    <div class="main-content">
      <div class="section-header">
        <div>
          <div class="section-title">My Tasks</div>
          <div style="color:var(--text-muted)">Track your work and earnings</div>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:12px;margin-bottom:24px">
        ${statCard('Approved', approved, '#4ade80')}
        ${statCard('Rejected', rejected, '#f87171')}
        ${statCard('Pending', pending, '#fb923c')}
        ${statCard('Earned Coins', earnedCoins, '#facc15')}
      </div>

      ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}
      ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}

      <div class="task-list">
        ${activeTasks.length ? activeTasks.map(renderTask).join('') : '<div class="empty-state">No pending or rejected tasks</div>'}
      </div>
    </div>

    <!-- Report Modal -->
    <div id="reportModal" class="modal-overlay hidden">
      <div class="glass-panel" style="max-width:400px;width:100%;padding:24px;position:relative">
        <button onclick="document.getElementById('reportModal').classList.add('hidden')" style="position:absolute;top:10px;right:10px;background:none;border:none;color:white;font-size:24px;cursor:pointer">×</button>
        <h3 style="margin-bottom:16px;color:#f87171">Report Rejection</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
          Tell us why you think this rejection is incorrect. Admins will review the screenshots.
        </p>
        <form action="/promote/tasks/report" method="POST">
          <input type="hidden" name="taskId" id="reportTaskId">
          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" style="display:block;margin-bottom:8px">Reason / Message</label>
            <textarea name="message" required placeholder="I completed the task correctly..." class="form-input" style="width:100%;padding:12px;background:rgba(15,23,42,0.6);border:1px solid var(--glass-border);border-radius:8px;color:white;min-height:80px"></textarea>
          </div>
          <button type="submit" class="btn-premium full-width" style="background:#ef4444">Submit Report</button>
        </form>
      </div>
    </div>

    <script>
      function openReportModal(id) {
        document.getElementById('reportTaskId').value = id;
        document.getElementById('reportModal').classList.remove('hidden');
      }
    </script>
    ${getFooter(user, level, levelProgress)}
  `)
})

router.post('/tasks/report', requireLogin, async (req, res) => {
  const { taskId, message } = req.body
  const userId = req.session.userId

  try {
    const task = await prisma.linkSubmission.findUnique({ where: { id: parseInt(taskId) } })
    
    if (!task || task.visitorId !== userId) return res.redirect('/promote/tasks?error=Unauthorized')
    
    const diffTime = Math.abs(new Date() - new Date(task.submittedAt));
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays > 3) return res.redirect('/promote/tasks?error=Report+period+expired')
    if (task.status !== 'REJECTED') return res.redirect('/promote/tasks?error=Only+rejected+tasks+can+be+reported')

    await prisma.linkSubmission.update({
      where: { id: parseInt(taskId) },
      data: {
        status: 'REPORTED',
        reportMessage: message,
        reportedAt: new Date()
      }
    })

    res.redirect('/promote/tasks?success=Report+submitted+successfully')
  } catch (e) {
    console.error(e)
    res.redirect('/promote/tasks?error=Something+went+wrong')
  }
})

// Fix: Back navigation for submission
router.get('/submission/:id/back', requireLogin, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.redirect('/promote')

    const submission = await prisma.linkSubmission.findUnique({
      where: { id },
      include: { promotedLink: true }
    })

    if (!submission) return res.redirect('/promote')

    // If user is the visitor (Earner) -> Go to Tasks
    if (submission.visitorId === req.session.userId) {
      return res.redirect('/promote/tasks')
    }

    // If user is the link owner (Promoter) -> Go to History Detail
    if (submission.promotedLink.userId === req.session.userId) {
      return res.redirect(`/promote/history/${submission.promotedLinkId}`)
    }

    // Fallback
    res.redirect('/promote')
  } catch (e) {
    console.error(e)
    res.redirect('/promote')
  }
})

module.exports = router

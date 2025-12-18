const express = require('express')
const { prisma } = require('../db/prisma')
const router = express.Router()

// Middleware to ensure user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login')
  next()
}

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

// Helper: Profile Modal
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

const getSidebar = (active) => `
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/dashboard"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/store" class="${active==='store'?'active':''}"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
        <li class="nav-item"><a href="/store/my" class="${active==='mystore'?'active':''}"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
        <li class="nav-item"><a href="/topup"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up</a></li>
        <li class="nav-item"><a href="/guild" class="${active==='guild'?'active':''}"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Guild</a></li>
        <li class="nav-item"><a href="/promote"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Link</a></li>
        <li class="nav-item"><a href="/notifications"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
        <li class="nav-item"><a href="/settings"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
        <li class="nav-item"><a href="#" id="menuProfile"><img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" class="nav-icon"> Profile</a></li>
        <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
  `

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
`

const getFooter = (user, level) => `
    ${getProfileModal(user, level)}
    <script>
      const menuBtn = document.getElementById('mobileMenuBtn');
      const sidebar = document.getElementById('sidebar');
      if(menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
      }

      // Profile Modal Logic
      const profileBtn = document.getElementById('menuProfile');
      const profileModal = document.getElementById('profileModal');
      const profileOverlay = document.getElementById('profileOverlay');
      const profileBack = document.getElementById('profileBack');

      if(profileBtn) {
        profileBtn.addEventListener('click', (e) => {
          e.preventDefault();
          profileModal.style.display = 'flex';
          profileOverlay.classList.remove('hidden');
        });
      }

      function closeProfile() {
        profileModal.style.display = 'none';
        profileOverlay.classList.add('hidden');
      }

      if(profileBack) profileBack.addEventListener('click', closeProfile);
      if(profileOverlay) profileOverlay.addEventListener('click', closeProfile);
    </script>
  </body>
  </html>
`

// GET /store - Show available items
router.get('/', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { items: true }
  })
  
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const level = calculateLevel(taskCount)

  // Get IDs of items user already owns
  const ownedItemIds = user.items.map(ui => ui.itemId)

  // Fetch items NOT owned by user
  const availableItems = await prisma.storeItem.findMany({
    where: {
      id: { notIn: ownedItemIds }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Group by type for display if needed, or just send all
  const avatars = availableItems.filter(i => i.type === 'avatar')
  const guildProfiles = availableItems.filter(i => i.type === 'guild_profile')

  const renderItem = (item) => `
    <div class="store-card">
      <div class="store-card-image ${item.type}">
        <img src="${item.imageUrl}" alt="${item.name}">
      </div>
      <div class="store-card-info">
        <div class="name">${item.name}</div>
        <div class="price-tag ${item.currency}">
          ${item.currency === 'free' ? 'FREE' : item.price + ' ' + (item.currency === 'dk' ? 'Dollar' : 'Taka')}
        </div>
      </div>
      <form action="/store/buy/${item.id}" method="POST">
        <button type="submit" class="btn-store">${item.currency === 'free' ? 'Get for Free' : 'Buy Now'}</button>
      </form>
    </div>
  `

  res.send(`
    ${getHead('Store')}
    <div class="app-layout">
      ${getSidebar('store')}
      <div class="main-content">
        <div class="section-header">
          <div>
            <div class="section-title">Store</div>
            <div style="color:var(--text-muted)">Purchase new looks for your profile</div>
          </div>
          <div class="balance-pill">
            <span>💎 ${user.diamond}</span>
            <span style="color:#22c55e">$ ${user.dk}</span>
            <span style="color:#6366f1">৳ ${user.tk}</span>
          </div>
        </div>

        ${req.query.error ? `<div class="alert error">${req.query.error}</div>` : ''}
        ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

        <div class="store-tabs">
          <button class="store-tab active" onclick="openTab('avatar')">Profile Pictures</button>
          <button class="store-tab" onclick="openTab('guild')">Guild Profile Pictures</button>
        </div>

        <div id="tab-avatar" class="tab-content active">
          <h3 class="section-subtitle">Profile Pictures</h3>
          <div class="store-grid">
            ${avatars.length ? avatars.map(renderItem).join('') : '<div class="empty-state">No new avatars available</div>'}
          </div>
        </div>

        <div id="tab-guild" class="tab-content">
          <h3 class="section-subtitle">Guild Profile Pictures</h3>
          <div class="store-grid">
            ${guildProfiles.length ? guildProfiles.map(renderItem).join('') : '<div class="empty-state">No guild profiles available</div>'}
          </div>
        </div>
      </div>
    </div>
    <script>
      function openTab(type) {
        document.querySelectorAll('.store-tab').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-' + type).classList.add('active');
      }
    </script>
    ${getFooter(user, level)}
  `)
})

// POST /store/buy/:id - Buy an item
router.post('/buy/:id', requireLogin, async (req, res) => {
  const itemId = parseInt(req.params.id)
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  const item = await prisma.storeItem.findUnique({ where: { id: itemId } })

  if (!item) return res.redirect('/store?error=Item+not+found')

  // Check if already owned
  const owned = await prisma.userItem.findFirst({
    where: { userId: user.id, itemId: item.id }
  })
  if (owned) return res.redirect('/store?error=You+already+own+this+item')

  // Check balance
  if (item.currency === 'dk' && user.dk < item.price) {
    return res.redirect('/store?error=Insufficient+Dollar+balance')
  }
  if (item.currency === 'tk' && user.tk < item.price) {
    return res.redirect('/store?error=Insufficient+Taka+balance')
  }

  // Deduct and Add
  try {
    await prisma.$transaction(async (tx) => {
      if (item.currency === 'dk') {
        await tx.user.update({ where: { id: user.id }, data: { dk: { decrement: item.price } } })
      } else if (item.currency === 'tk') {
        await tx.user.update({ where: { id: user.id }, data: { tk: { decrement: item.price } } })
      }
      
      await tx.userItem.create({
        data: {
          userId: user.id,
          itemId: item.id
        }
      })
    })
    return res.redirect('/store?success=Item+purchased+successfully')
  } catch (e) {
    console.error(e)
    return res.redirect('/store?error=Transaction+failed')
  }
})

// GET /store/my - My Store (Inventory)
router.get('/my', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { 
      items: {
        include: { item: true }
      }
    }
  })
  
  const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
  const level = calculateLevel(taskCount)

  const myItems = user.items.map(ui => ui.item)
  const avatars = myItems.filter(i => i.type === 'avatar')
  const guildProfiles = myItems.filter(i => i.type === 'guild_profile')

  const renderMyItem = (item) => {
    const isEquipped = (item.type === 'avatar' && user.currentAvatar === item.imageUrl) || 
                       (item.type === 'banner' && user.currentBanner === item.imageUrl)
    return `
    <div class="store-card owned" style="${isEquipped ? 'border: 1px solid #22c55e;' : ''}">
      <div class="store-card-image ${item.type}">
        <img src="${item.imageUrl}" alt="${item.name}">
      </div>
      <div class="store-card-info">
        <div class="name">${item.name}</div>
        <div class="status-tag" style="${isEquipped ? 'background:#22c55e;color:white' : ''}">${isEquipped ? 'Applied' : 'Owned'}</div>
      </div>
      ${isEquipped 
        ? '<button class="btn-store" disabled style="background:#22c55e;opacity:0.8;cursor:default">Applied</button>'
        : `<form action="/store/equip/${item.id}" method="POST"><button type="submit" class="btn-store btn-apply">Apply</button></form>`
      }
    </div>
  `
  }

  res.send(`
    ${getHead('My Store')}
    <div class="app-layout">
      ${getSidebar('mystore')}
      <div class="main-content">
        <div class="section-header">
          <div>
            <div class="section-title">My Store</div>
            <div style="color:var(--text-muted)">Manage your purchased items</div>
          </div>
        </div>

        ${req.query.success ? `<div class="alert success">${req.query.success}</div>` : ''}

        <div class="store-tabs">
          <button class="store-tab active" onclick="openTab('avatar')">Profile Pictures</button>
          <button class="store-tab" onclick="openTab('guild')">Guild Profile Pictures</button>
        </div>

        <div id="tab-avatar" class="tab-content active">
          <h3 class="section-subtitle">My Profile Pictures</h3>
          <div class="store-grid">
            ${avatars.length ? avatars.map(renderMyItem).join('') : '<div class="empty-state">You haven\'t bought any avatars yet</div>'}
          </div>
        </div>

        <div id="tab-guild" class="tab-content">
          <h3 class="section-subtitle">My Guild Profiles</h3>
          <div class="store-grid">
            ${guildProfiles.length ? guildProfiles.map(renderMyItem).join('') : '<div class="empty-state">You haven\'t bought any guild profiles yet</div>'}
          </div>
        </div>
      </div>
    </div>
    <script>
      function openTab(type) {
        // Update buttons
        document.querySelectorAll('.store-tab').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-' + type).classList.add('active');
      }
    </script>
    ${getFooter(user, level)}
  `)
})

// POST /store/equip/:id - Equip an item
router.post('/equip/:id', requireLogin, async (req, res) => {
  const itemId = parseInt(req.params.id)
  const user = await prisma.user.findUnique({ 
    where: { id: req.session.userId },
    include: { items: true }
  })
  
  // Verify ownership
  const owned = user.items.find(ui => ui.itemId === itemId)
  if (!owned) return res.redirect('/store/my?error=You+do+not+own+this+item')

  const item = await prisma.storeItem.findUnique({ where: { id: itemId } })

  // Update user profile
  if (item.type === 'avatar') {
    await prisma.user.update({ where: { id: user.id }, data: { currentAvatar: item.imageUrl } })
  }
  // Guild Profile equip logic could be added here if needed, but for now we removed banner and added guild profile without equip logic for user profile.
  // if (item.type === 'banner') { ... } removed.

  return res.redirect('/store/my?success=Applied+successfully')
})

module.exports = router
const express = require('express')
const { prisma } = require('../db/prisma')
const router = express.Router()

// Middleware to ensure user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login')
  next()
}

// GET /store - Show available items
router.get('/', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { items: true }
  })

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

  // Helper for navigation
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
        <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
  `

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
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Store - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
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
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

        function openTab(type) {
          document.querySelectorAll('.store-tab').forEach(b => b.classList.remove('active'));
          event.target.classList.add('active');
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          document.getElementById('tab-' + type).classList.add('active');
        }
      </script>
    </body>
    </html>
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

  const myItems = user.items.map(ui => ui.item)
  const avatars = myItems.filter(i => i.type === 'avatar')
  const guildProfiles = myItems.filter(i => i.type === 'guild_profile')

  // Helper for navigation (duplicated for now, could be shared)
  const getSidebar = (active) => `
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/dashboard"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/store" class="${active==='store'?'active':''}"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
        <li class="nav-item"><a href="/store/my" class="${active==='mystore'?'active':''}"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
        <li class="nav-item"><a href="/notifications"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
        <li class="nav-item"><a href="/settings"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
        <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
  `

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
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>My Store - HaMJ toP PaY</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <button class="menu-trigger" id="mobileMenuBtn">☰</button>
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
            <button class="store-tab" onclick="openTab('banner')">Banners</button>
          </div>

          <div id="tab-avatar" class="tab-content active">
            <h3 class="section-subtitle">My Profile Pictures</h3>
            <div class="store-grid">
              ${avatars.length ? avatars.map(renderMyItem).join('') : '<div class="empty-state">You haven\'t bought any avatars yet</div>'}
            </div>
          </div>

          <div id="tab-banner" class="tab-content">
            <h3 class="section-subtitle">My Banners</h3>
            <div class="store-grid">
              ${banners.length ? banners.map(renderMyItem).join('') : '<div class="empty-state">You haven\'t bought any banners yet</div>'}
            </div>
          </div>
        </div>
      </div>
      <script>
        const menuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

        function openTab(type) {
          // Update buttons
          document.querySelectorAll('.store-tab').forEach(b => b.classList.remove('active'));
          event.target.classList.add('active');
          
          // Update content
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          document.getElementById('tab-' + type).classList.add('active');
        }
      </script>
    </body>
    </html>
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
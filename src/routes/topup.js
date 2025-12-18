const express = require('express')
const router = express.Router()
const { prisma } = require('../db/prisma')

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login')
  }
  next()
}

// Helper to render layout
const renderLayout = (title, content, user) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - HaMJ toP PaY</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    /* TopUp Specific Styles */
    .package-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .package-card {
      background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px;
      display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s;
    }
    .package-card:hover { transform: translateY(-4px); border-color: var(--primary); }
    .package-header { display: flex; justify-content: space-between; align-items: center; }
    .diamond-amount { font-size: 24px; font-weight: 800; color: #60a5fa; display: flex; align-items: center; gap: 8px; }
    .package-price { font-size: 20px; font-weight: 600; color: #fff; }
    .country-tag { 
      font-size: 12px; padding: 4px 8px; background: rgba(255,255,255,0.1); 
      border-radius: 4px; color: var(--text-muted); align-self: flex-start;
    }
    .wallet-list { display: flex; flex-direction: column; gap: 16px; }
    .wallet-item {
      background: rgba(15, 23, 42, 0.6); padding: 20px; border-radius: 12px; border: 1px solid var(--glass-border);
      cursor: pointer; display: flex; align-items: center; justify-content: space-between;
      transition: all 0.2s; text-decoration: none; color: white;
    }
    .wallet-item:hover { background: rgba(99, 102, 241, 0.1); border-color: var(--primary); }
    .step-indicator { display: flex; gap: 10px; margin-bottom: 30px; }
    .step { flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; }
    .step.active { background: var(--primary); }
    
    .history-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .history-table th { text-align: left; padding: 12px; color: var(--text-muted); font-size: 14px; border-bottom: 1px solid var(--glass-border); }
    .history-table td { padding: 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-PENDING { background: rgba(234, 179, 8, 0.2); color: #facc15; }
    .status-APPROVED { background: rgba(34, 197, 94, 0.2); color: #86efac; }
    .status-REJECTED { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
  </style>
</head>
<body>
  <button class="menu-trigger" id="mobileMenuBtn">☰</button>
  <div class="app-layout">
    <nav class="sidebar-premium" id="sidebar">
      <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
      <ul class="nav-links">
        <li class="nav-item"><a href="/dashboard"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
        <li class="nav-item"><a href="/topup" class="${title === 'Top Up' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up</a></li>
        <li class="nav-item"><a href="/topup/history" class="${title === 'History' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:history.svg?color=%2394a3b8" class="nav-icon"> History</a></li>
        <li class="nav-item"><a href="/guild"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Guild</a></li>
        <li class="nav-item"><a href="/store"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
        <li class="nav-item"><a href="/store/my"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
        <li class="nav-item"><a href="/leaderboard"><img src="https://api.iconify.design/lucide:trophy.svg?color=%2394a3b8" class="nav-icon"> Leaderboard</a></li>
        <li class="nav-item"><a href="/promote"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Link</a></li>
        <li class="nav-item"><a href="/notifications"><img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications</a></li>
        <li class="nav-item"><a href="/settings"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
        <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
      </ul>
    </nav>
    <div class="main-content">
      <div class="container content">
         ${content}
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
        document.addEventListener('click', (e) => {
          if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          }
        });
    }
  </script>
</body>
</html>
`

// 1. Package List
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    let packages = await prisma.topUpPackage.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } })
    
    // Filter packages based on user country
    packages = packages.filter(pkg => {
      if (pkg.countries === 'All') return true
      if (pkg.countries === 'Bangladesh' && user.country === 'Bangladesh') return true
      return false
    })
    
    const content = `
      <div class="section-header">
        <div>
          <div class="section-title">Select Diamond Package</div>
          <div style="color:var(--text-muted);font-size:14px">Choose the amount you want to top up</div>
        </div>
      </div>
      
      <div class="step-indicator">
        <div class="step active"></div>
        <div class="step"></div>
        <div class="step"></div>
      </div>

      <div class="package-grid">
        ${packages.map(pkg => `
          <div class="package-card">
            <div class="package-header">
              <div class="diamond-amount">
                 <img src="https://api.iconify.design/lucide:gem.svg?color=%2360a5fa" width="24">
                 ${pkg.diamondAmount}
              </div>
              <div class="package-price">${pkg.price} TK</div>
            </div>
            <div class="country-tag">🌏 ${pkg.countries}</div>
            <div style="margin-top: auto;">
              <a href="/topup/${pkg.id}/wallets" class="btn-premium full-width" style="text-align: center; justify-content: center;">Next Step</a>
            </div>
          </div>
        `).join('')}
        ${packages.length === 0 ? '<div class="alert">No packages available at the moment.</div>' : ''}
      </div>
    `
    res.send(renderLayout('Top Up', content, user))
  } catch (error) {
    console.error(error)
    res.status(500).send('Server Error')
  }
})

// 2. Wallet List
router.get('/:pkgId/wallets', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    const pkg = await prisma.topUpPackage.findUnique({ where: { id: parseInt(req.params.pkgId) } })
    
    if (!pkg) return res.redirect('/topup')

    const wallets = await prisma.topUpWallet.findMany({ where: { isActive: true } })

    const content = `
      <div class="section-header">
        <div>
          <div class="section-title">Select Payment Method</div>
          <div style="color:var(--text-muted);font-size:14px">Package: <b>${pkg.diamondAmount} Diamonds</b> for <b>${pkg.price} TK</b></div>
        </div>
        <a href="/topup" class="btn-premium" style="background: rgba(255,255,255,0.1);">Back</a>
      </div>

      <div class="step-indicator">
        <div class="step active"></div>
        <div class="step active"></div>
        <div class="step"></div>
      </div>

      <div class="wallet-list" style="max-width: 600px; margin: 0 auto;">
        ${wallets.map(wallet => `
          <a href="/topup/${pkg.id}/pay/${wallet.id}" class="wallet-item">
            <div style="display: flex; align-items: center; gap: 16px;">
               <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: 50%; display: grid; place-items: center;">
                 <img src="https://api.iconify.design/lucide:wallet.svg?color=white" width="20">
               </div>
               <div>
                 <div style="font-weight: 600; font-size: 16px;">${wallet.name}</div>
                 <div style="font-size: 13px; color: var(--text-muted);">Click to view details</div>
               </div>
            </div>
            <div style="color: var(--primary);">➔</div>
          </a>
        `).join('')}
        ${wallets.length === 0 ? '<div class="alert">No payment methods available.</div>' : ''}
      </div>
    `
    res.send(renderLayout('Top Up', content, user))
  } catch (error) {
    console.error(error)
    res.status(500).send('Server Error')
  }
})

// 3. Payment Details & Form
router.get('/:pkgId/pay/:walletId', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    const pkg = await prisma.topUpPackage.findUnique({ where: { id: parseInt(req.params.pkgId) } })
    const wallet = await prisma.topUpWallet.findUnique({ where: { id: parseInt(req.params.walletId) } })
    
    if (!pkg || !wallet) return res.redirect('/topup')

    const content = `
      <div class="section-header">
        <div>
          <div class="section-title">Confirm Payment</div>
          <div style="color:var(--text-muted);font-size:14px">Complete your transaction</div>
        </div>
      </div>

      <div class="step-indicator">
        <div class="step active"></div>
        <div class="step active"></div>
        <div class="step active"></div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
        
        <!-- Instruction Card -->
        <div class="card3d" style="height: fit-content;">
          <div style="margin-bottom: 20px;">
             <div style="color: var(--text-muted); font-size: 14px; text-transform: uppercase;">You are buying</div>
             <div style="font-size: 24px; font-weight: 700; color: white;">${pkg.diamondAmount} Diamonds</div>
             <div style="font-size: 20px; color: #4ade80; margin-top: 4px;">Price: ${pkg.price} TK</div>
          </div>
          
          <div style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
             <div style="color: var(--text-muted); font-size: 12px;">Send Money To (${wallet.name})</div>
             <div style="font-size: 24px; font-weight: 700; letter-spacing: 1px; color: #facc15; margin: 4px 0;">${wallet.adminNumber}</div>
             <div style="font-size: 12px; color: var(--text-muted);">Personal / Agent</div>
          </div>

          <div style="font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.8); white-space: pre-wrap;">${wallet.instruction}</div>
        </div>

        <!-- Submission Form -->
        <div class="glass-panel" style="padding: 30px;">
           <form action="/topup/submit" method="POST">
             <input type="hidden" name="pkgId" value="${pkg.id}">
             <input type="hidden" name="walletId" value="${wallet.id}">
             
             <div class="form-group">
               <label class="form-label">Sender Number (Your Number)</label>
               <input type="text" name="senderNumber" class="form-input" placeholder="e.g. 017xxxxxxxx" required>
             </div>

             <div class="form-group">
               <label class="form-label">Transaction ID (TrxID)</label>
               <input type="text" name="trxId" class="form-input" placeholder="e.g. 8H3K9L2M" required>
             </div>

             <button type="submit" class="btn-premium full-width" style="margin-top: 10px;">Submit Request</button>
           </form>
        </div>

      </div>
    `
    res.send(renderLayout('Top Up', content, user))
  } catch (error) {
    console.error(error)
    res.status(500).send('Server Error')
  }
})

// 4. Handle Submission
router.post('/submit', requireAuth, async (req, res) => {
  try {
    let { pkgId, walletId, senderNumber, trxId } = req.body
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    
    // Normalize Input
    trxId = trxId ? trxId.trim().toUpperCase() : ''
    senderNumber = senderNumber ? senderNumber.trim() : ''

    if (!trxId || !senderNumber) {
       return res.send(renderLayout('Error', `
         <div class="alert error">Please provide all required details.</div>
         <a href="/topup/${pkgId}/pay/${walletId}" class="btn-premium">Try Again</a>
       `, user))
    }
    
    // Check if TrxID exists (Case Insensitive via normalization)
    const existing = await prisma.topUpRequest.findUnique({ where: { trxId } })
    if (existing) {
       return res.send(renderLayout('Error', `
         <div class="alert error">Transaction ID '${trxId}' already used! Please check again.</div>
         <a href="/topup/${pkgId}/pay/${walletId}" class="btn-premium">Try Again</a>
       `, user))
    }

    await prisma.topUpRequest.create({
      data: {
        userId: user.id,
        packageId: parseInt(pkgId),
        walletId: parseInt(walletId),
        senderNumber,
        trxId
      }
    })

    res.redirect('/topup/history')

  } catch (error) {
    // Handle Unique Constraint Violation if race condition occurs
    if (error.code === 'P2002') {
       const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
       return res.send(renderLayout('Error', `
         <div class="alert error">Transaction ID already used! Please check again.</div>
         <a href="/topup" class="btn-premium">Try Again</a>
       `, user))
    }
    console.error(error)
    res.status(500).send('Server Error')
  }
})

// 5. History
router.get('/history', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    const requests = await prisma.topUpRequest.findMany({
      where: { userId: user.id },
      include: { package: true, wallet: true },
      orderBy: { createdAt: 'desc' }
    })

    const content = `
      <div class="section-header">
        <div>
          <div class="section-title">Top Up History</div>
          <div style="color:var(--text-muted);font-size:14px">Track your purchase status</div>
        </div>
      </div>

      <div class="glass-panel" style="overflow-x: auto;">
        <table class="history-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Price</th>
              <th>TrxID</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(req => `
              <tr>
                <td>
                  <div style="font-weight: 600; color: white;">${req.package.diamondAmount} 💎</div>
                  <div style="font-size: 12px; color: var(--text-muted);">${req.wallet.name}</div>
                </td>
                <td>${req.package.price} TK</td>
                <td style="font-family: monospace;">${req.trxId}</td>
                <td>${new Date(req.createdAt).toLocaleDateString()}</td>
                <td><span class="status-badge status-${req.status}">${req.status}</span></td>
              </tr>
            `).join('')}
            ${requests.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 30px;">No history found</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    `
    res.send(renderLayout('History', content, user))
  } catch (error) {
    console.error(error)
    res.status(500).send('Server Error')
  }
})

module.exports = router

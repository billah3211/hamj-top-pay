const express = require('express')
const { prisma } = require('../db/prisma')
const { getUserSidebar } = require('../utils/sidebar')
const { getSystemSettings } = require('../utils/settings')
const router = express.Router()

// Middleware to ensure login
const requireLogin = (req, res, next) => {
  if (req.session && req.session.userId) return next()
  res.redirect('/login')
}

// Layout Helpers
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
  </head>
  <body>
    <button class="menu-trigger" id="mobileMenuBtn">
      <i class="fas fa-bars"></i>
    </button>
    <div class="app-layout">
`

const getFooter = () => `
    </div>
    <div id="toast-container"></div>
    <script>
      const menuBtn = document.getElementById('mobileMenuBtn');
      const sidebar = document.getElementById('sidebar');
      if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
      
      // Toast Notification Logic
      function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast-notification ' + type;
        toast.innerHTML = \`
          <i class="\${getIconForType(type)}"></i>
          <span>\${message}</span>
        \`;
        
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateX(0)';
        });
        
        // Remove after 3s
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateX(20px)';
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      }

      function getIconForType(type) {
        if(type === 'success') return 'fas fa-check-circle';
        if(type === 'error') return 'fas fa-exclamation-triangle';
        return 'fas fa-info-circle';
      }

      // Check URL params for toasts
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');
      const success = urlParams.get('success');
      if (error) showToast(error, 'error');
      if (success) showToast(success, 'success');
      if (error || success) window.history.replaceState({}, document.title, window.location.pathname);

      // Loading State for Forms
      document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function() {
          const btn = this.querySelector('button[type="submit"]');
          if(btn && !btn.classList.contains('no-loading')) {
            const originalContent = btn.innerHTML;
            btn.style.width = btn.offsetWidth + 'px'; // Maintain width
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
            btn.style.opacity = '0.8';
            btn.style.pointerEvents = 'none';
          }
        });
      });
    </script>
  </body>
  </html>
`

// ----------------------------------------------------------------------
// GUILD ROUTES
// ----------------------------------------------------------------------

router.get('/', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { guild: { include: { leader: true, members: true } } }
  })

  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
  const settings = await getSystemSettings()

  // Get Top Guilds
  const topGuilds = await prisma.guild.findMany({
    take: 10,
    orderBy: { totalEarnings: 'desc' },
    include: { leader: true, members: true }
  })

  // Get My Pending Requests
  const myRequests = await prisma.guildRequest.findMany({
    where: { userId: user.id, status: 'PENDING' },
    include: { guild: true }
  })

  // CSS Styles for the new design
  const customStyles = `
    <style>
      :root {
        --primary: #d946ef;
        --primary-hover: #c026d3;
        --secondary: #06b6d4;
        --accent: #facc15;
        --bg-body: #020617;
        --bg-card: #0f172a;
        --bg-card-hover: #1e293b;
        --text-main: #f8fafc;
        --text-muted: #94a3b8;
        --border-color: rgba(217, 70, 239, 0.3);
        --gradient-primary: linear-gradient(135deg, #d946ef 0%, #8b5cf6 100%);
        --gradient-cyber: linear-gradient(90deg, #d946ef, #06b6d4);
        --glass: rgba(15, 23, 42, 0.8);
        --glass-border: rgba(217, 70, 239, 0.2);
        --shadow-glow: 0 0 20px rgba(217, 70, 239, 0.15);
        --radius-lg: 12px;
        --radius-md: 8px;
        --font-head: 'Rajdhani', sans-serif;
        --font-body: 'Inter', sans-serif;
      }

      /* Global Reset & Base */
      body { 
        font-family: var(--font-body); 
        background: var(--bg-body); 
        color: var(--text-main);
        background-image: 
          linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px);
        background-size: 50px 50px;
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-head);
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .guild-container {
        max-width: 1280px;
        margin: 0 auto;
        padding: 24px;
      }

      /* Animations */
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
      @keyframes glow { 0% { box-shadow: 0 0 5px var(--primary); } 50% { box-shadow: 0 0 20px var(--primary); } 100% { box-shadow: 0 0 5px var(--primary); } }

      /* Components */
      .g-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-glow);
        position: relative;
      }
      .g-card::before {
        content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px;
        background: var(--gradient-cyber); opacity: 0.5;
      }
      .g-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 30px rgba(217, 70, 239, 0.2);
        border-color: var(--primary);
      }

      /* Hero Section */
      .hero-section {
        position: relative;
        margin-bottom: 40px;
        border-radius: 24px;
        overflow: hidden;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-glow);
      }
      
      .hero-banner-wrapper {
        height: 220px;
        width: 100%;
        position: relative;
        overflow: hidden;
      }
      .hero-banner-wrapper::after {
        content: '';
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 100px;
        background: linear-gradient(to top, var(--bg-card), transparent);
      }

      .hero-banner-img { width: 100%; height: 100%; object-fit: cover; }
      .hero-banner-placeholder {
        width: 100%; height: 100%;
        background: var(--gradient-primary);
        position: relative;
      }
      
      .hero-body {
        padding: 0 40px 40px;
        position: relative;
        display: flex;
        align-items: flex-end;
        gap: 32px;
        margin-top: -80px;
      }

      .hero-avatar {
        width: 160px; height: 160px;
        border-radius: 24px;
        border: 4px solid var(--bg-card);
        background: var(--bg-card);
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        overflow: hidden;
        flex-shrink: 0;
        z-index: 2;
        position: relative;
      }
      .hero-avatar::after {
        content: ''; position: absolute; inset: 0;
        border-radius: 24px;
        border: 2px solid var(--primary);
        opacity: 0.5;
      }

      .hero-info {
        flex: 1;
        padding-bottom: 10px;
        z-index: 2;
      }

      .guild-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 4px;
        background: rgba(217, 70, 239, 0.1);
        color: var(--primary);
        font-size: 12px;
        font-family: var(--font-head);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        border: 1px solid var(--primary);
        margin-bottom: 12px;
        box-shadow: 0 0 10px rgba(217, 70, 239, 0.2);
      }

      .hero-title {
        font-size: 48px;
        font-weight: 700;
        margin: 0 0 16px 0;
        line-height: 1;
        text-shadow: 0 0 20px rgba(217, 70, 239, 0.3);
        background: linear-gradient(to right, #fff, #d8b4fe);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .hero-meta {
        display: flex; gap: 24px;
        color: var(--text-muted);
        font-size: 14px; font-weight: 500;
      }
      .hero-meta-item { display: flex; align-items: center; gap: 8px; }
      .hero-meta-item i { color: var(--secondary); text-shadow: 0 0 10px var(--secondary); }

      .hero-actions { padding-bottom: 15px; display: flex; gap: 12px; }

      /* Stats Grid */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        margin-bottom: 48px;
      }

      .stat-box {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 24px;
        display: flex; flex-direction: column; gap: 8px;
        position: relative; overflow: hidden;
        backdrop-filter: blur(10px);
      }
      .stat-box::before {
        content: ''; position: absolute; top: 0; right: 0; width: 80px; height: 80px;
        background: radial-gradient(circle at top right, rgba(217, 70, 239, 0.2), transparent 70%);
      }

      .stat-label {
        font-size: 12px; font-family: var(--font-head);
        text-transform: uppercase; letter-spacing: 1px;
        color: var(--secondary); font-weight: 700;
      }
      
      .stat-value {
        font-size: 36px; font-weight: 700;
        color: var(--text-main);
        display: flex; align-items: baseline; gap: 8px;
        text-shadow: 0 0 15px rgba(255,255,255,0.1);
      }
      
      .stat-sub { font-size: 14px; color: var(--text-muted); font-family: var(--font-body); font-weight: 400; }
      .stat-icon-lg {
        position: absolute; bottom: -10px; right: -10px;
        font-size: 80px; opacity: 0.05; transform: rotate(-15deg);
        color: var(--primary);
      }

      /* Section Headers */
      .section-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 24px; padding-bottom: 16px;
        border-bottom: 1px solid var(--border-color);
      }
      .section-title {
        font-size: 28px; font-weight: 700;
        display: flex; align-items: center; gap: 12px;
        color: var(--text-main);
      }
      .section-title i { color: var(--accent); filter: drop-shadow(0 0 5px var(--accent)); }

      /* Members Grid */
      .members-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 20px;
      }

      .member-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 24px 16px;
        text-align: center;
        transition: all 0.2s;
        position: relative;
      }
      .member-card:hover {
        transform: translateY(-5px);
        border-color: var(--secondary);
        box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
      }
      .member-card::after {
        content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 2px;
        background: linear-gradient(90deg, transparent, var(--secondary), transparent);
        opacity: 0; transition: opacity 0.2s;
      }
      .member-card:hover::after { opacity: 1; }
      
      .member-avatar {
        width: 80px; height: 80px;
        border-radius: 50%;
        margin: 0 auto 16px auto;
        border: 2px solid var(--border-color);
        box-shadow: 0 0 15px rgba(0,0,0,0.3);
        overflow: hidden;
      }
      .member-name {
        font-weight: 700; font-size: 16px; margin-bottom: 4px;
        color: var(--text-main); font-family: var(--font-head); letter-spacing: 0.5px;
      }
      .member-role {
        font-size: 11px; color: var(--secondary);
        background: rgba(6, 182, 212, 0.1);
        padding: 4px 10px; border-radius: 4px;
        display: inline-block; text-transform: uppercase; letter-spacing: 1px;
        border: 1px solid rgba(6, 182, 212, 0.2);
      }
      
      .crown-icon {
        position: absolute; top: 15px; right: 15px;
        color: var(--accent);
        filter: drop-shadow(0 0 5px var(--accent));
        font-size: 18px;
      }

      /* Top Guilds List */
      .top-guilds-list { display: flex; flex-direction: column; gap: 16px; }

      .guild-row {
        display: grid; grid-template-columns: 60px 1fr auto;
        align-items: center; gap: 24px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 16px 24px;
        transition: all 0.2s;
        position: relative; overflow: hidden;
      }
      .guild-row::before {
        content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
        background: var(--border-color); transition: background 0.2s;
      }
      .guild-row:hover {
        transform: translateX(5px);
        background: var(--bg-card-hover);
        border-color: var(--primary);
      }
      .guild-row:hover::before { background: var(--primary); box-shadow: 0 0 10px var(--primary); }

      .rank-display {
        font-size: 28px; font-weight: 700;
        color: var(--text-muted); text-align: center;
      }
      .rank-1 { color: var(--accent); text-shadow: 0 0 15px var(--accent); }
      .rank-2 { color: #e2e8f0; text-shadow: 0 0 10px #e2e8f0; }
      .rank-3 { color: #b45309; text-shadow: 0 0 10px #b45309; }

      .guild-info-cell { display: flex; align-items: center; gap: 20px; }
      .guild-info-avatar {
        width: 56px; height: 56px; border-radius: 12px;
        background: var(--bg-body); overflow: hidden;
        border: 1px solid var(--border-color);
      }

      .guild-stats-row {
        display: flex; gap: 24px;
        font-size: 14px; color: var(--text-muted); margin-top: 4px;
      }
      .guild-stats-item { display: flex; align-items: center; gap: 6px; }

      /* Buttons */
      .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 12px 28px; border-radius: 6px;
        font-weight: 600; font-size: 14px; font-family: var(--font-head);
        text-transform: uppercase; letter-spacing: 1px;
        cursor: pointer; transition: all 0.2s; border: none; text-decoration: none;
      }
      
      .btn-primary {
        background: var(--primary);
        color: white;
        position: relative; z-index: 1; overflow: hidden;
        box-shadow: 0 0 15px rgba(217, 70, 239, 0.4);
      }
      .btn-primary::before {
        content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(90deg, var(--primary), var(--secondary));
        z-index: -1; transition: opacity 0.3s;
      }
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 25px rgba(217, 70, 239, 0.6);
      }
      
      .btn-danger {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.5);
      }
      .btn-danger:hover {
        background: rgba(239, 68, 68, 0.2);
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
      }
      
      .btn-outline {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-main);
      }
      .btn-outline:hover {
        border-color: var(--text-main);
        background: rgba(255,255,255,0.05);
        box-shadow: 0 0 10px rgba(255,255,255,0.1);
      }

      /* Empty State */
      .empty-state {
        text-align: center; padding: 80px 20px;
        background: var(--bg-card); border-radius: 24px;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-glow);
      }
      .empty-icon {
        width: 100px; height: 100px;
        background: rgba(217, 70, 239, 0.1);
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-size: 40px; color: var(--primary); margin: 0 auto 24px auto;
        box-shadow: 0 0 30px rgba(217, 70, 239, 0.2);
      }

      /* Modal */
      .modal-overlay {
        position: fixed; inset: 0;
        background: rgba(2, 6, 23, 0.9);
        backdrop-filter: blur(12px);
        z-index: 1000; display: none;
        align-items: center; justify-content: center;
      }
      .modal-box {
        background: #0f172a;
        border: 1px solid var(--border-color);
        border-radius: 16px;
        width: 90%; max-width: 500px;
        box-shadow: 0 0 50px rgba(0,0,0,0.8);
        animation: modalIn 0.3s ease-out;
      }
      @keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

      /* Toast Notifications */
      #toast-container {
        position: fixed; bottom: 24px; right: 24px; z-index: 10000;
        display: flex; flex-direction: column; gap: 12px;
      }
      .toast-notification {
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid var(--border-color);
        color: var(--text-main);
        padding: 16px 20px; border-radius: 8px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        display: flex; align-items: center; gap: 12px;
        backdrop-filter: blur(10px);
        min-width: 300px;
        transform: translateX(20px); opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-left: 4px solid var(--primary);
      }
      .toast-notification.success { border-left-color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.2); }
      .toast-notification.error { border-left-color: #ef4444; box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); }
      .toast-notification i { font-size: 18px; }
      .toast-notification.success i { color: #10b981; }
      .toast-notification.error i { color: #ef4444; }

      /* Responsive */
      @media (max-width: 768px) {
        .hero-body { flex-direction: column; align-items: center; text-align: center; margin-top: -60px; }
        .hero-meta { justify-content: center; flex-wrap: wrap; }
        .hero-actions { justify-content: center; width: 100%; }
        .hero-actions .btn { flex: 1; }
        .stats-grid { grid-template-columns: 1fr; gap: 16px; }
        .guild-row { grid-template-columns: 40px 1fr; gap: 16px; position: relative; padding: 16px; }
        .guild-row .btn { width: 100%; margin-top: 10px; }
        .guild-actions-cell { grid-column: 1 / -1; }
        .rank-display { font-size: 18px; }
        .guild-info-cell { gap: 12px; }
        .guild-info-avatar { width: 40px; height: 40px; }
      }
    </style>
  `

  let html = getHead('Guilds') + customStyles + getUserSidebar('guild', unreadCount, user.id, user.role, settings) + `
    <div class="main-content">
      <div class="guild-container">
  `

  if (user.guild) {
    // ----------------------------------------------------------------------
    // USER HAS GUILD
    // ----------------------------------------------------------------------
    const memberLimit = user.guild.memberLimit || 50
    const memberCount = user.guild.members.length
    const earnings = user.guild.totalEarnings || 0
    const bannerUrl = user.guild.currentBanner || ''
    const avatarUrl = user.guild.currentAvatar || ''
    
    html += `
      <!-- HERO SECTION -->
      <div class="hero-section">
        <div class="hero-banner-wrapper">
          ${bannerUrl ? 
            `<img src="${bannerUrl}" class="hero-banner-img" alt="Banner">` : 
            `<div class="hero-banner-placeholder"></div>`
          }
        </div>
        <div class="hero-body">
          <div class="hero-avatar">
             ${avatarUrl ? 
               `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` : 
               `<div style="width:100%;height:100%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:64px;color:white;">${user.guild.name[0]}</div>`
             }
          </div>
          <div class="hero-info">
             <div class="guild-badge"><i class="fas fa-shield-alt"></i> ${user.guild.type} Guild</div>
             <h1 class="hero-title">${user.guild.name}</h1>
             <div class="hero-meta">
               <div class="hero-meta-item"><i class="fas fa-crown"></i> Leader: ${user.guild.leader.username}</div>
               <div class="hero-meta-item"><i class="fas fa-calendar-alt"></i> Est. ${new Date(user.guild.createdAt).getFullYear()}</div>
               <div class="hero-meta-item"><i class="fas fa-percentage"></i> ${user.guild.commissionRate}% Commission</div>
             </div>
             ${user.guild.description ? `<p style="margin-top:16px; color:var(--text-muted); line-height:1.6;">${user.guild.description}</p>` : ''}
          </div>
          <div class="hero-actions">
            ${user.id === user.guild.leaderId ? `
               <a href="/guild/manage" class="btn btn-primary"><i class="fas fa-cog"></i> Manage Guild</a>
            ` : `
               <form action="/guild/leave" method="POST" onsubmit="return confirm('Are you sure you want to leave this guild?');">
                  <button type="submit" class="btn btn-danger"><i class="fas fa-sign-out-alt"></i> Leave Guild</button>
               </form>
            `}
          </div>
        </div>
      </div>

      <!-- STATS GRID -->
      <div class="stats-grid">
         <div class="stat-box">
            <div class="stat-label">Total Members</div>
            <div class="stat-value">${memberCount} <span class="stat-sub">/ ${memberLimit}</span></div>
            <div class="stat-sub">Active Players</div>
            <i class="fas fa-users stat-icon-lg"></i>
         </div>
         
         ${user.id === user.guild.leaderId ? `
           <div class="stat-box">
              <div class="stat-label">Total Earnings (BDT)</div>
              <div class="stat-value">৳${earnings.toFixed(2)}</div>
              <div class="stat-sub">Lifetime Revenue</div>
              <i class="fas fa-coins stat-icon-lg"></i>
           </div>
           <div class="stat-box">
              <div class="stat-label">Total Earnings (USD)</div>
              <div class="stat-value">$${(earnings / 120).toFixed(2)}</div>
              <div class="stat-sub">Est. Value (~120৳)</div>
              <i class="fas fa-dollar-sign stat-icon-lg" style="color:#10b981"></i>
           </div>
         ` : ''}

         <div class="stat-box">
            <div class="stat-label">Guild Status</div>
            <div class="stat-value" style="color:#10b981">Active</div>
            <div class="stat-sub">Good Standing</div>
            <i class="fas fa-check-circle stat-icon-lg"></i>
         </div>
      </div>

      <!-- MEMBERS SECTION -->
      <div class="section-header">
         <div class="section-title"><i class="fas fa-users"></i> Guild Roster</div>
         <div style="color:var(--text-muted); font-size:14px;">${memberCount} Members</div>
      </div>
      
      <div class="members-grid">
         ${user.guild.members.map(m => `
           <div class="member-card">
              ${m.id === user.guild.leaderId ? '<i class="fas fa-crown crown-icon"></i>' : ''}
              <div class="member-avatar">
                 ${m.currentAvatar ? 
                   `<img src="${m.currentAvatar}" style="width:100%;height:100%;object-fit:cover;">` : 
                   `<div style="width:100%;height:100%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:32px;color:white;">${m.username[0]}</div>`
                 }
              </div>
              <div class="member-name">${m.username}</div>
              <div class="member-role">${m.id === user.guild.leaderId ? 'Leader' : 'Member'}</div>
           </div>
         `).join('')}
      </div>

    `
  } else {
    // ----------------------------------------------------------------------
    // NO GUILD
    // ----------------------------------------------------------------------
    html += `
      <div class="empty-state">
         <div class="empty-icon"><i class="fas fa-shield-alt"></i></div>
         <h1 style="font-size:32px; font-weight:900; margin-bottom:16px;">Join the Action</h1>
         <p style="color:var(--text-muted); max-width:600px; margin:0 auto 32px auto; font-size:16px; line-height:1.6;">
            Join a guild to unlock exclusive rewards, participate in team events, and earn commissions. 
            Or create your own legacy and lead your team to victory.
         </p>
         <div style="display:flex; gap:16px; justify-content:center;">
            <button onclick="openModal('createGuildModal')" class="btn btn-primary" style="padding:12px 32px; font-size:16px;">
               <i class="fas fa-plus-circle"></i> Create New Guild
            </button>
            <a href="#top-guilds" class="btn btn-outline" style="padding:12px 32px; font-size:16px;">
               <i class="fas fa-search"></i> Browse Guilds
            </a>
         </div>
      </div>
    `
    
    // PENDING REQUESTS
    if (myRequests.length > 0) {
      html += `
        <div class="section-header" style="margin-top:40px;">
           <div class="section-title"><i class="fas fa-clock" style="color:#f59e0b"></i> Pending Applications</div>
        </div>
        <div class="top-guilds-list">
           ${myRequests.map(req => `
             <div class="guild-row">
                <div style="font-size:24px; color:var(--text-muted); text-align:center;"><i class="fas fa-hourglass-half"></i></div>
                <div class="guild-info-cell">
                   <div class="guild-info-avatar">
                      ${req.guild.currentAvatar ? `<img src="${req.guild.currentAvatar}" style="width:100%;height:100%;object-fit:cover;">` : 
                      `<div style="width:100%;height:100%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:24px;color:white;">${req.guild.name[0]}</div>`}
                   </div>
                   <div>
                      <div style="font-weight:700; font-size:18px;">${req.guild.name}</div>
                      <div style="color:var(--text-muted); font-size:13px;">Applied on ${new Date(req.createdAt).toLocaleDateString()}</div>
                   </div>
                </div>
                <div class="guild-actions-cell">
                   <div style="background:rgba(245, 158, 11, 0.1); color:#f59e0b; padding:8px 16px; border-radius:8px; font-weight:600;">
                      Waiting for Approval
                   </div>
                </div>
             </div>
           `).join('')}
        </div>
      `
    }
  }

  // ----------------------------------------------------------------------
  // TOP GUILDS SECTION
  // ----------------------------------------------------------------------
  html += `
    <div id="top-guilds" style="margin-top: 60px;">
      <div class="section-header">
         <div class="section-title"><i class="fas fa-trophy" style="color:#fbbf24"></i> Top Guilds Leaderboard</div>
      </div>
      
      <div class="top-guilds-list">
        ${topGuilds.map((g, index) => `
          <div class="guild-row">
             <div class="rank-display rank-${index + 1}">#${index + 1}</div>
             
             <div class="guild-info-cell">
                <div class="guild-info-avatar">
                   ${g.currentAvatar ? 
                     `<img src="${g.currentAvatar}" style="width:100%;height:100%;object-fit:cover;">` : 
                     `<div style="width:100%;height:100%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:24px;color:white;">${g.name[0]}</div>`
                   }
                </div>
                
                <div style="flex:1;">
                   <div style="font-weight:700; font-size:18px; color:var(--text-main);">${g.name}</div>
                   <div class="guild-stats-row">
                      <span class="guild-stats-item"><i class="fas fa-users"></i> ${g.members.length} / ${g.memberLimit || 50}</span>
                      ${user.id === g.leaderId ? `
                        <span class="guild-stats-item" style="color:#fbbf24"><i class="fas fa-coins"></i> ৳${g.totalEarnings.toFixed(0)}</span>
                        <span class="guild-stats-item" style="color:#10b981"><i class="fas fa-dollar-sign"></i> $${(g.totalEarnings / 120).toFixed(2)}</span>
                      ` : ''}
                      <span class="guild-stats-item" style="color:#818cf8"><i class="fas fa-crown"></i> ${g.leader.username}</span>
                   </div>
                </div>
             </div>

             <div class="guild-actions-cell">
                ${!user.guild ? `
                   ${myRequests.some(r => r.guildId === g.id) ? `
                     <button disabled class="btn btn-outline" style="opacity:0.5; cursor:not-allowed;">Requested</button>
                   ` : `
                     <form action="/guild/join" method="POST">
                       <input type="hidden" name="guildId" value="${g.id}">
                       <button type="submit" class="btn btn-primary">Join Guild</button>
                     </form>
                   `}
                ` : `
                    <span style="color:var(--text-muted); font-size:13px; font-weight:500;">
                       ${user.guild.id === g.id ? '<span style="color:#10b981">Your Guild</span>' : ''}
                    </span>
                `}
             </div>
          </div>
        `).join('')}
      </div>
    </div>

    </div> <!-- End guild-container -->
    </div> <!-- End main-content -->

    <!-- CREATE GUILD MODAL -->
    <div id="createGuildModal" class="modal-overlay" onclick="if(event.target === this) closeModal('createGuildModal')">
       <div class="modal-box">
          <div style="padding:20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
             <h3 style="margin:0; font-size:18px;">Create New Guild</h3>
             <button onclick="closeModal('createGuildModal')" style="background:none; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;"><i class="fas fa-times"></i></button>
          </div>
          
          <div style="padding:20px;">
            <div style="display:flex; background:#0f172a; padding:4px; border-radius:12px; margin-bottom:20px;">
               <button onclick="switchTab('youtuber')" id="tab-youtuber" style="flex:1; padding:10px; background:var(--primary); color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer;">YouTuber</button>
               <button onclick="switchTab('user')" id="tab-user" style="flex:1; padding:10px; background:transparent; color:var(--text-muted); border:none; border-radius:8px; font-weight:600; cursor:pointer;">Regular User</button>
            </div>

            <!-- YOUTUBER FORM -->
            <div id="form-youtuber">
               <div style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.2); padding:15px; border-radius:12px; margin-bottom:20px; font-size:13px; color:#a5b4fc;">
                  <strong>Requirements:</strong><br>
                  • 2,000+ Subscribers<br>
                  • Active Channel related to Gaming/TopUp<br>
                  • Must upload promotional video
               </div>
               <form action="/guild/create" method="POST">
                  <input type="hidden" name="type" value="YOUTUBER">
                  <div style="margin-bottom:15px;">
                     <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px; font-weight:600;">Guild Name</label>
                     <input type="text" name="name" required style="width:100%; background:#0f172a; border:1px solid var(--border-color); padding:12px; border-radius:10px; color:white;">
                  </div>
                  <div style="margin-bottom:20px;">
                     <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px; font-weight:600;">Channel/Video Link</label>
                     <input type="url" name="proof" required style="width:100%; background:#0f172a; border:1px solid var(--border-color); padding:12px; border-radius:10px; color:white;">
                  </div>
                  <button type="submit" class="btn btn-primary" style="width:100%;">Submit for Approval</button>
               </form>
            </div>

            <!-- USER FORM -->
            <div id="form-user" style="display:none;">
               <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); padding:15px; border-radius:12px; margin-bottom:20px; font-size:13px; color:#93c5fd;">
                  <strong>Features:</strong><br>
                  • 50 Member Limit<br>
                  • 1% Commission<br>
                  • Instant Creation (Cost: 500 Diamonds)
               </div>
               <form action="/guild/create" method="POST">
                  <input type="hidden" name="type" value="USER">
                  <div style="margin-bottom:15px;">
                     <label style="display:block; color:var(--text-muted); margin-bottom:6px; font-size:12px; font-weight:600;">Guild Name</label>
                     <input type="text" name="name" required style="width:100%; background:#0f172a; border:1px solid var(--border-color); padding:12px; border-radius:10px; color:white;">
                  </div>
                  <button type="submit" class="btn btn-primary" style="width:100%;">Create Guild (500 <i class="fas fa-gem"></i>)</button>
               </form>
            </div>
          </div>
       </div>
    </div>

    <script>
      function openModal(id) {
        document.getElementById(id).style.display = 'flex';
      }
      function closeModal(id) {
        document.getElementById(id).style.display = 'none';
      }
      function switchTab(type) {
         document.getElementById('form-youtuber').style.display = type === 'youtuber' ? 'block' : 'none';
         document.getElementById('form-user').style.display = type === 'user' ? 'block' : 'none';
         
         const btnYoutuber = document.getElementById('tab-youtuber');
         const btnUser = document.getElementById('tab-user');
         
         if(type === 'youtuber') {
            btnYoutuber.style.background = 'var(--primary)';
            btnYoutuber.style.color = 'white';
            btnUser.style.background = 'transparent';
            btnUser.style.color = 'var(--text-muted)';
         } else {
            btnUser.style.background = 'var(--primary)';
            btnUser.style.color = 'white';
            btnYoutuber.style.background = 'transparent';
            btnYoutuber.style.color = 'var(--text-muted)';
         }
      }
    </script>
    ${getFooter()}
  `

  res.send(html)
})

// ----------------------------------------------------------------------
// MANAGE GUILD (DESIGN & SETTINGS)
// ----------------------------------------------------------------------
router.get('/manage', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { guild: true }
  })

  if (!user.guild || user.guild.leaderId !== user.id) {
    return res.redirect('/guild')
  }

  // Fetch User's Inventory (Avatars & Banners)
  const myItems = await prisma.userItem.findMany({
    where: { userId: user.id },
    include: { item: true }
  })

  const avatars = myItems.filter(i => i.item.type === 'avatar')
  const banners = myItems.filter(i => i.item.type === 'banner')
  
  const [settings, unreadCount, pendingRequests] = await Promise.all([
    getSystemSettings(),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.guildRequest.findMany({
      where: { guildId: user.guild.id, status: 'PENDING' },
      include: { user: true }
    })
  ])

  res.send(`
    ${getHead('Manage Guild')}
    <style>
      :root {
        --primary: #d946ef;
        --primary-hover: #c026d3;
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
      
      body {
        font-family: var(--font-body);
        background: var(--bg-body);
        background-image: 
          linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px);
        background-size: 50px 50px;
        color: var(--text-main);
      }

      /* Include Toast Styles here as well if needed, or rely on global if linked */
       #toast-container {
        position: fixed; bottom: 24px; right: 24px; z-index: 10000;
        display: flex; flex-direction: column; gap: 12px;
      }
      .toast-notification {
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid var(--border-color);
        color: var(--text-main);
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 0 20px rgba(217, 70, 239, 0.15);
        display: flex; align-items: center; gap: 12px;
        backdrop-filter: blur(10px);
        min-width: 300px;
        transform: translateX(20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-left: 4px solid var(--primary);
      }
      .toast-notification.success { border-left-color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.2); }
      .toast-notification.error { border-left-color: #ef4444; box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); }
      .toast-notification i { font-size: 18px; }
      .toast-notification.success i { color: #10b981; }
      .toast-notification.error i { color: #ef4444; }

      .manage-container { max-width: 800px; margin: 0 auto; padding: 24px; }
      
      .section-card { 
        background: var(--bg-card); 
        border-radius: 16px; 
        border: 1px solid var(--border-color); 
        padding: 24px; 
        margin-bottom: 24px;
        box-shadow: 0 0 20px rgba(0,0,0,0.2);
      }
      
      .section-title { 
        font-size: 20px; 
        font-family: var(--font-head);
        font-weight: 700; 
        color: var(--text-main); 
        margin-bottom: 24px; 
        display: flex; align-items: center; gap: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-color);
      }
      
      .form-group { margin-bottom: 24px; }
      .form-label { display: block; color: var(--text-muted); font-size: 13px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      
      .form-input { 
        width: 100%; 
        background: #020617; 
        border: 1px solid var(--border-color); 
        padding: 12px 16px; 
        border-radius: 8px; 
        color: var(--text-main); 
        font-family: inherit;
        transition: all 0.2s;
      }
      .form-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 10px rgba(217, 70, 239, 0.2);
      }
      
      .item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 16px; }
      .item-select-label { cursor: pointer; position: relative; }
      .item-select-input { display: none; }
      
      .item-preview { 
        border: 2px solid var(--border-color); 
        border-radius: 12px; 
        overflow: hidden; 
        transition: all 0.2s; 
        position: relative;
        background: #020617;
      }
      .item-preview:hover {
        transform: translateY(-2px);
        border-color: var(--secondary);
        box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);
      }
      
      .item-select-input:checked + .item-preview { 
        border-color: var(--primary); 
        box-shadow: 0 0 15px rgba(217, 70, 239, 0.4); 
      }
      .item-select-input:checked + .item-preview::after {
        content: '\f00c';
        font-family: 'Font Awesome 6 Free';
        font-weight: 900;
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        background: var(--primary);
        width: 24px; height: 24px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
      }
      
      .btn-save { 
        background: var(--primary); 
        color: white; 
        border: none; 
        padding: 14px 24px; 
        border-radius: 8px; 
        font-weight: 700; 
        cursor: pointer; 
        width: 100%; 
        font-family: var(--font-head);
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all 0.2s;
        box-shadow: 0 0 15px rgba(217, 70, 239, 0.3);
      }
      .btn-save:hover {
        background: var(--primary-hover);
        transform: translateY(-2px);
        box-shadow: 0 0 25px rgba(217, 70, 239, 0.5);
      }
      
      .back-link { 
        display: inline-flex; align-items: center; gap: 8px; 
        color: var(--text-muted); 
        text-decoration: none; 
        margin-bottom: 24px; 
        font-size: 14px; 
        font-weight: 500;
        transition: color 0.2s;
      }
      .back-link:hover { color: var(--primary); }
    </style>
    ${getUserSidebar('guild', unreadCount, user.id, user.role, settings)}
    <div class="main-content">
       <div class="manage-container">
          <a href="/guild" class="back-link"><i class="fas fa-arrow-left"></i> Back to Guild Dashboard</a>
          
          <!-- MEMBER REQUESTS -->
          <div class="section-card">
             <div class="section-title"><i class="fas fa-user-plus" style="color:#facc15"></i> Member Requests (${pendingRequests.length})</div>
             
             ${pendingRequests.length === 0 ? `
                <div style="text-align:center; padding:20px; color:var(--text-muted);">No pending requests</div>
             ` : `
                <div style="display:flex; flex-direction:column; gap:12px;">
                   ${pendingRequests.map(req => `
                      <div style="display:flex; justify-content:space-between; align-items:center; background:#020617; padding:12px 16px; border-radius:8px; border:1px solid var(--border-color);">
                         <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:40px; height:40px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; font-weight:bold; color:white;">
                               ${req.user.username[0]}
                            </div>
                            <div>
                               <div style="font-weight:700; color:var(--text-main);">${req.user.username}</div>
                               <div style="font-size:12px; color:var(--text-muted);">Requested: ${new Date(req.createdAt).toLocaleDateString()}</div>
                            </div>
                         </div>
                         <div style="display:flex; gap:8px;">
                            <form action="/guild/request/approve" method="POST" style="margin:0;">
                               <input type="hidden" name="requestId" value="${req.id}">
                               <button type="submit" style="background:#10b981; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;"><i class="fas fa-check"></i></button>
                            </form>
                            <form action="/guild/request/reject" method="POST" style="margin:0;">
                               <input type="hidden" name="requestId" value="${req.id}">
                               <button type="submit" style="background:#ef4444; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;"><i class="fas fa-times"></i></button>
                            </form>
                         </div>
                      </div>
                   `).join('')}
                </div>
             `}
          </div>

          <div class="section-card">
             <div class="section-title"><i class="fas fa-paint-brush" style="color:#ec4899"></i> Appearance</div>
             <form action="/guild/update-design" method="POST">
                
                <!-- AVATAR -->
                <div class="form-group">
                   <label class="form-label">Guild Avatar</label>
                   <div class="item-grid">
                      <label class="item-select-label">
                         <input type="radio" name="avatar" value="" class="item-select-input" ${!user.guild.currentAvatar ? 'checked' : ''}>
                         <div class="item-preview" style="aspect-ratio:1; background:#334155; display:flex; align-items:center; justify-content:center;">
                            <span style="font-weight:bold; font-size:24px; color:#94a3b8;">${user.guild.name[0]}</span>
                         </div>
                      </label>
                      ${avatars.map(a => `
                        <label class="item-select-label">
                           <input type="radio" name="avatar" value="${a.item.imageUrl}" class="item-select-input" ${user.guild.currentAvatar === a.item.imageUrl ? 'checked' : ''}>
                           <div class="item-preview" style="aspect-ratio:1;">
                              <img src="${a.item.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
                           </div>
                        </label>
                      `).join('')}
                   </div>
                </div>

                <!-- BANNER -->
                <div class="form-group">
                   <label class="form-label">Guild Banner</label>
                   <div class="item-grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
                      <label class="item-select-label">
                         <input type="radio" name="banner" value="" class="item-select-input" ${!user.guild.currentBanner ? 'checked' : ''}>
                         <div class="item-preview" style="height:80px; background:linear-gradient(45deg, #1e293b, #334155);"></div>
                      </label>
                      ${banners.map(b => `
                        <label class="item-select-label">
                           <input type="radio" name="banner" value="${b.item.imageUrl}" class="item-select-input" ${user.guild.currentBanner === b.item.imageUrl ? 'checked' : ''}>
                           <div class="item-preview" style="height:80px;">
                              <img src="${b.item.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
                           </div>
                        </label>
                      `).join('')}
                   </div>
                </div>
                
                <button type="submit" class="btn-save">Save Appearance</button>
             </form>
          </div>

          <div class="section-card">
             <div class="section-title"><i class="fas fa-cog" style="color:#6366f1"></i> General Settings</div>
             <form action="/guild/update-info" method="POST">
                <div class="form-group">
                   <label class="form-label">Description</label>
                   <textarea name="description" rows="4" class="form-input">${user.guild.description || ''}</textarea>
                </div>
                ${user.guild.type === 'YOUTUBER' ? `
                   <div class="form-group">
                      <label class="form-label">Featured Video URL</label>
                      <input type="url" name="videoLink" value="${user.guild.videoLink || ''}" class="form-input">
                   </div>
                ` : ''}
                <button type="submit" class="btn-save">Update Information</button>
             </form>
          </div>
       </div>
    </div>
    ${getFooter()}
  `)
})

router.post('/update-design', requireLogin, async (req, res) => {
  const { avatar, banner } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })
  
  if (!user.guild || user.guild.leaderId !== user.id) return res.redirect('/guild')

  const updateData = {}
  if (avatar !== undefined) updateData.currentAvatar = avatar || null
  if (banner !== undefined) updateData.currentBanner = banner || null

  await prisma.guild.update({
    where: { id: user.guild.id },
    data: updateData
  })

  res.redirect('/guild/manage?success=Appearance+updated')
})

router.post('/update-info', requireLogin, async (req, res) => {
  const { description, videoLink } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })
  
  if (!user.guild || user.guild.leaderId !== user.id) return res.redirect('/guild')

  await prisma.guild.update({
    where: { id: user.guild.id },
    data: { 
      description,
      videoLink: videoLink || null
    }
  })

  res.redirect('/guild/manage?success=Settings+updated')
})

// ----------------------------------------------------------------------
// GUILD ACTIONS
// ----------------------------------------------------------------------

router.post('/create', requireLogin, async (req, res) => {
  const { name, type, proof } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })

  if (user.guild) return res.redirect('/guild?error=Already+in+a+guild')

  try {
    if (type === 'USER') {
      if (user.diamonds < 500) return res.redirect('/guild?error=Not+enough+diamonds')
      
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { diamonds: { decrement: 500 } }
        }),
        prisma.guild.create({
          data: {
            name,
            type: 'USER',
            leaderId: user.id,
            status: 'APPROVED',
            memberLimit: 50,
            commissionRate: 1.0,
            members: { connect: { id: user.id } }
          }
        })
      ])
    } else {
      await prisma.guild.create({
        data: {
          name,
          type: 'YOUTUBER',
          leaderId: user.id,
          status: 'PENDING',
          videoLink: proof,
          memberLimit: 100,
          commissionRate: 2.0,
          members: { connect: { id: user.id } }
        }
      })
    }
    res.redirect('/guild?success=Guild+created+successfully')
  } catch (err) {
    console.error(err)
    res.redirect('/guild?error=Creation+failed.+Name+might+be+taken.')
  }
})

router.post('/join', requireLogin, async (req, res) => {
  const { guildId } = req.body
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })

    if (user.guild) return res.redirect('/guild?error=You+are+already+in+a+guild')

    const existing = await prisma.guildRequest.findFirst({
      where: { userId: user.id, status: 'PENDING' }
    })
    if (existing) return res.redirect('/guild?error=You+have+a+pending+request')

    // Check if guild exists and is not full
    const guild = await prisma.guild.findUnique({
      where: { id: parseInt(guildId) },
      include: { members: true }
    })
    
    if (!guild) return res.redirect('/guild?error=Guild+not+found')
    if (guild.members.length >= (guild.memberLimit || 50)) return res.redirect('/guild?error=Guild+is+full')

    await prisma.guildRequest.create({
      data: {
        userId: user.id,
        guildId: parseInt(guildId)
      }
    })

    // Notify Leader
    await prisma.notification.create({
      data: {
        userId: guild.leaderId,
        message: `${user.username} wants to join your guild "${guild.name}"`,
        type: 'info'
      }
    })

    res.redirect('/guild?success=Request+sent+successfully')
  } catch (error) {
    console.error('Join Error:', error)
    res.redirect('/guild?error=Failed+to+join+guild')
  }
})

router.post('/leave', requireLogin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })
  if (!user.guild) return res.redirect('/guild')
  
  if (user.guild.leaderId === user.id) return res.redirect('/guild?error=Leader+cannot+leave.+You+must+delete+the+guild+or+transfer+ownership.')

  await prisma.user.update({
    where: { id: user.id },
    data: { guildId: null }
  })

  res.redirect('/guild?success=Left+guild+successfully')
})

router.post('/request/approve', requireLogin, async (req, res) => {
  const { requestId } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })
  
  if (!user.guild || user.guild.leaderId !== user.id) return res.redirect('/guild')

  const request = await prisma.guildRequest.findUnique({ where: { id: parseInt(requestId) }, include: { guild: true } })
  
  if (!request || request.guildId !== user.guild.id || request.status !== 'PENDING') {
    return res.redirect('/guild/manage?error=Invalid+request')
  }

  // Check member limit
  const memberCount = await prisma.user.count({ where: { guildId: user.guild.id } })
  if (memberCount >= (user.guild.memberLimit || 50)) {
    return res.redirect('/guild/manage?error=Guild+is+full')
  }

  await prisma.$transaction([
    prisma.guildRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED' }
    }),
    prisma.user.update({
      where: { id: request.userId },
      data: { guildId: user.guild.id }
    }),
    prisma.notification.create({
      data: {
        userId: request.userId,
        message: `Your request to join ${user.guild.name} has been approved!`,
        type: 'success'
      }
    })
  ])

  res.redirect('/guild/manage?success=Member+approved')
})

router.post('/request/reject', requireLogin, async (req, res) => {
  const { requestId } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { guild: true } })
  
  if (!user.guild || user.guild.leaderId !== user.id) return res.redirect('/guild')

  const request = await prisma.guildRequest.findUnique({ where: { id: parseInt(requestId) } })
  
  if (!request || request.guildId !== user.guild.id || request.status !== 'PENDING') {
    return res.redirect('/guild/manage?error=Invalid+request')
  }

  await prisma.$transaction([
    prisma.guildRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED' }
    }),
    prisma.notification.create({
      data: {
        userId: request.userId,
        message: `Your request to join ${user.guild.name} has been rejected.`,
        type: 'error'
      }
    })
  ])

  res.redirect('/guild/manage?success=Request+rejected')
})

module.exports = router

const getUserSidebar = (active, unreadCount = 0, userId = null, role = 'USER', config = {}) => {
  const siteName = config.site_name || 'HaMJ toP PaY'
  const logoUrl = config.site_logo
  const showLogo = config.show_logo === 'true'

  const brandHtml = showLogo && logoUrl 
    ? `<img src="${logoUrl}" style="height:40px;width:auto;max-width:180px;object-fit:contain">`
    : `<span>H</span> ${siteName}`

  return `
  <nav class="sidebar-premium" id="sidebar">
    <div class="brand-logo">${brandHtml}</div>
    <ul class="nav-links">
      <li class="nav-item"><a href="/dashboard" class="${active === 'dashboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
      <li class="nav-item"><a href="/topup" class="${active === 'topup' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up</a></li>
      <li class="nav-item"><a href="/topup/history" class="${active === 'history' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:history.svg?color=%2394a3b8" class="nav-icon"> History</a></li>
      <li class="nav-item"><a href="/guild" class="${active === 'guild' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Guild</a></li>
      <li class="nav-item"><a href="/store" class="${active === 'store' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
      <li class="nav-item"><a href="/store/my" class="${active === 'my-store' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
      <li class="nav-item"><a href="/leaderboard" class="${active === 'leaderboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:trophy.svg?color=%2394a3b8" class="nav-icon"> Leaderboard</a></li>
      <li class="nav-item"><a href="/promote" class="${active === 'promote' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Link</a></li>
      ${(role === 'ADMIN' || role === 'SUPER_ADMIN') ? `<li class="nav-item"><a href="/admin/dashboard"><img src="https://api.iconify.design/lucide:shield.svg?color=%23ef4444" class="nav-icon" style="color:#ef4444"> Admin Panel</a></li>` : ''}
      <li class="nav-item"><a href="/profile" class="${active === 'profile' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:user.svg?color=%2394a3b8" class="nav-icon"> Profile</a></li>
      <li class="nav-item" style="position:relative">
        <a href="/notifications" class="${active === 'notifications' ? 'active' : ''}">
          <img src="https://api.iconify.design/lucide:bell.svg?color=%2394a3b8" class="nav-icon"> Notifications
          ${unreadCount > 0 ? `<span style="position:absolute; right:12px; top:12px; width:8px; height:8px; background:#ef4444; border-radius:50%; box-shadow:0 0 5px #ef4444;"></span>` : ''}
        </a>
      </li>
      <li class="nav-item"><a href="/settings" class="${active === 'settings' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:settings.svg?color=%2394a3b8" class="nav-icon"> Settings</a></li>
      <li class="nav-item" style="margin-top:auto"><a href="/auth/logout"><img src="https://api.iconify.design/lucide:log-out.svg?color=%2394a3b8" class="nav-icon"> Logout</a></li>
    </ul>
  </nav>
  ${userId ? `
    <link rel="stylesheet" href="/css/chat.css">
    <script>
      window.CURRENT_USER_ID = ${userId};
      window.CURRENT_USER_ROLE = '${role}';
    </script>
    <script src="/socket.io/socket.io.js"></script>
    <script src="/js/chat.js" defer></script>
  ` : ''}
`
}

module.exports = { getUserSidebar }

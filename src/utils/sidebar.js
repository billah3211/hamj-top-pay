const getUserSidebar = (active, unreadCount = 0) => `
  <nav class="sidebar-premium" id="sidebar">
    <div class="brand-logo"><span>H</span> HaMJ toP PaY</div>
    <ul class="nav-links">
      <li class="nav-item"><a href="/dashboard" class="${active === 'dashboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:layout-dashboard.svg?color=%2394a3b8" class="nav-icon"> Dashboard</a></li>
      <li class="nav-item"><a href="/topup" class="${active === 'topup' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:gem.svg?color=%2394a3b8" class="nav-icon"> Top Up</a></li>
      <li class="nav-item"><a href="/topup/history" class="${active === 'history' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:history.svg?color=%2394a3b8" class="nav-icon"> History</a></li>
      <li class="nav-item"><a href="/guild" class="${active === 'guild' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:users.svg?color=%2394a3b8" class="nav-icon"> Guild</a></li>
      <li class="nav-item"><a href="/store" class="${active === 'store' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:shopping-bag.svg?color=%2394a3b8" class="nav-icon"> Store</a></li>
      <li class="nav-item"><a href="/store/my" class="${active === 'my-store' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:briefcase.svg?color=%2394a3b8" class="nav-icon"> My Store</a></li>
      <li class="nav-item"><a href="/leaderboard" class="${active === 'leaderboard' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:trophy.svg?color=%2394a3b8" class="nav-icon"> Leaderboard</a></li>
      <li class="nav-item"><a href="/promote" class="${active === 'promote' ? 'active' : ''}"><img src="https://api.iconify.design/lucide:megaphone.svg?color=%2394a3b8" class="nav-icon"> Promote Link</a></li>
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
`

module.exports = { getUserSidebar }

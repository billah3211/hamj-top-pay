async function openUserProfile(username) {
    const modal = document.getElementById('userProfileModal');
    modal.style.display = 'flex';
    document.getElementById('upName').innerText = 'Loading...';
    try {
        const res = await fetch('/api/profile/' + username);
        const user = await res.json();
        if(user.error) { alert(user.error); modal.style.display = 'none'; return; }
        document.getElementById('upName').innerText = user.firstName + ' ' + user.lastName;
        document.getElementById('upUsername').innerText = '@' + user.username;
        document.getElementById('upEmail').innerText = '📧 ' + user.email;
        document.getElementById('upJoined').innerText = '📅 Joined: ' + new Date(user.createdAt).toLocaleDateString();
        document.getElementById('upAvatar').src = user.currentAvatar || 'https://api.iconify.design/lucide:user.svg?color=white';
        document.getElementById('upCountry').innerText = user.country;
        document.getElementById('upBio').innerHTML = user.bio || '<span style="opacity:0.5">No bio added</span>';
        document.getElementById('upWebsite').innerHTML = user.website ? '<a href="' + user.website + '" target="_blank" style="color:#60a5fa">' + user.website + '</a>' : '<span style="opacity:0.5">No website</span>';
        document.getElementById('upSocial').innerHTML = user.social || '<span style="opacity:0.5">No social links</span>';
    } catch(e) { console.error(e); alert('Failed to load profile'); modal.style.display = 'none'; }
}

// Simple Client-Side Search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('memberSearchInput');
    const memberList = document.getElementById('memberList');
    
    if(searchInput && memberList) {
        const members = memberList.getElementsByClassName('member-card');
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            Array.from(members).forEach(member => {
                const username = member.getAttribute('data-username');
                if (username.includes(term)) {
                    member.style.display = 'flex';
                } else {
                    member.style.display = 'none';
                }
            });
        });
    }
});
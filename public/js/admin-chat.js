const socket = io();
socket.emit('join_chat', { userId: 'ADMIN', role: 'ADMIN' });

const sessionsList = document.getElementById('sessionsList');
const chatArea = document.getElementById('chatArea');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
let currentSessionId = null;
let currentUserId = null;

// Load Sessions
async function loadSessions() {
  try {
    const res = await fetch('/admin/api/sessions');
    const sessions = await res.json();
    renderSessions(sessions);
  } catch (e) {
    console.error(e);
  }
}

function renderSessions(sessions) {
  sessionsList.innerHTML = '';
  sessions.forEach(session => {
    const el = document.createElement('div');
    el.className = `session-item ${currentSessionId === session.id ? 'active' : ''}`;
    el.innerHTML = `
      <div class="user-name">${session.user.firstName} ${session.user.lastName}</div>
      <div class="status-badge ${session.status.toLowerCase()}">${session.status.replace('_', ' ')}</div>
    `;
    el.onclick = () => selectSession(session);
    sessionsList.appendChild(el);
  });
}

async function selectSession(session) {
  currentSessionId = session.id;
  currentUserId = session.userId;
  document.getElementById('chatTitle').innerText = `Chat with ${session.user.firstName}`;
  chatArea.style.display = 'flex';
  
  // Load Messages
  const res = await fetch(`/admin/api/messages/${session.id}`);
  const messages = await res.json();
  renderMessages(messages);
  
  // Update UI classes
  Array.from(sessionsList.children).forEach(child => child.classList.remove('active'));
  // We'd need to find the specific child, but reloading sessions is easier to keep state sync
  // loadSessions(); 
}

function renderMessages(messages) {
  chatMessages.innerHTML = '';
  messages.forEach(msg => appendMessage(msg));
  scrollToBottom();
}

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.sender}`;
  div.innerText = msg.message;
  chatMessages.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send
sendBtn.onclick = sendMessage;
chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendMessage() };

function sendMessage() {
  const text = chatInput.value.trim();
  if(!text || !currentSessionId) return;
  
  // Emit to socket
  socket.emit('send_message', {
    userId: currentUserId,
    message: text,
    sender: 'admin'
  });
  
  appendMessage({ sender: 'admin', message: text });
  chatInput.value = '';
}

// Socket Events
socket.on('new_support_request', (data) => {
  // Play sound or notification
  // alert('New Support Request!');
  loadSessions();
});

socket.on('receive_admin_message', (data) => {
  // If viewing this user, append message
  if (currentUserId == data.userId) {
    appendMessage({ sender: 'user', message: data.message });
  } else {
    // Refresh list
    loadSessions();
  }
});

// Initial Load
loadSessions();
setInterval(loadSessions, 30000); // Poll every 30s as backup

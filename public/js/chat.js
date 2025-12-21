// Initialize Socket.io
const socket = io();

// UI Elements
const chatBtn = document.createElement('div');
chatBtn.className = 'chat-widget-btn';
chatBtn.innerHTML = '<img src="https://api.iconify.design/lucide:message-circle.svg?color=white" width="30" height="30">';
document.body.appendChild(chatBtn);

const chatWindow = document.createElement('div');
chatWindow.className = 'chat-widget-window';
chatWindow.innerHTML = `
  <div class="chat-header">
    <h3>Hamj Assistant</h3>
    <button class="close-chat">✕</button>
  </div>
  <div class="chat-messages" id="chatMessages">
    <div class="message ai">Hello! How can I help you today?</div>
  </div>
  <div class="chat-input-area">
    <input type="text" class="chat-input" placeholder="Type a message..." id="chatInput">
    <button class="chat-send-btn" id="sendBtn">
      <img src="https://api.iconify.design/lucide:send.svg?color=white" width="16" height="16">
    </button>
  </div>
`;
document.body.appendChild(chatWindow);

// Logic
const messagesContainer = document.getElementById('chatMessages');
const input = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
let isOpen = false;

// Toggle Chat
chatBtn.addEventListener('click', () => {
  isOpen = !isOpen;
  chatWindow.style.display = isOpen ? 'flex' : 'none';
  if (isOpen) {
    input.focus();
    scrollToBottom();
  }
});

chatWindow.querySelector('.close-chat').addEventListener('click', () => {
  isOpen = false;
  chatWindow.style.display = 'none';
});

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  msgDiv.innerText = text;
  messagesContainer.appendChild(msgDiv);
  scrollToBottom();
}

// Socket Connection
// window.CURRENT_USER_ID and window.CURRENT_USER_ROLE should be injected by the server
const USER_ID = window.CURRENT_USER_ID; 
const USER_ROLE = window.CURRENT_USER_ROLE || 'USER';

if (USER_ID) {
  socket.emit('join_chat', { userId: USER_ID, role: USER_ROLE });

  // Send Message
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    
    appendMessage(text, 'user');
    input.value = '';
    
    socket.emit('send_message', {
      userId: USER_ID,
      message: text,
      sender: 'user'
    });
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Receive Message
  socket.on('receive_message', (data) => {
    appendMessage(data.message, data.sender);
  });
} else {
  // If not logged in
  appendMessage("Please login to chat with support.", "ai");
  input.disabled = true;
  input.placeholder = "Login required";
}

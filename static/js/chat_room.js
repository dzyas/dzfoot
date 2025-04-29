// كود JavaScript محسن لغرفة الدردشة

document.addEventListener('DOMContentLoaded', function() {
    // تكوين Socket.IO
    const socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
    });

    // عناصر DOM
    const elements = {
        joinArea: document.getElementById('join-area'),
        chatArea: document.getElementById('chat-area'),
        usernameInput: document.getElementById('username-input'),
        joinButton: document.getElementById('join-button'),
        messagesBox: document.getElementById('messages-box'),
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        statusMessage: document.getElementById('status-message'),
        usersList: document.getElementById('users-list')
    };

    let currentUsername = '';
    let typingTimeout;
    let reconnectionAttempts = 0;

    // مستمعو الأحداث
    setupEventListeners();
    setupSocketListeners();

    function setupEventListeners() {
        elements.joinButton.addEventListener('click', joinRoom);
        elements.usernameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinRoom();
            }
        });

        elements.sendButton.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        elements.messageInput.addEventListener('input', handleTyping);
    }

    function setupSocketListeners() {
        // أحداث الاتصال
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectionError);

        // أحداث الدردشة
        socket.on('server_status', handleServerStatus);
        socket.on('join_response', handleJoinResponse);
        socket.on('message', handleIncomingMessage);
        socket.on('status', handleStatusMessage);
        socket.on('user_list_update', updateUsersList);
        socket.on('typing', handleUserTyping);
    }

    function handleConnect() {
        console.log('متصل بالخادم');
        reconnectionAttempts = 0;
        elements.statusMessage.textContent = 'متصل بالخادم';
        elements.statusMessage.className = 'status-message connected';

        const storedUsername = localStorage.getItem('chatroomUsername');
        if (storedUsername && elements.joinArea.style.display !== 'none') {
            elements.usernameInput.value = storedUsername;
            setTimeout(joinRoom, 500);
        }
    }

    function handleDisconnect() {
        console.log('انقطع الاتصال بالخادم');
        elements.statusMessage.textContent = 'محاولة إعادة الاتصال...';
        elements.statusMessage.className = 'status-message disconnected';
        displaySystemMessage('انقطع الاتصال بالخادم. جاري المحاولة مرة أخرى...');
    }

    function handleConnectionError(error) {
        console.error('خطأ في الاتصال:', error);
        reconnectionAttempts++;

        if (reconnectionAttempts > 5) {
            elements.statusMessage.textContent = 'تعذر الاتصال بالخادم';
            displaySystemMessage('تعذر الاتصال بالخادم. يرجى تحديث الصفحة.');
        }
    }

    function handleServerStatus(data) {
        console.log('حالة الخادم:', data);
        if (data.status === 'connected') {
            showToast(data.message, 'success');
        }
    }

    function handleJoinResponse(data) {
        if (data.success) {
            currentUsername = data.username;
            localStorage.setItem('chatroomUsername', currentUsername);

            elements.joinArea.style.display = 'none';
            elements.chatArea.style.display = 'flex';
            elements.messageInput.focus();

            displaySystemMessage(`مرحباً بك في الغرفة يا ${escapeHTML(currentUsername)}!`);
            elements.statusMessage.textContent = `في الغرفة: ${escapeHTML(data.room)}`;
        } else {
            showToast(data.msg, 'error');
            elements.joinButton.disabled = false;
        }
    }

    function handleIncomingMessage(data) {
        const messageType = data.username === currentUsername ? 'self' : 'user';
        displayMessage(data.message, messageType, data.username);
        elements.messagesBox.scrollTop = elements.messagesBox.scrollHeight;
    }

    function handleStatusMessage(data) {
        displaySystemMessage(data.msg);
    }

    function handleUserTyping(data) {
        if (data.username !== currentUsername) {
            const typingIndicator = document.getElementById('typing-indicator');
            typingIndicator.textContent = `${data.username} يكتب...`;
            typingIndicator.style.display = 'block';

            setTimeout(() => {
                typingIndicator.style.display = 'none';
            }, 1000);
        }
    }

    function updateUsersList(users) {
        elements.usersList.innerHTML = '';
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.innerHTML = `
                <span class="user-status ${user.status}"></span>
                <span class="user-name">${escapeHTML(user.username)}</span>
            `;
            elements.usersList.appendChild(userElement);
        });
    }

    function joinRoom() {
        const username = elements.usernameInput.value.trim();
        if (!username) {
            showToast('يرجى إدخال اسم مستخدم', 'error');
            return;
        }

        elements.joinButton.disabled = true;
        elements.joinButton.textContent = 'جاري الانضمام...';

        socket.emit('join', {
            username: username,
            room: 'default_room'
        });

        setTimeout(() => {
            if (elements.joinButton.disabled) {
                elements.joinButton.disabled = false;
                elements.joinButton.textContent = 'انضمام';
                showToast('انتهت مهلة الانضمام', 'error');
            }
        }, 5000);
    }

    function sendMessage() {
        const message = elements.messageInput.value.trim();
        if (!message || !currentUsername) return;

        socket.emit('message', { message: message });
        elements.messageInput.value = '';
        elements.messageInput.focus();
    }

    function handleTyping() {
        if (!currentUsername) return;

        socket.emit('typing', { username: currentUsername });

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stop_typing', { username: currentUsername });
        }, 1000);
    }

    function displayMessage(content, type, username) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;

        const timestamp = new Date().toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (type === 'system') {
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${escapeHTML(content)}</div>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${escapeHTML(content)}</div>
                    <span class="message-time">${timestamp}</span>
                </div>
            `;
        }

        elements.messagesBox.appendChild(messageElement);
        elements.messagesBox.scrollTop = elements.messagesBox.scrollHeight;
    }

    function displaySystemMessage(message) {
        displayMessage(message, 'system');
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        document.getElementById('toast-container').appendChild(toast);

        setTimeout(() => {
            toast.classList.add('visible');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
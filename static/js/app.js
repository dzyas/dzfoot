document.addEventListener('DOMContentLoaded', function() {
    // App initialization
    initApp();
});

function initApp() {
    // Load settings from localStorage
    loadSettings();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize speech recognition
    initSpeechRecognition();
    
    // Initialize speech synthesis
    initSpeechSynthesis();
    
    // Check connection status
    checkConnectionStatus();
    
    // Fetch conversations list
    fetchConversations();
    
    // Setup display message handling
    if (document.querySelectorAll('#messages .message-bubble').length === 0) {
        displayWelcomeMessage();
    }
    
    // Setup new sidebar toggle buttons
    setupSidebarToggleButtons();
}

function loadSettings() {
    // Load dark mode preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        if (document.getElementById('dark-mode-toggle')) {
            document.getElementById('dark-mode-toggle').checked = true;
        }
    }
    
    // Load text-to-speech preference
    if (localStorage.getItem('textToSpeech') === 'false') {
        if (document.getElementById('text-to-speech-toggle')) {
            document.getElementById('text-to-speech-toggle').checked = false;
        }
    }
    
    // Load model preference
    const savedModel = localStorage.getItem('model');
    if (savedModel && document.getElementById('model-select')) {
        document.getElementById('model-select').value = savedModel;
    }
    
    // Load temperature
    const savedTemperature = localStorage.getItem('temperature');
    if (savedTemperature && document.getElementById('temperature-slider')) {
        document.getElementById('temperature-slider').value = savedTemperature;
        document.getElementById('temperature-value').textContent = savedTemperature;
    }
    
    // Load max tokens
    const savedMaxTokens = localStorage.getItem('maxTokens');
    if (savedMaxTokens && document.getElementById('max-tokens')) {
        document.getElementById('max-tokens').value = savedMaxTokens;
    }
}

function setupEventListeners() {
    // Mobile settings button
    const statusBarSettingsIcon = document.getElementById('status-bar-settings-icon');
    if (statusBarSettingsIcon) {
        statusBarSettingsIcon.addEventListener('click', toggleSidebar);
    }
    
    // Mobile menu button (hamburger)
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', toggleSidebar);
    }
    
    // Model quick select in header
    const modelQuickSelect = document.getElementById('model-quick-select');
    if (modelQuickSelect) {
        modelQuickSelect.addEventListener('change', function() {
            // When the quick select changes, also update the sidebar select if it exists
            const modelSidebarSelect = document.getElementById('model-select');
            if (modelSidebarSelect) {
                modelSidebarSelect.value = this.value;
                localStorage.setItem('model', this.value);
            }
        });
    }
    
    // Close sidebar button
    const closeSidebarButton = document.getElementById('close-sidebar');
    if (closeSidebarButton) {
        closeSidebarButton.addEventListener('click', closeSidebar);
    }
    
    // Sidebar overlay (for closing on tap)
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // Dropdown menu toggle (3 dots)
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleDropdownMenu);
        // Close dropdown when clicking elsewhere
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('dropdown-menu');
            if (dropdown && !menuToggle.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }
    
    // Toggle dark mode
    const toggleDarkModeButton = document.getElementById('toggle-dark-mode');
    if (toggleDarkModeButton) {
        toggleDarkModeButton.addEventListener('click', function() {
            toggleDarkMode();
            hideDropdownMenu();
        });
    }
    
    // Dark mode toggle switch
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', toggleDarkMode);
    }
    
    // Toggle sidebar button in dropdown
    const toggleSidebarButton = document.getElementById('toggle-sidebar');
    if (toggleSidebarButton) {
        toggleSidebarButton.addEventListener('click', function() {
            toggleSidebar();
            hideDropdownMenu();
        });
    }
    
    // Settings button in dropdown
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
        settingsButton.addEventListener('click', function() {
            openSidebar();
            hideDropdownMenu();
        });
    }
    
    // Mobile settings button
    const mobileMenuSettings = document.getElementById('mobile-menu-settings');
    if (mobileMenuSettings) {
        mobileMenuSettings.addEventListener('click', toggleSidebar);
    }
    
    // Send message when send button is clicked
    const sendButton = document.getElementById('send-button');
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    // Send message when enter key is pressed (without shift)
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keydown', handleInputKeydown);
        messageInput.addEventListener('input', adjustInputHeight);
    }
    
    // Clear chat button
    const clearChatButton = document.getElementById('clear-chat-btn');
    if (clearChatButton) {
        clearChatButton.addEventListener('click', function() {
            showConfirmModal('هل أنت متأكد من رغبتك في بدء محادثة جديدة؟', clearCurrentConversation);
        });
    }
    
    // New conversation button in sidebar
    const newConversationButton = document.getElementById('new-conversation-btn');
    if (newConversationButton) {
        newConversationButton.addEventListener('click', function() {
            clearCurrentConversation();
            closeSidebar();
        });
    }
    
    // Microphone button
    const micButton = document.getElementById('mic-button');
    if (micButton) {
        micButton.addEventListener('click', toggleSpeechRecognition);
    }
    
    // Mobile microphone button
    const mobileRecordButton = document.getElementById('mobile-record-button');
    if (mobileRecordButton) {
        mobileRecordButton.addEventListener('click', toggleSpeechRecognition);
    }
    
    // Model select change
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
        modelSelect.addEventListener('change', saveModelPreference);
    }
    
    // Temperature slider change
    const temperatureSlider = document.getElementById('temperature-slider');
    if (temperatureSlider) {
        temperatureSlider.addEventListener('input', updateTemperatureValue);
        temperatureSlider.addEventListener('change', function() {
            localStorage.setItem('temperature', this.value);
        });
    }
    
    // Max tokens input change
    const maxTokensInput = document.getElementById('max-tokens');
    if (maxTokensInput) {
        maxTokensInput.addEventListener('change', saveMaxTokens);
    }
    
    // Text-to-speech toggle
    const textToSpeechToggle = document.getElementById('text-to-speech-toggle');
    if (textToSpeechToggle) {
        textToSpeechToggle.addEventListener('change', saveTextToSpeechPreference);
    }
    
    // Confirm dialog buttons
    const confirmActionButton = document.getElementById('confirm-action');
    if (confirmActionButton) {
        confirmActionButton.addEventListener('click', handleConfirmation);
    }
    
    const confirmCancelButton = document.getElementById('confirm-cancel');
    if (confirmCancelButton) {
        confirmCancelButton.addEventListener('click', closeConfirmModal);
    }
    
    // Adjust UI for screen size
    window.addEventListener('resize', adjustUIForScreenSize);
}

function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        window.speechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        const recognition = new window.speechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'ar-AR'; // Arabic language
        
        let finalTranscript = '';
        
        recognition.onresult = function(event) {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            // Update the message input with the transcript
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = finalTranscript + interimTranscript;
                // Trigger input event to adjust height
                messageInput.dispatchEvent(new Event('input'));
            }
        };
        
        recognition.onend = function() {
            // Stop recording UI
            updateRecordingUI(false);
            
            const messageInput = document.getElementById('message-input');
            if (messageInput && finalTranscript.trim() !== '') {
                // If we have a final transcript, send the message
                messageInput.value = finalTranscript;
                sendMessage();
                finalTranscript = '';
            }
        };
        
        recognition.onerror = function(event) {
            updateRecordingUI(false);
            if (event.error === 'no-speech') {
                showToast('لم يتم سماع أي صوت', 'error');
            } else if (event.error === 'not-allowed') {
                showToast('يرجى السماح بالوصول إلى الميكروفون', 'error');
            } else {
                showToast('حدث خطأ في التعرف على الصوت: ' + event.error, 'error');
            }
        };
        
        window.recognition = recognition;
    } else {
        // Speech recognition not supported
        const micButton = document.getElementById('mic-button');
        if (micButton) {
            micButton.style.display = 'none';
        }
        
        const mobileRecordButton = document.getElementById('mobile-record-button');
        if (mobileRecordButton) {
            mobileRecordButton.style.display = 'none';
        }
    }
}

function toggleSpeechRecognition() {
    if (!window.recognition) {
        showToast('التعرف على الصوت غير مدعوم في هذا المتصفح', 'error');
        return;
    }
    
    if (window.recognitionActive) {
        window.recognition.stop();
        window.recognitionActive = false;
    } else {
        try {
            window.recognition.start();
            window.recognitionActive = true;
            updateRecordingUI(true);
        } catch (e) {
            showToast('حدث خطأ في بدء التعرف على الصوت', 'error');
        }
    }
}

function updateRecordingUI(isActive) {
    const micButton = document.getElementById('mic-button');
    const mobileRecordButton = document.getElementById('mobile-record-button');
    
    if (isActive) {
        if (micButton) micButton.classList.add('recording');
        if (mobileRecordButton) mobileRecordButton.classList.add('recording');
    } else {
        if (micButton) micButton.classList.remove('recording');
        if (mobileRecordButton) mobileRecordButton.classList.remove('recording');
    }
}

function initSpeechSynthesis() {
    if ('speechSynthesis' in window) {
        window.synth = window.speechSynthesis;
        
        // Get Arabic voice if available
        window.speechSynthesis.onvoiceschanged = function() {
            let voices = window.speechSynthesis.getVoices();
            window.arabicVoice = voices.find(voice => voice.lang.includes('ar')) || voices[0];
        };
        
        // Trigger to get voices
        window.speechSynthesis.getVoices();
    } else {
        console.log('Text-to-speech not supported in this browser');
    }
}

function speakText(text) {
    if (!window.synth) return;
    
    // Check if text-to-speech is enabled
    if (localStorage.getItem('textToSpeech') === 'false') return;
    
    // Cancel any ongoing speech
    window.synth.cancel();
    
    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice to Arabic if available
    if (window.arabicVoice) {
        utterance.voice = window.arabicVoice;
    }
    
    // Set language to Arabic
    utterance.lang = 'ar-AR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Speak the text
    window.synth.speak(utterance);
}

function checkConnectionStatus() {
    if (navigator.onLine) {
        updateConnectionStatus(true);
    } else {
        updateConnectionStatus(false);
    }
    
    // Set up event listeners for connection changes
    window.addEventListener('online', function() {
        updateConnectionStatus(true);
    });
    
    window.addEventListener('offline', function() {
        updateConnectionStatus(false);
    });
    
    // Check every 30 seconds
    setInterval(function() {
        fetch('/api/ping', { method: 'GET' })
            .then(response => {
                updateConnectionStatus(true);
            })
            .catch(error => {
                // Only show offline if actually offline
                if (!navigator.onLine) {
                    updateConnectionStatus(false);
                }
            });
    }, 30000);
}

function updateConnectionStatus(isOnline) {
    const statusIcon = document.getElementById('status-connection-icon');
    const offlineIndicator = document.getElementById('offline-indicator');
    
    if (statusIcon) {
        if (isOnline) {
            statusIcon.className = 'fas fa-wifi';
            statusIcon.style.color = '#4CAF50';
        } else {
            statusIcon.className = 'fas fa-wifi-slash';
            statusIcon.style.color = '#F44336';
        }
    }
    
    if (offlineIndicator) {
        if (isOnline) {
            offlineIndicator.style.display = 'none';
        } else {
            offlineIndicator.style.display = 'block';
        }
    }
}

function fetchConversations() {
    fetch('/api/conversations')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayConversationsList(data.conversations);
                
                // If no active conversation, load the first one
                const currentConversationId = localStorage.getItem('currentConversationId');
                if (!currentConversationId && data.conversations.length > 0) {
                    loadConversation(data.conversations[0].id);
                } else if (currentConversationId) {
                    loadConversation(currentConversationId);
                }
            } else {
                showToast('فشل في تحميل المحادثات: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error fetching conversations:', error);
        });
}

function displayConversationsList(conversations) {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) return;
    
    conversationsList.innerHTML = '';
    
    if (conversations.length === 0) {
        conversationsList.innerHTML = '<div class="empty-state">لا توجد محادثات سابقة</div>';
        return;
    }
    
    const currentConversationId = localStorage.getItem('currentConversationId');
    
    conversations.forEach(conversation => {
        const conversationItem = document.createElement('div');
        conversationItem.className = 'conversation-item';
        if (conversation.id === currentConversationId) {
            conversationItem.classList.add('active');
        }
        
        const conversationDate = new Date(conversation.updated_at);
        const formattedDate = conversationDate.toLocaleDateString('ar-SA', { 
            month: 'short',
            day: 'numeric'
        });
        
        conversationItem.innerHTML = `
            <span class="conversation-title">${conversation.title}</span>
            <small class="conversation-date">${formattedDate}</small>
            <div class="conversation-actions">
                <button class="delete-conversation" data-id="${conversation.id}" aria-label="حذف المحادثة">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        
        conversationItem.addEventListener('click', function(e) {
            if (!e.target.closest('.delete-conversation')) {
                loadConversation(conversation.id);
                if (window.innerWidth < 768) {
                    closeSidebar();
                }
            }
        });
        
        conversationsList.appendChild(conversationItem);
    });
    
    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-conversation').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const conversationId = this.getAttribute('data-id');
            showConfirmModal('هل أنت متأكد من رغبتك في حذف هذه المحادثة؟', function() {
                deleteConversation(conversationId);
            });
        });
    });
}

function loadConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem('currentConversationId', conversationId);
                
                // Update active conversation in sidebar
                document.querySelectorAll('.conversation-item').forEach(item => {
                    item.classList.remove('active');
                    if (item.querySelector(`.delete-conversation[data-id="${conversationId}"]`)) {
                        item.classList.add('active');
                    }
                });
                
                // Display conversation messages
                displayMessages(data.conversation.messages);
            } else {
                showToast('فشل في تحميل المحادثة: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error loading conversation:', error);
        });
}

function createNewConversation() {
    fetch('/api/conversations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem('currentConversationId', data.conversation.id);
                fetchConversations();
                displayWelcomeMessage();
            } else {
                showToast('فشل في إنشاء محادثة جديدة: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error creating new conversation:', error);
        });
}

function deleteConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // If deleted conversation is the current one, clear messages
                if (localStorage.getItem('currentConversationId') === conversationId) {
                    document.getElementById('messages').innerHTML = '';
                    localStorage.removeItem('currentConversationId');
                    displayWelcomeMessage();
                }
                
                // Refresh conversations list
                fetchConversations();
                showToast('تم حذف المحادثة بنجاح', 'success');
            } else {
                showToast('فشل في حذف المحادثة: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting conversation:', error);
            showToast('حدث خطأ أثناء حذف المحادثة', 'error');
        });
}

function clearCurrentConversation() {
    // Clear messages display
    document.getElementById('messages').innerHTML = '';
    
    // Remove current conversation from localStorage
    localStorage.removeItem('currentConversationId');
    
    // Create a new conversation
    createNewConversation();
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages');
    
    if (!messageInput || !messagesContainer) return;
    
    const messageText = messageInput.value.trim();
    if (messageText === '') return;
    
    // Clear input
    messageInput.value = '';
    adjustInputHeight();
    
    // Get current conversation ID or create a new one
    let currentConversationId = localStorage.getItem('currentConversationId');
    
    const sendMessageFunction = (conversationId) => {
        // Get model and temperature settings
        // Get model from the quick select in header or fallback to the sidebar select
        const modelQuickSelect = document.getElementById('model-quick-select');
        const modelSidebarSelect = document.getElementById('model-select');
        
        // Give priority to the quick select if it exists
        const model = modelQuickSelect?.value || modelSidebarSelect?.value || 'openrouter/gemini-1.5-pro';
        const temperature = parseFloat(document.getElementById('temperature-slider')?.value || 0.7);
        
        // Display user message immediately
        const userMessage = {
            id: 'temp-' + Date.now(),
            role: 'user',
            content: messageText,
            created_at: new Date().toISOString()
        };
        displayMessage(userMessage);
        
        // Show typing indicator
        showTypingIndicator();
        
        // Scroll to bottom
        scrollToBottom();
        
        // Send message to API
        fetch(`/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: messageText,
                model: model,
                temperature: temperature
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update current conversation ID
                    localStorage.setItem('currentConversationId', conversationId);
                    
                    // Hide typing indicator
                    hideTypingIndicator();
                    
                    // Display AI response
                    displayMessage(data.ai_message);
                    
                    // Speak the response if text-to-speech is enabled
                    speakText(data.ai_message.content);
                    
                    // Add regenerate button
                    addRegenerateButton();
                    
                    // Refresh conversations list
                    fetchConversations();
                } else {
                    hideTypingIndicator();
                    showToast('فشل في إرسال الرسالة: ' + data.error, 'error');
                }
            })
            .catch(error => {
                console.error('Error sending message:', error);
                hideTypingIndicator();
                showToast('حدث خطأ أثناء إرسال الرسالة', 'error');
            });
    };
    
    if (!currentConversationId) {
        // Create new conversation first
        fetch('/api/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    sendMessageFunction(data.conversation.id);
                } else {
                    showToast('فشل في إنشاء محادثة جديدة: ' + data.error, 'error');
                }
            })
            .catch(error => {
                console.error('Error creating new conversation:', error);
                showToast('حدث خطأ أثناء إنشاء محادثة جديدة', 'error');
            });
    } else {
        sendMessageFunction(currentConversationId);
    }
}

function handleInputKeydown(event) {
    // Send message on Enter without Shift
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function adjustInputHeight() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    // Reset height to auto to get accurate scrollHeight
    messageInput.style.height = 'auto';
    
    // Set height based on content, with max height of 120px
    const newHeight = Math.min(messageInput.scrollHeight, 120);
    messageInput.style.height = newHeight + 'px';
}

function displayWelcomeMessage() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = `
        <div class="ai-bubble message-bubble">
            <img src="/static/img/yasmin-avatar.png" alt="ياسمين" class="ai-avatar">
            <div class="message-content">
                <p>مرحباً بك! أنا ياسمين، مساعدتك الذكية.</p>
                <p>كيف يمكنني مساعدتك اليوم؟</p>
            </div>
        </div>
        
        <div class="suggestions-container">
            <div class="suggestion-label">
                <i class="fas fa-lightbulb"></i>
                <span>يمكنك أن تسألني عن...</span>
            </div>
            <div class="suggestion-chips">
                <button class="suggestion-chip">عرّفني عن نفسك</button>
                <button class="suggestion-chip">ما هي إمكانياتك؟</button>
                <button class="suggestion-chip">اكتب لي قصة قصيرة</button>
                <button class="suggestion-chip">اقترح لي أفكاراً لمشروع</button>
            </div>
        </div>
    `;
    
    // Add click event for suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            document.getElementById('message-input').value = this.textContent;
            sendMessage();
        });
    });
}

function displayMessages(messagesList) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (messagesList.length === 0) {
        displayWelcomeMessage();
        return;
    }
    
    messagesList.forEach(message => {
        displayMessage(message);
    });
    
    // Add regenerate button for last AI message
    if (messagesList.length > 0 && messagesList[messagesList.length - 1].role === 'assistant') {
        addRegenerateButton();
    }
    
    // Scroll to bottom
    scrollToBottom();
}

function displayMessage(message) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    const formattedTime = formatTime(message.created_at);
    
    let messageElement = document.createElement('div');
    messageElement.className = message.role === 'user' ? 'user-bubble message-bubble' : 'ai-bubble message-bubble';
    
    if (message.role === 'assistant') {
        messageElement.innerHTML = `
            <img src="/static/img/yasmin-avatar.png" alt="ياسمين" class="ai-avatar">
            <div class="message-content">
                ${formatMessageContent(message.content)}
                <div class="message-timestamp">${formattedTime}</div>
                <div class="message-actions">
                    <div class="vote-buttons">
                        <button class="thumbs-up-button vote-button" aria-label="مفيد">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <button class="thumbs-down-button vote-button" aria-label="غير مفيد">
                            <i class="fas fa-thumbs-down"></i>
                        </button>
                    </div>
                    <button class="copy-button" aria-label="نسخ">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="message-content">
                ${formatMessageContent(message.content)}
                <div class="message-timestamp">${formattedTime}</div>
                <div class="message-actions">
                    <button class="copy-button" aria-label="نسخ">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <img src="/static/img/user-avatar.svg" alt="المستخدم" class="user-avatar">
        `;
    }
    
    messagesContainer.appendChild(messageElement);
    
    // Add event listeners for interaction buttons
    const copyButton = messageElement.querySelector('.copy-button');
    if (copyButton) {
        copyButton.addEventListener('click', function() {
            copyMessageToClipboard(message.content);
        });
    }
    
    // Add event listeners for vote buttons if present
    const thumbsUpButton = messageElement.querySelector('.thumbs-up-button');
    const thumbsDownButton = messageElement.querySelector('.thumbs-down-button');
    
    if (thumbsUpButton && thumbsDownButton) {
        thumbsUpButton.addEventListener('click', function() {
            toggleVoteButton(this, thumbsDownButton);
        });
        
        thumbsDownButton.addEventListener('click', function() {
            toggleVoteButton(this, thumbsUpButton);
        });
    }
    
    // Scroll to the new message
    scrollToBottom();
}

function toggleVoteButton(button, oppositeButton) {
    if (button.classList.contains('active')) {
        button.classList.remove('active');
    } else {
        button.classList.add('active');
        if (oppositeButton.classList.contains('active')) {
            oppositeButton.classList.remove('active');
        }
    }
}

function displayErrorMessage(text) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    let errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = text;
    
    messagesContainer.appendChild(errorElement);
    scrollToBottom();
}

function formatMessageContent(content) {
    // Convert line breaks to <br> elements
    const text = content.replace(/\n/g, '<br>');
    
    // Wrap the content in a paragraph if not already done
    if (!text.startsWith('<p>')) {
        return `<p>${text}</p>`;
    }
    
    return text;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function copyMessageToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('تم نسخ النص بنجاح', 'success');
        })
        .catch(err => {
            showToast('فشل في نسخ النص: ' + err, 'error');
        });
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    // Remove existing indicator if any
    hideTypingIndicator();
    
    // Create typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `
        <div class="dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
        <span>ياسمين تكتب...</span>
    `;
    typingIndicator.id = 'typing-indicator';
    
    messagesContainer.appendChild(typingIndicator);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function addRegenerateButton() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    // Remove existing button if any
    const existingButton = document.getElementById('regenerate-button');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Add the button
    const regenerateButton = document.createElement('button');
    regenerateButton.id = 'regenerate-button';
    regenerateButton.innerHTML = `
        <i class="fas fa-redo-alt"></i>
        إعادة توليد الإجابة
    `;
    regenerateButton.addEventListener('click', regenerateResponse);
    
    messagesContainer.appendChild(regenerateButton);
}

function regenerateResponse() {
    const currentConversationId = localStorage.getItem('currentConversationId');
    if (!currentConversationId) {
        showToast('لا توجد محادثة حالية لإعادة التوليد', 'error');
        return;
    }
    
    // Get model and temperature settings
    const model = document.getElementById('model-select')?.value || 'gpt-3.5-turbo';
    const temperature = parseFloat(document.getElementById('temperature-slider')?.value || 0.7);
    
    // Hide regenerate button
    const regenerateButton = document.getElementById('regenerate-button');
    if (regenerateButton) {
        regenerateButton.style.display = 'none';
    }
    
    // Show typing indicator
    showTypingIndicator();
    
    // Send regenerate request
    fetch(`/api/conversations/${currentConversationId}/regenerate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            temperature: temperature
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Hide typing indicator
                hideTypingIndicator();
                
                // Find and replace the last AI message
                const aiMessages = document.querySelectorAll('.ai-bubble');
                if (aiMessages.length > 0) {
                    const lastAiMessage = aiMessages[aiMessages.length - 1];
                    const messageContent = lastAiMessage.querySelector('.message-content');
                    if (messageContent) {
                        const formattedTime = formatTime(data.regenerated_message.created_at);
                        messageContent.innerHTML = `
                            ${formatMessageContent(data.regenerated_message.content)}
                            <div class="message-timestamp">${formattedTime}</div>
                            <div class="message-actions">
                                <div class="vote-buttons">
                                    <button class="thumbs-up-button vote-button" aria-label="مفيد">
                                        <i class="fas fa-thumbs-up"></i>
                                    </button>
                                    <button class="thumbs-down-button vote-button" aria-label="غير مفيد">
                                        <i class="fas fa-thumbs-down"></i>
                                    </button>
                                </div>
                                <button class="copy-button" aria-label="نسخ">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        `;
                    }
                }
                
                // Speak the regenerated response
                speakText(data.regenerated_message.content);
                
                // Show regenerate button again
                addRegenerateButton();
                
                // Refresh conversations list
                fetchConversations();
            } else {
                hideTypingIndicator();
                if (regenerateButton) {
                    regenerateButton.style.display = 'flex';
                }
                showToast('فشل في إعادة توليد الإجابة: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error regenerating response:', error);
            hideTypingIndicator();
            if (regenerateButton) {
                regenerateButton.style.display = 'flex';
            }
            showToast('حدث خطأ أثناء إعادة توليد الإجابة', 'error');
        });
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function showConfirmModal(message, callback) {
    const modal = document.getElementById('confirm-modal');
    const messageElement = document.getElementById('confirm-message');
    
    if (!modal || !messageElement) return;
    
    messageElement.textContent = message;
    modal.style.display = 'flex';
    
    // Store callback
    window.confirmCallback = callback;
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function handleConfirmation() {
    // Execute the stored callback
    if (window.confirmCallback) {
        window.confirmCallback();
    }
    
    // Close the modal
    closeConfirmModal();
}

function toggleDropdownMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('dropdown-menu');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('dropdown-menu');
    const menuToggle = document.getElementById('menu-toggle');
    
    if (dropdown && !menuToggle.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

function clearCurrentConversation() {
    showConfirmModal('هل أنت متأكد من رغبتك في مسح المحادثة؟', function() {
        document.getElementById('messages').innerHTML = '';
        localStorage.removeItem('currentConversationId');
        displayWelcomeMessage();
        // إخفاء القائمة المنسدلة بعد المسح
        const dropdown = document.getElementById('dropdown-menu');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : 'auto';
    }
    
    // إخفاء القائمة المنسدلة عند فتح القائمة الجانبية
    const dropdown = document.getElementById('dropdown-menu');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

function hideDropdownMenu() {
    const dropdown = document.getElementById('dropdown-menu');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        if (sidebar.classList.contains('active')) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            overlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }
}

function openSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function saveModelPreference() {
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
        localStorage.setItem('model', modelSelect.value);
    }
}

function updateTemperatureValue() {
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    
    if (temperatureSlider && temperatureValue) {
        temperatureValue.textContent = temperatureSlider.value;
    }
}

function saveMaxTokens() {
    const maxTokensInput = document.getElementById('max-tokens');
    if (maxTokensInput) {
        localStorage.setItem('maxTokens', maxTokensInput.value);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    localStorage.setItem('darkMode', isDarkMode.toString());
    
    // Update dark mode toggle if it exists
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.checked = isDarkMode;
    }
}

function saveTextToSpeechPreference() {
    const textToSpeechToggle = document.getElementById('text-to-speech-toggle');
    if (textToSpeechToggle) {
        localStorage.setItem('textToSpeech', textToSpeechToggle.checked.toString());
    }
}

function adjustUIForScreenSize() {
    const sidebar = document.getElementById('settings-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (window.innerWidth >= 768) {
        // Desktop view
        if (sidebar) {
            sidebar.classList.remove('active');
        }
        if (overlay) {
            overlay.classList.remove('active');
        }
        document.body.style.overflow = 'auto';
    }
}

function setupSidebarToggleButtons() {
    // Setup the sidebar toggle button below header
    const sidebarToggleButton = document.getElementById('sidebar-toggle-button');
    if (sidebarToggleButton) {
        sidebarToggleButton.addEventListener('click', toggleSidebar);
    }
    
    // Setup the back button below header
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', function() {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // If there's no history, just go to the root
                window.location.href = '/';
            }
        });
    }
}
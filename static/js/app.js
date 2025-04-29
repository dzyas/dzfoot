// Main application JavaScript for Yasmin chat

// Global variables
let currentConversationId = null;
let isGeneratingResponse = false;
let isRecording = false;
let darkMode = localStorage.getItem('darkMode') === 'true';
let textToSpeechEnabled = localStorage.getItem('textToSpeech') === 'true' || localStorage.getItem('textToSpeech') === null; // Default to true
let useBrowserTTS = localStorage.getItem('useBrowserTTS') === 'true';
let speechRecognition;
let currentModel = localStorage.getItem('model') || 'gemini-1.5-pro';
let currentTemperature = parseFloat(localStorage.getItem('temperature') || '0.7');
let currentMaxTokens = parseInt(localStorage.getItem('maxTokens') || '2000');
let selectedVoice = localStorage.getItem('voice') || 'EXAVITQu4vr4xnSDxMaL';

// DOM Elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const settingsSidebar = document.getElementById('settings-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const closeSidebarButton = document.getElementById('close-sidebar');
const sidebarToggleButton = document.getElementById('sidebar-toggle');
const temperatureSlider = document.getElementById('temperature-slider');
const temperatureValue = document.getElementById('temperature-value');
const maxTokensInput = document.getElementById('max-tokens');
const modelSelect = document.getElementById('model-select');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const textToSpeechToggle = document.getElementById('text-to-speech-toggle');
const useBrowserTtsToggle = document.getElementById('use-browser-tts');
const voiceSelect = document.getElementById('voice-select');
const newConversationBtn = document.getElementById('new-conversation-btn');
const conversationsList = document.getElementById('conversations-list');
const clearChatBtn = document.getElementById('clear-chat-btn');
const menuToggle = document.getElementById('menu-toggle');
const dropdownMenu = document.getElementById('dropdown-menu');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const confirmModal = document.getElementById('confirm-modal');
const confirmAction = document.getElementById('confirm-action');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmMessage = document.getElementById('confirm-message');
const exportChatBtn = document.getElementById('export-chat-btn');

// Initialize the application
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    // Load settings from localStorage
    loadSettings();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load conversations
    loadConversations();
    
    // Display welcome message if no conversation is loaded
    if (!currentConversationId) {
        displayWelcomeMessage();
    }
    
    // Initialize speech recognition
    initSpeechRecognition();
}

function loadSettings() {
    // Apply dark mode if enabled
    if (darkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }
    
    // Set text-to-speech toggle
    textToSpeechToggle.checked = textToSpeechEnabled;
    
    // Set browser TTS toggle
    if (useBrowserTtsToggle) {
        useBrowserTtsToggle.checked = useBrowserTTS;
    }
    
    // Set voice selector if available
    if (voiceSelect) {
        voiceSelect.value = selectedVoice;
    }
    
    // Set model and parameters
    if (modelSelect) {
        modelSelect.value = currentModel;
    }
    
    if (temperatureSlider) {
        temperatureSlider.value = currentTemperature;
        temperatureValue.textContent = currentTemperature;
    }
    
    if (maxTokensInput) {
        maxTokensInput.value = currentMaxTokens;
    }
}

function setupEventListeners() {
    // Message sending
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Mic button
    if (micButton) {
        micButton.addEventListener('click', toggleRecording);
    }
    
    // Auto-resize message input
    messageInput.addEventListener('input', autoResizeInput);
    
    // Sidebar toggle
    sidebarToggleButton.addEventListener('click', toggleSidebar);
    closeSidebarButton.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);
    mobileMenuButton.addEventListener('click', toggleSidebar);
    
    // Menu toggle
    menuToggle.addEventListener('click', () => {
        dropdownMenu.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-container') && dropdownMenu.classList.contains('active')) {
            dropdownMenu.classList.remove('active');
        }
    });
    
    // Settings changes
    darkModeToggle.addEventListener('change', toggleDarkMode);
    textToSpeechToggle.addEventListener('change', toggleTextToSpeech);
    if (useBrowserTtsToggle) {
        useBrowserTtsToggle.addEventListener('change', toggleBrowserTTS);
    }
    if (voiceSelect) {
        voiceSelect.addEventListener('change', changeVoice);
    }
    
    // Model parameters
    if (modelSelect) {
        modelSelect.addEventListener('change', changeModel);
    }
    if (temperatureSlider) {
        temperatureSlider.addEventListener('input', updateTemperature);
    }
    if (maxTokensInput) {
        maxTokensInput.addEventListener('change', updateMaxTokens);
    }
    
    // Conversation management
    newConversationBtn.addEventListener('click', startNewConversation);
    clearChatBtn.addEventListener('click', () => {
        showConfirmation('هل أنت متأكد من رغبتك في مسح جميع الرسائل في هذه المحادثة؟', clearConversation);
    });
    
    // Export chat
    if (exportChatBtn) {
        exportChatBtn.addEventListener('click', exportChat);
    }
    
    // Modal buttons
    confirmAction.addEventListener('click', () => {
        // The actual action will be set when showing the confirmation
        confirmModal.classList.remove('active');
    });
    
    confirmCancel.addEventListener('click', () => {
        confirmModal.classList.remove('active');
    });
    
    // Feature buttons
    setupFeatureButtons();
}

function setupFeatureButtons() {
    // These buttons now point to separate pages and are handled by Flask routing
    // Add any client-side handlers for tool buttons that still work in the same page
    
    const summarizeBtn = document.getElementById('summarize-btn');
    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', () => {
            if (!currentConversationId) {
                showToast('لا توجد محادثة لتلخيصها.', 'error');
                return;
            }
            
            const summaryPrompt = 'لخص المحادثة السابقة في نقاط قصيرة وواضحة.';
            messageInput.value = summaryPrompt;
            sendMessage();
        });
    }
    
    const grammarCheckBtn = document.getElementById('grammar-check-btn');
    if (grammarCheckBtn) {
        grammarCheckBtn.addEventListener('click', () => {
            if (!messagesContainer.querySelector('.message-bubble.user:last-of-type')) {
                showToast('يُرجى إدخال نص للتدقيق اللغوي أولاً.', 'error');
                return;
            }
            
            const lastUserMessage = messagesContainer.querySelector('.message-bubble.user:last-of-type .message-content').textContent;
            const grammarPrompt = `قم بتدقيق النص التالي لغوياً وتصحيح أي أخطاء إملائية أو نحوية:\n\n"${lastUserMessage}"\n\nالنص المصحح:`;
            messageInput.value = grammarPrompt;
            sendMessage();
        });
    }
    
    const explainCodeBtn = document.getElementById('explain-code-btn');
    if (explainCodeBtn) {
        explainCodeBtn.addEventListener('click', () => {
            if (!messagesContainer.querySelector('.message-bubble.user:last-of-type')) {
                showToast('يُرجى إدخال الكود المراد شرحه أولاً.', 'error');
                return;
            }
            
            const lastUserMessage = messagesContainer.querySelector('.message-bubble.user:last-of-type .message-content').textContent;
            const explainPrompt = `اشرح الكود التالي بالتفصيل مع توضيح كل سطر ووظيفته:\n\n${lastUserMessage}`;
            messageInput.value = explainPrompt;
            sendMessage();
        });
    }
    
    const translateBtn = document.getElementById('translate-btn');
    if (translateBtn) {
        translateBtn.addEventListener('click', () => {
            if (!messagesContainer.querySelector('.message-bubble.user:last-of-type')) {
                showToast('يُرجى إدخال النص المراد ترجمته أولاً.', 'error');
                return;
            }
            
            const lastUserMessage = messagesContainer.querySelector('.message-bubble.user:last-of-type .message-content').textContent;
            const translatePrompt = `ترجم النص التالي إلى اللغة الإنجليزية:\n\n"${lastUserMessage}"\n\nالترجمة:`;
            messageInput.value = translatePrompt;
            sendMessage();
        });
    }
}

function autoResizeInput() {
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
}

function toggleSidebar() {
    document.body.classList.toggle('sidebar-active');
}

function toggleDarkMode() {
    darkMode = darkModeToggle.checked;
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode);
}

function toggleTextToSpeech() {
    textToSpeechEnabled = textToSpeechToggle.checked;
    localStorage.setItem('textToSpeech', textToSpeechEnabled);
}

function toggleBrowserTTS() {
    useBrowserTTS = useBrowserTtsToggle.checked;
    localStorage.setItem('useBrowserTTS', useBrowserTTS);
}

function changeVoice() {
    selectedVoice = voiceSelect.value;
    localStorage.setItem('voice', selectedVoice);
}

function changeModel() {
    currentModel = modelSelect.value;
    localStorage.setItem('model', currentModel);
    
    // Show information about the selected model
    let modelInfo = '';
    if (currentModel.includes('gemini')) {
        modelInfo = 'استخدام نموذج Gemini من Google';
    } else if (currentModel.includes('claude')) {
        modelInfo = 'استخدام نموذج Claude من Anthropic';
    } else if (currentModel.includes('gpt-4')) {
        modelInfo = 'استخدام نموذج GPT-4 من OpenAI';
    } else {
        modelInfo = 'استخدام نموذج ' + currentModel;
    }
    
    showToast(modelInfo, 'info');
}

function updateTemperature() {
    currentTemperature = parseFloat(temperatureSlider.value);
    temperatureValue.textContent = currentTemperature;
    localStorage.setItem('temperature', currentTemperature);
}

function updateMaxTokens() {
    currentMaxTokens = parseInt(maxTokensInput.value);
    localStorage.setItem('maxTokens', currentMaxTokens);
}

function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        micButton.style.display = 'none';
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;
    speechRecognition.lang = 'ar-SA'; // Arabic language
    
    speechRecognition.onstart = () => {
        isRecording = true;
        micButton.classList.add('recording');
        showToast('جارٍ الاستماع...', 'info');
    };
    
    speechRecognition.onend = () => {
        isRecording = false;
        micButton.classList.remove('recording');
    };
    
    speechRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        messageInput.value = transcript;
        autoResizeInput();
    };
    
    speechRecognition.onerror = (event) => {
        isRecording = false;
        micButton.classList.remove('recording');
        showToast('حدث خطأ في التعرف على الصوت', 'error');
        console.error('Speech recognition error', event.error);
    };
}

function toggleRecording() {
    if (isRecording) {
        speechRecognition.stop();
    } else {
        speechRecognition.start();
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isGeneratingResponse) return;
    
    // Clear input
    messageInput.value = '';
    autoResizeInput();
    
    // Add user message to UI
    addMessageToUI('user', message);
    
    // Show typing indicator
    showTypingIndicator();
    
    // Set flag to prevent multiple requests
    isGeneratingResponse = true;
    
    // Send to backend API
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: message,
            conversation_id: currentConversationId,
            model: currentModel,
            temperature: currentTemperature,
            max_tokens: currentMaxTokens
        }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        // Remove typing indicator
        removeTypingIndicator();
        
        // Add assistant response to UI
        addMessageToUI('assistant', data.message);
        
        // Update conversation ID if new
        if (!currentConversationId) {
            currentConversationId = data.conversation_id;
            loadConversations(); // Refresh the conversations list
        }
        
        // Text to speech if enabled
        if (textToSpeechEnabled) {
            speakText(data.message);
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
        removeTypingIndicator();
        showToast('حدث خطأ أثناء إرسال الرسالة', 'error');
    })
    .finally(() => {
        isGeneratingResponse = false;
    });
}

function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${role}`;
    
    // Create avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = role === 'user' 
        ? '/static/img/user-avatar.jpg' 
        : '/static/img/yasmin-avatar.png';
    avatar.appendChild(avatarImg);
    
    // Create message content
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format message content with Markdown-like parsing
    const formattedContent = formatMessageContent(content);
    messageContent.innerHTML = formattedContent;
    
    // Create time display
    const timeElement = document.createElement('div');
    timeElement.className = 'message-time';
    const now = new Date();
    timeElement.textContent = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    
    // Add message actions for assistant messages
    let actionsDiv;
    if (role === 'assistant') {
        actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'message-action-btn';
        copyBtn.innerHTML = '<i class="far fa-copy"></i>';
        copyBtn.title = 'نسخ';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(content)
                .then(() => showToast('تم نسخ النص', 'success'))
                .catch(() => showToast('فشل نسخ النص', 'error'));
        });
        
        const likeBtn = document.createElement('button');
        likeBtn.className = 'message-action-btn';
        likeBtn.innerHTML = '<i class="far fa-heart"></i>';
        likeBtn.title = 'إعجاب';
        likeBtn.addEventListener('click', (e) => {
            e.currentTarget.classList.toggle('liked');
            e.currentTarget.querySelector('i').classList.toggle('far');
            e.currentTarget.querySelector('i').classList.toggle('fas');
        });
        
        const speakBtn = document.createElement('button');
        speakBtn.className = 'message-action-btn';
        speakBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        speakBtn.title = 'قراءة';
        speakBtn.addEventListener('click', () => {
            speakText(content);
        });
        
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(likeBtn);
        actionsDiv.appendChild(speakBtn);
    }
    
    // Assemble message
    messageDiv.appendChild(role === 'user' ? avatar : document.createDocumentFragment());
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(role === 'assistant' ? avatar : document.createDocumentFragment());
    
    // Add time and actions
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    messageContainer.appendChild(messageDiv);
    
    if (timeElement) {
        messageContent.appendChild(timeElement);
    }
    
    if (actionsDiv) {
        messageContainer.appendChild(actionsDiv);
    }
    
    messagesContainer.appendChild(messageContainer);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatMessageContent(content) {
    if (!content) return '';
    
    // Basic HTML escaping
    let escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Code blocks
    escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');
    
    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold text
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Line breaks
    escaped = escaped.replace(/\n/g, '<br>');
    
    return escaped;
}

function showTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message-bubble assistant loading';
    typingIndicator.id = 'typing-indicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = '/static/img/yasmin-avatar.png';
    avatar.appendChild(avatarImg);
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    
    typingIndicator.appendChild(messageContent);
    typingIndicator.appendChild(avatar);
    
    messagesContainer.appendChild(typingIndicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function speakText(text) {
    if (useBrowserTTS) {
        // Use browser's built-in TTS
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar-SA';
            window.speechSynthesis.speak(utterance);
        } else {
            console.error('Browser does not support speech synthesis');
            showToast('المتصفح لا يدعم ميزة تحويل النص إلى كلام', 'error');
        }
    } else {
        // Use ElevenLabs API
        fetch('/api/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                voice_id: selectedVoice
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Text-to-speech API error');
            }
            return response.json();
        })
        .then(data => {
            if (data.audio) {
                // Create and play audio from base64
                const audio = new Audio('data:audio/mpeg;base64,' + data.audio);
                audio.play();
            }
        })
        .catch(error => {
            console.error('Error in text-to-speech:', error);
            showToast('فشل تحويل النص إلى كلام', 'error');
            
            // Fallback to browser TTS
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'ar-SA';
                window.speechSynthesis.speak(utterance);
            }
        });
    }
}

function loadConversations() {
    fetch('/api/conversations')
    .then(response => response.json())
    .then(data => {
        conversationsList.innerHTML = '';
        
        if (data.conversations && data.conversations.length > 0) {
            data.conversations.forEach(conversation => {
                addConversationToList(conversation);
            });
        } else {
            conversationsList.innerHTML = '<div class="empty-state">لا توجد محادثات سابقة</div>';
        }
    })
    .catch(error => {
        console.error('Error loading conversations:', error);
        conversationsList.innerHTML = '<div class="empty-state">فشل تحميل المحادثات</div>';
    });
}

function addConversationToList(conversation) {
    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    if (currentConversationId === conversation.id) {
        conversationItem.classList.add('active');
    }
    
    const date = new Date(conversation.last_updated);
    const formattedDate = date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
    
    conversationItem.innerHTML = `
        <div class="conversation-info">
            <div class="conversation-title">${conversation.title}</div>
            <div class="conversation-date">${formattedDate}</div>
        </div>
        <button class="conversation-delete" title="حذف المحادثة">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;
    
    conversationItem.querySelector('.conversation-info').addEventListener('click', () => {
        loadConversation(conversation.id);
    });
    
    conversationItem.querySelector('.conversation-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmation('هل أنت متأكد من رغبتك في حذف هذه المحادثة؟', () => {
            deleteConversation(conversation.id);
        });
    });
    
    conversationsList.appendChild(conversationItem);
}

function loadConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`)
    .then(response => response.json())
    .then(data => {
        currentConversationId = conversationId;
        
        // Update active conversation in the list
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelectorAll('.conversation-item').forEach(item => {
            if (item.querySelector('.conversation-title').textContent === data.conversation.title) {
                item.classList.add('active');
            }
        });
        
        // Clear current messages
        messagesContainer.innerHTML = '';
        
        // Add messages to UI
        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(message => {
                addMessageToUI(message.role, message.content);
            });
        }
        
        // Close sidebar on mobile
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    })
    .catch(error => {
        console.error('Error loading conversation:', error);
        showToast('فشل تحميل المحادثة', 'error');
    });
}

function startNewConversation() {
    currentConversationId = null;
    messagesContainer.innerHTML = '';
    displayWelcomeMessage();
    
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        toggleSidebar();
    }
}

function clearConversation() {
    if (!currentConversationId) {
        showToast('لا توجد محادثة لمسحها', 'error');
        return;
    }
    
    fetch(`/api/conversations/${currentConversationId}/messages`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            messagesContainer.innerHTML = '';
            displayWelcomeMessage();
            showToast('تم مسح المحادثة بنجاح', 'success');
        } else {
            throw new Error('Failed to clear conversation');
        }
    })
    .catch(error => {
        console.error('Error clearing conversation:', error);
        showToast('فشل مسح المحادثة', 'error');
    });
}

function deleteConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            loadConversations();
            
            if (currentConversationId === conversationId) {
                currentConversationId = null;
                messagesContainer.innerHTML = '';
                displayWelcomeMessage();
            }
            
            showToast('تم حذف المحادثة بنجاح', 'success');
        } else {
            throw new Error('Failed to delete conversation');
        }
    })
    .catch(error => {
        console.error('Error deleting conversation:', error);
        showToast('فشل حذف المحادثة', 'error');
    });
}

function displayWelcomeMessage() {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-container';
    welcomeDiv.innerHTML = `
        <div class="message-bubble assistant">
            <div class="message-content">
                <p>أهلاً بك في ياسمين! أنا مساعدك الذكي باللغة العربية. كيف يمكنني مساعدتك اليوم؟</p>
            </div>
            <div class="message-avatar">
                <img src="/static/img/yasmin-avatar.webp" alt="Yasmin">
            </div>
        </div>
        
        <div class="welcome-suggestions">
            <button class="suggestion-button">
                <i class="fas fa-book"></i>
                اكتب لي فقرة عن تاريخ اللغة العربية
            </button>
            <button class="suggestion-button">
                <i class="fas fa-lightbulb"></i>
                اقترح أفكار لمشروع برمجي
            </button>
            <button class="suggestion-button">
                <i class="fas fa-code"></i>
                اكتب كود بايثون لتحليل بيانات
            </button>
            <button class="suggestion-button">
                <i class="fas fa-image"></i>
                صف لي كيف أستخدم ميزة توليد الصور
            </button>
        </div>
    `;
    
    messagesContainer.appendChild(welcomeDiv);
    
    // Add event listeners to suggestion buttons
    welcomeDiv.querySelectorAll('.suggestion-button').forEach(button => {
        button.addEventListener('click', () => {
            messageInput.value = button.textContent.trim();
            sendMessage();
        });
    });
}

function showConfirmation(message, actionCallback) {
    confirmMessage.textContent = message;
    
    // Set the action callback
    confirmAction.onclick = () => {
        actionCallback();
        confirmModal.classList.remove('active');
    };
    
    confirmModal.classList.add('active');
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon;
    switch (type) {
        case 'success':
            icon = 'fas fa-check-circle';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            break;
        default:
            icon = 'fas fa-info-circle';
    }
    
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after animation completes
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function exportChat() {
    if (!currentConversationId) {
        showToast('لا توجد محادثة للتصدير', 'error');
        return;
    }
    
    fetch(`/api/conversations/${currentConversationId}`)
    .then(response => response.json())
    .then(data => {
        let chatText = `# ${data.conversation.title}\n`;
        chatText += `# ${new Date(data.conversation.created_at).toLocaleString('ar-SA')}\n\n`;
        
        data.messages.forEach(message => {
            const role = message.role === 'user' ? 'أنت' : 'ياسمين';
            chatText += `## ${role} (${new Date(message.timestamp).toLocaleTimeString('ar-SA')})\n`;
            chatText += message.content + '\n\n';
        });
        
        // Create and download file
        const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `محادثة_ياسمين_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('تم تصدير المحادثة بنجاح', 'success');
    })
    .catch(error => {
        console.error('Error exporting chat:', error);
        showToast('فشل تصدير المحادثة', 'error');
    });
}

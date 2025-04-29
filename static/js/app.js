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
    // تطبيق الوضع الداكن إذا كان مفعلاً
    if (darkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }
    
    // تحميل التخصيصات المحفوظة
    const customFont = localStorage.getItem('customFont') || 'Cairo';
    const customColor = localStorage.getItem('customColor') || '#4361ee';
    
    document.documentElement.style.setProperty('--font-family', customFont);
    document.documentElement.style.setProperty('--primary-color', customColor);
    
    if (fontSelect) fontSelect.value = customFont;
    if (colorPicker) colorPicker.value = customColor;
}

function updateCustomization(type, value) {
    if (type === 'font') {
        document.documentElement.style.setProperty('--font-family', value);
        localStorage.setItem('customFont', value);
    } else if (type === 'color') {
        document.documentElement.style.setProperty('--primary-color', value);
        localStorage.setItem('customColor', value);
    }
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
    // This is called when the dropdown modelSelect is changed
    if (modelSelect) {
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
    
    // Also check if model was changed via sidebar
    const savedModel = localStorage.getItem('model');
    if (savedModel && savedModel !== currentModel) {
        currentModel = savedModel;
        if (modelSelect) {
            modelSelect.value = currentModel;
        }
    }
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
    
    if (!message || isGeneratingResponse) {
        return;
    }
    
    // Add user message to UI
    addMessageToUI('user', message);
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Show typing indicator
    showTypingIndicator();
    
    // Set generating flag
    isGeneratingResponse = true;
    
    // Get the conversation ID (may be null for new conversations)
    const conversationData = {
        message: message,
        conversation_id: currentConversationId,
        model: currentModel,
        temperature: currentTemperature,
        max_tokens: currentMaxTokens
    };
    
    // Send request to the server
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversationData)
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
        
        // Update conversation ID if this was a new conversation
        if (!currentConversationId && data.conversation_id) {
            currentConversationId = data.conversation_id;
            localStorage.setItem('currentConversationId', currentConversationId);
            
            // Add to conversations list
            loadConversations();
        }
        
        // If TTS is enabled, speak the response
        if (textToSpeechEnabled) {
            speakText(data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        removeTypingIndicator();
        showToast('حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى.', 'error');
    })
    .finally(() => {
        isGeneratingResponse = false;
    });
}

function addMessageToUI(role, content) {
    const messageElement = document.createElement('div');
    messageElement.className = `message-bubble ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatMessageContent(content);
    
    messageElement.appendChild(contentDiv);
    
    // Add actions for assistant messages
    if (role === 'assistant') {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        // Add copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'message-action-btn';
        copyButton.innerHTML = '<i class="far fa-copy"></i>';
        copyButton.title = 'نسخ';
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(content).then(() => {
                showToast('تم نسخ الرسالة', 'success');
            });
        });
        
        // Add like button
        const likeButton = document.createElement('button');
        likeButton.className = 'message-action-btn';
        likeButton.innerHTML = '<i class="far fa-thumbs-up"></i>';
        likeButton.title = 'إعجاب';
        likeButton.addEventListener('click', function() {
            this.classList.toggle('liked');
            this.querySelector('i').classList.toggle('far');
            this.querySelector('i').classList.toggle('fas');
            
            // TODO: Send feedback to server
        });
        
        // Add speak button
        const speakButton = document.createElement('button');
        speakButton.className = 'message-action-btn';
        speakButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        speakButton.title = 'قراءة';
        speakButton.addEventListener('click', () => {
            speakText(content);
        });
        
        actionsDiv.appendChild(copyButton);
        actionsDiv.appendChild(likeButton);
        actionsDiv.appendChild(speakButton);
        
        messageElement.appendChild(actionsDiv);
    }
    
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Highlight code blocks with Prism.js if available
    if (window.Prism) {
        Prism.highlightAllUnder(messageElement);
    }
}

function formatMessageContent(content) {
    // Format code blocks (```code```)
    let formattedContent = content.replace(/```([\s\S]*?)```/g, function(match, code) {
        return `<pre><code>${code}</code></pre>`;
    });
    
    // Format inline code (`code`)
    formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Format lists
    formattedContent = formattedContent.replace(/^\s*(-|\*|\d+\.)\s+(.*?)$/gm, '<li>$2</li>');
    formattedContent = formattedContent.replace(/<li>.*?<\/li>(?:\s*\n\s*<li>.*?<\/li>)+/g, function(match) {
        return '<ul>' + match + '</ul>';
    });
    
    // Format paragraphs (simple approach)
    formattedContent = formattedContent.replace(/\n\n/g, '</p><p>');
    formattedContent = '<p>' + formattedContent + '</p>';
    formattedContent = formattedContent.replace(/<p><ul>/g, '<ul>').replace(/<\/ul><\/p>/g, '</ul>');
    
    // Format links
    formattedContent = formattedContent.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return formattedContent;
}

function showTypingIndicator() {
    const typingElement = document.createElement('div');
    typingElement.className = 'message-bubble assistant loading';
    typingElement.id = 'typing-indicator';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    
    contentDiv.appendChild(typingIndicator);
    typingElement.appendChild(contentDiv);
    
    messagesContainer.appendChild(typingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function speakText(text) {
    if (!textToSpeechEnabled) return;
    
    if (useBrowserTTS) {
        useWebSpeechAPI(text);
        return;
    }
    
    // Show speech loading indicator
    showToast('جارٍ إنشاء الصوت...', 'info');
    
    // Use ElevenLabs API
    fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: text,
            voice_id: selectedVoice
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Text-to-speech request failed');
        }
        return response.json();
    })
    .then(data => {
        if (data.audio) {
            // Convert base64 to URL
            const audioData = 'data:audio/mpeg;base64,' + data.audio;
            const audio = new Audio(audioData);
            audio.play();
        } else {
            // Fallback to browser TTS
            console.warn('No audio data received, falling back to browser TTS');
            useWebSpeechAPI(text);
        }
    })
    .catch(error => {
        console.error('Error in text-to-speech:', error);
        // Fallback to browser TTS
        useWebSpeechAPI(text);
    });
}

function useWebSpeechAPI(text) {
    // Check if browser supports speech synthesis
    if (!('speechSynthesis' in window)) {
        console.error('Browser does not support speech synthesis');
        return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language to Arabic
    utterance.lang = 'ar-SA';
    
    // Get available voices
    let voices = window.speechSynthesis.getVoices();
    
    // If voices is empty, wait for voices to load
    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = function() {
            voices = window.speechSynthesis.getVoices();
            setVoice();
        };
    } else {
        setVoice();
    }
    
    function setVoice() {
        // Try to find an Arabic voice
        const arabicVoice = voices.find(v => v.lang.includes('ar'));
        if (arabicVoice) {
            utterance.voice = arabicVoice;
        }
        
        // Speak
        window.speechSynthesis.speak(utterance);
    }
}

function loadConversations() {
    // إظهار حالة التحميل
    conversationsList.innerHTML = '<div class="loading-conversations">جاري تحميل المحادثات...</div>';
    
    fetch('/api/conversations')
        .then(response => {
            // التحقق من استجابة HTTP
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            conversationsList.innerHTML = '';
            console.log('Conversations data:', data); // تسجيل البيانات للتصحيح
            
            if (data.conversations && data.conversations.length > 0) {
                data.conversations.forEach(conversation => {
                    addConversationToList(conversation);
                });
                
                // Set current conversation if not set
                if (!currentConversationId && data.conversations.length > 0) {
                    loadConversation(data.conversations[0].id);
                } else if (currentConversationId) {
                    // Highlight current conversation
                    const currentItem = document.querySelector(`.conversation-item[data-id="${currentConversationId}"]`);
                    if (currentItem) {
                        currentItem.classList.add('active');
                    } else {
                        // إذا لم يتم العثور على المحادثة الحالية، تحميل أول محادثة
                        if (data.conversations.length > 0) {
                            loadConversation(data.conversations[0].id);
                        }
                    }
                }
            } else {
                // No conversations yet
                conversationsList.innerHTML = '<div class="empty-conversations">لا توجد محادثات سابقة</div>';
            }
        })
        .catch(error => {
            console.error('Error loading conversations:', error);
            // عرض رسالة خطأ أكثر تفصيلاً
            conversationsList.innerHTML = '<div class="error-conversations">فشل تحميل المحادثات. يرجى المحاولة مرة أخرى لاحقاً.</div>';
            showToast('حدث خطأ أثناء تحميل المحادثات: ' + error.message, 'error');
        });
}

function addConversationToList(conversation) {
    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    conversationItem.dataset.id = conversation.id;
    
    if (currentConversationId === conversation.id) {
        conversationItem.classList.add('active');
    }
    
    conversationItem.innerHTML = `
        <div class="conversation-info">
            <div class="conversation-title">${conversation.title}</div>
            <div class="conversation-date">${new Date(conversation.last_updated).toLocaleDateString('ar-SA')}</div>
        </div>
        <div class="conversation-delete" title="حذف"><i class="fas fa-trash-alt"></i></div>
    `;
    
    // Add click event to load conversation
    conversationItem.querySelector('.conversation-info').addEventListener('click', () => {
        loadConversation(conversation.id);
    });
    
    // Add click event to delete button
    conversationItem.querySelector('.conversation-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmation(`هل أنت متأكد من رغبتك في حذف المحادثة "${conversation.title}"؟`, () => {
            deleteConversation(conversation.id);
        });
    });
    
    conversationsList.appendChild(conversationItem);
}

function loadConversation(conversationId) {
    // Highlight the selected conversation and unhighlight others
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
    
    // Set current conversation ID
    currentConversationId = conversationId;
    localStorage.setItem('currentConversationId', currentConversationId);
    
    // Clear messages container and show loading
    messagesContainer.innerHTML = '<div class="loading-message">جاري تحميل المحادثة...</div>';
    
    // Fetch conversation messages
    fetch(`/api/conversations/${conversationId}`)
        .then(response => {
            // التحقق من استجابة HTTP
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Conversation data:', data); // للتصحيح
            messagesContainer.innerHTML = ''; // إزالة رسالة التحميل
            
            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(message => {
                    addMessageToUI(message.role, message.content);
                });
                
                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                // إذا لم تكن هناك رسائل في المحادثة
                displayWelcomeMessage();
            }
            
            // Close sidebar on mobile after loading conversation
            if (window.innerWidth < 768) {
                document.body.classList.remove('sidebar-active');
            }
        })
        .catch(error => {
            console.error('Error loading conversation:', error);
            messagesContainer.innerHTML = '<div class="error-message">حدث خطأ أثناء تحميل المحادثة. يرجى المحاولة مرة أخرى.</div>';
            showToast('حدث خطأ أثناء تحميل المحادثة: ' + error.message, 'error');
        });
}

function startNewConversation() {
    // Clear current conversation ID
    currentConversationId = null;
    localStorage.removeItem('currentConversationId');
    
    // Clear messages container
    messagesContainer.innerHTML = '';
    
    // Unhighlight all conversations
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Display welcome message
    displayWelcomeMessage();
    
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        document.body.classList.remove('sidebar-active');
    }
}

function clearConversation() {
    if (!currentConversationId) {
        showToast('لا توجد محادثة لمسحها.', 'error');
        return;
    }
    
    fetch(`/api/conversations/${currentConversationId}/clear`, {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to clear conversation');
            }
            return response.json();
        })
        .then(data => {
            // Clear messages container
            messagesContainer.innerHTML = '';
            
            // Display welcome message
            displayWelcomeMessage();
            
            showToast('تم مسح المحادثة بنجاح', 'success');
        })
        .catch(error => {
            console.error('Error clearing conversation:', error);
            showToast('حدث خطأ أثناء مسح المحادثة', 'error');
        });
}

function deleteConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete conversation');
            }
            return response.json();
        })
        .then(data => {
            // Remove from conversations list
            const conversationItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
            if (conversationItem) {
                conversationItem.remove();
            }
            
            // If it was the current conversation, clear it
            if (currentConversationId === conversationId) {
                currentConversationId = null;
                localStorage.removeItem('currentConversationId');
                messagesContainer.innerHTML = '';
                displayWelcomeMessage();
            }
            
            showToast('تم حذف المحادثة بنجاح', 'success');
            
            // Load first conversation if available
            const firstConversation = document.querySelector('.conversation-item');
            if (firstConversation) {
                loadConversation(firstConversation.dataset.id);
            }
        })
        .catch(error => {
            console.error('Error deleting conversation:', error);
            showToast('حدث خطأ أثناء حذف المحادثة', 'error');
        });
}

function displayWelcomeMessage() {
    const welcomeContainer = document.createElement('div');
    welcomeContainer.className = 'welcome-container';
    
    // Add welcome message
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'message-bubble assistant';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<p>مرحباً! أنا ياسمين، مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟</p>';
    
    welcomeMessage.appendChild(contentDiv);
    welcomeContainer.appendChild(welcomeMessage);
    
    // Add suggestions
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.className = 'welcome-suggestions';
    
    const suggestions = [
        { icon: 'fas fa-book', text: 'أخبريني عن موضوع علمي مثير للاهتمام' },
        { icon: 'fas fa-brain', text: 'اقترحي علي طرقاً لتحسين التركيز' },
        { icon: 'fas fa-code', text: 'ساعديني في كتابة كود برمجي بسيط' },
        { icon: 'fas fa-utensils', text: 'اقترحي علي وصفة طعام صحية' }
    ];
    
    suggestions.forEach(suggestion => {
        const button = document.createElement('button');
        button.className = 'suggestion-button';
        button.innerHTML = `<i class="${suggestion.icon}"></i> ${suggestion.text}`;
        
        button.addEventListener('click', function() {
            document.getElementById('message-input').value = suggestion.text;
            sendMessage();
        });
        
        suggestionsDiv.appendChild(button);
    });
    
    welcomeContainer.appendChild(suggestionsDiv);
    messagesContainer.appendChild(welcomeContainer);
}

function showConfirmation(message, actionCallback) {
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmAction = document.getElementById('confirm-action');
    const confirmCancel = document.getElementById('confirm-cancel');
    
    confirmMessage.textContent = message;
    confirmModal.classList.add('active');
    
    confirmAction.onclick = function() {
        actionCallback();
        confirmModal.classList.remove('active');
    };
    
    confirmCancel.onclick = function() {
        confirmModal.classList.remove('active');
    };
    
    // Close modal when clicking outside
    confirmModal.addEventListener('click', function(e) {
        if (e.target === confirmModal) {
            confirmModal.classList.remove('active');
        }
    });
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function exportChat() {
    const messages = document.querySelectorAll('.message-bubble');
    let chatText = 'محادثة ياسمين\n\n';
    
    messages.forEach(message => {
        const role = message.classList.contains('user') ? 'أنت' : 'ياسمين';
        const content = message.querySelector('.message-content').textContent;
        chatText += `${role}: ${content}\n\n`;
    });
    
    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `yasmin-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    a.remove();
    
    showToast('تم تصدير المحادثة بنجاح', 'success');
}
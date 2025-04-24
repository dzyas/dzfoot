document.addEventListener('DOMContentLoaded', function() {
    // App initialization
    initApp();
});

// Global variables
let currentConversationId = null;
let pendingMessageId = null;
let isTyping = false;
let recognitionActive = false;
let messageQueue = [];
let processingQueue = false;

function initApp() {
    // Load settings from localStorage
    loadSettings();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize speech recognition
    initSpeechRecognition();
    
    // Initialize speech synthesis
    initSpeechSynthesis();
    
    // Fetch conversations list
    fetchConversations();
    
    // Setup display message handling
    if (document.querySelectorAll('#messages .message-bubble').length === 0) {
        displayWelcomeMessage();
    }
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
    
    // Load browser TTS preference
    const useBrowserTTS = localStorage.getItem('useBrowserTTS') === 'true';
    if (document.getElementById('use-browser-tts')) {
        document.getElementById('use-browser-tts').checked = useBrowserTTS;
        toggleElevenLabsVoiceSelector(useBrowserTTS);
    }
    
    // Load voice preference
    if (localStorage.getItem('voiceId')) {
        const voiceSelect = document.getElementById('voice-select');
        if (voiceSelect) {
            voiceSelect.value = localStorage.getItem('voiceId');
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
    
    // Voice select change
    const voiceSelect = document.getElementById('voice-select');
    if (voiceSelect) {
        voiceSelect.addEventListener('change', function() {
            localStorage.setItem('voiceId', this.value);
        });
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
    
    // Toggle sidebar button in dropdown
    const toggleSidebarButton = document.getElementById('sidebar-toggle');
    if (toggleSidebarButton) {
        toggleSidebarButton.addEventListener('click', function() {
            toggleSidebar();
            hideDropdownMenu();
        });
    }
    
    // Mobile menu button (hamburger)
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', toggleSidebar);
    }
    
    // Dark mode toggle switch
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', toggleDarkMode);
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
            showConfirmModal('هل أنت متأكد من رغبتك في مسح هذه المحادثة؟', clearCurrentConversation);
            hideDropdownMenu();
        });
    }
    
    // New conversation button in sidebar
    const newConversationButton = document.getElementById('new-conversation-btn');
    if (newConversationButton) {
        newConversationButton.addEventListener('click', function() {
            createNewConversation();
            closeSidebar();
        });
    }
    
    // Microphone button
    const micButton = document.getElementById('mic-button');
    if (micButton) {
        micButton.addEventListener('click', toggleSpeechRecognition);
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
    
    // Browser TTS toggle
    const browserTtsToggle = document.getElementById('use-browser-tts');
    if (browserTtsToggle) {
        browserTtsToggle.addEventListener('change', function() {
            const useBrowserTts = this.checked;
            localStorage.setItem('useBrowserTTS', useBrowserTts);
            toggleElevenLabsVoiceSelector(useBrowserTts);
        });
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
    
    // Window resize event for mobile adaptations
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
            recognitionActive = false;
            
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
            recognitionActive = false;
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
        
        showToast('التعرف على الصوت غير مدعوم في هذا المتصفح', 'info');
    }
}

function toggleSpeechRecognition() {
    if (!window.recognition) {
        showToast('التعرف على الصوت غير مدعوم في هذا المتصفح', 'error');
        return;
    }
    
    if (recognitionActive) {
        window.recognition.stop();
        recognitionActive = false;
    } else {
        try {
            window.recognition.start();
            recognitionActive = true;
            updateRecordingUI(true);
        } catch (e) {
            showToast('حدث خطأ في بدء التعرف على الصوت', 'error');
        }
    }
}

function updateRecordingUI(isActive) {
    const micButton = document.getElementById('mic-button');
    
    if (isActive) {
        if (micButton) micButton.classList.add('recording');
    } else {
        if (micButton) micButton.classList.remove('recording');
    }
}

function initSpeechSynthesis() {
    // Initialize browser's speech synthesis (for fallback when ElevenLabs is not available)
    if ('speechSynthesis' in window) {
        window.synth = window.speechSynthesis;
        
        // Get Arabic voice if available
        window.speechSynthesis.onvoiceschanged = function() {
            let voices = window.speechSynthesis.getVoices();
            window.arabicVoice = voices.find(voice => voice.lang.includes('ar')) || voices[0];
        };
        
        // Try to load voices immediately (some browsers need this)
        if (window.speechSynthesis.getVoices().length > 0) {
            let voices = window.speechSynthesis.getVoices();
            window.arabicVoice = voices.find(voice => voice.lang.includes('ar')) || voices[0];
        }
    }
    
    // Initialize ElevenLabs audio player
    window.audioPlayer = new Audio();
}

function toggleElevenLabsVoiceSelector(useBrowserTTS) {
    // Show/hide ElevenLabs voice selector based on browser TTS preference
    const voiceSelector = document.getElementById('elevenlabs-voices');
    if (voiceSelector) {
        voiceSelector.style.display = useBrowserTTS ? 'none' : 'block';
    }
}

function speakText(text) {
    // Check if text-to-speech is enabled
    if (localStorage.getItem('textToSpeech') === 'false') {
        return;
    }
    
    // Check if browser TTS is preferred
    const useBrowserTTS = localStorage.getItem('useBrowserTTS') === 'true';
    
    if (useBrowserTTS) {
        // Use browser's built-in speech synthesis
        if ('speechSynthesis' in window && window.synth) {
            // Cancel any ongoing speech
            window.synth.cancel();
            
            // Create a new utterance
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Set language to Arabic
            utterance.lang = 'ar';
            
            // Set voice if we have an Arabic voice
            if (window.arabicVoice) {
                utterance.voice = window.arabicVoice;
            }
            
            // Adjust speech parameters for better Arabic pronunciation
            utterance.pitch = 1;
            utterance.rate = 0.9; // Slightly slower for clearer Arabic pronunciation
            utterance.volume = 1;
            
            // Speak the text
            window.synth.speak(utterance);
        } else {
            console.warn('Browser speech synthesis not available');
        }
    } else {
        // ElevenLabs will handle TTS via the API
        // Note: Nothing to do here, as the server-side handles calling ElevenLabs
        // The audio data will be returned with the API response
    }
}

function stopSpeaking() {
    // Stop browser's speech synthesis
    if ('speechSynthesis' in window && window.synth) {
        window.synth.cancel();
    }
    
    // Stop ElevenLabs audio
    if (window.audioPlayer) {
        window.audioPlayer.pause();
        window.audioPlayer.currentTime = 0;
    }
}

// Play audio from ElevenLabs using base64 data
function playAudioFromBase64(base64Audio) {
    if (!base64Audio) return;
    
    // Check if text-to-speech is enabled
    if (localStorage.getItem('textToSpeech') === 'false') {
        return;
    }
    
    // Stop any ongoing speech first
    stopSpeaking();
    
    // Convert base64 to blob URL
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(blob);
    
    // Play the audio
    window.audioPlayer.src = audioUrl;
    window.audioPlayer.play().catch(error => {
        console.error('Error playing audio:', error);
        showToast('حدث خطأ في تشغيل الصوت', 'error');
    });
}

function toggleDropdownMenu() {
    const dropdown = document.getElementById('dropdown-menu');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

function hideDropdownMenu() {
    const dropdown = document.getElementById('dropdown-menu');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

function toggleSidebar() {
    document.body.classList.toggle('sidebar-active');
}

function openSidebar() {
    document.body.classList.add('sidebar-active');
}

function closeSidebar() {
    document.body.classList.remove('sidebar-active');
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function adjustInputHeight() {
    const textarea = this;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = newHeight + 'px';
}

function saveModelPreference() {
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
        localStorage.setItem('model', modelSelect.value);
    }
}

function updateTemperatureValue() {
    const temperatureValue = document.getElementById('temperature-value');
    if (temperatureValue) {
        temperatureValue.textContent = this.value;
    }
}

function saveMaxTokens() {
    const maxTokensInput = document.getElementById('max-tokens');
    if (maxTokensInput) {
        localStorage.setItem('maxTokens', maxTokensInput.value);
    }
}

function saveTextToSpeechPreference() {
    const textToSpeechToggle = document.getElementById('text-to-speech-toggle');
    if (textToSpeechToggle) {
        localStorage.setItem('textToSpeech', textToSpeechToggle.checked);
    }
}

function showConfirmModal(message, confirmCallback) {
    const modal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    
    if (modal && confirmMessage) {
        confirmMessage.textContent = message;
        modal.classList.add('active');
        
        // Store the callback to execute when confirmed
        window.confirmCallback = confirmCallback;
    }
}

function handleConfirmation() {
    if (window.confirmCallback) {
        window.confirmCallback();
        closeConfirmModal();
    }
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        default:
            icon = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function fetchConversations() {
    fetch('/api/conversations')
        .then(response => {
            if (!response.ok) {
                throw new Error('فشل في جلب المحادثات');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                renderConversationsList(data.conversations);
                
                // If no active conversation, load the most recent one
                if (!currentConversationId && data.conversations.length > 0) {
                    loadConversation(data.conversations[0].id);
                }
            } else {
                showToast('فشل في جلب المحادثات: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error fetching conversations:', error);
            showToast('حدث خطأ أثناء جلب المحادثات', 'error');
        });
}

function renderConversationsList(conversations) {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) return;
    
    // Clear the list
    conversationsList.innerHTML = '';
    
    if (conversations.length === 0) {
        conversationsList.innerHTML = '<div class="empty-conversations">لا توجد محادثات سابقة</div>';
        return;
    }
    
    // Add conversations to the list
    conversations.forEach(conversation => {
        const conversationItem = document.createElement('div');
        conversationItem.className = 'conversation-item';
        if (conversation.id === currentConversationId) {
            conversationItem.classList.add('active');
        }
        
        // Format date
        const date = new Date(conversation.updated_at);
        const formattedDate = formatDate(date);
        
        conversationItem.innerHTML = `
            <div class="conversation-info" data-id="${conversation.id}">
                <div class="conversation-title">${conversation.title}</div>
                <div class="conversation-date">${formattedDate}</div>
            </div>
            <button class="conversation-delete" data-id="${conversation.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        conversationsList.appendChild(conversationItem);
        
        // Add click event for loading the conversation
        const conversationInfo = conversationItem.querySelector('.conversation-info');
        conversationInfo.addEventListener('click', function() {
            loadConversation(this.dataset.id);
            closeSidebar();
        });
        
        // Add click event for deleting the conversation
        const deleteButton = conversationItem.querySelector('.conversation-delete');
        deleteButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const convId = this.dataset.id;
            showConfirmModal('هل أنت متأكد من رغبتك في حذف هذه المحادثة؟', () => deleteConversation(convId));
        });
    });
}

function loadConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('فشل في جلب المحادثة');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Set current conversation
                currentConversationId = conversationId;
                
                // Clear messages area
                const messagesContainer = document.getElementById('messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
                
                // Add messages to the UI
                if (data.conversation.messages.length > 0) {
                    data.conversation.messages.forEach(message => {
                        addMessageToUI(message.role, message.content, new Date(message.created_at));
                    });
                    
                    // Scroll to bottom
                    scrollToBottom();
                } else {
                    // Show welcome message if conversation is empty
                    displayWelcomeMessage();
                }
                
                // Update active conversation in sidebar
                updateActiveConversation(conversationId);
            } else {
                showToast('فشل في جلب المحادثة: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error loading conversation:', error);
            showToast('حدث خطأ أثناء جلب المحادثة', 'error');
        });
}

function updateActiveConversation(conversationId) {
    // Update active class in sidebar
    const conversationItems = document.querySelectorAll('.conversation-item');
    conversationItems.forEach(item => {
        const infoElement = item.querySelector('.conversation-info');
        if (infoElement && infoElement.dataset.id === conversationId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function createNewConversation() {
    fetch('/api/conversations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('فشل في إنشاء محادثة جديدة');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Set current conversation to the new one
                currentConversationId = data.conversation.id;
                
                // Clear messages area and show welcome message
                const messagesContainer = document.getElementById('messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                    displayWelcomeMessage();
                }
                
                // Refresh conversations list
                fetchConversations();
                
                showToast('تم إنشاء محادثة جديدة', 'success');
            } else {
                showToast('فشل في إنشاء محادثة جديدة: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error creating new conversation:', error);
            showToast('حدث خطأ أثناء إنشاء محادثة جديدة', 'error');
        });
}

function deleteConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('فشل في حذف المحادثة');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showToast('تم حذف المحادثة بنجاح', 'success');
                
                // If the deleted conversation is the current one, create a new one
                if (conversationId === currentConversationId) {
                    createNewConversation();
                }
                
                // Refresh conversations list
                fetchConversations();
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
    if (!currentConversationId) {
        createNewConversation();
        return;
    }
    
    fetch(`/api/conversations/${currentConversationId}/clear`, {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('فشل في مسح المحادثة');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showToast('تم مسح المحادثة بنجاح', 'success');
                
                // Clear messages area and show welcome message
                const messagesContainer = document.getElementById('messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                    displayWelcomeMessage();
                }
                
                // Refresh conversations list
                fetchConversations();
            } else {
                showToast('فشل في مسح المحادثة: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error clearing conversation:', error);
            showToast('حدث خطأ أثناء مسح المحادثة', 'error');
        });
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Focus back on input
    messageInput.focus();
    
    // Add message to UI immediately
    const userMessageTimestamp = new Date();
    addMessageToUI('user', message, userMessageTimestamp);
    
    // Show typing indicator
    showTypingIndicator();
    
    // Scroll to bottom
    scrollToBottom();
    
    // Get current settings
    const model = getSelectedModel();
    const temperature = getTemperature();
    const maxTokens = getMaxTokens();
    
    // If no current conversation, use 'new'
    const conversationId = currentConversationId || 'new';
    
    // Check if text-to-speech is enabled
    const voice_enabled = document.getElementById('text-to-speech-toggle') && 
                          document.getElementById('text-to-speech-toggle').checked;
    
    // Get selected voice if available
    const voice_id = document.getElementById('voice-select') ? 
                     document.getElementById('voice-select').value : 
                     'EXAVITQu4vr4xnSDxMaL';
    
    // Send message to API
    fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            model,
            temperature,
            max_tokens: maxTokens,
            voice_enabled,
            voice_id
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('فشل في إرسال الرسالة');
            }
            return response.json();
        })
        .then(data => {
            // Remove typing indicator
            hideTypingIndicator();
            
            if (data.success) {
                // If this was a new conversation, update the ID
                if (!currentConversationId || currentConversationId === 'new') {
                    currentConversationId = data.conversation_id;
                    fetchConversations(); // Refresh the list to show the new conversation
                }
                
                // Add assistant response to UI
                const assistantMessage = data.messages[1]; // Second message is the assistant's response
                addMessageToUI('assistant', assistantMessage.content, new Date(assistantMessage.created_at));
                
                // Check if we have audio data from ElevenLabs
                if (data.audio) {
                    // Play audio from ElevenLabs
                    playAudioFromBase64(data.audio);
                } else {
                    // Fallback to browser's speech synthesis
                    speakText(assistantMessage.content);
                }
                
                // Scroll to bottom
                scrollToBottom();
            } else {
                showToast('فشل في إرسال الرسالة: ' + data.error, 'error');
                
                // Add error message
                addMessageToUI('assistant', 'عذراً، حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.', new Date());
            }
        })
        .catch(error => {
            // Remove typing indicator
            hideTypingIndicator();
            
            console.error('Error sending message:', error);
            showToast('حدث خطأ أثناء إرسال الرسالة', 'error');
            
            // Add error message
            addMessageToUI('assistant', 'عذراً، حدث خطأ في الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.', new Date());
            
            // Scroll to bottom
            scrollToBottom();
        });
}

function getSelectedModel() {
    const modelSelect = document.getElementById('model-select');
    return modelSelect ? modelSelect.value : 'gemini-1.5-pro';
}

function getTemperature() {
    const temperatureSlider = document.getElementById('temperature-slider');
    return temperatureSlider ? parseFloat(temperatureSlider.value) : 0.7;
}

function getMaxTokens() {
    const maxTokensInput = document.getElementById('max-tokens');
    return maxTokensInput ? parseInt(maxTokensInput.value) : 2000;
}

function addMessageToUI(role, content, timestamp) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message-bubble ${role}`;
    
    // Create avatar based on role
    const avatarSrc = role === 'user' ? 
        '/static/img/user-avatar.jpg' : 
        '/static/img/yasmin-avatar.png';
    
    // Format timestamp
    const formattedTime = formatTime(timestamp);
    
    // Handle markdown-like content
    const formattedContent = formatMessageContent(content);
    
    // Construct message HTML
    messageElement.innerHTML = `
        <div class="message-avatar">
            <img src="${avatarSrc}" alt="${role} avatar">
        </div>
        <div class="message-content">
            ${formattedContent}
            <div class="message-time">${formattedTime}</div>
        </div>
    `;
    
    // Add action buttons for assistant messages
    if (role === 'assistant') {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.innerHTML = `
            <button class="message-action-btn copy-btn" title="نسخ الرسالة">
                <i class="fas fa-copy"></i>
            </button>
            <button class="message-action-btn like-btn" title="إعجاب">
                <i class="fas fa-heart"></i>
            </button>
            <button class="message-action-btn share-btn" title="مشاركة">
                <i class="fas fa-share-alt"></i>
            </button>
        `;
        
        // Add event listener for copy button
        const copyBtn = actionsDiv.querySelector('.copy-btn');
        copyBtn.addEventListener('click', function() {
            const textToCopy = content;
            navigator.clipboard.writeText(textToCopy).then(function() {
                showToast('تم نسخ الرسالة بنجاح!', 'success');
            }, function() {
                showToast('فشل في نسخ الرسالة', 'error');
            });
        });
        
        // Add event listener for like button
        const likeBtn = actionsDiv.querySelector('.like-btn');
        likeBtn.addEventListener('click', function() {
            this.classList.toggle('liked');
            if(this.classList.contains('liked')) {
                this.style.color = '#e74c3c';
                showToast('أعجبتك هذه الرسالة', 'success');
            } else {
                this.style.color = '';
                showToast('تم إلغاء الإعجاب', 'info');
            }
        });
        
        // Add event listener for share button
        const shareBtn = actionsDiv.querySelector('.share-btn');
        shareBtn.addEventListener('click', function() {
            showToast('جاري مشاركة الرسالة...', 'info');
        });
        
        messageElement.appendChild(actionsDiv);
    }
    
    // Add message to container
    messagesContainer.appendChild(messageElement);
}

function formatMessageContent(content) {
    // Replace code blocks
    let formatted = content.replace(/```([\s\S]*?)```/g, function(match, code) {
        return `<pre>${escapeHtml(code)}</pre>`;
    });
    
    // Replace inline code
    formatted = formatted.replace(/`([^`]+)`/g, function(match, code) {
        return `<code>${escapeHtml(code)}</code>`;
    });
    
    // Replace links
    formatted = formatted.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Replace line breaks with paragraphs
    formatted = '<p>' + formatted.replace(/\n\n+/g, '</p><p>') + '</p>';
    
    // Replace single line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    // Remove any existing typing indicators
    hideTypingIndicator();
    
    // Create typing indicator
    const typingElement = document.createElement('div');
    typingElement.className = 'message-bubble assistant';
    typingElement.id = 'typing-indicator';
    
    typingElement.innerHTML = `
        <div class="message-avatar">
            <img src="/static/img/yasmin-avatar.png" alt="Yasmin avatar">
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    `;
    
    // Add to container
    messagesContainer.appendChild(typingElement);
    
    // Scroll to bottom
    scrollToBottom();
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function displayWelcomeMessage() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    const welcomeElement = document.createElement('div');
    welcomeElement.className = 'welcome-container';
    
    welcomeElement.innerHTML = `
        <div class="welcome-avatar">
            <img src="/static/img/yasmin-avatar.png" alt="Yasmin avatar">
        </div>
        <div class="welcome-message">
            <h1>مرحباً بك في ياسمين!</h1>
            <p>أنا مساعدك الذكي باللغة العربية. يمكنني الإجابة على أسئلتك، وتقديم المعلومات، والمساعدة في مختلف المهام.</p>
        </div>
        
        <div class="welcome-suggestions">
            <button class="suggestion-button" data-text="ما هي أبرز الأخبار العالمية اليوم؟">
                ما هي أبرز الأخبار العالمية اليوم؟
            </button>
            <button class="suggestion-button" data-text="اكتب لي قصة قصيرة عن الذكاء الاصطناعي">
                اكتب لي قصة قصيرة عن الذكاء الاصطناعي
            </button>
            <button class="suggestion-button" data-text="أحتاج صورة في رسم البورتريه. إنه محيط.">
                أحتاج صورة في رسم البورتريه. إنه محيط.
            </button>
        </div>
    `;
    
    messagesContainer.appendChild(welcomeElement);
    
    // Add event listeners to suggestion buttons
    const suggestionButtons = welcomeElement.querySelectorAll('.suggestion-button');
    suggestionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const text = this.dataset.text;
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = text;
                sendMessage();
            }
        });
    });
}

function scrollToBottom() {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function formatTime(date) {
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    
    // Today
    if (date.toDateString() === now.toDateString()) {
        return 'اليوم ' + date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }
    // Yesterday
    else if (date.toDateString() === yesterday.toDateString()) {
        return 'الأمس ' + date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }
    // Other days
    else {
        return date.toLocaleDateString('ar-SA', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

function adjustUIForScreenSize() {
    // Handle mobile-specific UI adjustments
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
        // Any mobile-specific adjustments can be made here
    } else {
        // Any desktop-specific adjustments can be made here
        closeSidebar();
    }
}

// Yasmin Chat Application - Main JavaScript File
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const settingsSidebar = document.getElementById('settings-sidebar');
    const toggleSidebarButton = document.getElementById('toggle-sidebar');
    const closeSidebarButton = document.getElementById('close-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const newConversationButton = document.getElementById('new-conversation');
    const conversationsList = document.getElementById('conversations-list');
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const likeButton = document.getElementById('like-button');
    const dislikeButton = document.getElementById('dislike-button');
    const mobileRecordButton = document.getElementById('mobile-record-button');
    const modelSelect = document.getElementById('model-select');
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValueSpan = document.getElementById('temperature-value');
    const maxTokensInput = document.getElementById('max-tokens-input');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const ttsToggle = document.getElementById('tts-toggle');
    const offlineIndicator = document.getElementById('offline-indicator');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkButton = document.getElementById('confirm-ok');
    const confirmCancelButton = document.getElementById('confirm-cancel');

    // State Variables
    let currentConversationId = null;
    let messages = [];
    let isTyping = false;
    let confirmationCallback = null;
    let lastMessageTimestamp = null;
    let isRecording = false;
    let recognition = null;
    let speakingUtterance = null;
    let availableVoices = [];

    // Constants
    const WELCOME_MESSAGE = {
        role: 'assistant',
        content: 'مرحباً، أنا ياسمين مساعدتك الذكية. كيف يمكنني مساعدتك اليوم؟'
    };
    const DEFAULT_MODEL = 'mistral-7b-instruct';
    const DEFAULT_TEMPERATURE = 0.7;
    const DEFAULT_MAX_TOKENS = 512;
    const OFFLINE_MESSAGE = 'أعتذر، لا يمكنني معالجة طلبك الآن. يبدو أن هناك مشكلة في الاتصال بالإنترنت.';

    // Predefined responses for specific queries
    const PREDEFINED_RESPONSES = {
        'من صنعك': 'تم تطويري بواسطة فريق من المهندسين المختصين في الذكاء الاصطناعي واللغة العربية.',
        'من انت': 'أنا ياسمين، مساعدة ذكية تعمل بتقنية الذكاء الاصطناعي ومصممة خصيصًا للتواصل باللغة العربية.',
    };

    // Initialize Application
    initApp();

    // Main Initialization Function
    function initApp() {
        loadSettings();
        setupEventListeners();
        initSpeechRecognition();
        initSpeechSynthesis();
        checkConnectionStatus();
        fetchConversations();
        
        // Display welcome message if no conversation is loaded
        if (!currentConversationId) {
            displayWelcomeMessage();
        }
    }

    // Load User Settings from localStorage
    function loadSettings() {
        // Load dark mode setting
        const darkMode = localStorage.getItem('darkMode') === 'true';
        darkModeToggle.checked = darkMode;
        if (darkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // Load TTS setting
        const ttsEnabled = localStorage.getItem('ttsEnabled') === 'true';
        ttsToggle.checked = ttsEnabled;
        
        // Load model preference
        const savedModel = localStorage.getItem('preferredModel') || DEFAULT_MODEL;
        
        // Populate model select options
        const models = [
            { id: 'mistral-7b-instruct', name: 'ميسترال 7B' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'llama3-70b', name: 'Llama3 70B' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
        ];
        
        modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });
        
        modelSelect.value = savedModel;
        
        // Load temperature and max tokens
        const savedTemperature = parseFloat(localStorage.getItem('temperature')) || DEFAULT_TEMPERATURE;
        temperatureSlider.value = savedTemperature;
        temperatureValueSpan.textContent = savedTemperature;
        
        const savedMaxTokens = parseInt(localStorage.getItem('maxTokens')) || DEFAULT_MAX_TOKENS;
        maxTokensInput.value = savedMaxTokens;
    }

    // Set up all event listeners
    function setupEventListeners() {
        // Sidebar toggle events
        if (toggleSidebarButton) {
            toggleSidebarButton.addEventListener('click', toggleSidebar);
        }
        
        if (closeSidebarButton) {
            closeSidebarButton.addEventListener('click', closeSidebar);
        }
        
        if (mobileMenuButton) {
            mobileMenuButton.addEventListener('click', openSidebar);
        }
        
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', closeSidebar);
        }
        
        // New conversation button
        if (newConversationButton) {
            newConversationButton.addEventListener('click', createNewConversation);
        }
        
        // Send message events
        if (sendButton) {
            sendButton.addEventListener('click', sendMessage);
        }
        
        if (messageInput) {
            messageInput.addEventListener('keydown', handleInputKeydown);
            // Auto-resize textarea as user types
            messageInput.addEventListener('input', adjustInputHeight);
        }
        
        // Microphone button
        if (micButton) {
            micButton.addEventListener('click', toggleSpeechRecognition);
        }
        
        if (mobileRecordButton) {
            mobileRecordButton.addEventListener('click', toggleSpeechRecognition);
        }
        
        // Feedback buttons
        if (likeButton) {
            likeButton.addEventListener('click', () => {
                likeButton.classList.toggle('active');
                if (likeButton.classList.contains('active')) {
                    dislikeButton.classList.remove('active');
                }
            });
        }
        
        if (dislikeButton) {
            dislikeButton.addEventListener('click', () => {
                dislikeButton.classList.toggle('active');
                if (dislikeButton.classList.contains('active')) {
                    likeButton.classList.remove('active');
                }
            });
        }
        
        // Settings change events
        if (modelSelect) {
            modelSelect.addEventListener('change', saveModelPreference);
        }
        
        if (temperatureSlider) {
            temperatureSlider.addEventListener('input', updateTemperatureValue);
        }
        
        if (maxTokensInput) {
            maxTokensInput.addEventListener('change', saveMaxTokens);
        }
        
        if (darkModeToggle) {
            darkModeToggle.addEventListener('change', toggleDarkMode);
        }
        
        if (ttsToggle) {
            ttsToggle.addEventListener('change', saveTextToSpeechPreference);
        }
        
        // Modal buttons
        if (confirmOkButton) {
            confirmOkButton.addEventListener('click', handleConfirmation);
        }
        
        if (confirmCancelButton) {
            confirmCancelButton.addEventListener('click', closeConfirmModal);
        }
        
        // Suggestion chips
        const suggestionChips = document.querySelectorAll('.suggestion-chip');
        suggestionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                if (messageInput) {
                    messageInput.value = chip.textContent.trim();
                    sendMessage();
                }
            });
        });
        
        // Clear chat button
        const clearChatButton = document.querySelector('.clear-chat-button');
        if (clearChatButton) {
            clearChatButton.addEventListener('click', () => {
                showConfirmModal('هل أنت متأكد من مسح المحادثة؟', () => {
                    messagesContainer.innerHTML = '';
                    currentConversationId = null;
                    messages = [];
                    displayWelcomeMessage();
                });
            });
        }
        
        // Online/Offline detection
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
        
        // Window resize to adjust UI
        window.addEventListener('resize', adjustUIForScreenSize);
    }

    // Initialize Speech Recognition - will add full functionality later
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            console.log('Speech Recognition API is supported');
            recognition = new SpeechRecognition();
            recognition.lang = 'ar-SA'; // Set language to Arabic
        } else {
            console.warn('Speech Recognition API not supported in this browser');
        }
    }

    // Placeholder for speech recognition toggle - will implement fully later
    function toggleSpeechRecognition() {
        console.log('Speech recognition toggle clicked');
    }

    // Initialize Speech Synthesis
    function initSpeechSynthesis() {
        if (window.speechSynthesis) {
            // Load available voices
            const loadVoices = () => {
                availableVoices = window.speechSynthesis.getVoices();
                console.log(`${availableVoices.length} voices loaded`);
            };
            
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
            
            loadVoices();
            
            // Try to load voices again after a delay if needed
            if (availableVoices.length === 0) {
                setTimeout(loadVoices, 500);
            }
        } else {
            console.warn('Speech Synthesis API not supported in this browser');
        }
    }

    // Speak text using Speech Synthesis
    function speakText(text) {
        if (!window.speechSynthesis || !text || !ttsToggle.checked) {
            return;
        }
        
        // Stop any currently speaking utterance
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar';
            utterance.rate = 0.9; // Slightly slower for Arabic
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // Find Arabic voice if available
            const arabicVoices = availableVoices.filter(voice => 
                voice.lang === 'ar' || 
                voice.lang.startsWith('ar-') ||
                voice.name.toLowerCase().includes('arab')
            );
            
            if (arabicVoices.length > 0) {
                utterance.voice = arabicVoices[0];
            }
            
            speakingUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Error speaking text:', error);
        }
    }

    // Check connection status
    function checkConnectionStatus() {
        updateConnectionStatus();
        // Periodically check connection
        setInterval(updateConnectionStatus, 30000);
    }

    // Update online/offline indicator
    function updateConnectionStatus() {
        if (navigator.onLine) {
            offlineIndicator.style.display = 'none';
        } else {
            offlineIndicator.style.display = 'block';
        }
    }

    // Fetch conversations from the server
    function fetchConversations() {
        fetch('/api/conversations')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch conversations');
                }
                return response.json();
            })
            .then(data => {
                renderConversationsList(data.conversations);
            })
            .catch(error => {
                console.error('Error fetching conversations:', error);
                // If offline, try to load from localStorage
                const savedConversations = JSON.parse(localStorage.getItem('conversations') || '[]');
                if (savedConversations.length > 0) {
                    renderConversationsList(savedConversations);
                }
            });
    }

    // Render conversations list
    function renderConversationsList(conversations) {
        conversationsList.innerHTML = '';
        
        if (conversations.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'لا توجد محادثات سابقة';
            conversationsList.appendChild(emptyState);
            return;
        }
        
        // Sort conversations by most recent first
        conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        conversations.forEach(conversation => {
            const conversationItem = document.createElement('div');
            conversationItem.className = 'conversation-item';
            if (conversation.id === currentConversationId) {
                conversationItem.classList.add('active');
            }
            
            const title = document.createElement('div');
            title.className = 'conversation-title';
            title.textContent = conversation.title;
            
            const actions = document.createElement('div');
            actions.className = 'conversation-actions';
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'icon-button';
            deleteButton.title = 'حذف المحادثة';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirmModal('هل أنت متأكد من حذف هذه المحادثة؟', () => {
                    deleteConversation(conversation.id);
                });
            });
            
            actions.appendChild(deleteButton);
            conversationItem.appendChild(title);
            conversationItem.appendChild(actions);
            
            conversationItem.addEventListener('click', () => {
                loadConversation(conversation.id);
            });
            
            conversationsList.appendChild(conversationItem);
        });
    }

    // Create a new conversation
    function createNewConversation() {
        // Reset current state
        currentConversationId = null;
        messages = [];
        messagesContainer.innerHTML = '';
        
        // Show welcome message
        displayWelcomeMessage();
        
        // Close sidebar on mobile
        closeSidebar();
        
        // Clear the input
        messageInput.value = '';
        messageInput.focus();
    }

    // Load a conversation
    function loadConversation(conversationId) {
        fetch(`/api/conversations/${conversationId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch conversation');
                }
                return response.json();
            })
            .then(data => {
                currentConversationId = conversationId;
                
                // Update active state in conversation list
                const conversationItems = conversationsList.querySelectorAll('.conversation-item');
                conversationItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.querySelector('.conversation-title').textContent === data.title) {
                        item.classList.add('active');
                    }
                });
                
                // Render messages
                messages = data.messages;
                renderMessages(messages);
                
                // Close sidebar on mobile
                closeSidebar();
            })
            .catch(error => {
                console.error('Error loading conversation:', error);
                showError('حدث خطأ أثناء تحميل المحادثة. يرجى المحاولة مرة أخرى.');
            });
    }

    // Delete a conversation
    function deleteConversation(conversationId) {
        fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to delete conversation');
                }
                
                // If deleting current conversation, create a new one
                if (conversationId === currentConversationId) {
                    createNewConversation();
                }
                
                // Refresh conversations list
                fetchConversations();
            })
            .catch(error => {
                console.error('Error deleting conversation:', error);
                showError('حدث خطأ أثناء حذف المحادثة. يرجى المحاولة مرة أخرى.');
            });
    }

    // Display welcome message
    function displayWelcomeMessage() {
        messages = [WELCOME_MESSAGE];
        renderMessages(messages);
    }

    // Render messages in the UI
    function renderMessages(messagesToRender) {
        messagesContainer.innerHTML = '';
        
        messagesToRender.forEach((message, index) => {
            const messageElement = createMessageElement(message, index);
            messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        scrollToBottom();
    }

    // Create message element
    function createMessageElement(message, index) {
        const isUser = message.role === 'user';
        const bubbleClass = isUser ? 'user-bubble' : 'ai-bubble';
        
        const messageElement = document.createElement('div');
        messageElement.className = `message-bubble ${bubbleClass}`;
        messageElement.setAttribute('data-index', index);
        
        // Avatar
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.src = isUser 
            ? '/static/img/user-avatar.svg'
            : '/static/img/yasmin-avatar.svg';
        avatar.alt = isUser ? 'أنت' : 'ياسمين';
        
        // Content
        const content = document.createElement('p');
        content.innerHTML = formatMessageContent(message.content);
        
        // Timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        
        if (message.created_at) {
            const date = new Date(message.created_at);
            timestamp.textContent = formatTime(date);
        } else {
            const date = new Date();
            timestamp.textContent = formatTime(date);
        }
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        
        // Copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-btn';
        copyButton.title = 'نسخ النص';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.addEventListener('click', () => {
            copyToClipboard(message.content);
        });
        
        actions.appendChild(copyButton);
        
        // Extra actions for assistant messages
        if (!isUser) {
            // Speak button (if browser supports speech synthesis)
            if (window.speechSynthesis) {
                const speakButton = document.createElement('button');
                speakButton.className = 'speak-btn';
                speakButton.title = 'استماع إلى الرد';
                speakButton.innerHTML = '<i class="fas fa-volume-up"></i>';
                speakButton.addEventListener('click', () => {
                    speakText(message.content);
                });
                actions.appendChild(speakButton);
            }
            
            // Vote buttons
            const voteButtons = document.createElement('div');
            voteButtons.className = 'vote-buttons';
            
            const likeButton = document.createElement('button');
            likeButton.className = 'like-btn';
            likeButton.title = 'أعجبني';
            likeButton.setAttribute('data-vote-type', 'like');
            likeButton.innerHTML = '<i class="fas fa-thumbs-up"></i>';
            
            const dislikeButton = document.createElement('button');
            dislikeButton.className = 'dislike-btn';
            dislikeButton.title = 'لم يعجبني';
            dislikeButton.setAttribute('data-vote-type', 'dislike');
            dislikeButton.innerHTML = '<i class="fas fa-thumbs-down"></i>';
            
            voteButtons.appendChild(likeButton);
            voteButtons.appendChild(dislikeButton);
            actions.appendChild(voteButtons);
        }
        
        // Assemble the message
        messageElement.appendChild(content);
        messageElement.appendChild(timestamp);
        messageElement.appendChild(actions);
        messageElement.appendChild(avatar);
        
        return messageElement;
    }

    // Format message content (handle emojis, links, etc.)
    function formatMessageContent(content) {
        if (!content) return '';
        
        // Convert links to clickable anchors
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        content = content.replace(urlRegex, url => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
        
        // Convert line breaks to <br>
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }

    // Format time for messages
    function formatTime(date) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'م' : 'ص';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
        
        return `${formattedHours}:${formattedMinutes} ${ampm}`;
    }

    // Send a message
    function sendMessage() {
        const content = messageInput.value.trim();
        
        if (!content || isTyping) return;
        
        // Add user message to the UI immediately
        const userMessage = { role: 'user', content };
        messages.push(userMessage);
        
        const userMessageElement = createMessageElement(userMessage, messages.length - 1);
        messagesContainer.appendChild(userMessageElement);
        scrollToBottom();
        
        // Reset input
        messageInput.value = '';
        adjustInputHeight();
        
        // Set typing state
        isTyping = true;
        
        // Check for predefined responses
        const predefinedResponse = checkPredefinedResponse(content);
        if (predefinedResponse) {
            // Simulate API delay
            setTimeout(() => {
                addAssistantResponse(predefinedResponse);
            }, 500);
            return;
        }
        
        // Check if offline
        if (!navigator.onLine) {
            setTimeout(() => {
                addAssistantResponse(OFFLINE_MESSAGE);
            }, 500);
            return;
        }
        
        // Create typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `
            <div class="dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span>ياسمين تكتب...</span>
        `;
        messagesContainer.appendChild(typingIndicator);
        scrollToBottom();
        
        // Get model parameters
        const model = modelSelect.value;
        const temperature = parseFloat(temperatureSlider.value);
        const maxTokens = parseInt(maxTokensInput.value);
        
        // Prepare data for API
        const requestData = {
            messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
            model,
            temperature,
            max_tokens: maxTokens
        };
        
        // If we have a conversation ID, use it
        const url = currentConversationId 
            ? `/api/conversations/${currentConversationId}/messages`
            : '/api/conversations';
        
        // Send request to the server
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to send message');
                }
                return response.json();
            })
            .then(data => {
                // Remove typing indicator
                const indicator = document.querySelector('.typing-indicator');
                if (indicator) {
                    indicator.remove();
                }
                
                if (!currentConversationId && data.conversation_id) {
                    // New conversation was created
                    currentConversationId = data.conversation_id;
                    fetchConversations(); // Refresh the conversations list
                }
                
                // Add assistant response to UI
                const assistantMessage = { 
                    role: 'assistant', 
                    content: data.response,
                    created_at: new Date().toISOString()
                };
                
                messages.push(assistantMessage);
                
                const assistantMessageElement = createMessageElement(
                    assistantMessage,
                    messages.length - 1
                );
                
                messagesContainer.appendChild(assistantMessageElement);
                scrollToBottom();
                
                // Reset typing state
                isTyping = false;
                
                // Speak response if TTS is enabled
                if (ttsToggle.checked) {
                    speakText(data.response);
                }
            })
            .catch(error => {
                console.error('Error sending message:', error);
                
                // Remove typing indicator
                const indicator = document.querySelector('.typing-indicator');
                if (indicator) {
                    indicator.remove();
                }
                
                // Add error message
                addAssistantResponse('عذرًا، حدث خطأ أثناء معالجة الرسالة. يرجى المحاولة مرة أخرى.');
                
                // Reset typing state
                isTyping = false;
            });
    }

    // Add assistant response to the UI
    function addAssistantResponse(content) {
        const assistantMessage = { 
            role: 'assistant', 
            content,
            created_at: new Date().toISOString()
        };
        
        messages.push(assistantMessage);
        
        const assistantMessageElement = createMessageElement(
            assistantMessage,
            messages.length - 1
        );
        
        messagesContainer.appendChild(assistantMessageElement);
        scrollToBottom();
        
        // Reset typing state
        isTyping = false;
        
        // Speak response if TTS is enabled
        if (ttsToggle.checked) {
            speakText(content);
        }
    }

    // Check for predefined responses
    function checkPredefinedResponse(userMessage) {
        const cleanedMessage = userMessage.toLowerCase().replace(/[?؟!.,\s]+/g, ' ').trim();
        
        for (const key in PREDEFINED_RESPONSES) {
            if (cleanedMessage === key.toLowerCase() || 
                cleanedMessage.startsWith(key.toLowerCase() + ' ')) {
                return PREDEFINED_RESPONSES[key];
            }
        }
        
        return null;
    }

    // Handle input keydown event (Enter to send, Shift+Enter for newline)
    function handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    // Adjust input height based on content
    function adjustInputHeight() {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    }

    // Save model preference
    function saveModelPreference() {
        localStorage.setItem('preferredModel', modelSelect.value);
    }

    // Update temperature value display
    function updateTemperatureValue() {
        const value = temperatureSlider.value;
        temperatureValueSpan.textContent = value;
        localStorage.setItem('temperature', value);
    }

    // Save max tokens setting
    function saveMaxTokens() {
        localStorage.setItem('maxTokens', maxTokensInput.value);
    }

    // Toggle dark mode
    function toggleDarkMode() {
        if (darkModeToggle.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    }

    // Save Text-to-Speech preference
    function saveTextToSpeechPreference() {
        localStorage.setItem('ttsEnabled', ttsToggle.checked);
    }

    // Copy text to clipboard
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast('تم نسخ النص');
            })
            .catch(error => {
                console.error('Error copying text:', error);
                showError('فشل نسخ النص');
            });
    }

    // Show toast notification
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }

    // Show error message
    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        messagesContainer.appendChild(errorElement);
        scrollToBottom();
        
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    // Show confirmation modal
    function showConfirmModal(message, callback) {
        confirmMessage.textContent = message;
        confirmationCallback = callback;
        confirmModal.style.display = 'flex';
    }

    // Close confirmation modal
    function closeConfirmModal() {
        confirmModal.style.display = 'none';
        confirmationCallback = null;
    }

    // Handle confirmation
    function handleConfirmation() {
        if (confirmationCallback) {
            confirmationCallback();
        }
        closeConfirmModal();
    }

    // Scroll messages to bottom
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Sidebar Functions
    function toggleSidebar() {
        settingsSidebar.classList.toggle('collapsed');
    }

    function openSidebar() {
        settingsSidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
    }

    function closeSidebar() {
        settingsSidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }

    // Adjust UI based on screen size
    function adjustUIForScreenSize() {
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
    }

    // Initial UI adjustment
    adjustUIForScreenSize();
});

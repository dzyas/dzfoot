function mentionYasmin(event) {
    const messageInput = document.getElementById('message-input');
    if (event.target.classList.contains('mention-yasmin')) {
        messageInput.value = '@ياسمين ' + messageInput.value;
        messageInput.focus();
    }
}

// متغيرات عامة
let currentModel = 'openai/gpt-4o';
let temperature = 0.7;
let maxTokens = 2000;
let recognition;
let conversationId = null;

// تهيئة المحادثة
document.addEventListener('DOMContentLoaded', function() {
    // تهيئة القائمة الجانبية
    initSidebar();

    // تهيئة الإعدادات
    initSettings();

    // إضافة تاريخ اليوم
    addDateToChat();

    // عرض رسالة الترحيب
    const welcomeMessage = {
        role: 'assistant',
        content: 'حبيبي، لقد تعلمت نكتة جديدة، هل تريد سماعها؟ 😋',
        timestamp: new Date().toISOString()
    };

    addMessageToUI(welcomeMessage.role, welcomeMessage.content);

    // إضافة المقترحات
    addSuggestions();

    // تحميل المحادثات السابقة
    loadConversations();

    // إعداد مربع النص للتمدد تلقائياً
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // إرسال الرسالة عند الضغط على زر الإرسال
    document.getElementById('send-button').addEventListener('click', sendMessage);

    // إرسال الرسالة عند الضغط على Enter (بدون Shift)
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // تهيئة منتقي الإيموجي
    initEmojiPicker();

    // زر الإيموجي
    document.getElementById('emoji-button').addEventListener('click', function() {
        const emojiPicker = document.getElementById('emoji-picker');
        emojiPicker.classList.toggle('active');
    });

    // تهيئة التعرف الصوتي
    initSpeechRecognition();

    // أزرار إدارة المحادثة
    document.getElementById('new-conversation-btn').addEventListener('click', startNewConversation);
    document.getElementById('clear-current-chat-btn').addEventListener('click', function() {
        showConfirmation('هل أنت متأكد من رغبتك في مسح الرسائل في المحادثة الحالية؟', clearConversation);
    });
    document.getElementById('export-chat-btn').addEventListener('click', exportChat);

    // استعادة الصوت الاحتياطي المحفوظ
    const backupVoice = localStorage.getItem('backupVoice') || 'browser';
    const backupVoiceSelect = document.getElementById('backup-voice-select');
    if (backupVoiceSelect) {
        backupVoiceSelect.value = backupVoice;
        backupVoiceSelect.addEventListener('change', function() {
            localStorage.setItem('backupVoice', this.value);
        });
    }
});

function initSidebar() {
    // فتح وإغلاق القائمة الجانبية
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('chat-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    sidebarToggleBtn.addEventListener('click', function() {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    });

    closeSidebarBtn.addEventListener('click', function() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });

    overlay.addEventListener('click', function() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });

    // تحديد النموذج المستخدم
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
        modelSelect.addEventListener('change', function() {
            currentModel = this.value;
            localStorage.setItem('selectedModel', currentModel);
            showToast('تم تغيير النموذج إلى ' + this.options[this.selectedIndex].text, 'success');
        });
    }
}

function initSettings() {
    // تهيئة شريط التمرير للإبداع
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');

    temperatureSlider.addEventListener('input', function() {
        temperature = parseFloat(this.value);
        temperatureValue.textContent = temperature;
        localStorage.setItem('temperature', temperature);
    });

    // تهيئة حقل الحد الأقصى من الرموز
    const maxTokensInput = document.getElementById('max-tokens');
    maxTokensInput.addEventListener('change', function() {
        maxTokens = parseInt(this.value);
        localStorage.setItem('maxTokens', maxTokens);
    });

    // تهيئة مفاتيح التبديل
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    darkModeToggle.addEventListener('change', function() {
        if (this.checked) {
            document.documentElement.classList.add('dark-theme');
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.documentElement.classList.remove('dark-theme');
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    });

    const ttsToggle = document.getElementById('text-to-speech-toggle');
    ttsToggle.addEventListener('change', function() {
        localStorage.setItem('textToSpeechEnabled', this.checked);
    });

    const browserTtsToggle = document.getElementById('use-browser-tts');
    browserTtsToggle.addEventListener('change', function() {
        localStorage.setItem('useBrowserTTS', this.checked);
    });

    // تغيير الصوت
    const voiceSelect = document.getElementById('voice-select');
    if (voiceSelect) {
        voiceSelect.addEventListener('change', function() {
            localStorage.setItem('selectedVoice', this.value);
        });
    }

    // استعادة الإعدادات المحفوظة
    restoreSettings();
}

function restoreSettings() {
    // استعادة النموذج المحدد
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel) {
        currentModel = savedModel;
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            for (let i = 0; i < modelSelect.options.length; i++) {
                if (modelSelect.options[i].value === savedModel) {
                    modelSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }

    // استعادة مستوى الإبداع
    const savedTemperature = localStorage.getItem('temperature');
    if (savedTemperature) {
        temperature = parseFloat(savedTemperature);
        document.getElementById('temperature-slider').value = temperature;
        document.getElementById('temperature-value').textContent = temperature;
    }

    // استعادة الحد الأقصى من الرموز
    const savedMaxTokens = localStorage.getItem('maxTokens');
    if (savedMaxTokens) {
        maxTokens = parseInt(savedMaxTokens);
        document.getElementById('max-tokens').value = maxTokens;
    }

    // استعادة الوضع الليلي
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('dark-mode-toggle').checked = darkMode;
    if (darkMode) {
        document.documentElement.classList.add('dark-theme');
        document.body.classList.add('dark-mode');
    }

    // استعادة إعدادات النطق
    const ttsEnabled = localStorage.getItem('textToSpeechEnabled') !== 'false';
    document.getElementById('text-to-speech-toggle').checked = ttsEnabled;

    const useBrowserTTS = localStorage.getItem('useBrowserTTS') === 'true';
    document.getElementById('use-browser-tts').checked = useBrowserTTS;

    // استعادة الصوت المحدد
    const voiceSelect = document.getElementById('voice-select');
    if (voiceSelect) {
        const savedVoice = localStorage.getItem('selectedVoice');
        if (savedVoice) {
            for (let i = 0; i < voiceSelect.options.length; i++) {
                if (voiceSelect.options[i].value === savedVoice) {
                    voiceSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }
}

function addDateToChat() {
    const messagesContainer = document.getElementById('messages');
    const dateDiv = document.createElement('div');
    dateDiv.className = 'message-date';

    // تنسيق التاريخ بالطريقة العربية
    const today = new Date();
    const formattedDate = `${today.toLocaleDateString('ar-SA', {year: 'numeric', month: 'numeric', day: 'numeric'}).replace(/\//g, '/')}، ${today.toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}`;

    dateDiv.textContent = formattedDate;
    messagesContainer.appendChild(dateDiv);
}

function initEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    const messageInput = document.getElementById('message-input');

    // قائمة من الإيموجي المستخدمة بشكل شائع
    const emojis = [
        '😊', '😄', '😍', '🥰', '😘', 
        '😇', '🤩', '😎', '🥳', '😋', 
        '🤔', '🤗', '😴', '😒', '😢', 
        '😭', '😡', '👍', '👎', '👏', 
        '🙏', '💪', '🎉', '💯', '❤️', 
        '💔', '✨', '🤣', '😂', '🥺'
    ];

    // إضافة الإيموجي إلى منتقي الإيموجي
    emojis.forEach(emoji => {
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji;

        emojiItem.addEventListener('click', function() {
            // إضافة الإيموجي المحدد إلى مربع النص
            messageInput.value += emoji;

            // إخفاء منتقي الإيموجي
            emojiPicker.classList.remove('active');

            // تركيز مربع النص
            messageInput.focus();
        });

        emojiPicker.appendChild(emojiItem);
    });

    // إخفاء منتقي الإيموجي عند النقر خارجه
    document.addEventListener('click', function(e) {
        if (!emojiPicker.contains(e.target) && e.target.id !== 'emoji-button') {
            emojiPicker.classList.remove('active');
        }
    });
}

function addSuggestions() {
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'welcome-suggestions';

    const suggestions = [
        { text: 'أجد صعوبة في رسم البورتريه. إنه محبط.' },
        { text: 'أريد أن أتعلم عن الموسيقى الكلاسيكية. هل لديك أي توصيات؟' },
        { text: 'أشعر بالإحباط مؤخرًا، ولست متأكدًا من السبب.' }
    ];

    suggestions.forEach(suggestion => {
        const button = document.createElement('button');
        button.className = 'suggestion-button';
        button.textContent = suggestion.text;

        button.addEventListener('click', function() {
            document.getElementById('message-input').value = suggestion.text;
            document.getElementById('send-button').click();
        });

        suggestionsContainer.appendChild(button);
    });

    const messagesContainer = document.getElementById('messages');
    messagesContainer.appendChild(suggestionsContainer);
}

function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'ar-SA'; // اللغة العربية

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('message-input').value = transcript;
            document.getElementById('mic-button').classList.remove('recording');
        };

        recognition.onend = function() {
            document.getElementById('mic-button').classList.remove('recording');
        };

        recognition.onerror = function() {
            document.getElementById('mic-button').classList.remove('recording');
            showToast('حدث خطأ في التعرف الصوتي', 'error');
        };

        document.getElementById('mic-button').addEventListener('click', function() {
            if (this.classList.contains('recording')) {
                recognition.stop();
            } else {
                this.classList.add('recording');
                recognition.start();
            }
        });
    } else {
        document.getElementById('mic-button').style.display = 'none';
    }
}

function addMessageToUI(role, content) {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${role}`;

    // أيقونة المستخدم أو ياسمين
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';

    const avatarImg = document.createElement('img');
    avatarImg.src = role === 'user' 
        ? "/static/images/user-avatar.jpg"
        : "/static/images/yasmin-avatar.png";
    avatarImg.alt = role === 'user' ? 'أيقونة المستخدم' : 'أيقونة ياسمين';

    avatarDiv.appendChild(avatarImg);
    messageDiv.appendChild(avatarDiv);

    // محتوى الرسالة
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const contentFormatted = formatMessageContent(content);
    contentDiv.innerHTML = `<p>${contentFormatted}</p>`;

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    // تمرير الشاشة إلى أسفل
    const scrollContainer = document.querySelector('.messages-container');
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function formatMessageContent(content) {
    // استبدال الروابط بروابط قابلة للنقر
    let formatted = content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');

    // استبدال علامات ** بتنسيق عريض
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // استبدال علامات * بتنسيق مائل
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // إضافة تنسيق أفضل للقوائم
    formatted = formatted.replace(/^- (.*)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/<li>(.*)<\/li>(\n<li>)/g, '<li>$1</li><li>');
    formatted = formatted.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');

    return formatted;
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const userMessage = messageInput.value.trim();

    if (userMessage === '') return;

    // إضافة رسالة المستخدم إلى واجهة المستخدم
    addMessageToUI('user', userMessage);

    // مسح حقل الإدخال وإعادة تعيين ارتفاعه
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // إظهار مؤشر الكتابة
    showTypingIndicator();

    // إعداد الرسالة للإرسال
    const messages = [
        { role: 'user', content: userMessage }
    ];

    // إرسال الرسالة إلى الخادم
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            message: userMessage,
            conversation_id: conversationId,
            model: currentModel,
            temperature: temperature,
            max_tokens: maxTokens
        }),
    })
    .then(response => response.json())
    .then(data => {
        // إزالة مؤشر الكتابة
        removeTypingIndicator();

        // إضافة رد المساعد
        addMessageToUI('assistant', data.message);

        // تحديث معرف المحادثة إذا كان جديدًا
        if (data.conversation_id && !conversationId) {
            conversationId = data.conversation_id;
            loadConversations(); // تحديث قائمة المحادثات
        }

        // قراءة الرد صوتيًا إذا كانت هذه الميزة مفعلة
        const textToSpeechEnabled = localStorage.getItem('textToSpeechEnabled') !== 'false';
        if (textToSpeechEnabled) {
            const useBrowserTTS = localStorage.getItem('useBrowserTTS') === 'true';
            if (useBrowserTTS) {
                speakTextWithBrowser(data.message);
            } else {
                speakText(data.message);
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessageToUI('assistant', 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.');
        showToast('فشل في الاتصال بالخادم', 'error');
    });
}

function showTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message-bubble assistant loading';
    typingIndicator.id = 'typing-indicator';

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';

    const avatarImg = document.createElement('img');
    avatarImg.src = "/static/images/yasmin-avatar.png";
    avatarImg.alt = 'أيقونة ياسمين';

    avatarDiv.appendChild(avatarImg);
    typingIndicator.appendChild(avatarDiv);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content typing-indicator';
    contentDiv.innerHTML = '<span></span><span></span><span></span>';

    typingIndicator.appendChild(contentDiv);
    document.getElementById('messages').appendChild(typingIndicator);

    // تمرير الشاشة إلى أسفل
    const scrollContainer = document.querySelector('.messages-container');
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function speakText(text) {
    fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            text: text,
            voice_id: localStorage.getItem('selectedVoice') || 'EXAVITQu4vr4xnSDxMaL'
        }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.audio_url) {
            // إنشاء عنصر صوتي مؤقت
            const audio = new Audio(data.audio_url);
            audio.play();
        } else if (data.error) {
            console.error('TTS Error:', data.error);
            // استخدام النطق من المتصفح كبديل عند فشل ElevenLabs
            speakTextWithBrowser(text);
        }
    })
    .catch(error => {
        console.error('Error with TTS:', error);
        // استخدام النطق من المتصفح كبديل عند حدوث خطأ
        speakTextWithBrowser(text);
    });
}

function speakTextWithBrowser(text) {
    if ('speechSynthesis' in window) {
        // إيقاف أي نطق جاري
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // ضبط اللغة والصوت
        utterance.lang = 'ar-SA';

        // الحصول على قائمة الأصوات المتاحة
        const voices = window.speechSynthesis.getVoices();

        // البحث عن صوت عربي
        let arabicVoice = voices.find(voice => voice.lang.includes('ar'));

        // إذا لم يتم العثور على صوت عربي، استخدم الصوت الافتراضي
        if (arabicVoice) {
            utterance.voice = arabicVoice;
        }

        // ضبط الإعدادات
        utterance.rate = 1.0;  // سرعة النطق (0.1 إلى 10)
        utterance.pitch = 1.0; // نغمة الصوت (0 إلى 2)

        // تشغيل النطق
        window.speechSynthesis.speak(utterance);
    } else {
        console.log('متصفحك لا يدعم واجهة النطق.');
    }
}

function loadConversations() {
    fetch('/api/conversations')
    .then(response => response.json())
    .then(data => {
        const conversationsList = document.getElementById('conversations-list');

        // مسح أي محتوى حالي
        conversationsList.innerHTML = '';

        if (data.conversations && data.conversations.length > 0) {
            data.conversations.forEach(conversation => {
                addConversationToList(conversation);
            });
        } else {
            conversationsList.innerHTML = '<div class="empty-conversations">لا توجد محادثات سابقة</div>';
        }
    })
    .catch(error => {
        console.error('Error loading conversations:', error);
        const conversationsList = document.getElementById('conversations-list');
        conversationsList.innerHTML = '<div class="empty-conversations">فشل في تحميل المحادثات</div>';
    });
}

function addConversationToList(conversation) {
    const conversationsList = document.getElementById('conversations-list');

    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    if (conversationId && conversation.id === conversationId) {
        conversationItem.classList.add('active');
    }

    // تنسيق التاريخ
    const date = new Date(conversation.last_updated);
    const formattedDate = date.toLocaleDateString('ar-SA');

    conversationItem.innerHTML = `
        <div class="conversation-title">
            <span>${conversation.title}</span>
            <span class="conversation-date">${formattedDate}</span>
        </div>
        <button class="delete-conversation-btn" title="حذف المحادثة" data-id="${conversation.id}">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

    // إضافة معالج أحداث للنقر على المحادثة
    conversationItem.addEventListener('click', function(e) {
        // التأكد من أن النقر لم يكن على زر الحذف
        if (!e.target.closest('.delete-conversation-btn')) {
            loadConversation(conversation.id);
        }
    });

    // إضافة معالج أحداث لزر الحذف
    const deleteBtn = conversationItem.querySelector('.delete-conversation-btn');
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // منع انتشار الحدث إلى عنصر المحادثة
        showConfirmation(
            `هل أنت متأكد من رغبتك في حذف المحادثة "${conversation.title}"؟`,
            () => deleteConversation(conversation.id)
        );
    });

    conversationsList.appendChild(conversationItem);
}

function loadConversation(convId) {
    fetch(`/get_conversation/${convId}`)
    .then(response => response.json())
    .then(data => {
        if (data.conversation) {
            // مسح محتوى المحادثة الحالية
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';

            // إضافة تاريخ المحادثة
            addDateToChat();

            // إضافة جميع الرسائل
            if (data.conversation.messages && data.conversation.messages.length > 0) {
                data.conversation.messages.forEach(message => {
                    addMessageToUI(message.role, message.content);
                });
            }

            // تحديث معرف المحادثة الحالية
            conversationId = convId;

            // تحديث العناصر النشطة في قائمة المحادثات
            const conversationItems = document.querySelectorAll('.conversation-item');
            conversationItems.forEach(item => {
                item.classList.remove('active');
                const deleteBtn = item.querySelector('.delete-conversation-btn');
                if (deleteBtn && deleteBtn.getAttribute('data-id') == convId) {
                    item.classList.add('active');
                }
            });

            // إغلاق القائمة الجانبية على الأجهزة المحمولة
            if (window.innerWidth < 768) {
                document.getElementById('chat-sidebar').classList.remove('active');
                document.getElementById('sidebar-overlay').classList.remove('active');
            }
        }
    })
    .catch(error => {
        console.error('Error loading conversation:', error);
        showToast('فشل في تحميل المحادثة', 'error');
    });
}

function startNewConversation() {
    // مسح محتوى المحادثة الحالية
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';

    // إعادة تعيين معرف المحادثة
    conversationId = null;

    // إضافة تاريخ اليوم
    addDateToChat();

    // إضافة رسالة الترحيب
    const welcomeMessage = {
        role: 'assistant',
        content: 'حبيبي، لقد تعلمت نكتة جديدة، هل تريد سماعها؟ 😋',
        timestamp: new Date().toISOString()
    };

    addMessageToUI(welcomeMessage.role, welcomeMessage.content);

    // إضافة المقترحات
    addSuggestions();

    // إلغاء تنشيط جميع عناصر المحادثة في القائمة
    const conversationItems = document.querySelectorAll('.conversation-item');
    conversationItems.forEach(item => {
        item.classList.remove('active');
    });

    // إغلاق القائمة الجانبية على الأجهزة المحمولة
    if (window.innerWidth < 768) {
        document.getElementById('chat-sidebar').classList.remove('active');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }

    showToast('تم إنشاء محادثة جديدة', 'success');
}

function clearConversation() {
    if (!conversationId) {
        showToast('لا توجد محادثة حالية لمسحها', 'info');
        return;
    }

    fetch(`/clear_conversation/${conversationId}`, {
        method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // إعادة تحميل المحادثة بعد المسح
            loadConversation(conversationId);
            showToast('تم مسح الرسائل في المحادثة الحالية', 'success');
        } else {
            showToast(data.error || 'فشل في مسح المحادثة', 'error');
        }
    })
    .catch(error => {
        console.error('Error clearing conversation:', error);
        showToast('فشل في الاتصال بالخادم', 'error');
    });
}

function deleteConversation(convId) {
    fetch(`/api/conversations/${convId}`, {
        method: 'DELETE',
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadConversations(); // تحديث قائمة المحادثات

            // إذا كانت المحادثة المحذوفة هي الحالية، ابدأ محادثة جديدة
            if (conversationId === convId) {
                startNewConversation();
            }

            showToast('تم حذف المحادثة بنجاح', 'success');
        } else {
            showToast(data.error || 'فشل في حذف المحادثة', 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting conversation:', error);
        showToast('فشل في الاتصال بالخادم', 'error');
    });
}

function exportChat() {
    if (!conversationId) {
        showToast('لا توجد محادثة حالية للتصدير', 'info');
        return;
    }

    fetch(`/get_conversation/${conversationId}`)
    .then(response => response.json())
    .then(data => {
        if (data.conversation) {
            // تجهيز محتوى التصدير
            let exportContent = `# ${data.conversation.title}\n`;
            exportContent += `تاريخ: ${new Date(data.conversation.created_at).toLocaleDateString('ar-SA')}\n\n`;

            if (data.conversation.messages && data.conversation.messages.length > 0) {
                data.conversation.messages.forEach(message => {
                    const sender = message.role === 'user' ? 'أنت' : 'ياسمين';
                    exportContent += `## ${sender}:\n${message.content}\n\n`;
                });
            }

            // إنشاء ملف نصي للتنزيل
            const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            // إنشاء رابط تنزيل وتنشيطه
            const a = document.createElement('a');
            a.href = url;
            a.download = `محادثة-ياسمين-${new Date().toISOString().slice(0, 10)}.txt`;
            a.style.display = 'none';

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            showToast('تم تصدير المحادثة بنجاح', 'success');
        }
    })
    .catch(error => {
        console.error('Error exporting chat:', error);
        showToast('فشل في تصدير المحادثة', 'error');
    });
}

function showConfirmation(message, actionCallback) {
    const modal = document.getElementById('confirm-modal');
    const messageElem = document.getElementById('confirm-message');
    const actionBtn = document.getElementById('confirm-action');
    const cancelBtn = document.getElementById('confirm-cancel');

    messageElem.textContent = message;

    // إضافة معالجات الأحداث
    const confirmAction = function() {
        actionCallback();
        modal.style.display = 'none';
    };

    const cancelAction = function() {
        modal.style.display = 'none';
    };

    // إزالة معالجات الأحداث السابقة
    actionBtn.replaceWith(actionBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));

    // إعادة تعيين مراجع العناصر
    const newActionBtn = document.getElementById('confirm-action');
    const newCancelBtn = document.getElementById('confirm-cancel');

    newActionBtn.addEventListener('click', confirmAction);
    newCancelBtn.addEventListener('click', cancelAction);

    // إظهار نافذة التأكيد
    modal.style.display = 'flex';
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;

    toastContainer.appendChild(toast);

    // إضافة الفئة المرئية للرسوم المتحركة
    setTimeout(() => {
        toast.classList.add('visible');
    }, 10);

    // إزالة التنبيه بعد مدة
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => {
            toast.remove();
        }, 300); // مدة الرسوم المتحركة للتلاشي
    }, 3000);
}
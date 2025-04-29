// Audio Generator JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const textInput = document.getElementById('text-input');
    const voiceSelect = document.getElementById('voice-select');
    const useBrowserTts = document.getElementById('use-browser-tts');
    const generateButton = document.getElementById('generate-audio-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const audioResult = document.getElementById('audio-result');
    
    // Event listeners
    generateButton.addEventListener('click', generateAudio);
    
    // Load settings from localStorage
    const savedVoice = localStorage.getItem('audioVoice') || 'EXAVITQu4vr4xnSDxMaL';
    const useBrowser = localStorage.getItem('useBrowserTTS') === 'true';
    
    voiceSelect.value = savedVoice;
    useBrowserTts.checked = useBrowser;
    
    // Save settings to localStorage
    voiceSelect.addEventListener('change', function() {
        localStorage.setItem('audioVoice', voiceSelect.value);
    });
    
    useBrowserTts.addEventListener('change', function() {
        localStorage.setItem('useBrowserTTS', useBrowserTts.checked);
    });
    
    // Generate audio function
    function generateAudio() {
        const text = textInput.value.trim();
        const voiceId = voiceSelect.value;
        const useBrowser = useBrowserTts.checked;
        
        // Validate input
        if (!text) {
            showToast('يرجى إدخال نص لتحويله إلى صوت', 'error');
            return;
        }
        
        // Use browser's built-in TTS if selected
        if (useBrowser) {
            useBrowserTTS(text);
            return;
        }
        
        // Show loading state
        loadingSpinner.style.display = 'block';
        generateButton.disabled = true;
        audioResult.innerHTML = '';
        
        // Call API
        fetch('/api/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                voice_id: voiceId
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Hide loading spinner
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false;
            
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }
            
            // Create and play audio from base64
            const audioSrc = 'data:audio/mpeg;base64,' + data.audio;
            
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = audioSrc;
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-button';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> تحميل الصوت';
            downloadBtn.addEventListener('click', function() {
                // Create a temporary link to download the audio
                const link = document.createElement('a');
                link.href = audioSrc;
                link.download = 'yasmin-generated-audio.mp3';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
            
            // Clear previous results and show new audio
            audioResult.innerHTML = '';
            audioResult.appendChild(audio);
            audioResult.appendChild(downloadBtn);
            
            // Auto-play the audio
            audio.play();
            
            // Show success message
            showToast('تم توليد الصوت بنجاح', 'success');
        })
        .catch(error => {
            console.error('Error generating audio:', error);
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false;
            
            // Try browser TTS as fallback
            showToast('حدث خطأ أثناء توليد الصوت، جارٍ استخدام المتصفح كبديل', 'error');
            useBrowserTTS(text);
        });
    }
    
    // Browser TTS function
    function useBrowserTTS(text) {
        if ('speechSynthesis' in window) {
            // Clear previous results
            audioResult.innerHTML = '';
            
            // Create message
            const message = document.createElement('div');
            message.className = 'browser-tts-message';
            message.innerHTML = `
                <i class="fas fa-volume-up"></i>
                <p>جارٍ التشغيل باستخدام المتصفح...</p>
            `;
            audioResult.appendChild(message);
            
            // Create and configure utterance
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar-SA';
            utterance.rate = 0.9; // Slightly slower for better Arabic pronunciation
            
            // Get available voices and try to find Arabic ones
            let voices = speechSynthesis.getVoices();
            let arabicVoice = voices.find(voice => voice.lang.includes('ar') || voice.name.includes('Arabic'));
            
            if (arabicVoice) {
                utterance.voice = arabicVoice;
            }
            
            // Handle speech end
            utterance.onend = function() {
                message.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    <p>تم تشغيل الصوت بنجاح</p>
                `;
            };
            
            // Handle speech error
            utterance.onerror = function(event) {
                console.error('Speech synthesis error:', event);
                message.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    <p>حدث خطأ أثناء التشغيل</p>
                `;
            };
            
            // Speak the text
            window.speechSynthesis.speak(utterance);
            
            // Show success message
            showToast('جارٍ التشغيل باستخدام المتصفح', 'info');
        } else {
            showToast('المتصفح لا يدعم ميزة تحويل النص إلى كلام', 'error');
        }
    }
    
    // Handle Ctrl+Enter to generate
    textInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
            e.preventDefault();
            generateAudio();
        }
    });
});

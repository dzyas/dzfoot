// Audio Generator JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const textInput = document.getElementById('text-input');
    const voiceSelect = document.getElementById('voice-select');
    const generateButton = document.getElementById('generate-audio-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const audioResult = document.getElementById('audio-result');

    // Event listeners
    generateButton.addEventListener('click', generateAudio);

    // Generate audio function
    function generateAudio() {
        const text = textInput.value.trim();
        if (!text) {
            showToast('يرجى إدخال نص لتحويله إلى صوت', 'error');
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
                voice_id: voiceSelect.value
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
            downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = audioSrc;
                link.download = 'yasmin-audio.mp3';
                link.click();
            };

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
            console.error('Error:', error);
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false;
            showToast('حدث خطأ في توليد الصوت', 'error');
        });
    }

    // Handle Enter key in textarea
    textInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateAudio();
        }
    });
});

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
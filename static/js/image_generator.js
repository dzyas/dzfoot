// Image Generator JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const promptInput = document.getElementById('prompt-input');
    const sizeSelect = document.getElementById('size-select');
    const generateButton = document.getElementById('generate-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const imageResult = document.getElementById('image-result');
    
    // Event listeners
    generateButton.addEventListener('click', generateImage);
    
    // Set initial size from localStorage or default
    const savedSize = localStorage.getItem('imageSize') || '512';
    sizeSelect.value = savedSize;
    
    // Save size selection to localStorage
    sizeSelect.addEventListener('change', function() {
        localStorage.setItem('imageSize', sizeSelect.value);
    });
    
    // Generate image function
    function generateImage() {
        const prompt = promptInput.value.trim();
        const size = parseInt(sizeSelect.value);
        
        // Validate input
        if (!prompt) {
            showToast('يرجى إدخال وصف للصورة', 'error');
            return;
        }
        
        // Show loading state
        loadingSpinner.style.display = 'block';
        generateButton.disabled = true;
        imageResult.innerHTML = '';
        
        // Call API
        fetch('/api/generate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                size: size
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
            
            // Display the generated image
            const imageUrl = data.image_url;
            
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = prompt;
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-button';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> تحميل الصورة';
            downloadBtn.addEventListener('click', function() {
                // Create a temporary link to download the image
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = 'yasmin-generated-image.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
            
            // Clear previous results and show new image
            imageResult.innerHTML = '';
            imageResult.appendChild(img);
            imageResult.appendChild(downloadBtn);
            
            // Show success message
            showToast('تم توليد الصورة بنجاح', 'success');
        })
        .catch(error => {
            console.error('Error generating image:', error);
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false;
            showToast('حدث خطأ أثناء توليد الصورة، يرجى المحاولة مرة أخرى', 'error');
        });
    }
    
    // Handle Enter key in textarea
    promptInput.addEventListener('keydown', function(e) {
        // Check if Ctrl+Enter or Shift+Enter was pressed
        if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
            e.preventDefault();
            generateImage();
        }
    });
});
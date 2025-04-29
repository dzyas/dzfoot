// Image Recognition JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const uploadForm = document.getElementById('upload-form');
    const uploadContainer = document.getElementById('upload-container');
    const imageInput = document.getElementById('image-input');
    const imagePreview = document.getElementById('image-preview');
    const previewImage = document.getElementById('preview-image');
    const analyzeButton = document.getElementById('analyze-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const recognitionResults = document.getElementById('recognition-results');
    const descriptionTab = document.getElementById('description-tab');
    const detailsTab = document.getElementById('details-tab');
    const objectsList = document.getElementById('objects-list');
    const annotatedImageContainer = document.getElementById('annotated-image-container');
    const tabs = document.querySelectorAll('.result-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Tab functionality
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Hide results initially
    recognitionResults.style.display = 'none';
    imagePreview.style.display = 'none';

    // Event listeners for file upload
    uploadContainer.addEventListener('click', function() {
        imageInput.click();
    });

    uploadContainer.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });

    uploadContainer.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });

    uploadContainer.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    imageInput.addEventListener('change', function() {
        if (this.files.length) {
            handleFileSelect(this.files[0]);
        }
    });

    // Analyze button
    analyzeButton.addEventListener('click', analyzeImage);

    // Handle file selection
    function handleFileSelect(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            showToast('نوع الملف غير مدعوم. يرجى اختيار صورة بتنسيق JPG، JPEG، PNG، أو GIF.', 'error');
            return;
        }
        if (file.size > 16 * 1024 * 1024) {
            showToast('حجم الملف كبير جدًا. الحد الأقصى هو 16 ميجابايت.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            imagePreview.style.display = 'block';
            uploadContainer.style.display = 'none';
            recognitionResults.style.display = 'none';
            descriptionTab.innerHTML = '';
            detailsTab.innerHTML = '';
            objectsList.innerHTML = '';
            annotatedImageContainer.innerHTML = '';
        };
        reader.readAsDataURL(file);
    }

    // Analyze image function
    async function analyzeImage() {
        if (!previewImage.src) {
            showToast('يرجى تحميل صورة أولًا', 'error');
            return;
        }
        loadingSpinner.style.display = 'block';
        analyzeButton.disabled = true;
        recognitionResults.style.display = 'none';

        const formData = new FormData();
        formData.append('image', imageInput.files[0]);

        try {
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }
            
            displayResults(data);
            recognitionResults.style.display = 'block';
            showToast('تم تحليل الصورة بنجاح', 'success');
        } catch (error) {
            console.error('Error analyzing image:', error);
            showToast('حدث خطأ أثناء تحليل الصورة، يرجى المحاولة مرة أخرى', 'error');
        } finally {
            loadingSpinner.style.display = 'none';
            analyzeButton.disabled = false;
        }
    }

    // Display results function
    function displayResults(data) {
        // Description tab
        if (data.description) {
            descriptionTab.innerHTML = formatText(data.description);
        } else {
            descriptionTab.innerHTML = '<p class="no-data">لم يتم العثور على وصف.</p>';
        }

        // Details tab
        if (data.technical_details) {
            const detailsHtml = `
                <h3>تفاصيل الصورة التقنية</h3>
                <div class="details-table">
                    <div class="detail-row">
                        <div class="detail-label">الأبعاد</div>
                        <div class="detail-value">${data.technical_details.dimensions || 'غير متوفر'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">الحجم</div>
                        <div class="detail-value">${data.technical_details.size || 'غير متوفر'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">نوع الملف</div>
                        <div class="detail-value">${data.technical_details.format || 'غير متوفر'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">تاريخ الإنشاء</div>
                        <div class="detail-value">${data.technical_details.date || 'غير متوفر'}</div>
                    </div>
                </div>
            `;
            detailsTab.innerHTML = detailsHtml;
        } else {
            detailsTab.innerHTML = '<p class="no-data">لم يتم العثور على تفاصيل تقنية.</p>';
        }

        // Objects tab
        if (data.detected_objects && data.detected_objects.length > 0) {
            const objectsHtml = data.detected_objects.map(obj => {
                return `<div class="detected-object">
                    <div class="object-name">${obj.name}</div>
                    <div class="object-confidence">الثقة: ${Math.round(obj.confidence * 100)}%</div>
                </div>`;
            }).join('');
            
            objectsList.innerHTML = `
                <h3>الكائنات المكتشفة (${data.detected_objects.length})</h3>
                <div class="objects-container">${objectsHtml}</div>
            `;
        } else {
            objectsList.innerHTML = '<p class="no-data">لم يتم اكتشاف كائنات.</p>';
        }

        // Annotated image
        if (data.annotated_image_url) {
            const originalImg = document.createElement('div');
            originalImg.className = 'image-wrapper';
            originalImg.innerHTML = `
                <img src="${previewImage.src}" alt="الصورة الأصلية">
                <div class="image-label">الصورة الأصلية</div>
            `;

            const annotatedImg = document.createElement('div');
            annotatedImg.className = 'image-wrapper';
            annotatedImg.innerHTML = `
                <img src="${data.annotated_image_url}" alt="الصورة مع تحديد الكائنات">
                <div class="image-label">الكائنات المحددة</div>
            `;

            annotatedImageContainer.innerHTML = '';
            annotatedImageContainer.appendChild(originalImg);
            annotatedImageContainer.appendChild(annotatedImg);
        }
    }

    // Function to format text with markdown
    function formatText(text) {
        // Basic markdown formatting
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }
});
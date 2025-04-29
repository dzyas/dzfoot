// Image Recognition JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Elements from original code
    const uploadContainer = document.getElementById('upload-container');
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const analyzeButton = document.getElementById('analyze-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const recognitionResults = document.getElementById('recognition-results');
    const descriptionTab = document.getElementById('description-tab');
    const detailsTab = document.getElementById('details-tab');
    const objectsTab = document.getElementById('objects-tab');
    const objectsList = document.getElementById('objects-list');
    const annotatedImageContainer = document.getElementById('annotated-image-container');
    const tabs = document.querySelectorAll('.result-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Elements and form from edited code
    const uploadForm = document.getElementById('upload-form');
    const imageInput = document.getElementById('image-input');
    const resultContainer = document.getElementById('result-container');


    // Tab functionality (from original code)
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Hide results initially (from original code)
    recognitionResults.style.display = 'none';
    imagePreview.style.display = 'none';

    // Event listeners for file upload (adapted from original and edited code)
    uploadContainer.addEventListener('click', function() {
        imageInput.click(); // Use imageInput from edited code
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

    imageInput.addEventListener('change', function() { // Use imageInput from edited code
        if (this.files.length) {
            handleFileSelect(this.files[0]);
        }
    });

    // Analyze button (from original code)
    analyzeButton.addEventListener('click', analyzeImage);

    // Handle file selection (from original code)
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

    // Analyze image function (modified from original and edited code)
    async function analyzeImage() {
        if (!previewImage.src) {
            showToast('يرجى تحميل صورة أولًا', 'error');
            return;
        }
        loadingSpinner.style.display = 'block';
        analyzeButton.disabled = true;
        recognitionResults.style.display = 'none';

        const formData = new FormData();
        const file = imageInput.files[0]; // Use imageInput from edited code
        formData.append('image', file);

        try {
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            });
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

    // Display results function (from edited code, with some adaptations)
    function displayResults(data) {
        imagePreview.src = data.file_url || previewImage.src; // Use file_url if available, fallback to existing preview
        imagePreview.style.display = 'block';

        if (data.analysis) {
            const analysis = data.analysis;
            let detailsHtml = '<div class="analysis-result">';

            detailsHtml += `
                <h3 class="analysis-title">معلومات أساسية</h3>
                <div class="analysis-detail">
                    <span class="analysis-label">الأبعاد:</span>
                    <span class="analysis-value">${analysis.dimensions || 'غير متوفر'}</span>
                </div>
                <div class="analysis-detail">
                    <span class="analysis-label">الصيغة:</span>
                    <span class="analysis-value">${analysis.format || 'غير متوفر'}</span>
                </div>
                <div class="analysis-detail">
                    <span class="analysis-label">وضع الألوان:</span>
                    <span class="analysis-value">${analysis.mode || 'غير متوفر'}</span>
                </div>
            `;

            if (analysis.average_color || analysis.dominant_color) {
                detailsHtml += '<h3 class="analysis-title">تحليل الألوان</h3>';
                if (analysis.average_color) {
                    const avgColor = Array.isArray(analysis.average_color)
                        ? `rgb(${analysis.average_color[0]}, ${analysis.average_color[1]}, ${analysis.average_color[2]})`
                        : 'غير متوفر';
                    detailsHtml += `
                        <div class="analysis-detail">
                            <span class="analysis-label">متوسط اللون:</span>
                            <span class="analysis-value">
                                <span class="color-sample" style="background-color: ${avgColor}"></span>
                                ${avgColor}
                            </span>
                        </div>
                    `;
                }
                if (analysis.dominant_color) {
                    const domColor = Array.isArray(analysis.dominant_color)
                        ? `rgb(${analysis.dominant_color[0]}, ${analysis.dominant_color[1]}, ${analysis.dominant_color[2]})`
                        : 'غير متوفر';
                    detailsHtml += `
                        <div class="analysis-detail">
                            <span class="analysis-label">اللون السائد:</span>
                            <span class="analysis-value">
                                <span class="color-sample" style="background-color: ${domColor}"></span>
                                ${domColor}
                            </span>
                        </div>
                    `;
                }
            }
            if (analysis.exif && Object.keys(analysis.exif).length > 0) {
                detailsHtml += '<h3 class="analysis-title">بيانات EXIF</h3>';
                for (const [key, value] of Object.entries(analysis.exif)) {
                    detailsHtml += `
                        <div class="analysis-detail">
                            <span class="analysis-label">${key}:</span>
                            <span class="analysis-value">${value}</span>
                        </div>
                    `;
                }
            }
            detailsHtml += '</div>';
            detailsTab.innerHTML = detailsHtml;

            const style = document.createElement('style');
            style.textContent = `
                .color-sample {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border-radius: 4px;
                    margin-left: 8px;
                    vertical-align: middle;
                    border: 1px solid rgba(0,0,0,0.1);
                }
            `;
            document.head.appendChild(style);
        }


        //Rest of displayResults from original code (Objects tab, etc.)
        // Description tab
        if (data.description) {
            descriptionTab.innerHTML = `
                <div class="result-content">
                    <p>${formatText(data.description)}</p>
                </div>
            `;
        } else {
            descriptionTab.innerHTML = '<p>لا يمكن توليد وصف للصورة.</p>';
        }

        // Objects tab
        if (data.detection) {
            const detection = data.detection;

            // Objects list
            if (detection.objects_detected && detection.objects_detected.length > 0) {
                let objectsHtml = '<div class="objects-detected">';

                objectsHtml += `<h3 class="analysis-title">تم اكتشاف ${detection.object_count} عنصر</h3>`;

                objectsHtml += '<div class="objects-tags">';
                for (const object of detection.objects_detected) {
                    objectsHtml += `<span class="object-tag">${object}</span>`;
                }
                objectsHtml += '</div>';

                objectsHtml += '</div>';

                objectsList.innerHTML = objectsHtml;
            } else {
                objectsList.innerHTML = '<p>لم يتم اكتشاف أي كائنات في الصورة.</p>';
            }

            // Annotated image comparison
            if (detection.annotated_image) {
                annotatedImageContainer.innerHTML = `
                    <div class="image-column">
                        <img src="${previewImage.src}" alt="الصورة الأصلية">
                        <div class="image-label">الصورة الأصلية</div>
                    </div>
                    <div class="image-column">
                        <img src="/static/uploads/${detection.annotated_image.split('/').pop()}" alt="الصورة المشروحة">
                        <div class="image-label">الصورة المشروحة</div>
                    </div>
                `;
            }
        } else {
            objectsList.innerHTML = '<p>لا يمكن اكتشاف كائنات في هذه الصورة.</p>';
        }
    }


    // Format text function (from original code)
    function formatText(text) {
        if (!text) return '';
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
        escaped = escaped.replace(/\n/g, '<br>');
        return escaped;
    }

    // Reset button functionality (from original code)
    const resetButton = document.createElement('button');
    resetButton.className = 'action-button';
    resetButton.style.marginRight = '10px';
    resetButton.innerHTML = '<i class="fas fa-redo"></i> صورة جديدة';
    resetButton.addEventListener('click', function() {
        imagePreview.style.display = 'none';
        uploadContainer.style.display = 'block';
        recognitionResults.style.display = 'none';
        previewImage.src = '';
        imageInput.value = ''; // Use imageInput from edited code
        descriptionTab.innerHTML = '';
        detailsTab.innerHTML = '';
        objectsList.innerHTML = '';
        annotatedImageContainer.innerHTML = '';
    });

    analyzeButton.parentNode.insertBefore(resetButton, analyzeButton);
});
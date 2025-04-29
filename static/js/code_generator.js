// Code Generator JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const codeDescription = document.getElementById('code-description');
    const languageSelect = document.getElementById('language-select');
    const withComments = document.getElementById('with-comments');
    const arabicComments = document.getElementById('arabic-comments');
    const generateButton = document.getElementById('generate-code-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const codeResult = document.getElementById('code-result');
    
    // Event listeners
    generateButton.addEventListener('click', generateCode);
    
    // Load settings from localStorage
    const savedLanguage = localStorage.getItem('codeLanguage') || 'python';
    const savedWithComments = localStorage.getItem('withComments') !== 'false';
    const savedArabicComments = localStorage.getItem('arabicComments') !== 'false';
    
    languageSelect.value = savedLanguage;
    withComments.checked = savedWithComments;
    arabicComments.checked = savedArabicComments;
    
    // Save settings to localStorage
    languageSelect.addEventListener('change', function() {
        localStorage.setItem('codeLanguage', languageSelect.value);
    });
    
    withComments.addEventListener('change', function() {
        localStorage.setItem('withComments', withComments.checked);
    });
    
    arabicComments.addEventListener('change', function() {
        localStorage.setItem('arabicComments', arabicComments.checked);
    });
    
    // Toggle Arabic comments availability based on with comments
    withComments.addEventListener('change', function() {
        arabicComments.disabled = !withComments.checked;
        if (!withComments.checked) {
            arabicComments.parentElement.style.opacity = 0.5;
        } else {
            arabicComments.parentElement.style.opacity = 1;
        }
    });
    
    // Initial state
    if (!withComments.checked) {
        arabicComments.disabled = true;
        arabicComments.parentElement.style.opacity = 0.5;
    }
    
    // Generate code function
    function generateCode() {
        const description = codeDescription.value.trim();
        const language = languageSelect.value;
        const useComments = withComments.checked;
        const useArabicComments = arabicComments.checked;
        
        // Validate input
        if (!description) {
            showToast('يرجى إدخال وصف للكود المطلوب', 'error');
            return;
        }
        
        // Show loading state
        loadingSpinner.style.display = 'block';
        generateButton.disabled = true;
        codeResult.innerHTML = '';
        
        // Prepare a more detailed prompt based on settings
        let enrichedDescription = description;
        
        // Add instructions for comments
        if (useComments) {
            const commentLang = useArabicComments ? 'العربية' : 'الإنجليزية';
            enrichedDescription += `\n\nيرجى إضافة تعليقات توضيحية باللغة ${commentLang} لشرح الكود.`;
        } else {
            enrichedDescription += "\n\nيرجى عدم إضافة تعليقات في الكود.";
        }
        
        // Call API
        fetch('/api/generate-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                description: enrichedDescription,
                language: language
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
            
            // Display the generated code
            displayCode(data.generated_code, language);
            
            // Show success message
            showToast('تم توليد الكود بنجاح', 'success');
        })
        .catch(error => {
            console.error('Error generating code:', error);
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false;
            showToast('حدث خطأ أثناء توليد الكود، يرجى المحاولة مرة أخرى', 'error');
        });
    }
    
    // Function to display code with proper formatting
    function displayCode(code, language) {
        // Extract code blocks if present
        let formattedCode = code;
        
        // Check if the response contains markdown code blocks
        const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
        const match = codeBlockRegex.exec(code);
        
        if (match && match[2]) {
            // Use the extracted code from the markdown code block
            formattedCode = match[2];
        }
        
        // Create code display
        const codeDisplay = document.createElement('div');
        codeDisplay.className = 'code-display';
        
        const pre = document.createElement('pre');
        pre.className = `language-${language}`;
        pre.textContent = formattedCode;
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.title = 'نسخ الكود';
        
        copyButton.addEventListener('click', function() {
            navigator.clipboard.writeText(formattedCode).then(function() {
                showToast('تم نسخ الكود بنجاح', 'success');
                
                // Visual feedback for copy
                copyButton.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(function() {
                    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                }, 1500);
            }).catch(function() {
                showToast('فشل نسخ الكود', 'error');
            });
        });
        
        codeDisplay.appendChild(pre);
        codeDisplay.appendChild(copyButton);
        
        // Clear previous results
        codeResult.innerHTML = '';
        codeResult.appendChild(codeDisplay);
        
        // Apply syntax highlighting if available
        if (window.Prism) {
            Prism.highlightElement(pre);
        }
    }
    
    // Handle Enter key in textarea
    codeDescription.addEventListener('keydown', function(e) {
        // Check if Ctrl+Enter or Shift+Enter was pressed
        if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
            e.preventDefault();
            generateCode();
        }
    });
    
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
// Login page functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    
    // Add form submission handler
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            // Get form inputs
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            
            // Basic validation
            if (!username) {
                event.preventDefault();
                showToast('يرجى إدخال اسم المستخدم', 'error');
                return;
            }
            
            if (!password) {
                event.preventDefault();
                showToast('يرجى إدخال كلمة المرور', 'error');
                return;
            }
            
            // Show loading indicator
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...';
            submitButton.disabled = true;
            
            // Form will be submitted normally to the server
        });
    }
    
    // Add input field focus effects
    const inputFields = document.querySelectorAll('.input-group input');
    inputFields.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
    });
    
    // Auto-focus username field on page load
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.focus();
    }
});

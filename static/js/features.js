/**
 * Features Hub JavaScript
 * Handles interactivity for the features hub page
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeFeatureCards();
});

/**
 * Initialize feature cards with hover effects and click handling
 */
function initializeFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');
    
    featureCards.forEach(card => {
        // Add hover sound effect
        card.addEventListener('mouseenter', () => {
            playHoverSound();
        });
        
        // Add click effect
        card.addEventListener('click', function(e) {
            // Create ripple effect
            createRippleEffect(e, this);
        });
    });
}

/**
 * Create a ripple effect on the clicked element
 * @param {Event} e - The click event
 * @param {Element} element - The element that was clicked
 */
function createRippleEffect(e, element) {
    const ripple = document.createElement('span');
    ripple.classList.add('ripple-effect');
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    // Position the ripple at the click point
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    element.appendChild(ripple);
    
    // Remove the ripple after animation completes
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

/**
 * Play a subtle hover sound effect
 */
function playHoverSound() {
    // Check if sounds are enabled in user preferences
    const soundsEnabled = localStorage.getItem('yasmin_sounds_enabled');
    
    if (soundsEnabled === 'true') {
        const hoverSound = new Audio('/static/sounds/hover.mp3');
        hoverSound.volume = 0.2;
        hoverSound.play().catch(e => {
            // Silently fail if sound can't be played
            console.log('Sound playback failed:', e);
        });
    }
}

// Add necessary CSS for the ripple effect
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .feature-card {
            position: relative;
            overflow: hidden;
        }
        
        .ripple-effect {
            position: absolute;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        }
        
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});
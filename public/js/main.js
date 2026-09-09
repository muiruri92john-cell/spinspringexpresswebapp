// Cart functionality
async function addToCart(productId) {
    try {
        const res = await fetch('/products/add-to-cart/' + productId, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('Product added to cart! (' + data.cartCount + ' items)');
            updateCartBadge(data.cartCount);
        }
    } catch(e) {
        console.error('Error adding to cart:', e);
    }
}

function updateCartBadge(count) {
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
}

// Back to top button
window.addEventListener('scroll', function() {
    const btn = document.getElementById('backToTop');
    if (btn) {
        btn.style.display = window.scrollY > 500 ? 'block' : 'none';
    }
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// Notification close
function closeNotification() {
    const bar = document.getElementById('notificationBar');
    if (bar) bar.style.display = 'none';
}

// Image preview for uploads
function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (preview && input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Quantity selector
function updateQuantity(action, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let value = parseInt(input.value) || 1;
    if (action === 'increase') value++;
    if (action === 'decrease' && value > 1) value--;
    input.value = value;
}

// Confirm delete
function confirmDelete(message) {
    return confirm(message || 'Are you sure you want to delete this?');
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

// Initialize tooltips
document.addEventListener('DOMContentLoaded', function() {
    // Lazy load images
    const lazyImages = document.querySelectorAll('img[data-src]');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        });
        lazyImages.forEach(function(img) { observer.observe(img); });
    }
});

console.log('Ardthon Solutions - Connect With Ease');
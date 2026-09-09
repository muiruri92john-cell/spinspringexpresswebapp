// PWA Installation & Push Notifications
const PWA = {
  deferredPrompt: null,
  isInstalled: false,

  // Initialize PWA features
  init() {
    this.registerServiceWorker();
    this.listenForInstall();
    this.checkInstalled();
  },

  // Register Service Worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              this.showUpdateNotification();
            }
          });
        });
      } catch(err) {
        console.log('Service Worker registration failed:', err);
      }
    }
  },

  // Listen for install prompt
  listenForInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      console.log('PWA installed successfully!');
      this.hideInstallBanner();
    });
  },

  // Show install banner
  showInstallBanner() {
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a2e;
      border: 1px solid #00d4ff;
      border-radius: 15px;
      padding: 15px 20px;
      color: white;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 15px;
      box-shadow: 0 10px 40px rgba(0,212,255,0.3);
      animation: slideUp 0.5s ease;
    `;
    banner.innerHTML = `
      <span style="font-size:2rem;">📱</span>
      <div>
        <strong>CuePay App</strong><br>
        <small style="color:#888;">Install for quick access</small>
      </div>
      <button id="install-btn" style="background:#00d4ff;color:#000;border:none;padding:8px 20px;border-radius:50px;font-weight:700;cursor:pointer;">Install</button>
      <button id="dismiss-btn" style="background:transparent;color:#888;border:none;cursor:pointer;font-size:1.2rem;">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('install-btn').addEventListener('click', () => this.installApp());
    document.getElementById('dismiss-btn').addEventListener('click', () => this.hideInstallBanner());
  },

  // Install the app
  async installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const result = await this.deferredPrompt.userChoice;
      console.log('User choice:', result.outcome);
      this.deferredPrompt = null;
      this.hideInstallBanner();
    }
  },

  // Hide install banner
  hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
  },

  // Check if already installed
  checkInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('Running as installed PWA');
    }
  },

  // Subscribe to push notifications
  async subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array('YOUR_PUBLIC_VAPID_KEY')
      });
      
      console.log('Push subscription:', subscription);
      
      // Send subscription to your server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
      
      return subscription;
    } catch(err) {
      console.log('Push subscription failed:', err);
      return null;
    }
  },

  // Show update notification
  showUpdateNotification() {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #f59e0b;
      color: #000;
      padding: 12px 25px;
      border-radius: 50px;
      z-index: 9999;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 5px 20px rgba(245,158,11,0.4);
    `;
    banner.textContent = 'New update available! Tap to refresh';
    banner.addEventListener('click', () => {
      window.location.reload();
    });
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 5000);
  },

  // Convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  PWA.init();
});
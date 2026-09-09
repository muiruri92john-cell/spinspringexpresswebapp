// ============================================
// SPINSPRING - Laundry Automation JS
// ============================================

// Auto-refresh dashboard every 15 seconds
let ssRefreshInterval;

function startSpinRefresh() {
  ssRefreshInterval = setInterval(() => {
    fetch('/spinspg/api/dashboard-data')
      .then(res => res.json())
      .then(data => {
        if (data.success) updateSpinDashboard(data);
      })
      .catch(err => console.log('Refresh error:', err));
  }, 15000);
}

function updateSpinDashboard(data) {
  if (!data.devices) return;
  
  data.devices.forEach(device => {
    // Update status badge
    const statusEl = document.getElementById('ss-status-' + device.device_id);
    if (statusEl) {
      statusEl.textContent = device.status;
      statusEl.className = 'status-badge status-' + device.status;
    }
    
    // Update progress
    const progressEl = document.getElementById('ss-progress-' + device.device_id);
    if (progressEl) {
      progressEl.textContent = device.cycle_progress + '%';
      const bar = document.getElementById('ss-progress-bar-' + device.device_id);
      if (bar) bar.style.width = device.cycle_progress + '%';
    }
    
    // Update revenue
    const revEl = document.getElementById('ss-revenue-' + device.device_id);
    if (revEl) revEl.textContent = 'Ksh ' + (device.today_revenue || 0);
  });
  
  // Update refresh indicator
  const indicator = document.getElementById('ss-refresh-indicator');
  if (indicator) {
    indicator.textContent = 'Last refresh: ' + new Date().toLocaleTimeString();
    indicator.style.color = '#10b981';
  }
}

// Save notification settings
function saveNotificationSettings() {
  const emailAlerts = document.getElementById('emailAlerts').checked;
  const lowRevenue = document.getElementById('lowRevenueAlert').checked;
  const maintenance = document.getElementById('maintenanceAlert').checked;
  
  fetch('/spinspg/settings/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailAlerts, lowRevenue, maintenance })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showSpinToast('Notification settings saved!', 'success');
    }
  })
  .catch(() => showSpinToast('Failed to save settings', 'error'));
}

// Toast notification
function showSpinToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 15px 25px;
    border-radius: 12px;
    font-weight: 600;
    z-index: 9999;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    animation: spinSlideIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'spinSlideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Copy credentials
function copySpinCredentials() {
  const deviceId = document.getElementById('spin-device-id')?.textContent;
  const apiKey = document.getElementById('spin-api-key')?.textContent;
  
  if (deviceId && apiKey) {
    const text = `Device ID: ${deviceId}\nAPI Key: ${apiKey}\nAPI URL: https://ardthonsolutions.com/spinspg/api/sync`;
    navigator.clipboard.writeText(text).then(() => {
      showSpinToast('Credentials copied!', 'success');
    });
  }
}

// Start cycle from dashboard
function startSpinCycle(deviceId) {
  fetch(`/spinspg/device/${deviceId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'command_type=start_cycle&command_value=normal'
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) showSpinToast('Cycle started!', 'success');
  });
}

// Stop machine
function stopSpinMachine(deviceId) {
  if (!confirm('Stop this machine?')) return;
  
  fetch(`/spinspg/device/${deviceId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'command_type=stop&command_value='
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) showSpinToast('Machine stopped', 'success');
  });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  startSpinRefresh();
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spinSlideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes spinSlideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
});

// Sound alert on cycle completion
function playCycleCompleteSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = (freq, duration) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      osc.stop(audioContext.currentTime + duration);
    };
    
    // Play completion melody
    playBeep(600, 0.15);
    setTimeout(() => playBeep(800, 0.15), 200);
    setTimeout(() => playBeep(1000, 0.3), 400);
  } catch(e) {}
}
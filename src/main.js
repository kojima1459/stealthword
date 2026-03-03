/**
 * main.js — エントリーポイント
 * 全モジュールの初期化 + 設定モーダル管理
 */
import './style.css';
import { ChatManager, SettingsManager } from './chat.js';
import { BossMode } from './boss-mode.js';

// Set tab title
document.title = '無題のドキュメント - Google ドキュメント';

// Initialize chat
const chatManager = new ChatManager();

// Initialize boss mode
const bossMode = new BossMode(chatManager);

// ===== Settings Modal Logic =====
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose = document.getElementById('settings-close');
const settingsCancel = document.getElementById('settings-cancel');
const settingsSave = document.getElementById('settings-save');
const apiProvider = document.getElementById('api-provider');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeyField = document.getElementById('api-key-field');
const apiModel = document.getElementById('api-model');
const systemPrompt = document.getElementById('system-prompt');
const toggleKeyVis = document.getElementById('toggle-key-visibility');
const settingsStatus = document.getElementById('settings-status');

function openSettings() {
  // Load current values
  apiProvider.value = SettingsManager.provider;
  apiKeyInput.value = SettingsManager.apiKey;
  apiModel.value = SettingsManager.model;
  systemPrompt.value = SettingsManager.systemPrompt;
  updateKeyFieldVisibility();
  settingsStatus.className = 'settings-status';
  settingsStatus.textContent = '';
  settingsOverlay.style.display = 'flex';
}

function closeSettings() {
  settingsOverlay.style.display = 'none';
}

function updateKeyFieldVisibility() {
  const isGemini = apiProvider.value === 'gemini';
  apiKeyField.style.display = isGemini ? 'block' : 'none';
  document.getElementById('api-model').closest('.settings-field').style.display = isGemini ? 'block' : 'none';
}

apiProvider.addEventListener('change', updateKeyFieldVisibility);

// Toggle API key visibility
toggleKeyVis.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyVis.querySelector('.material-icons').textContent = isPassword ? 'visibility_off' : 'visibility';
});

// Save settings
settingsSave.addEventListener('click', () => {
  SettingsManager.provider = apiProvider.value;
  SettingsManager.apiKey = apiKeyInput.value.trim();
  SettingsManager.model = apiModel.value;
  SettingsManager.systemPrompt = systemPrompt.value;

  settingsStatus.className = 'settings-status success';
  settingsStatus.textContent = '✓ 設定を保存しました。ページをリロードすると反映されます。';

  setTimeout(closeSettings, 1200);
});

// Close events
settingsClose.addEventListener('click', closeSettings);
settingsCancel.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

// ===== Menu Bar — ツール → 設定 =====
const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach(item => {
  if (item.textContent === 'ツール') {
    // Add blue dot if API not configured
    if (!SettingsManager.isConfigured) {
      item.classList.add('has-indicator');
    }
    item.addEventListener('click', (e) => {
      e.preventDefault();
      openSettings();
    });
  }
});

// ===== Ruler marks generation =====
const rulerMarks = document.querySelector('.ruler-marks');
if (rulerMarks) {
  let marks = '';
  for (let i = 0; i <= 20; i++) {
    marks += `<span style="position:absolute;left:${i * 38.4}px;top:6px;font-size:8px;color:#999;user-select:none;">${i}</span>`;
  }
  rulerMarks.innerHTML = marks;
}

// Toolbar visual feedback (decorative)
document.querySelectorAll('.toolbar-btn').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    el.style.background = 'rgba(26,115,232,0.12)';
    setTimeout(() => { el.style.background = ''; }, 150);
  });
});

// Menu items (except ツール)
document.querySelectorAll('.menu-item').forEach(el => {
  if (el.textContent !== 'ツール') {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      el.style.background = 'rgba(26,115,232,0.12)';
      setTimeout(() => { el.style.background = ''; }, 150);
    });
  }
});

// Focus chat input on load
setTimeout(() => {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.focus();
}, 100);

console.log('🔒 Stealth AI Chat initialized. Press Escape for boss mode.');
if (SettingsManager.isConfigured) {
  console.log(`🤖 Gemini API: ${SettingsManager.model}`);
} else {
  console.log('💡 ツール → 設定 からAPIキーを設定してください');
}

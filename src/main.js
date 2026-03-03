/**
 * main.js — エントリーポイント
 * 全機能の初期化: チュートリアル、サイドバー、ダークモード、スキン、
 * タイマー、診断、共有、デイリーTips、ショートカット、エクスポート
 */
import './style.css';
import { ChatManager, SettingsManager, PERSONAS } from './chat.js';
import { BossMode } from './boss-mode.js';

document.title = '無題のドキュメント - Google ドキュメント';

// === DARK MODE ===
function applyDarkMode(on) {
  document.body.classList.toggle('dark-mode', on);
  SettingsManager.darkMode = on;
}
applyDarkMode(SettingsManager.darkMode);
document.getElementById('btn-dark-mode').addEventListener('click', () => applyDarkMode(!SettingsManager.darkMode));

// === SKIN ===
function applySkin(skin) {
  document.body.classList.remove('skin-ms-word', 'skin-notion', 'skin-terminal');
  if (skin !== 'google-docs') document.body.classList.add('skin-' + skin);
  SettingsManager.skin = skin;
  document.querySelectorAll('.skin-option').forEach(el => el.classList.toggle('active', el.dataset.skin === skin));
}
applySkin(SettingsManager.skin);
document.getElementById('btn-skin').addEventListener('click', () => {
  document.getElementById('skin-overlay').style.display = 'flex';
});
document.getElementById('skin-grid').addEventListener('click', (e) => {
  const opt = e.target.closest('.skin-option');
  if (opt) { applySkin(opt.dataset.skin); }
});

// === CHAT ===
const chatManager = new ChatManager();
const bossMode = new BossMode(chatManager);

// === PERSONA CHIPS ===
const personaChips = document.getElementById('persona-chips');
PERSONAS.forEach(p => {
  const chip = document.createElement('button');
  chip.className = 'persona-chip' + (SettingsManager.persona === p.id ? ' active' : '');
  chip.textContent = p.name;
  chip.dataset.id = p.id;
  chip.addEventListener('click', () => {
    SettingsManager.persona = p.id;
    SettingsManager.systemPrompt = p.prompt;
    document.querySelectorAll('.persona-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
  personaChips.appendChild(chip);
});

// === SIDEBAR (Chat History) ===
const sidebar = document.getElementById('chat-sidebar');
const sidebarList = document.getElementById('sidebar-list');
function refreshSidebar() {
  sidebarList.innerHTML = '';
  const convs = SettingsManager.getConversations();
  convs.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'sidebar-item' + (conv.id === chatManager.conversationId ? ' active' : '');
    const dateStr = conv.date ? new Date(conv.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '';
    item.innerHTML = `<span class="sidebar-item-title">${conv.title || '新しい会話'}</span><span class="sidebar-item-date">${dateStr}</span><button class="sidebar-item-delete" title="削除">×</button>`;
    item.querySelector('.sidebar-item-title').addEventListener('click', () => {
      chatManager.loadConversation(conv.id);
      refreshSidebar();
    });
    item.querySelector('.sidebar-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      const cs = SettingsManager.getConversations().filter(c => c.id !== conv.id);
      SettingsManager.saveConversations(cs);
      refreshSidebar();
    });
    sidebarList.appendChild(item);
  });
}
window._refreshSidebar = refreshSidebar;
document.getElementById('btn-history').addEventListener('click', () => {
  sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
  refreshSidebar();
});
document.getElementById('sidebar-close').addEventListener('click', () => { sidebar.style.display = 'none'; });
document.getElementById('sidebar-new').addEventListener('click', () => {
  chatManager.startNewConversation();
  refreshSidebar();
});

// === TUTORIAL ===
if (!SettingsManager.tutorialDone) {
  const overlay = document.getElementById('tutorial-overlay');
  overlay.style.display = 'flex';
  let currentStep = 0;
  const steps = overlay.querySelectorAll('.tutorial-step');
  const dots = overlay.querySelectorAll('.dot');
  const nextBtn = document.getElementById('tutorial-next');
  nextBtn.addEventListener('click', () => {
    currentStep++;
    if (currentStep >= steps.length) {
      overlay.style.display = 'none';
      SettingsManager.tutorialDone = true;
      return;
    }
    steps.forEach((s, i) => { s.style.display = i === currentStep ? 'block' : 'none'; });
    dots.forEach((d, i) => d.classList.toggle('active', i === currentStep));
    if (currentStep === steps.length - 1) nextBtn.textContent = '始める！';
  });
}

// === SETTINGS MODAL ===
const settingsOverlay = document.getElementById('settings-overlay');
const apiProvider = document.getElementById('api-provider');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeyField = document.getElementById('api-key-field');
const apiModel = document.getElementById('api-model');
const systemPrompt = document.getElementById('system-prompt');
const toggleKeyVis = document.getElementById('toggle-key-visibility');
const settingsStatus = document.getElementById('settings-status');

function openSettings() {
  apiProvider.value = SettingsManager.provider;
  apiKeyInput.value = SettingsManager.apiKey;
  apiModel.value = SettingsManager.model;
  systemPrompt.value = SettingsManager.systemPrompt;
  updateKeyFieldVis();
  settingsStatus.className = 'settings-status';
  settingsOverlay.style.display = 'flex';
}
function closeSettings() { settingsOverlay.style.display = 'none'; }
function updateKeyFieldVis() {
  const isG = apiProvider.value === 'gemini';
  apiKeyField.style.display = isG ? 'block' : 'none';
  apiModel.closest('.settings-field').style.display = isG ? 'block' : 'none';
}
apiProvider.addEventListener('change', updateKeyFieldVis);
toggleKeyVis.addEventListener('click', () => {
  const isP = apiKeyInput.type === 'password';
  apiKeyInput.type = isP ? 'text' : 'password';
  toggleKeyVis.querySelector('.material-icons').textContent = isP ? 'visibility_off' : 'visibility';
});
document.getElementById('settings-save').addEventListener('click', () => {
  SettingsManager.provider = apiProvider.value;
  SettingsManager.apiKey = apiKeyInput.value.trim();
  SettingsManager.model = apiModel.value;
  SettingsManager.systemPrompt = systemPrompt.value;
  settingsStatus.className = 'settings-status success';
  settingsStatus.textContent = '✓ 設定を保存しました。ページをリロードすると反映されます。';
  const menuTool = document.getElementById('menu-tools');
  if (SettingsManager.isConfigured) menuTool.classList.remove('has-indicator');
  setTimeout(closeSettings, 1200);
});
document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('settings-cancel').addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });
document.getElementById('menu-tools').addEventListener('click', openSettings);
if (!SettingsManager.isConfigured) document.getElementById('menu-tools').classList.add('has-indicator');

// === GENERIC MODAL CLOSE ===
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const overlayId = btn.dataset.close;
    if (overlayId) document.getElementById(overlayId).style.display = 'none';
  });
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
});

// === KEYBOARD SHORTCUTS ===
document.getElementById('btn-shortcuts').addEventListener('click', () => {
  document.getElementById('shortcuts-overlay').style.display = 'flex';
});
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === '/') { e.preventDefault(); document.getElementById('shortcuts-overlay').style.display = 'flex'; }
  if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportChat(); }
  if (e.ctrlKey && e.key === 'h') { e.preventDefault(); document.getElementById('btn-history').click(); }
  if (e.ctrlKey && e.key === 'd') { e.preventDefault(); applyDarkMode(!SettingsManager.darkMode); }
});

// === EXPORT ===
function exportChat() {
  const md = chatManager.exportMarkdown();
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `stealthword-chat-${Date.now()}.md`;
  a.click(); URL.revokeObjectURL(url);
}
document.getElementById('btn-export').addEventListener('click', exportChat);

// === TIMER ===
const timerPopup = document.getElementById('timer-popup');
const timerDisplay = document.getElementById('timer-display');
let timerInterval = null;
let timerSeconds = 300;
document.getElementById('btn-timer').addEventListener('click', () => {
  timerPopup.style.display = timerPopup.style.display === 'none' ? 'block' : 'none';
});
document.querySelectorAll('.timer-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    timerSeconds = parseInt(btn.dataset.time);
    updateTimerDisplay();
    document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
document.getElementById('timer-start').addEventListener('click', () => {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      timerPopup.style.display = 'none';
      bossMode.activate();
    }
  }, 1000);
});
document.getElementById('timer-stop').addEventListener('click', () => {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
});

// === STEALTH SCORE & DIAGNOSIS ===
function calcStealthScore() {
  const msgs = SettingsManager.msgCount;
  const bosses = SettingsManager.bossCount;
  const sessionMin = Math.floor((Date.now() - parseInt(SettingsManager.sessionStart)) / 60000);
  const hasAPI = SettingsManager.isConfigured ? 20 : 0;
  const hasDark = SettingsManager.darkMode ? 10 : 0;
  const skinBonus = SettingsManager.skin !== 'google-docs' ? 10 : 0;
  const score = Math.min(100, msgs * 3 + bosses * 10 + Math.min(sessionMin, 30) + hasAPI + hasDark + skinBonus);
  return { score, msgs, bosses, sessionMin, hasAPI: SettingsManager.isConfigured, hasDark: SettingsManager.darkMode, skin: SettingsManager.skin };
}
function updateStealthScore() {
  const { score } = calcStealthScore();
  document.getElementById('score-value').textContent = score;
}
setInterval(updateStealthScore, 5000);
updateStealthScore();

document.getElementById('stealth-score').addEventListener('click', () => {
  const { score, msgs, bosses, sessionMin, hasAPI, hasDark, skin } = calcStealthScore();
  const ring = document.getElementById('diagnosis-ring');
  const offset = 327 - (327 * score / 100);
  ring.style.transition = 'stroke-dashoffset 1s ease';
  ring.style.strokeDashoffset = offset;
  document.getElementById('diagnosis-score-text').textContent = score;
  const ranks = [
    [90, '🏆 ステルスマスター'], [70, '🥷 影の使い手'], [50, '🕵️ 見習いスパイ'],
    [30, '👀 まだバレそう...'], [0, '😰 初心者']
  ];
  const rank = ranks.find(r => score >= r[0])?.[1] || '😰 初心者';
  document.getElementById('diagnosis-rank').textContent = rank;
  let details = `<strong>詳細スコア:</strong><br>`;
  details += `・メッセージ送信: ${msgs}回 (+${Math.min(msgs * 3, 30)})<br>`;
  details += `・ボスモード発動: ${bosses}回 (+${Math.min(bosses * 10, 30)})<br>`;
  details += `・使用時間: ${sessionMin}分 (+${Math.min(sessionMin, 30)})<br>`;
  details += `・API設定: ${hasAPI ? '✓' : '✗'} (+${hasAPI ? 20 : 0})<br>`;
  details += `・ダークモード: ${hasDark ? '✓' : '✗'} (+${hasDark ? 10 : 0})<br>`;
  details += `・カスタムスキン: ${skin !== 'google-docs' ? '✓' : '✗'} (+${skin !== 'google-docs' ? 10 : 0})`;
  document.getElementById('diagnosis-details').innerHTML = details;
  document.getElementById('diagnosis-overlay').style.display = 'flex';
});
document.getElementById('diagnosis-share').addEventListener('click', () => {
  const { score } = calcStealthScore();
  const ranks = [[90, 'ステルスマスター'], [70, '影の使い手'], [50, '見習いスパイ'], [30, 'まだバレそう'], [0, '初心者']];
  const rank = ranks.find(r => score >= r[0])?.[1] || '初心者';
  const text = `私のステルス度は${score}点！「${rank}」でした🔒\n\n見た目はGoogle Docs、中身はAIチャット。\n#StealthWord で職場でこっそりAI活用中😎\nhttps://stealthword.vercel.app`;
  navigator.clipboard?.writeText(text);
  alert('診断結果をクリップボードにコピーしました！');
});

// === SHARE / INVITE ===
document.getElementById('btn-share-screenshot').addEventListener('click', () => {
  document.getElementById('share-overlay').style.display = 'flex';
});
document.getElementById('share-copy').addEventListener('click', () => {
  navigator.clipboard?.writeText(document.getElementById('share-url').value);
  document.getElementById('share-copy').innerHTML = '<span class="material-icons">done</span>';
  setTimeout(() => { document.getElementById('share-copy').innerHTML = '<span class="material-icons">content_copy</span>'; }, 1500);
});
document.getElementById('copy-template').addEventListener('click', () => {
  navigator.clipboard?.writeText(document.getElementById('share-template').value);
  document.getElementById('copy-template').innerHTML = '<span class="material-icons">done</span> コピー済み';
  setTimeout(() => { document.getElementById('copy-template').innerHTML = '<span class="material-icons">content_copy</span> コピー'; }, 1500);
});
document.getElementById('share-twitter').addEventListener('click', () => {
  const text = encodeURIComponent('見た目はGoogle Docs、中身はAIチャット。\nEscキーでAIが議事録に変身する「StealthWord」がヤバい😂\n#StealthWord');
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=https://stealthword.vercel.app`, '_blank');
});
document.getElementById('share-line').addEventListener('click', () => {
  const msg = encodeURIComponent('StealthWord — 見た目はDocs。中身はAI。 https://stealthword.vercel.app');
  window.open(`https://line.me/R/msg/text/?${msg}`, '_blank');
});

// === DAILY TIPS ===
const tips = [
  'Escキーでボスモードに瞬時切替！上司が来てもバレません 🛡️',
  'ツール → 設定 でGemini APIキーを入力すると、本物のAIと会話できます 🤖',
  'Ctrl+E で会話をMarkdown形式でエクスポートできます 📄',
  'Ctrl+D でダークモードに切替。目に優しく、ステルス度もアップ 🌙',
  'ペルソナを「エンジニア」に切り替えると、技術的な回答が得られます 💻',
  'ステータスバーの🛡️をクリックすると「ステルス度診断」ができます',
  'スキンを「ターミナル」に変えると、完全に別のアプリに見えます',
  'タイマー機能で「5分後にボスモード」を自動発動できます ⏰',
  'Shift+Enter で改行、Enter で送信です',
  '友達に教えるボタンでXやLINEでシェアできます 📱',
];
const today = new Date().toDateString();
if (localStorage.getItem(SettingsManager.KEYS.DAILY_TIP_DATE) !== today) {
  localStorage.setItem(SettingsManager.KEYS.DAILY_TIP_DATE, today);
  const tipEl = document.getElementById('daily-tip');
  const tipText = document.getElementById('tip-text');
  tipText.textContent = tips[Math.floor(Math.random() * tips.length)];
  setTimeout(() => { tipEl.style.display = 'flex'; }, 2000);
  document.getElementById('tip-close').addEventListener('click', () => { tipEl.style.display = 'none'; });
}

// === RULER ===
const rulerMarks = document.querySelector('.ruler-marks');
if (rulerMarks) {
  let m = '';
  for (let i = 0; i <= 20; i++) m += `<span style="position:absolute;left:${i*38.4}px;top:6px;font-size:8px;color:#999;user-select:none">${i}</span>`;
  rulerMarks.innerHTML = m;
}

// === TOOLBAR / MENU FEEDBACK ===
document.querySelectorAll('.toolbar-btn').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); el.style.background = 'rgba(26,115,232,.12)'; setTimeout(() => { el.style.background = ''; }, 150); });
});
document.querySelectorAll('.menu-item').forEach(el => {
  if (el.id !== 'menu-tools') {
    el.addEventListener('click', (e) => { e.preventDefault(); el.style.background = 'rgba(26,115,232,.12)'; setTimeout(() => { el.style.background = ''; }, 150); });
  }
});

// Focus
setTimeout(() => { document.getElementById('chat-input')?.focus(); }, 100);
console.log('🔒 StealthWord v2.0 initialized');

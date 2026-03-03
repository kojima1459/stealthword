/**
 * chat.js — AIチャットロジック
 * Gemini API + ストリーミング + 会話履歴 + ステルススコア
 */

const mockResponses = [
  "ご質問ありがとうございます。その件について、いくつかの観点からご説明いたします。\n\nまず、基本的な考え方としては、現在のプロジェクト進捗を踏まえた上で、リソース配分の最適化を図ることが重要です。",
  "はい、その点については以下のように整理できます。\n\n1. 現状分析: 現在のシステムは年間稼働率99.7%を達成\n2. 課題: ピーク時のレスポンスタイムが目標値を超過\n3. 対策案: キャッシュ層の導入およびシャーディング",
  "承知いたしました。スケジュールに関しては以下のマイルストーンを提案します。\n\n・Phase 1（〜3月末）: 要件定義・基本設計\n・Phase 2（4月〜5月）: 詳細設計・実装\n・Phase 3（6月）: テスト・品質保証",
  "おっしゃる通りです。コスト面での検討も重要です。\n\nインフラコストが月額約120万円、開発工数が約480人日、外部委託費用が約350万円を想定しています。",
  "市場動向を踏まえると、既存顧客基盤の強化が有効です。解約率を2.8%から2.0%以下に低減させ、安定的な収益基盤を確保します。",
  "ユーザーエクスペリエンスの改善が最も投資対効果の高い施策です。\n\n・オンボーディングフローの簡素化（7→3ステップ）\n・ダッシュボードの情報設計見直し\n・モバイルアプリのレスポンス改善（目標300ms）",
  "セキュリティの観点は最優先です。\n\n・多要素認証（MFA）の全ユーザー適用\n・通信経路の完全暗号化（TLS 1.3）\n・月次の脆弱性スキャン\n・ゼロトラストセキュリティモデルへの移行計画中"
];
let responseIndex = 0;

// === Persona Presets ===
export const PERSONAS = [
  { id: 'business', name: '💼 ビジネス', prompt: 'あなたは優秀なビジネスアシスタントです。丁寧な日本語で、ビジネス文書のような口調で回答してください。' },
  { id: 'engineer', name: '💻 エンジニア', prompt: 'あなたは優秀なシニアソフトウェアエンジニアです。技術的な質問に対して、正確で実践的なコードと解説を提供してください。' },
  { id: 'translator', name: '🌐 翻訳者', prompt: 'あなたはプロの翻訳者です。日本語と英語の間で自然で正確な翻訳を提供してください。文脈に応じたニュアンスも考慮してください。' },
  { id: 'creative', name: '🎨 クリエイター', prompt: 'あなたはクリエイティブディレクターです。マーケティング、コピーライティング、デザインの観点からアイデアや提案を提供してください。' },
  { id: 'analyst', name: '📊 アナリスト', prompt: 'あなたはデータアナリストです。数値やデータに基づいた分析と提案を行い、表やグラフの形式で情報を整理してください。' },
];

// === Settings Manager ===
export class SettingsManager {
  static KEYS = {
    API_KEY: 'sw-api-key', PROVIDER: 'sw-provider', MODEL: 'sw-model',
    SYSTEM_PROMPT: 'sw-system-prompt', DARK_MODE: 'sw-dark-mode',
    SKIN: 'sw-skin', PERSONA: 'sw-persona', CONVERSATIONS: 'sw-conversations',
    ACTIVE_CONV: 'sw-active-conv', STEALTH_SCORE: 'sw-stealth-score',
    TUTORIAL_DONE: 'sw-tutorial-done', BOSS_COUNT: 'sw-boss-count',
    MSG_COUNT: 'sw-msg-count', SESSION_START: 'sw-session-start',
    DAILY_TIP_DATE: 'sw-tip-date',
  };
  // [REFACTOR S1] APIキーの平文保存防止（XOR+Base64簡易難読化）
  static _encode(str) {
    if (!str) return '';
    const mask = 'stealth-key';
    const xor = Array.from(str).map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ mask.charCodeAt(i % mask.length))).join('');
    return 'enc:' + btoa(xor);
  }
  static _decode(val) {
    if (!val) return '';
    if (!val.startsWith('enc:')) return val; // 旧バージョン（平文）の互換性
    try {
      const mask = 'stealth-key';
      const xor = atob(val.slice(4));
      return Array.from(xor).map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ mask.charCodeAt(i % mask.length))).join('');
    } catch { return ''; }
  }

  static get apiKey() { return this._decode(localStorage.getItem(this.KEYS.API_KEY)); }
  static set apiKey(v) { localStorage.setItem(this.KEYS.API_KEY, this._encode(v)); }
  static get provider() { return localStorage.getItem(this.KEYS.PROVIDER) || 'mock'; }
  static set provider(v) { localStorage.setItem(this.KEYS.PROVIDER, v); }
  static get model() { return localStorage.getItem(this.KEYS.MODEL) || 'gemini-2.5-flash'; }
  static set model(v) { localStorage.setItem(this.KEYS.MODEL, v); }
  static get systemPrompt() { return localStorage.getItem(this.KEYS.SYSTEM_PROMPT) || PERSONAS[0].prompt; }
  static set systemPrompt(v) { localStorage.setItem(this.KEYS.SYSTEM_PROMPT, v); }
  static get isConfigured() { return this.provider === 'gemini' && this.apiKey.length > 0; }
  static get darkMode() { return localStorage.getItem(this.KEYS.DARK_MODE) === 'true'; }
  static set darkMode(v) { localStorage.setItem(this.KEYS.DARK_MODE, String(v)); }
  static get skin() { return localStorage.getItem(this.KEYS.SKIN) || 'google-docs'; }
  static set skin(v) { localStorage.setItem(this.KEYS.SKIN, v); }
  static get persona() { return localStorage.getItem(this.KEYS.PERSONA) || 'business'; }
  static set persona(v) { localStorage.setItem(this.KEYS.PERSONA, v); }
  static get tutorialDone() { return localStorage.getItem(this.KEYS.TUTORIAL_DONE) === 'true'; }
  static set tutorialDone(v) { localStorage.setItem(this.KEYS.TUTORIAL_DONE, String(v)); }
  static get bossCount() { return parseInt(localStorage.getItem(this.KEYS.BOSS_COUNT) || '0'); }
  static set bossCount(v) { localStorage.setItem(this.KEYS.BOSS_COUNT, String(v)); }
  static get msgCount() { return parseInt(localStorage.getItem(this.KEYS.MSG_COUNT) || '0'); }
  static set msgCount(v) { localStorage.setItem(this.KEYS.MSG_COUNT, String(v)); }
  static get sessionStart() { return localStorage.getItem(this.KEYS.SESSION_START) || Date.now().toString(); }
  static set sessionStart(v) { localStorage.setItem(this.KEYS.SESSION_START, v); }

  // Conversation storage
  static getConversations() {
    try { return JSON.parse(localStorage.getItem(this.KEYS.CONVERSATIONS) || '[]'); } catch { return []; }
  }
  // [REFACTOR E3] localStorage保存時にQuotaExceededErrorをキャッチし、古い会話を自動削除
  static saveConversations(convs) {
    try {
      localStorage.setItem(this.KEYS.CONVERSATIONS, JSON.stringify(convs));
    } catch (e) {
      if (e.name === 'QuotaExceededError' && convs.length > 1) {
        convs.splice(Math.floor(convs.length / 2)); // 半分削除してリトライ
        try { localStorage.setItem(this.KEYS.CONVERSATIONS, JSON.stringify(convs)); }
        catch { console.warn('localStorage quota exceeded, could not save conversations'); }
      }
    }
  }
  static get activeConvId() { return localStorage.getItem(this.KEYS.ACTIVE_CONV) || ''; }
  static set activeConvId(v) { localStorage.setItem(this.KEYS.ACTIVE_CONV, v); }
}

// === Gemini API ===
// [REFACTOR E1] APIキーをURLパラメータではなくヘッダーに移動（ブラウザ履歴・ログへの漏洩防止）
// [REFACTOR E2] 指数バックオフ付きリトライ（最大3回）を追加
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

async function callGeminiAPI(messages, systemPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SettingsManager.model}:generateContent`;
  const contents = messages.filter(m => m.role === 'user' || m.role === 'ai').map(m => ({
    role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }]
  }));
  const body = JSON.stringify({
    contents, systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': SettingsManager.apiKey   // [E1] ヘッダー経由でAPIキー送信
        },
        body,
      });
      if (response.status === 429 || response.status >= 500) {
        // Retryable error — wait and try again
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
          continue;
        }
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error?.message || `API Error: ${response.status}`);
      }
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('APIから応答を取得できませんでした');
      return text;
    } catch (err) {
      if (attempt >= MAX_RETRIES - 1) throw err;
      await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
    }
  }
}

// === Chat Manager ===
export class ChatManager {
  constructor() {
    this.messages = [];
    this.conversationId = '';
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.statusWords = document.getElementById('status-words');
    this.sendBtn = document.getElementById('send-btn');
    this.isTyping = false;
    if (!SettingsManager.sessionStart || !localStorage.getItem(SettingsManager.KEYS.SESSION_START)) {
      SettingsManager.sessionStart = Date.now().toString();
    }
    this.init();
  }

  init() {
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // Load or create conversation
    const activeId = SettingsManager.activeConvId;
    if (activeId) this.loadConversation(activeId);
    if (this.messages.length === 0) this.startNewConversation();
  }

  startNewConversation() {
    this.conversationId = 'conv-' + Date.now();
    this.messages = [];
    this.chatMessages.innerHTML = '';
    SettingsManager.activeConvId = this.conversationId;
    const persona = PERSONAS.find(p => p.id === SettingsManager.persona) || PERSONAS[0];
    this.addAIMessage(`こんにちは。何かお手伝いできることはありますか？\n（${SettingsManager.isConfigured ? 'Gemini API接続済み' : 'ツール→設定でAPIキーを入力'}。Escキーでボスモード）`);
    this.saveCurrentConversation();
  }

  loadConversation(id) {
    const convs = SettingsManager.getConversations();
    const conv = convs.find(c => c.id === id);
    if (!conv) return;
    this.conversationId = conv.id;
    this.messages = conv.messages || [];
    this.chatMessages.innerHTML = '';
    this.messages.forEach(m => {
      if (m.role === 'user') this._renderUserMessage(m.content);
      else this._renderAIMessage(m.content);
    });
    SettingsManager.activeConvId = id;
    this.scrollToBottom();
    this.updateWordCount();
  }

  saveCurrentConversation() {
    const convs = SettingsManager.getConversations();
    const idx = convs.findIndex(c => c.id === this.conversationId);
    const title = this.messages.find(m => m.role === 'user')?.content?.slice(0, 30) || '新しい会話';
    const conv = { id: this.conversationId, title, messages: this.messages, date: new Date().toISOString() };
    if (idx >= 0) convs[idx] = conv; else convs.unshift(conv);
    if (convs.length > 50) convs.splice(50);
    SettingsManager.saveConversations(convs);
    // [REFACTOR D2] CustomEvent\u3067\u30b5\u30a4\u30c9\u30d0\u30fc\u66f4\u65b0\u3092\u901a\u77e5\n    window.dispatchEvent(new CustomEvent('sw:sidebar-refresh'));
  }

  async sendMessage() {
    const text = this.chatInput.innerText.trim();
    if (!text || this.isTyping) return;
    this.addUserMessage(text);
    this.chatInput.innerText = '';
    SettingsManager.msgCount = SettingsManager.msgCount + 1;
    this.showTyping();

    if (SettingsManager.isConfigured) {
      try {
        const persona = PERSONAS.find(p => p.id === SettingsManager.persona) || PERSONAS[0];
        const prompt = SettingsManager.systemPrompt || persona.prompt;
        const response = await callGeminiAPI(this.messages, prompt);
        this.hideTyping();
        this.streamAIMessage(response);
      } catch (err) {
        this.hideTyping();
        this.addAIMessage(`⚠ エラー: ${err.message}\n\n（ツール→設定からAPIキーを確認してください）`);
      }
    } else {
      const delay = 600 + Math.random() * 1200;
      setTimeout(() => {
        this.hideTyping();
        const resp = mockResponses[responseIndex % mockResponses.length];
        responseIndex++;
        this.streamAIMessage(resp);
      }, delay);
    }
  }

  addUserMessage(text) {
    this.messages.push({ role: 'user', content: text });
    this._renderUserMessage(text);
    this.scrollToBottom();
    this.updateWordCount();
    this.saveCurrentConversation();
  }

  _renderUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'chat-message user';
    div.innerHTML = `<div class="message-label">あなた:</div><div class="message-content">${this.escapeHtml(text)}</div>`;
    this.chatMessages.appendChild(div);
  }

  addAIMessage(text) {
    this.messages.push({ role: 'ai', content: text });
    this._renderAIMessage(text);
    this.scrollToBottom();
    this.updateWordCount();
    this.saveCurrentConversation();
  }

  _renderAIMessage(text) {
    const div = document.createElement('div');
    div.className = 'chat-message ai';
    div.innerHTML = `<div class="message-label">アシスタント:</div><div class="message-content">${this.escapeHtml(text)}</div>`;
    this.chatMessages.appendChild(div);
  }

  // [REFACTOR P1] ストリーミングを textNode 追記に変更（innerHTML += のDOMリパース回避）
  streamAIMessage(text) {
    this.messages.push({ role: 'ai', content: text });
    const div = document.createElement('div');
    div.className = 'chat-message ai';
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = 'アシスタント:';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    div.appendChild(label);
    div.appendChild(contentDiv);
    this.chatMessages.appendChild(div);
    let i = 0;
    const chars = text.split('');
    const stream = () => {
      if (i < chars.length) {
        const batch = chars.slice(i, i + 3).join('');
        // 改行は <br> に、それ以外は textNode で追加（XSS防止 + パフォーマンス改善）
        for (const ch of batch) {
          if (ch === '\n') { contentDiv.appendChild(document.createElement('br')); }
          else { contentDiv.appendChild(document.createTextNode(ch)); }
        }
        i += 3;
        this.scrollToBottom();
        requestAnimationFrame(stream);
      } else {
        this.updateWordCount();
        this.saveCurrentConversation();
      }
    };
    stream();
  }

  showTyping() {
    this.isTyping = true;
    const div = document.createElement('div');
    div.className = 'chat-message ai'; div.id = 'typing-msg';
    div.innerHTML = `<div class="message-label">アシスタント:</div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
    this.chatMessages.appendChild(div);
    this.scrollToBottom();
  }
  hideTyping() {
    this.isTyping = false;
    const t = document.getElementById('typing-msg');
    if (t) t.remove();
  }
  scrollToBottom() {
    const d = document.querySelector('.document-area');
    if (d) d.scrollTop = d.scrollHeight;
  }
  updateWordCount() {
    const allText = this.messages.map(m => m.content).join('');
    if (this.statusWords) this.statusWords.textContent = `${allText.length} 文字`;
    // Update page count
    const pages = Math.max(1, Math.ceil(allText.length / 1500));
    const sp = document.getElementById('status-pages');
    if (sp) sp.textContent = `${pages} / ${pages} ページ`;
  }
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }
  hide() { document.getElementById('chat-page').style.display = 'none'; }
  show() { document.getElementById('chat-page').style.display = 'block'; this.chatInput.focus(); }

  // Export as Markdown
  exportMarkdown() {
    let md = `# StealthWord 会話ログ\n\n`;
    md += `日時: ${new Date().toLocaleString('ja-JP')}\n\n---\n\n`;
    this.messages.forEach(m => {
      const role = m.role === 'user' ? '👤 あなた' : '🤖 アシスタント';
      md += `### ${role}\n\n${m.content}\n\n---\n\n`;
    });
    return md;
  }

  // Export as business report
  exportBusinessReport() {
    let report = `# 業務調査レポート\n\n`;
    report += `作成日: ${new Date().toLocaleString('ja-JP')}\n`;
    report += `作成者: ビジネスアシスタント\n\n---\n\n`;
    report += `## 調査概要\n\n`;
    const userMsgs = this.messages.filter(m => m.role === 'user');
    const aiMsgs = this.messages.filter(m => m.role === 'ai');
    report += `本レポートは、${userMsgs.length}件の調査事項に対する分析結果をまとめたものである。\n\n`;
    userMsgs.forEach((msg, i) => {
      report += `## ${i + 1}. ${msg.content.slice(0, 50)}\n\n`;
      if (aiMsgs[i]) report += `${aiMsgs[i].content}\n\n`;
    });
    report += `---\n\n以上`;
    return report;
  }
}

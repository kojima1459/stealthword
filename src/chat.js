/**
 * chat.js — AIチャットロジック
 * Gemini API対応 + モックフォールバック
 */

// モックAIレスポンス（APIキー未設定時のフォールバック）
const mockResponses = [
  "ご質問ありがとうございます。その件について、いくつかの観点からご説明いたします。\n\nまず、基本的な考え方としては、現在のプロジェクト進捗を踏まえた上で、リソース配分の最適化を図ることが重要です。具体的には、開発チームの稼働率を考慮しながら、優先順位の高いタスクから順次対応していくことをお勧めします。",
  "はい、その点については以下のように整理できます。\n\n1. 現状分析: 現在のシステムは年間稼働率99.7%を達成しており、安定性は十分確保されています\n2. 課題: スケーラビリティの面で、ピーク時のレスポンスタイムが目標値を超過するケースが散見されます\n3. 対策案: キャッシュ層の導入およびデータベースのシャーディングにより、処理能力の向上を図ります",
  "承知いたしました。そちらの方向で進めていただければと思います。\n\n補足として、スケジュールに関しては以下のマイルストーンを設定することを提案いたします。\n\n・Phase 1（〜3月末）: 要件定義・基本設計\n・Phase 2（4月〜5月）: 詳細設計・実装\n・Phase 3（6月）: テスト・品質保証",
  "おっしゃる通りです。コスト面での検討も非常に重要なポイントですね。\n\n現時点での概算見積もりとしては、インフラコストが月額約120万円、開発工数が約480人日、外部委託費用が約350万円を想定しています。",
  "その分析は的確だと思います。市場動向を踏まえると、以下の戦略が有効であると考えます。\n\n第一に、既存顧客基盤の強化です。解約率を現在の2.8%から2.0%以下に低減させることで、安定的な収益基盤を確保します。"
];

let responseIndex = 0;

/**
 * Settings管理 — LocalStorageに保存
 */
export class SettingsManager {
  static KEYS = {
    API_KEY: 'stealth-ai-api-key',
    PROVIDER: 'stealth-ai-provider',
    MODEL: 'stealth-ai-model',
    SYSTEM_PROMPT: 'stealth-ai-system-prompt',
  };

  static get apiKey() {
    return localStorage.getItem(this.KEYS.API_KEY) || '';
  }
  static set apiKey(v) {
    localStorage.setItem(this.KEYS.API_KEY, v);
  }

  static get provider() {
    return localStorage.getItem(this.KEYS.PROVIDER) || 'mock';
  }
  static set provider(v) {
    localStorage.setItem(this.KEYS.PROVIDER, v);
  }

  static get model() {
    return localStorage.getItem(this.KEYS.MODEL) || 'gemini-2.5-flash';
  }
  static set model(v) {
    localStorage.setItem(this.KEYS.MODEL, v);
  }

  static get systemPrompt() {
    return localStorage.getItem(this.KEYS.SYSTEM_PROMPT) ||
      'あなたは優秀なビジネスアシスタントです。丁寧な日本語で、ビジネス文書のような口調で回答してください。';
  }
  static set systemPrompt(v) {
    localStorage.setItem(this.KEYS.SYSTEM_PROMPT, v);
  }

  static get isConfigured() {
    return this.provider === 'gemini' && this.apiKey.length > 0;
  }
}

/**
 * Gemini API クライアント
 */
async function callGeminiAPI(messages, systemPrompt) {
  const apiKey = SettingsManager.apiKey;
  const model = SettingsManager.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build conversation history for Gemini
  const contents = messages
    .filter(m => m.role === 'user' || m.role === 'ai')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errMsg = error?.error?.message || `API Error: ${response.status}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('APIから応答を取得できませんでした');
  return text;
}

export class ChatManager {
  constructor() {
    this.messages = [];
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.statusWords = document.getElementById('status-words');
    this.isTyping = false;
    this.init();
  }

  init() {
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Welcome message depends on config
    if (SettingsManager.isConfigured) {
      this.addAIMessage('こんにちは。何かお手伝いできることはありますか？\n（Gemini API接続済み。Escキーで業務文書に切り替わります）');
    } else {
      this.addAIMessage('こんにちは。何かお手伝いできることはありますか？\n（ツール → 設定 からAPIキーを入力すると、本物のAIと会話できます。Escキーで業務文書に切り替わります）');
    }
  }

  async sendMessage() {
    const text = this.chatInput.innerText.trim();
    if (!text || this.isTyping) return;

    this.addUserMessage(text);
    this.chatInput.innerText = '';
    this.showTyping();

    if (SettingsManager.isConfigured) {
      // Real Gemini API call
      try {
        const response = await callGeminiAPI(this.messages, SettingsManager.systemPrompt);
        this.hideTyping();
        this.addAIMessage(response);
      } catch (err) {
        this.hideTyping();
        this.addAIMessage(`⚠ エラー: ${err.message}\n\n（ツール → 設定 からAPIキーを確認してください）`);
      }
    } else {
      // Mock response
      const delay = 800 + Math.random() * 1500;
      setTimeout(() => {
        this.hideTyping();
        const response = mockResponses[responseIndex % mockResponses.length];
        responseIndex++;
        this.addAIMessage(response);
      }, delay);
    }
  }

  addUserMessage(text) {
    this.messages.push({ role: 'user', content: text });
    const div = document.createElement('div');
    div.className = 'chat-message user';
    div.innerHTML = `
      <div class="message-label">あなた:</div>
      <div class="message-content">${this.escapeHtml(text)}</div>
    `;
    this.chatMessages.appendChild(div);
    this.scrollToBottom();
    this.updateWordCount();
  }

  addAIMessage(text) {
    this.messages.push({ role: 'ai', content: text });
    const div = document.createElement('div');
    div.className = 'chat-message ai';
    div.innerHTML = `
      <div class="message-label">アシスタント:</div>
      <div class="message-content">${this.escapeHtml(text)}</div>
    `;
    this.chatMessages.appendChild(div);
    this.scrollToBottom();
    this.updateWordCount();
  }

  showTyping() {
    this.isTyping = true;
    const div = document.createElement('div');
    div.className = 'chat-message ai';
    div.id = 'typing-msg';
    div.innerHTML = `
      <div class="message-label">アシスタント:</div>
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    this.chatMessages.appendChild(div);
    this.scrollToBottom();
  }

  hideTyping() {
    this.isTyping = false;
    const typingMsg = document.getElementById('typing-msg');
    if (typingMsg) typingMsg.remove();
  }

  scrollToBottom() {
    const docArea = document.querySelector('.document-area');
    if (docArea) docArea.scrollTop = docArea.scrollHeight;
  }

  updateWordCount() {
    const allText = this.messages.map(m => m.content).join('');
    if (this.statusWords) {
      this.statusWords.textContent = `${allText.length} 文字`;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  hide() {
    document.getElementById('chat-page').style.display = 'none';
  }

  show() {
    document.getElementById('chat-page').style.display = 'block';
    this.chatInput.focus();
  }
}

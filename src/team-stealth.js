/**
 * team-stealth.js — チームステルス機能
 * 同僚とリアルタイムで「業務文書風チャット」
 * 
 * BroadcastChannel API で同一ブラウザ内のタブ間通信をサポート。
 * 同じルームコードを入れた複数タブ間でリアルタイムチャット。
 * 
 * ※ 将来的にWebSocket/Firebase等に拡張可能な設計。
 */

const COLORS = ['#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#8e24aa', '#e65100', '#00897b', '#c62828'];
const ANIMAL_NAMES = ['キツネ', 'タヌキ', 'ウサギ', 'ネコ', 'イヌ', 'パンダ', 'コアラ', 'ペンギン', 'カワウソ', 'ハリネズミ'];
const ADJ = ['静かな', '素早い', '賢い', '勇敢な', '優しい', '面白い', '真面目な', 'クールな'];

function generateNickname() {
  const adj = ADJ[Math.floor(Math.random() * ADJ.length)];
  const animal = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
  return `${adj}${animal}`;
}

function generateUserId() {
  return 'user-' + Math.random().toString(36).slice(2, 8);
}

export class TeamStealth {
  constructor() {
    this.roomId = '';
    this.userId = generateUserId();
    this.nickname = generateNickname();
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.channel = null;
    this.members = new Map(); // userId -> { nickname, color, lastSeen }
    this.messages = [];
    this.isActive = false;
    this.onMessage = null; // callback
    this.onMembersChange = null; // callback
    this._heartbeatInterval = null;
  }

  /**
   * ルームに参加
   */
  join(roomId, nickname) {
    if (this.channel) this.leave();
    this.roomId = roomId.trim().toLowerCase();
    if (nickname) this.nickname = nickname;
    this.isActive = true;
    this.messages = [];
    this.members.clear();
    this.members.set(this.userId, { nickname: this.nickname, color: this.color, lastSeen: Date.now() });

    // BroadcastChannel for same-browser tab communication
    this.channel = new BroadcastChannel(`stealth-room-${this.roomId}`);
    this.channel.onmessage = (e) => this._handleMessage(e.data);

    // Announce join
    this._send({
      type: 'join',
      userId: this.userId,
      nickname: this.nickname,
      color: this.color,
    });

    // Heartbeat to track active members
    this._heartbeatInterval = setInterval(() => {
      this._send({ type: 'heartbeat', userId: this.userId, nickname: this.nickname, color: this.color });
      // Remove stale members (no heartbeat for 10s)
      const now = Date.now();
      for (const [uid, info] of this.members) {
        if (uid !== this.userId && now - info.lastSeen > 10000) {
          this.members.delete(uid);
          this._notifyMembersChange();
        }
      }
    }, 3000);

    this._notifyMembersChange();
  }

  /**
   * メッセージ送信
   */
  sendMessage(text) {
    if (!this.isActive || !text.trim()) return;
    const msg = {
      type: 'message',
      userId: this.userId,
      nickname: this.nickname,
      color: this.color,
      content: text.trim(),
      timestamp: Date.now(),
    };
    this._send(msg);
    // Also add to local messages
    this.messages.push(msg);
    if (this.onMessage) this.onMessage(msg, true);
  }

  /**
   * ルームを離脱
   */
  leave() {
    if (!this.isActive) return;
    this._send({ type: 'leave', userId: this.userId, nickname: this.nickname });
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    if (this.channel) { this.channel.close(); this.channel = null; }
    this.isActive = false;
    this.members.clear();
    this._notifyMembersChange();
  }

  /**
   * [REFACTOR S3] 受信データのスキーマ検証を追加
   */
  _validateMessage(data) {
    if (!data || typeof data !== 'object') return false;
    if (!['join', 'leave', 'heartbeat', 'message'].includes(data.type)) return false;
    if (typeof data.userId !== 'string') return false;
    if (data.type === 'message' && typeof data.content !== 'string') return false;
    if (data.type === 'message' && data.content.length > 10000) return false; // Max message length
    return true;
  }

  /**
   * 内部: メッセージ処理
   */
  _handleMessage(data) {
    // [S3] スキーマ検証
    if (!this._validateMessage(data)) return;
    switch (data.type) {
      case 'join':
        this.members.set(data.userId, { nickname: data.nickname, color: data.color, lastSeen: Date.now() });
        this._notifyMembersChange();
        // Reply with our info so new member sees us
        this._send({ type: 'heartbeat', userId: this.userId, nickname: this.nickname, color: this.color });
        // System message
        if (data.userId !== this.userId) {
          const sysMsg = { type: 'system', content: `${data.nickname} が参加しました`, timestamp: Date.now() };
          this.messages.push(sysMsg);
          if (this.onMessage) this.onMessage(sysMsg, false);
        }
        break;

      case 'leave':
        this.members.delete(data.userId);
        this._notifyMembersChange();
        const leaveMsg = { type: 'system', content: `${data.nickname} が退出しました`, timestamp: Date.now() };
        this.messages.push(leaveMsg);
        if (this.onMessage) this.onMessage(leaveMsg, false);
        break;

      case 'heartbeat':
        this.members.set(data.userId, { nickname: data.nickname, color: data.color, lastSeen: Date.now() });
        this._notifyMembersChange();
        break;

      case 'message':
        if (data.userId !== this.userId) {
          this.members.set(data.userId, { nickname: data.nickname, color: data.color, lastSeen: Date.now() });
          this.messages.push(data);
          if (this.onMessage) this.onMessage(data, false);
        }
        break;
    }
  }

  _send(data) {
    if (this.channel) {
      try { this.channel.postMessage(data); } catch (e) { /* channel closed */ }
    }
  }

  _notifyMembersChange() {
    if (this.onMembersChange) this.onMembersChange(Array.from(this.members.values()));
  }

  getMemberCount() {
    return this.members.size;
  }
}

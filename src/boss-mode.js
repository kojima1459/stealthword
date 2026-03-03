/**
 * boss-mode.js — ボスキター機能
 * Escapeキーでダミー業務文書に瞬時切替 + ステルススコア記録
 */
import { getRandomDummyDoc } from './dummy-docs.js';
import { SettingsManager } from './chat.js';

export class BossMode {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.isActive = false;
    this.bossPage = document.getElementById('boss-page');
    this.bossContent = document.getElementById('boss-content');
    this.bossIndicator = document.getElementById('boss-indicator');
    this.docTitle = document.querySelector('.doc-title');
    this.originalTitle = this.docTitle.value;
    this.currentDoc = getRandomDummyDoc();
    this.bossContent.innerHTML = this.currentDoc.content;
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Don't toggle if a modal is open
        const modals = document.querySelectorAll('.modal-overlay, .settings-overlay, .tutorial-overlay');
        for (const m of modals) {
          if (m.style.display === 'flex') { m.style.display = 'none'; return; }
        }
        // Don't toggle if timer popup open
        const timer = document.getElementById('timer-popup');
        if (timer && timer.style.display !== 'none') { timer.style.display = 'none'; return; }
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle() {
    this.isActive ? this.deactivate() : this.activate();
  }

  activate() {
    this.isActive = true;
    // Get a fresh random doc each time
    this.currentDoc = getRandomDummyDoc();
    this.bossContent.innerHTML = this.currentDoc.content;
    this.chatManager.hide();
    document.getElementById('persona-bar').style.display = 'none';
    this.bossPage.style.display = 'block';
    this.docTitle.value = this.currentDoc.title;
    document.title = this.currentDoc.title + ' - Google ドキュメント';
    this.showIndicator();
    const text = this.bossContent.textContent;
    const sw = document.getElementById('status-words');
    if (sw) sw.textContent = `${text.length} 文字`;
    // Track stealth score
    SettingsManager.bossCount = SettingsManager.bossCount + 1;
  }

  deactivate() {
    this.isActive = false;
    this.bossPage.style.display = 'none';
    document.getElementById('persona-bar').style.display = 'flex';
    this.chatManager.show();
    this.docTitle.value = this.originalTitle;
    document.title = this.originalTitle + ' - Google ドキュメント';
    this.chatManager.updateWordCount();
  }

  showIndicator() {
    this.bossIndicator.style.display = 'flex';
    this.bossIndicator.style.animation = 'none';
    this.bossIndicator.offsetHeight;
    this.bossIndicator.style.animation = 'indicatorFade 1.5s forwards';
    setTimeout(() => { this.bossIndicator.style.display = 'none'; }, 1500);
  }
}

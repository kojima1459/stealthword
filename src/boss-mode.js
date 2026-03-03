/**
 * boss-mode.js — ボスキター機能
 * Escapeキーでダミー業務文書に瞬時切替
 */
import { getRandomDummyDoc } from './dummy-docs.js';

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
    this.chatManager.hide();
    this.bossPage.style.display = 'block';
    this.docTitle.value = this.currentDoc.title;
    document.title = this.currentDoc.title + ' - Google ドキュメント';
    this.showIndicator();
    const text = this.bossContent.textContent;
    const sw = document.getElementById('status-words');
    if (sw) sw.textContent = `${text.length} 文字`;
  }

  deactivate() {
    this.isActive = false;
    this.bossPage.style.display = 'none';
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

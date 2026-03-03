/**
 * boss-mode.js — ボスキター機能
 * Escapeキーでダミー業務文書に瞬時切替 + 編集可能 + ステルススコア記録
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
    this._initToolbar();
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

  /**
   * [REFACTOR] Wire toolbar buttons to execCommand for boss mode editing.
   * Makes bold, italic, underline, alignment, list, heading, link, image,
   * and table insertion work when boss-content is focused.
   */
  _initToolbar() {
    const toolbarBtns = document.querySelectorAll('.toolbar-btn');
    const bc = this.bossContent;

    // Map toolbar buttons to execCommand actions
    const cmdMap = {
      'undo': 'undo', 'redo': 'redo', 'format_bold': 'bold',
      'format_italic': 'italic', 'format_underlined': 'underline',
      'format_align_left': 'justifyLeft', 'format_align_center': 'justifyCenter',
      'format_align_right': 'justifyRight',
    };

    toolbarBtns.forEach(btn => {
      const icon = btn.querySelector('.material-icons');
      if (!icon) return;
      const iconName = icon.textContent.trim();
      const cmd = cmdMap[iconName];
      if (cmd) {
        btn.addEventListener('click', (e) => {
          if (!this.isActive) return;
          e.preventDefault();
          document.execCommand(cmd, false, null);
          bc.focus();
        });
      }
      // Insert table
      if (iconName === 'add_comment') {
        btn.title = this.isActive ? '表を挿入' : 'コメントを追加';
        btn.addEventListener('click', (e) => {
          if (!this.isActive) return;
          e.preventDefault();
          this._insertTable();
        });
      }
      // Insert heading
      if (iconName === 'insert_link') {
        btn.addEventListener('click', (e) => {
          if (!this.isActive) return;
          e.preventDefault();
          const url = prompt('URLを入力:', 'https://');
          if (url) document.execCommand('createLink', false, url);
          bc.focus();
        });
      }
    });

    // Heading selector
    const styleSelect = document.querySelector('.toolbar-style');
    if (styleSelect) {
      styleSelect.addEventListener('change', () => {
        if (!this.isActive) return;
        const val = styleSelect.value;
        const headingMap = { 'タイトル': 'h1', '見出し1': 'h2', '見出し2': 'h3', '見出し3': 'h4', '標準テキスト': 'p' };
        const tag = headingMap[val];
        if (tag) {
          document.execCommand('formatBlock', false, `<${tag}>`);
          bc.focus();
        }
      });
    }

    // Track word count in boss-content as user types
    bc.addEventListener('input', () => {
      if (!this.isActive) return;
      const sw = document.getElementById('status-words');
      if (sw) sw.textContent = `${bc.textContent.length} 文字`;
    });
  }

  _insertTable() {
    const html = `<table>
      <tr><th>項目</th><th>内容</th><th>備考</th></tr>
      <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
      <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    </table><p>&nbsp;</p>`;
    // Insert at cursor or append
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && this.bossContent.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (temp.firstChild) frag.appendChild(temp.firstChild);
      range.insertNode(frag);
    } else {
      this.bossContent.insertAdjacentHTML('beforeend', html);
    }
    this.bossContent.focus();
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
    // Also hide team page if visible
    const tp = document.getElementById('team-page');
    if (tp) tp.style.display = 'none';
    this.bossPage.style.display = 'block';
    this.docTitle.value = this.currentDoc.title;
    document.title = this.currentDoc.title + ' - Google ドキュメント';
    this.showIndicator();
    const text = this.bossContent.textContent;
    const sw = document.getElementById('status-words');
    if (sw) sw.textContent = `${text.length} 文字`;
    // Track stealth score
    SettingsManager.bossCount = SettingsManager.bossCount + 1;
    // Focus boss content so user can type immediately
    setTimeout(() => {
      this.bossContent.focus();
      // Place cursor at end
      const range = document.createRange();
      range.selectNodeContents(this.bossContent);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }, 50);
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

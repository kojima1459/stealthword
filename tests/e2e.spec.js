/**
 * StealthWord E2Eテスト
 * 
 * 主要ユーザーフロー:
 * - 正常系: 初回ロード、チュートリアル、チャット送信、ボスモード、スキン切替、チーム機能
 * - 異常系: 空メッセージ、API未設定、無効入力
 */
import { test, expect } from '@playwright/test';

// ===========================
// 正常系テスト
// ===========================

test.describe('正常系: 初回ロード', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage をクリアして初回状態にする
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  // 目的: アプリが正常にロードされ、Google Docs風UIが表示されること
  // 期待結果: ヘッダー、メニューバー、ツールバー、入力欄が存在
  test('アプリが正常にロードされる', async ({ page }) => {
    await expect(page).toHaveTitle(/Google ドキュメント/);
    await expect(page.locator('.header-bar')).toBeVisible();
    await expect(page.locator('.menu-bar')).toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();
    await expect(page.locator('#chat-input')).toBeVisible();
  });

  // 目的: 初回訪問時にチュートリアルが表示されること
  // 期待結果: チュートリアルオーバーレイが visible、8ステップが存在
  test('初回訪問時にチュートリアルが表示される', async ({ page }) => {
    await expect(page.locator('#tutorial-overlay')).toBeVisible();
    const steps = page.locator('.tutorial-step');
    await expect(steps).toHaveCount(8);
    // 最初のステップが表示されている
    await expect(steps.nth(0)).toBeVisible();
    await expect(steps.nth(1)).not.toBeVisible();
  });

  // 目的: チュートリアルを最後まで進めてアプリが使えるようになること
  // 期待結果: 全8ステップを進めた後、チュートリアルが非表示に
  test('チュートリアルを完了できる', async ({ page }) => {
    const nextBtn = page.locator('#tutorial-next');
    // 7回「次へ」をクリック → 最後に「始める！」
    for (let i = 0; i < 7; i++) {
      await nextBtn.click();
    }
    // 最後のステップで「始める！」
    await expect(nextBtn).toHaveText('始める！');
    await nextBtn.click();
    await expect(page.locator('#tutorial-overlay')).not.toBeVisible();
  });
});

test.describe('正常系: チャット機能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // チュートリアルをスキップ
    await page.evaluate(() => {
      localStorage.setItem('sw-tutorial-done', 'true');
    });
    await page.reload();
  });

  // 目的: メッセージを送信するとAI応答（モック）が表示されること
  // 期待結果: ユーザーメッセージとAI応答の両方がチャットエリアに表示
  test('メッセージを送信してモック応答を受け取る', async ({ page }) => {
    const input = page.locator('#chat-input');
    await input.fill('テストメッセージです');
    await page.keyboard.press('Enter');
    // ユーザーメッセージの表示
    await expect(page.locator('.chat-message.user').last()).toContainText('テストメッセージです');
    // AI応答を待つ（モック: 600-1800ms）
    await expect(page.locator('.chat-message.ai').last()).toBeVisible({ timeout: 5000 });
  });

  // 目的: 送信ボタンでもメッセージが送信できること
  // 期待結果: ボタンクリックでメッセージ送信成功
  test('送信ボタンでメッセージ送信', async ({ page }) => {
    const input = page.locator('#chat-input');
    await input.fill('ボタンから送信');
    await page.locator('#send-btn').click();
    await expect(page.locator('.chat-message.user').last()).toContainText('ボタンから送信');
  });

  // 目的: Shift+Enterで改行できること
  // 期待結果: メッセージが送信されずに改行が挿入
  test('Shift+Enterで改行', async ({ page }) => {
    const input = page.locator('#chat-input');
    await input.click();
    await page.keyboard.type('1行目');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('2行目');
    // Shift+Enterでは送信されないことを確認
    await expect(page.locator('.chat-message.user')).toHaveCount(0);
  });
});

test.describe('正常系: ボスモード', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sw-tutorial-done', 'true'));
    await page.reload();
  });

  // 目的: Escキーでボスモード（業務文書）に切り替わること
  // 期待結果: boss-pageが表示、chat-pageが非表示
  test('Escキーでボスモードに切り替わる', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('#boss-page')).toBeVisible();
    await expect(page.locator('#chat-page')).not.toBeVisible();
    // ドキュメントタイトルが変更される
    await expect(page.locator('.doc-title')).not.toHaveValue('無題のドキュメント');
  });

  // 目的: Escキー再度でチャットに戻ること
  // 期待結果: chat-pageが表示、boss-pageが非表示
  test('Esc２回でチャットに戻る', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('#boss-page')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#chat-page')).toBeVisible();
    await expect(page.locator('#boss-page')).not.toBeVisible();
  });

  // 目的: ボスモードで文字入力ができること (contenteditable)
  // 期待結果: boss-contentに文字が入力される
  test('ボスモードで文字入力できる', async ({ page }) => {
    await page.keyboard.press('Escape');
    const bossContent = page.locator('#boss-content');
    await bossContent.focus();
    await page.keyboard.type('This is a test input.');
    await expect(bossContent).toContainText('This is a test input.');
  });
});

test.describe('正常系: スキン切替', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sw-tutorial-done', 'true'));
    await page.reload();
  });

  // 目的: ヘッダーの「スキン」ボタンでスキン選択画面が開くこと
  // 期待結果: skin-overlayが表示
  test('スキン選択モーダルが開く', async ({ page }) => {
    await page.locator('#btn-skin-header').click();
    await expect(page.locator('#skin-overlay')).toBeVisible();
  });

  // 目的: スキンを選択するとUIが変わること
  // 期待結果: bodyにskin-ms-wordクラスが付与
  test('スキンを変更するとUIテーマが切り替わる', async ({ page }) => {
    await page.locator('#btn-skin-header').click();
    await page.locator('[data-skin="ms-word"]').click();
    await expect(page.locator('body')).toHaveClass(/skin-ms-word/);
  });
});

test.describe('正常系: ダークモード', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sw-tutorial-done', 'true'));
    await page.reload();
  });

  // 目的: ダークモードボタンでダークモードに切り替わること
  // 期待結果: bodyにdark-modeクラスが付与
  test('ダークモードの切り替え', async ({ page }) => {
    await page.locator('#btn-dark-mode').click();
    await expect(page.locator('body')).toHaveClass(/dark-mode/);
    // 再度クリックで戻る
    await page.locator('#btn-dark-mode').click();
    await expect(page.locator('body')).not.toHaveClass(/dark-mode/);
  });
});

test.describe('正常系: ヘルプ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sw-tutorial-done', 'true'));
    await page.reload();
  });

  // 目的: ヘルプメニューで包括的ヘルプモーダルが開くこと
  // 期待結果: help-overlayが表示
  test('ヘルプモーダルが開く', async ({ page }) => {
    await page.locator('#menu-help').click();
    await expect(page.locator('#help-overlay')).toBeVisible();
    // セクションが存在することを確認
    await expect(page.locator('.help-section')).toHaveCount(6);
  });

  // 目的: ヘルプ内の「チュートリアルを再表示」でチュートリアルが出ること
  // 期待結果: チュートリアルオーバーレイが再表示
  test('ヘルプからチュートリアル再表示', async ({ page }) => {
    await page.locator('#menu-help').click();
    await page.locator('#help-replay-tutorial').click();
    await expect(page.locator('#tutorial-overlay')).toBeVisible();
    await expect(page.locator('#help-overlay')).not.toBeVisible();
  });
});

test.describe('正常系: 設定', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sw-tutorial-done', 'true'));
    await page.reload();
  });

  // 目的: ツールメニューで設定モーダルが開くこと
  // 期待結果: settings-overlayが表示
  test('設定モーダルが開く', async ({ page }) => {
    await page.locator('#menu-tools').click();
    await expect(page.locator('#settings-overlay')).toBeVisible();
  });

  // 目的: API設定を保存できること
  // 期待結果: 保存成功メッセージが表示
  test('API設定を保存できる', async ({ page }) => {
    await page.locator('#menu-tools').click();
    await page.locator('#api-provider').selectOption('gemini');
    await page.locator('#api-key-input').fill('test-api-key-12345');
    await page.locator('#settings-save').click();
    await expect(page.locator('#settings-status')).toContainText('保存しました');
  });
});

// ===========================
// 異常系テスト
// ===========================

test.describe('異常系', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sw-tutorial-done', 'true'));
    await page.reload();
  });

  // 目的: 空メッセージが送信されないこと
  // 期待結果: Enter押下後もユーザーメッセージが追加されない
  test('空メッセージは送信されない', async ({ page }) => {
    const input = page.locator('#chat-input');
    await input.click();
    await page.keyboard.press('Enter');
    // ユーザーメッセージが追加されていないこと（初期AIメッセージのみ）
    await expect(page.locator('.chat-message.user')).toHaveCount(0);
  });

  // 目的: API未設定時にモックレスポンスが返ること
  // 期待結果: エラーではなくモック応答が表示
  test('API未設定時にモック応答が返る', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sw-provider', 'mock');
      localStorage.removeItem('sw-api-key');
    });
    await page.reload();
    const input = page.locator('#chat-input');
    await input.fill('テスト');
    await page.keyboard.press('Enter');
    // モック応答を待つ
    const aiMessages = page.locator('.chat-message.ai');
    await expect(aiMessages.last()).toBeVisible({ timeout: 5000 });
  });

  // 目的: 無効なAPIキーでエラーメッセージが表示されること
  // 期待結果: エラーメッセージ「⚠ エラー:」が表示
  test('無効なAPIキーでエラーが表示される', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sw-provider', 'gemini');
      localStorage.setItem('sw-api-key', 'invalid-key');
    });
    await page.reload();
    const input = page.locator('#chat-input');
    await input.fill('テスト');
    await page.keyboard.press('Enter');
    // APIエラーメッセージを待つ（リトライ3回後）
    await expect(page.locator('.chat-message.ai').last()).toContainText('エラー', { timeout: 30000 });
  });

  // 目的: チームステルスでルームコード未入力時にアラートが出ること
  // 期待結果: alertが表示される
  test('チームステルスでルームコード未入力時にアラート', async ({ page }) => {
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('ルームコード');
      await dialog.accept();
    });
    await page.locator('#btn-team').click();
    await expect(page.locator('#team-overlay')).toBeVisible();
    // ルームコード空のまま入室ボタンクリック
    await page.locator('#team-room-code').fill('');
    await page.locator('#team-join').click();
  });

  // 目的: モーダルがEscキーやオーバーレイクリックで閉じること
  // 期待結果: 各モーダルが適切に閉じる
  test('モーダルがEscで閉じる', async ({ page }) => {
    // 設定モーダルを開く
    await page.locator('#menu-tools').click();
    await expect(page.locator('#settings-overlay')).toBeVisible();
    // Escで閉じる
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-overlay')).not.toBeVisible();
  });

  // 目的: ページリロード後もlocalStorage設定が保持されること
  // 期待結果: ダークモード/スキン設定が維持
  test('設定がlocalStorageに永続化される', async ({ page }) => {
    // ダークモードON
    await page.locator('#btn-dark-mode').click();
    await expect(page.locator('body')).toHaveClass(/dark-mode/);
    // リロード
    await page.reload();
    // ダークモードが維持
    await expect(page.locator('body')).toHaveClass(/dark-mode/);
  });
});

test.describe('異常系: ストレス・境界値', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sw-tutorial-done', 'true'));
    await page.reload();
  });

  // 目的: 連続でメッセージを送信してもクラッシュしないこと
  // 期待結果: 全メッセージが正常に表示
  test('連続メッセージ送信でクラッシュしない', async ({ page }) => {
    const input = page.locator('#chat-input');
    for (let i = 0; i < 5; i++) {
      await input.fill(`連続メッセージ ${i}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    // 5件のユーザーメッセージが存在
    await expect(page.locator('.chat-message.user')).toHaveCount(5);
  });

  // 目的: ボスモード連打でUIが壊れないこと
  // 期待結果: 正常に切替が完了
  test('ボスモード連打で壊れない', async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
    }
    // 最終状態がどちらかであることを確認（壊れていない）
    const chatVisible = await page.locator('#chat-page').isVisible();
    const bossVisible = await page.locator('#boss-page').isVisible();
    expect(chatVisible || bossVisible).toBe(true);
  });
});

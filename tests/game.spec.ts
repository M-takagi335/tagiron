import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { newMatch, npcView } from '../src/game.ts';
import { candidates } from '../src/npc.ts';
import { answer, answerLabel, colorNames, compare, handKey, labelTile, tiles } from '../src/rules.ts';
import type { Tile } from '../src/rules.ts';

const key = 'code-breakers-v1';

function fixture() {
  const match = newMatch('hard', () => 0.42);
  const order = ['one-two', ...[...match.market, ...match.deck].filter(id => id !== 'one-two')];
  return { ...match, market: order.slice(0, 6), deck: order.slice(6) };
}

async function resume(page: Page) {
  await page.getByRole('button', { name: /対戦を再開/ }).click();
  await expect(page.getByRole('region', { name: '対戦ボード' })).toBeVisible();
}

async function fillGuess(page: Page, hand: Tile[], own: Tile[]) {
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < hand.length; i++) {
    const tile = hand[i];
    await dialog.getByRole('button', { name: (i + 1) + '番目 未選択', exact: true }).click();
    const suffix = tile.color === 'yellow' && !own.some(t => t.color === 'yellow') ?
      ' ' + (Number(tile.id.at(-1)) + 1) + '枚目' : '';
    await dialog.getByRole('button', { name: colorNames[tile.color] + tile.value + suffix, exact: true }).click();
  }
  await dialog.getByRole('button', { name: '確認へ' }).click();
  await expect(dialog.getByRole('heading', { name: 'このコードで解答しますか？' })).toBeVisible();
  await dialog.getByRole('button', { name: '解答を確定' }).click();
}

test('初回案内・難易度選択・タイトルから開始', async ({ page }, testInfo) => {
  await page.addInitScript(() => { Math.random = () => 0.42; });
  await page.goto('/');
  const tutorial = page.getByRole('dialog');
  await expect(tutorial.getByRole('heading', { name: '数字タイルの内訳' })).toBeVisible();
  for (let i = 0; i < 7; i++) await tutorial.getByRole('button', { name: '次へ' }).click();
  await tutorial.getByRole('button', { name: '完了' }).click();
  await page.getByRole('button', { name: /HARD/ }).click();
  await page.screenshot({ path: testInfo.outputPath('title.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'ゲーム開始' }).click();
  const board = page.getByRole('region', { name: '対戦ボード' });
  await expect(board.getByText('HARD', { exact: true })).toBeVisible();
  await expect(board.locator('.question-card')).toHaveCount(6);
  await expect(board.getByRole('region', { name: '相手の手札' }).locator('.hidden-tile')).toHaveCount(5);
  await expect(board.getByRole('region', { name: '自分の手札' }).locator('.tile')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('board.png'), fullPage: true, animations: 'disabled' });
});

test('選択式質問とNPCの手番がオフラインでも進み、位置メモを再開できる', async ({ context, page }) => {
  const match = fixture();
  await page.addInitScript(({ key, match }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ tutorialSeen: true, reduced: true, match }));
  }, { key, match });
  await page.goto('/');
  await resume(page);
  await context.setOffline(true);
  const card = page.getByRole('button', { name: /1 または 2/ });
  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '質問する' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
  await expect(card).toBeEnabled();
  await card.click();
  await dialog.getByRole('button', { name: '2 の位置' }).click();
  await dialog.getByRole('button', { name: '質問する' }).click();
  const board = page.getByRole('region', { name: '対戦ボード' });
  await expect(board.getByText('2 はどこにある？', { exact: true })).toBeVisible();
  const response = answerLabel(answer(match.hands.npc, { cardId: 'one-two', option: 2 }));
  await expect(board.locator('.last-event').filter({ hasText: '2 はどこにある？' })).toContainText(response);
  await expect(card).toHaveCount(0);
  await expect(board.getByText(/TURN 03.*あなたの手番/)).toBeVisible();
  await expect(board.locator('.question-card')).toHaveCount(6);
  await page.getByRole('button', { name: '推理メモ', exact: true }).click();
  await dialog.getByRole('button', { name: '3', exact: true }).click();
  await dialog.getByRole('button', { name: '赤0、未確認' }).click();
  await expect(dialog.getByRole('button', { name: '赤0、ありそう' })).toBeVisible();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await context.setOffline(false);
  await page.reload();
  await resume(page);
  await page.getByRole('button', { name: '質問履歴', exact: true }).click();
  await expect(dialog.getByText('2 はどこにある？', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('button', { name: '推理メモ', exact: true }).click();
  await dialog.getByRole('button', { name: '3', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '赤0、ありそう' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '赤0、ありそう' })).toContainText('○');
  await dialog.getByRole('button', { name: '赤0、ありそう' }).click();
  await expect(dialog.getByRole('button', { name: '赤0、なし' })).toContainText('×');
});

test('誤答を伏せたまま進行し、正解後に成績と再戦を表示する', async ({ page }) => {
  const match = fixture();
  const correct = match.hands.npc;
  const dealt = new Set(Object.values(match.hands).flat().map(tile => tile.id));
  const wrong = [...correct.slice(0, 4), tiles.find(tile => !dealt.has(tile.id) && tile.color !== 'yellow')!].sort(compare);
  await page.addInitScript(({ key, match }) => {
    localStorage.setItem(key, JSON.stringify({ tutorialSeen: true, reduced: true, match }));
  }, { key, match });
  await page.goto('/');
  await resume(page);
  const solve = page.getByRole('button', { name: '解答する' });
  await solve.click();
  const dialog = page.getByRole('dialog');
  const own = match.hands.player.find(tile => tile.color !== 'yellow')!;
  await expect(dialog.getByRole('button', { name: labelTile(own), exact: true })).toHaveCount(0);
  await fillGuess(page, wrong, match.hands.player);
  const board = page.getByRole('region', { name: '対戦ボード' });
  await expect(board.getByText('不正解', { exact: true })).toBeVisible();
  await expect(board.getByRole('region', { name: '相手の手札' }).locator('.hidden-tile')).toHaveCount(5);
  await expect(solve).toBeEnabled();
  await solve.click();
  await fillGuess(page, correct, match.hands.player);
  await expect(dialog.getByText('CODE BROKEN')).toBeVisible();
  await expect(dialog.locator('.tile:not(.hidden-tile)')).toHaveCount(5);
  await dialog.getByRole('button', { name: '再戦する' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(board.getByRole('region', { name: '相手の手札' }).locator('.hidden-tile')).toHaveCount(5);
  await page.getByRole('button', { name: 'タイトル', exact: true }).click();
  await page.getByRole('button', { name: '対戦成績', exact: true }).click();
  await expect(dialog.getByText('1 勝', { exact: true })).toBeVisible();
});

for (const ownCount of [0, 1, 2]) {
  test('自分の黄色5が' + ownCount + '枚なら残りの黄色5だけ宣言できる', async ({ page }) => {
    const yellow = tiles.filter(tile => tile.value === 5);
    const others = tiles.filter(tile => tile.value !== 5);
    const remaining = 2 - ownCount;
    const player = [...others.slice(0, 5 - ownCount), ...yellow.slice(0, ownCount)].sort(compare);
    const npc = [...others.slice(9, 14 - remaining), ...yellow.slice(ownCount)].sort(compare);
    const match = { ...fixture(), hands: { player, npc } };
    await page.addInitScript(({ key, match }) => {
      localStorage.setItem(key, JSON.stringify({ tutorialSeen: true, reduced: true, match }));
    }, { key, match });
    await page.goto('/');
    await resume(page);
    await page.getByRole('button', { name: '解答する' }).click();
    const dialog = page.getByRole('dialog');
    const choices = dialog.getByRole('button', { name: /^黄5/ });
    await expect(choices).toHaveCount(remaining);
    await expect(dialog.getByRole('button', { name: /^[赤青]5/ })).toHaveCount(0);

    if (remaining > 0) {
      const firstYellow = choices.first();
      await firstYellow.click();
      await expect(dialog.getByRole('button', { name: '1番目 黄5', exact: true })).toBeVisible();
      if (remaining === 2) {
        await expect(firstYellow).toBeEnabled();
        await firstYellow.click();
        await expect(dialog.getByRole('button', { name: '2番目 黄5', exact: true })).toBeVisible();
      }
      await expect(choices.and(dialog.locator(':enabled'))).toHaveCount(0);
      await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
      await page.getByRole('button', { name: '解答する' }).click();
    }

    const declaration = remaining === 2 ? npc.map(tile =>
      tile.color === 'yellow' ? yellow.find(other => other.id !== tile.id)! : tile) : npc;
    await fillGuess(page, declaration, player);
    await expect(dialog.getByText('CODE BROKEN')).toBeVisible();
    await expect(dialog.locator('.tile.yellow')).toHaveCount(remaining);
  });
}

test('NPCだけが解答できる手番でNPCが勝ち、敗北を記録する', async ({ page }) => {
  const match = fixture();
  const correct = handKey(match.hands.player);
  const failed = candidates(npcView(match)).map(handKey).filter(key => key !== correct);
  await page.addInitScript(({ key, match, failed }) => {
    localStorage.setItem(key, JSON.stringify({
      tutorialSeen: true,
      reduced: true,
      match: { ...match, actor: 'npc', discard: [...match.market, ...match.deck], market: [], deck: [], failed: { player: [], npc: failed } },
    }));
  }, { key, match, failed });
  await page.goto('/');
  await resume(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('NEXUS WINS')).toBeVisible();
  await expect(dialog.locator('.tile:not(.hidden-tile)')).toHaveCount(10);
  await dialog.getByRole('button', { name: 'タイトルへ', exact: true }).click();
  await page.getByRole('button', { name: '対戦成績', exact: true }).click();
  await expect(dialog.getByText('1 敗', { exact: true })).toBeVisible();
});

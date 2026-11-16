import { describe, expect, it } from 'vitest';
import { ask, guess, newMatch, npcView, other, validGuess } from './game.ts';
import { candidates, decide } from './npc.ts';
import { answer, answerLabel, cards, compare, faceKey, handKey, tiles } from './rules.ts';

function hand(...keys: string[]) {
  const from = [...tiles];
  return keys.map(key => from.splice(from.findIndex(tile => faceKey(tile) === key), 1)[0]).sort(compare);
}

describe('タイル', () => {
  it('20枚の物理IDと色別の内訳', () => {
    expect(new Set(tiles.map(t => t.id)).size).toBe(20);
    for (const [color, count] of [['red', 9], ['blue', 9], ['yellow', 2]] as const) {
      expect(tiles.filter(t => t.color === color)).toHaveLength(count);
    }
    expect(tiles.filter(t => t.color === 'yellow').every(t => t.value === 5)).toBe(true);
  });

  it('重複せず5枚ずつ昇順に配布する', () => {
    const { hands } = newMatch('normal', () => 0.45);
    for (const row of Object.values(hands)) {
      expect(row).toHaveLength(5);
      expect(row).toEqual([...row].sort(compare));
    }
    expect(new Set(Object.values(hands).flat().map(t => t.id)).size).toBe(10);
    expect(compare({ value: 3, color: 'red' }, { value: 3, color: 'blue' })).toBeLessThan(0);
  });

  it('自分の実物タイル、重複、順序違反を拒否し黄色2枚を許す', () => {
    const own = hand('red0', 'blue0', 'blue1', 'blue2', 'blue3');
    expect(validGuess(hand('red1', 'red2', 'red3', 'yellow5', 'yellow5'), own)).toBe(true);
    expect(validGuess(hand('red0', 'red2', 'red3', 'yellow5', 'yellow5'), own)).toBe(false);
    expect(validGuess(hand('red1', 'red2', 'red3', 'yellow5', 'yellow5').reverse(), own)).toBe(false);
    expect(validGuess(Array(5).fill({ color: 'red', value: 3 }), own)).toBe(false);
  });
});

describe('カードと回答', () => {
  const sample = hand('red0', 'red1', 'blue1', 'yellow5', 'yellow5');
  it('ユニークな21種類すべての回答を計算する', () => {
    const expected = [1, 1, 2, 1, 1, 0, 5, 0, 5, 1, 2, 11, 12, 1, 4, 2, [[1, 2], [4, 5]], [[1, 2]], [1], [4, 5], [2, 3]];
    expect(new Set(cards.map(c => c.id)).size).toBe(21);
    expect(cards.map(c => answer(sample, { cardId: c.id, option: c.options?.[0] }))).toEqual(expected);
  });

  it('色が0枚または1枚の合計・差と複数の隣接場所を返す', () => {
    const row = hand('red0', 'red1', 'red2', 'red3', 'yellow5');
    expect(answer(row, { cardId: 'blue-sum' })).toBe(0);
    expect(answer(row, { cardId: 'blue-span' })).toBe(0);
    expect(answer(sample, { cardId: 'blue-span' })).toBe(0);
    expect(answerLabel(answer(row, { cardId: 'same-color' }))).toBe('左から1番目と2番目、2番目と3番目、3番目と4番目');
    expect(answerLabel(answer(sample, { cardId: 'five' }))).toBe('左から4番目、5番目');
    expect(answerLabel(answer(sample, { cardId: 'one-two', option: 2 }))).toBe('ありません');
    expect(() => answer(sample, { cardId: 'one-two' })).toThrow();
    expect(() => answer(sample, { cardId: 'one-two', option: [1, 2] as unknown as number })).toThrow();
  });

  it('6枚公開し、補充してから場を使い切り、カードは再登場しない', () => {
    let match = newMatch('normal', () => 0.42);
    expect(match.market).toHaveLength(6);
    expect(match.deck).toHaveLength(15);
    expect(() => ask(match, match.actor, { cardId: match.deck[0], option: 1 })).toThrow('公開カード');
    for (let i = 0; i < 21; i++) {
      const cardId = match.market[0];
      const option = cardId === 'one-two' ? 1 : undefined;
      const expected = answer(match.hands[other(match.actor)], { cardId, option });
      const previous = match;
      match = ask(match, match.actor, { cardId, option });
      expect(match.turn).toBe(i + 2);
      expect(match.actor).toBe(other(previous.actor));
      expect(match.history.at(-1)).toMatchObject({ answer: expected });
      expect(match.discard.at(-1)).toBe(cardId);
      expect(match.market).toHaveLength(Math.min(6, 20 - i));
      expect(match.deck).toHaveLength(Math.max(0, 14 - i));
      expect(() => ask(match, match.actor, { cardId, option })).toThrow('公開カード');
    }
    expect(new Set(match.discard).size).toBe(21);
    expect(guess(match, match.actor, match.hands[other(match.actor)]).winner).toBe(match.actor);
  });

  it('不正解は公開情報を増やさず、正解後のアクションは拒否する', () => {
    const match = newMatch('normal', () => 0.42);
    const wrong = candidates(npcView(match)).find(h => handKey(h) !== handKey(match.hands.player))!;
    const after = guess({ ...match, actor: 'npc' }, 'npc', wrong);
    expect(after.actor).toBe('player');
    expect(after.history.at(-1)).toEqual({ kind: 'guess', actor: 'npc', turn: 1, correct: false });
    const win = guess(after, 'player', after.hands.npc);
    expect(win.winner).toBe('player');
    expect(() => ask(win, 'player', { cardId: win.market[0] })).toThrow('手番');
  });
});

describe('NPC', () => {
  const match = newMatch('normal', () => 0.43);
  it('推理に秘密情報を渡さず、自分の手札の実物を除く', () => {
    const view = npcView(match);
    expect(Object.keys(view).sort()).toEqual(['clues', 'difficulty', 'failed', 'market', 'own']);
    expect(npcView({ ...match, hands: { ...match.hands, player: [] }, deck: [] })).toEqual(view);
    const rows = candidates(view);
    expect(rows.every(row => !row.some(tile => view.own.some(own => own.id === tile.id)))).toBe(true);
    expect(new Set(rows.map(handKey)).size).toBe(rows.length);
  });

  it('質問回答と不正解履歴で候補を絞る', () => {
    const view = npcView(match);
    const question = { cardId: 'sum' };
    const response = answer(match.hands.player, question);
    const rows = candidates({ ...view, clues: [{ kind: 'question', actor: 'npc', turn: 1, question, answer: response }] });
    expect(rows.length).toBeLessThan(candidates(view).length);
    expect(rows.every(row => answer(row, question) === response)).toBe(true);
    expect(rows.some(row => handKey(row) === handKey(match.hands.player))).toBe(true);
    expect(candidates({ ...view, failed: [handKey(rows[0])] }).some(row => handKey(row) === handKey(rows[0]))).toBe(false);
  });

  it('公開カードと選択肢を使い、難易度によって戦略が異なる', () => {
    const view = { ...npcView(match), market: ['blue-count', 'sum'] };
    expect(decide({ ...view, difficulty: 'easy' }, () => 0)).toMatchObject({ question: { cardId: 'blue-count' } });
    for (const difficulty of ['normal', 'hard'] as const) {
      expect(decide({ ...view, difficulty })).toMatchObject({ question: { cardId: 'sum' } });
      const move = decide({ ...view, difficulty, market: ['one-two'] });
      expect(move.kind === 'question' && [1, 2].includes(move.question.option!)).toBe(true);
    }
  });

  it('一意の候補をそのまま解答する', () => {
    const view = npcView(match);
    const expected = handKey(match.hands.player);
    const failed = candidates(view).map(handKey).filter(key => key !== expected);
    const move = decide({ ...view, failed, difficulty: 'hard' });
    expect(move.kind === 'guess' && handKey(move.hand)).toBe(expected);
  });

  it.each(['easy', 'normal', 'hard'] as const)('%s で複数の対戦を最後まで進行できる', difficulty => {
    for (let seed = 1; seed <= 8; seed++) {
      let state = seed;
      const random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
      let game = newMatch(difficulty, random);
      while (!game.winner && game.turn < 301) {
        const actor = game.actor;
        // Exercise both sides using the same public-information projection.
        const view = actor === 'npc' ? npcView(game) : {
          ...npcView(game), own: game.hands.player, failed: game.failed.player,
          clues: game.history.flatMap(e => e.kind === 'question' && e.actor === 'player' ? [e] : []),
        };
        const move = decide(view, random);
        game = move.kind === 'question' ? ask(game, actor, move.question) : guess(game, actor, move.hand);
      }
      expect(game.winner).not.toBeNull();
      expect(game.market.length + game.deck.length + game.discard.length).toBe(21);
    }
  });
});

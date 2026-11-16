import type { Clue, Difficulty } from './game.ts';
import { answer, available, cardById, handKey } from './rules.ts';
import type { Question, Tile } from './rules.ts';

export type NpcView = {
  own: readonly Tile[];
  market: readonly string[];
  clues: readonly Clue[];
  failed: readonly string[];
  difficulty: Difficulty;
};

export function candidates(view: NpcView) {
  const pool = available(view.own);
  const known = view.clues.map(clue => ({ question: clue.question, key: JSON.stringify(clue.answer) }));
  const rejected = new Set(view.failed);
  const seen = new Set<string>();
  const result: Tile[][] = [];
  function enumerate(start: number, hand: Tile[]) {
    if (hand.length === 5) {
      const key = handKey(hand);
      if (seen.has(key) || rejected.has(key)) return;
      seen.add(key);
      if (known.every(clue => JSON.stringify(answer(hand, clue.question)) === clue.key)) result.push(hand);
      return;
    }
    for (let i = start; i <= pool.length - (5 - hand.length); i++) {
      enumerate(i + 1, [...hand, pool[i]]);
    }
  }
  enumerate(0, []);
  return result;
}

export type Move = { kind: 'guess'; hand: Tile[] } | { kind: 'question'; question: Question };

export function decide(view: NpcView, random = Math.random): Move {
  const hands = candidates(view);
  if (!hands.length) throw new Error('回答と一致する候補がありません');
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
  if (hands.length === 1 || !view.market.length) return { kind: 'guess', hand: pick(hands) };

  const questions = view.market.flatMap(cardId =>
    (cardById.get(cardId)!.options ?? [undefined]).map(option => ({ cardId, option })));
  if (view.difficulty === 'easy') return { kind: 'question', question: pick(questions) };

  let best = questions[0];
  let bestScore = -Infinity;
  for (const question of questions) {
    const buckets = new Map<string, number>();
    for (const hand of hands) {
      const key = JSON.stringify(answer(hand, question));
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const probabilities = [...buckets.values()].map(size => size / hands.length);
    const score = probabilities.reduce((total, p) =>
      total - (view.difficulty === 'hard' ? p * Math.log2(p) : p * p), 0);
    if (score > bestScore) {
      best = question;
      bestScore = score;
    }
  }
  if (bestScore === (view.difficulty === 'hard' ? 0 : -1)) return { kind: 'guess', hand: pick(hands) };
  return { kind: 'question', question: best };
}

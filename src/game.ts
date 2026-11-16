import { answer, available, cards, compare, handKey, shuffle, tiles } from './rules.ts';
import type { Answer, Face, Question, Tile } from './rules.ts';
import type { NpcView } from './npc.ts';

export type Side = 'player' | 'npc';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Clue = { kind: 'question'; actor: Side; turn: number; question: Question; answer: Answer };
export type Attempt = { kind: 'guess'; actor: Side; turn: number; correct: boolean };
export type Event = Clue | Attempt;
export type Match = {
  hands: Record<Side, Tile[]>;
  market: string[];
  deck: string[];
  discard: string[];
  actor: Side;
  turn: number;
  winner: Side | null;
  history: Event[];
  failed: Record<Side, string[]>;
  difficulty: Difficulty;
};

export const other = (side: Side): Side => side === 'player' ? 'npc' : 'player';

export function newMatch(difficulty: Difficulty, random = Math.random): Match {
  const deal = shuffle(tiles, random);
  const order = shuffle(cards.map(card => card.id), random);
  return {
    hands: { player: deal.slice(0, 5).sort(compare), npc: deal.slice(5, 10).sort(compare) },
    market: order.slice(0, 6), deck: order.slice(6), discard: [],
    actor: random() < 0.5 ? 'player' : 'npc', turn: 1, winner: null, history: [],
    failed: { player: [], npc: [] }, difficulty,
  };
}

// Only this projection crosses the boundary into the NPC decision function.
export function npcView(match: Match): NpcView {
  return {
    own: match.hands.npc,
    market: match.market,
    clues: match.history.filter((event): event is Clue => event.kind === 'question' && event.actor === 'npc'),
    failed: match.failed.npc,
    difficulty: match.difficulty,
  };
}

export function validGuess(guess: readonly Face[], own: readonly Tile[]) {
  if (guess.length !== 5 || guess.some((tile, i) => i > 0 && compare(guess[i - 1], tile) > 0)) return false;
  const pool = available(own);
  return guess.every(face => {
    const index = pool.findIndex(tile => tile.value === face.value && tile.color === face.color);
    if (index < 0) return false;
    pool.splice(index, 1);
    return true;
  });
}

function assertTurn(match: Match, actor: Side) {
  if (match.winner || match.actor !== actor) throw new Error('手番ではありません');
}

export function ask(match: Match, actor: Side, question: Question): Match {
  assertTurn(match, actor);
  const index = match.market.indexOf(question.cardId);
  if (index < 0) throw new Error('公開カードから選んでください');
  const response = answer(match.hands[other(actor)], question);
  const market = [...match.market];
  const [next, ...deck] = match.deck;
  market.splice(index, 1, ...(next ? [next] : []));
  return {
    ...match, market, deck, discard: [...match.discard, question.cardId], actor: other(actor), turn: match.turn + 1,
    history: [...match.history, { kind: 'question', actor, turn: match.turn, question, answer: response }],
  };
}

export function guess(match: Match, actor: Side, hand: readonly Face[]): Match {
  assertTurn(match, actor);
  if (!validGuess(hand, match.hands[actor])) throw new Error('無効なタイルの並びです');
  const key = handKey(hand);
  const correct = key === handKey(match.hands[other(actor)]);
  return {
    ...match, winner: correct ? actor : null, actor: correct ? actor : other(actor), turn: match.turn + Number(!correct),
    failed: correct ? match.failed : { ...match.failed, [actor]: [...match.failed[actor], key] },
    history: [...match.history, { kind: 'guess', actor, turn: match.turn, correct }],
  };
}

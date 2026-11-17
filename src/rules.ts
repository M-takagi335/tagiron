export type Color = 'red' | 'blue' | 'yellow';
export type Face = { value: number; color: Color };
export type Tile = Face & { id: string };
export type Answer = number | number[] | [number, number][];
export type Category = 'color' | 'value' | 'parity' | 'pattern';
type Card = {
  id: string;
  category: Category;
  label: string;
  options?: readonly number[];
  evaluate: (hand: readonly Tile[], option?: number) => Answer;
};

export const colorNames = { red: '赤', blue: '青', yellow: '黄' };
const colorOrder = { red: 0, blue: 1, yellow: 2 };
export const compare = (a: Face, b: Face) => a.value - b.value || colorOrder[a.color] - colorOrder[b.color];
export const tiles: readonly Tile[] = [
  { id: 'red-0', value: 0, color: 'red' }, { id: 'blue-0', value: 0, color: 'blue' },
  { id: 'red-1', value: 1, color: 'red' }, { id: 'blue-1', value: 1, color: 'blue' },
  { id: 'red-2', value: 2, color: 'red' }, { id: 'blue-2', value: 2, color: 'blue' },
  { id: 'red-3', value: 3, color: 'red' }, { id: 'blue-3', value: 3, color: 'blue' },
  { id: 'red-4', value: 4, color: 'red' }, { id: 'blue-4', value: 4, color: 'blue' },
  { id: 'yellow-5-1', value: 5, color: 'yellow' }, { id: 'yellow-5-2', value: 5, color: 'yellow' },
  { id: 'red-6', value: 6, color: 'red' }, { id: 'blue-6', value: 6, color: 'blue' },
  { id: 'red-7', value: 7, color: 'red' }, { id: 'blue-7', value: 7, color: 'blue' },
  { id: 'red-8', value: 8, color: 'red' }, { id: 'blue-8', value: 8, color: 'blue' },
  { id: 'red-9', value: 9, color: 'red' }, { id: 'blue-9', value: 9, color: 'blue' },
];
export const faceKey = (tile: Face) => tile.color + tile.value;
export const handKey = (hand: readonly Face[]) => hand.map(faceKey).join('/');
export const labelTile = (tile: Face) => colorNames[tile.color] + tile.value;
export function available(own: readonly Tile[]) {
  const ownedIds = new Set(own.map(tile => tile.id));
  return tiles.filter(tile => !ownedIds.has(tile.id));
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const sum = (hand: readonly Tile[]) => hand.reduce((total, tile) => total + tile.value, 0);
const span = (hand: readonly Tile[]) => hand.length > 1 ? hand.at(-1)!.value - hand[0].value : 0;
const byColor = (hand: readonly Tile[], color: Color) => hand.filter(tile => tile.color === color);
const locations = (hand: readonly Tile[], value: number) => hand.flatMap((tile, i) => tile.value === value ? [i + 1] : []);

function adjacent(hand: readonly Tile[], check: (left: Tile, right: Tile) => boolean): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 1; i < hand.length; i++) {
    if (check(hand[i - 1], hand[i])) pairs.push([i, i + 1]);
  }
  return pairs;
}

const card = (id: string, category: Category, label: string, evaluate: Card['evaluate']): Card =>
  ({ id, category, label, evaluate });
const choice = (id: string, options: readonly number[]): Card => ({
  ...card(id, 'pattern', options.join(' または ') + ' はどこにある？', (hand, option) => locations(hand, option!)),
  options,
});

export const cards: readonly Card[] = [
  card('red-sum', 'color', '赤の数字の合計は？', h => sum(byColor(h, 'red'))),
  card('blue-sum', 'color', '青の数字の合計は？', h => sum(byColor(h, 'blue'))),
  card('red-count', 'color', '赤のタイルは何枚ある？', h => byColor(h, 'red').length),
  card('blue-count', 'color', '青のタイルは何枚ある？', h => byColor(h, 'blue').length),
  card('red-span', 'color', '赤の最大と最小の差は？', h => span(byColor(h, 'red'))),
  card('blue-span', 'color', '青の最大と最小の差は？', h => span(byColor(h, 'blue'))),
  card('max', 'value', '最大の数字は？', h => h.at(-1)!.value),
  card('min', 'value', '最小の数字は？', h => h[0].value),
  card('span', 'value', '最大と最小の差は？', span),
  card('middle', 'value', '中央の数字は？', h => h[2].value),
  card('left-sum', 'value', '左から3枚の数字の合計は？', h => sum(h.slice(0, 3))),
  card('right-sum', 'value', '右から3枚の数字の合計は？', h => sum(h.slice(-3))),
  card('sum', 'value', 'すべてのタイルの数字の合計は？', sum),
  card('even', 'parity', '偶数は何枚ある？', h => h.filter(t => t.value % 2 === 0).length),
  card('odd', 'parity', '奇数は何枚ある？', h => h.filter(t => t.value % 2 === 1).length),
  card('pairs', 'pattern', '同じ数字のペアは何組ある？', h => adjacent(h, (a, b) => a.value === b.value).length),
  card('same-color', 'pattern', '同じ色が隣り合っているところはどこ？', h => adjacent(h, (a, b) => a.color === b.color)),
  card('consecutive', 'pattern', '連番が隣り合っているところはどこ？', h => adjacent(h, (a, b) => b.value - a.value === 1)),
  card('zero', 'pattern', '0 はどこにある？', h => locations(h, 0)),
  card('five', 'pattern', '5 はどこにある？', h => locations(h, 5)),
  choice('one-two', [1, 2]),
];

export const cardById = new Map(cards.map(item => [item.id, item]));
export type Question = { cardId: string; option?: number };

export function answer(hand: readonly Tile[], question: Question): Answer {
  const item = cardById.get(question.cardId);
  if (!item || (item.options ? !item.options.includes(question.option!) : question.option !== undefined)) {
    throw new Error('無効な質問です');
  }
  return item.evaluate(hand, question.option);
}

export function questionLabel(question: Question) {
  return question.option === undefined ? cardById.get(question.cardId)!.label : question.option + ' はどこにある？';
}

export function answerLabel(value: Answer) {
  if (typeof value === 'number') return String(value);
  if (!value.length) return 'ありません';
  return '左から' + value.map(position => Array.isArray(position) ? position.join('番目と') + '番目' : position + '番目').join('、');
}

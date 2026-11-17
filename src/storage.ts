import type { Difficulty, Match } from './game.ts';
import type { Tile } from './rules.ts';

export type Save = {
  difficulty: Difficulty;
  sound: boolean;
  reduced: boolean;
  tutorialSeen: boolean;
  stats: Record<Difficulty, { wins: number; losses: number }>;
  match: Match | null;
  notes: Record<string, number>;
};

const key = 'code-breakers-v1';

function migrateTileId(tile: Tile): Tile {
  if (tile.id === 'yellow-5-0') return { ...tile, id: 'yellow-5-1' };
  if (tile.id === 'yellow-5-1') return { ...tile, id: 'yellow-5-2' };
  return tile;
}

export function load(): Save {
  const defaults: Save = {
    difficulty: 'normal', sound: false, reduced: false, tutorialSeen: false,
    stats: { easy: { wins: 0, losses: 0 }, normal: { wins: 0, losses: 0 }, hard: { wins: 0, losses: 0 } },
    match: null, notes: {},
  };
  try {
    const { tileIdVersion, ...saved } = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<Save> & { tileIdVersion?: number };
    const save = { ...defaults, ...saved };
    if (save.match && tileIdVersion === undefined) {
      const { player, npc } = save.match.hands;
      save.match = { ...save.match, hands: { player: player.map(migrateTileId), npc: npc.map(migrateTileId) } };
    }
    return save;
  } catch {
    return defaults;
  }
}

export function persist(save: Save) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...save, tileIdVersion: 2 }));
    return true;
  } catch {
    return false;
  }
}

let audio: AudioContext | undefined;

export function playSound(kind: 'select' | 'ask' | 'win') {
  if (!window.AudioContext) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    const context = audio;
    const tones = kind === 'win' ? [392, 494, 587, 784] : kind === 'ask' ? [390, 520] : [520];
    tones.forEach((frequency, i) => {
      const start = context.currentTime + i * 0.09;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.17);
    });
  } catch {
    // The browser may restrict audio until a user gesture.
  }
}

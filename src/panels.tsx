import { useState } from 'react';
import { ArrowRight, Check, Delete, LockKeyhole, PencilLine, Target } from 'lucide-react';
import { validGuess } from './game.ts';
import type { Event } from './game.ts';
import { answerLabel, available, colorNames, faceKey, labelTile, questionLabel, tiles } from './rules.ts';
import type { Face, Tile } from './rules.ts';
import { Modal, TileFace } from './ui.tsx';

export function History({ history, compact = false }: { history: readonly Event[]; compact?: boolean }) {
  if (!history.length) return <p className="empty">質問や解答はここに記録されます。</p>;
  const events = compact ? history.slice(-3) : history;
  return <ol className="history-list">{[...events].reverse().map(event => <li key={event.turn}>
    <div className="event-meta"><span className={event.actor === 'npc' ? 'npc-text' : 'player-text'}>
      {event.actor === 'npc' ? 'NEXUS' : 'あなた'}</span><span>TURN {String(event.turn).padStart(2, '0')}</span></div>
    {event.kind === 'question' ? <><div>{questionLabel(event.question)}</div><strong>{answerLabel(event.answer)}</strong></>
      : <><div>コードを解答</div><strong>{event.correct ? '解読成功' : '不正解'}</strong></>}
  </li>)}</ol>;
}

const noteStates = [
  { name: '未確認', mark: '–' },
  { name: 'ありそう', mark: '○' },
  { name: 'なし', mark: '×' },
  { name: '確定', mark: '✓' },
];
const faces = [...new Map(tiles.map(tile => [faceKey(tile), tile])).values()];

export function Notes({ notes, onChange }: { notes: Record<string, number>; onChange: (key: string, value: number) => void }) {
  const [tab, setTab] = useState(0);
  return <div className="notes">
    <div className="note-tabs" aria-label="メモの位置">{['候補表', '1', '2', '3', '4', '5'].map((item, i) =>
      <button type="button" key={item} aria-pressed={tab === i} onClick={() => setTab(i)}>{item}</button>)}</div>
    <div className="note-legend">{noteStates.map(({ name, mark }, i) => <span key={name} data-state={i}>
      <span className="note-mark" aria-hidden="true">{mark}</span>{name}
    </span>)}</div>
    <div className="note-grid">{faces.map(tile => {
      const key = tab + '/' + faceKey(tile);
      const state = notes[key] ?? 0;
      const { name, mark } = noteStates[state];
      return <button key={key} data-state={state} className={tile.color} title={name}
        aria-label={labelTile(tile) + '、' + name} onClick={() => onChange(key, (state + 1) % noteStates.length)}>
        <span className="note-number">{tile.value}</span><span className="note-mark" aria-hidden="true">{mark}</span>
      </button>;
    })}</div>
  </div>;
}

export function GuessPanel({ own, onClose, onGuess }: {
  own: Tile[]; onClose: () => void; onGuess: (hand: Face[]) => void;
}) {
  const [slots, setSlots] = useState<(Tile | null)[]>([null, null, null, null, null]);
  const [position, setPosition] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const pool = available(own);
  const remaining = pool.filter(tile => !slots.some((slot, i) => i !== position && slot?.id === tile.id));
  const complete = slots.every(slot => slot !== null);
  const ready = complete && validGuess(slots, own);
  function setTile(tile: Tile | null) {
    setSlots(slots.map((slot, i) => i === position ? tile : slot));
    if (tile) {
      const next = slots.findIndex((slot, i) => i > position && !slot);
      if (next >= 0) setPosition(next);
    }
  }
  return <Modal title={confirm ? 'このコードで解答しますか？' : 'コードを解答'} onClose={onClose}>
    <p className="muted">{confirm ? '間違えると相手の手番になります。' : 'スロットを選び、数字と色を左から順に並べます。'}</p>
    <div className="guess-slots">{slots.map((tile, i) => <button key={i} className="slot"
      aria-label={(i + 1) + '番目 ' + (tile ? labelTile(tile) : '未選択')} aria-pressed={!confirm && position === i}
      disabled={confirm} onClick={() => setPosition(i)}>{tile ? <TileFace face={tile} /> : <span className="slot-empty">{i + 1}</span>}</button>)}</div>
    {!confirm && <>
      <div className="picker">{pool.map(tile => {
        // Identical faces can use any remaining physical copy.
        const pick = remaining.includes(tile) ? tile : remaining.find(copy => faceKey(copy) === faceKey(tile));
        return <button key={tile.id} className={'pick ' + tile.color}
          aria-label={labelTile(tile) + (tile.color === 'yellow' && pool.filter(t => t.color === 'yellow').length === 2 ? ' ' + (Number(tile.id.at(-1)) + 1) + '枚目' : '')}
          disabled={!pick} onClick={() => pick && setTile(pick)}>{tile.value}<small>{colorNames[tile.color]}</small></button>;
      })}</div>
      <div className="guess-tools"><button className="text-btn" disabled={!slots[position]} onClick={() => setTile(null)}><Delete size={17} /> この位置を空にする</button>
        {complete && !ready && <p role="status">数字の昇順、同じ数字は赤 → 青の順です。</p>}</div>
    </>}
    <footer className="modal-actions">
      <button className="secondary" onClick={confirm ? () => setConfirm(false) : onClose}>{confirm ? '修正する' : 'キャンセル'}</button>
      <button className="primary" disabled={!ready} onClick={() => {
        if (confirm && complete) onGuess(slots);
        else setConfirm(true);
      }}>{confirm ? <Check size={17} /> : <Target size={17} />}{confirm ? '解答を確定' : '確認へ'}{!confirm && <ArrowRight size={17} />}</button>
    </footer>
  </Modal>;
}

export function PanelHeader({ notes, onClick }: { notes?: boolean; onClick: () => void }) {
  return <button className="panel-heading" onClick={onClick}>
    {notes ? <PencilLine size={17} /> : <LockKeyhole size={16} />} {notes ? '推理メモ' : '質問履歴'} <ArrowRight size={15} />
  </button>;
}

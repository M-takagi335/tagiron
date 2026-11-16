import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, BookOpen, Bot, ChevronRight, Crosshair, History as HistoryIcon,
  Layers3, LockKeyhole, PencilLine, Play, RotateCcw, Settings, Sparkles, Target, Trophy, UserRound,
} from 'lucide-react';
import { ask, guess, newMatch, npcView } from './game.ts';
import type { Difficulty, Event, Match } from './game.ts';
import { decide } from './npc.ts';
import type { Move } from './npc.ts';
import NpcWorker from './npc.worker.ts?worker&inline';
import { answerLabel, cardById, questionLabel } from './rules.ts';
import type { Face, Question } from './rules.ts';
import { load, persist, playSound } from './storage.ts';
import { categoryUI, Logo, Modal, TileFace, Tutorial } from './ui.tsx';
import { GuessPanel, History, Notes, PanelHeader } from './panels.tsx';

const difficulties = [
  { id: 'easy', label: 'EASY', description: '気軽に推理', bars: 1 },
  { id: 'normal', label: 'NORMAL', description: '論理の対戦', bars: 2 },
  { id: 'hard', label: 'HARD', description: '鋭い情報分析', bars: 3 },
] as const;
type Panel = 'rules' | 'settings' | 'stats' | 'notes' | 'history' | 'guess' | 'replace' | null;

function HeroArt() {
  return <div className="hero-art" aria-hidden="true">
    <div className="art-grid" /><div className="orbit orbit-one" /><div className="orbit orbit-two" />
    <div className="art-orbit-center" /><span className="art-cross cross-one">+</span><span className="art-cross cross-two">+</span>
    <div className="art-card art-blue"><TileFace face={{ value: 2, color: 'blue' }} /></div>
    <div className="art-card art-purple"><TileFace /></div>
    <div className="art-card art-red"><TileFace face={{ value: 7, color: 'red' }} /></div>
    <div className="art-card art-gold"><TileFace face={{ value: 5, color: 'yellow' }} /></div>
  </div>;
}

function EventLine({ event }: { event: Event }) {
  return <div className="last-event">
    <span className="event-icon"><Activity size={17} /></span>
    <div><small>{event.actor === 'npc' ? 'NEXUS' : 'あなた'} · TURN {event.turn}</small>
      <strong>{event.kind === 'question' ? questionLabel(event.question) : 'コードを解答'}</strong></div>
    <b>{event.kind === 'question' ? answerLabel(event.answer) : event.correct ? '解読成功' : '不正解'}</b>
  </div>;
}

export function App() {
  const [save, setSave] = useState(load);
  const [inMatch, setInMatch] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<Question | null>(null);
  const [resultOpen, setResultOpen] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const match = save.match;
  const active = inMatch && match !== null;
  const isPlayer = active && match.actor === 'player' && !match.winner;
  const thinking = active && match.actor === 'npc' && !match.winner;
  const lastQuestion = match?.history.at(-1);

  useEffect(() => { setStorageError(!persist(save)); }, [save]);

  useEffect(() => {
    if (!thinking || !match) return;
    let worker: Worker | undefined;
    const apply = (move: Move) => {
      const next = move.kind === 'question' ? ask(match, 'npc', move.question) : guess(match, 'npc', move.hand);
      setSave(previous => previous.match === match ? withMatch(previous, next) : previous);
    };
    const view = npcView(match);
    const timer = window.setTimeout(() => {
      try {
        worker = new NpcWorker();
        worker.onmessage = (event: MessageEvent<Move>) => apply(event.data);
        worker.onerror = () => apply(decide(view));
        worker.postMessage(view);
      } catch {
        apply(decide(view));
      }
    }, save.reduced ? 320 : 850);
    return () => { window.clearTimeout(timer); worker?.terminate(); };
  }, [thinking, match, save.reduced]);

  function start(difficulty: Difficulty) {
    setSave(previous => ({ ...previous, match: newMatch(difficulty), notes: {} }));
    setResultOpen(true);
    setPanel(null);
    setInMatch(true);
  }

  function home() {
    setSelected(null);
    setPanel(null);
    setInMatch(false);
  }

  function closeRules() {
    setSave(previous => ({ ...previous, tutorialSeen: true }));
    setPanel(null);
  }

  function submitGuess(hand: Face[]) {
    if (!match || !isPlayer) return;
    const next = guess(match, 'player', hand);
    if (next.winner && save.sound) playSound('win');
    setPanel(null);
    setSave(previous => withMatch(previous, next));
  }

  function submitQuestion() {
    if (!match || !isPlayer || !selected) return;
    const next = ask(match, 'player', selected);
    if (save.sound) playSound('ask');
    setSelected(null);
    setSave(previous => withMatch(previous, next));
  }

  function note(key: string, value: number) {
    setSave(previous => ({ ...previous, notes: { ...previous.notes, [key]: value } }));
  }

  return <div className={'shell' + (save.reduced ? ' reduced' : '')}>
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={home} aria-label="タイトルへ"><Logo /><span>CODE<span className="brand-accent">BREAKERS</span></span></button>
        <nav aria-label="メニュー">
          {active && <button className="nav-btn" aria-label="タイトル" onClick={home}><ArrowLeft size={17} /><span>タイトル</span></button>}
          <button className="nav-btn" aria-label="遊び方" onClick={() => setPanel('rules')}><BookOpen size={17} /><span>遊び方</span></button>
          <button className="nav-btn" aria-label="設定" onClick={() => setPanel('settings')}><Settings size={18} /><span>設定</span></button>
        </nav>
      </div>
    </header>
    {storageError && <div className="storage-warning" role="status">ブラウザの保存領域を利用できません。このページを開いている間は遊べます。</div>}
    {!active ? <main className="lobby">
      <div className="hero">
        <HeroArt />
        <section className="hero-content">
          <div className="eyebrow"><span /> 数字推理ボードゲーム</div>
          <h1>CODE<br /><em>BREAKERS</em></h1>
          <p className="hero-copy">質問を選び、手がかりをつなぐ。<br />相手より先に、隠された5枚を解読せよ。</p>
          <div className="launch">
            <h2 id="difficulty-heading">NPC 難易度</h2>
            <div className="difficulty" role="group" aria-labelledby="difficulty-heading">{difficulties.map(item =>
              <button key={item.id} data-level={item.id} aria-pressed={item.id === save.difficulty}
                onClick={() => setSave(previous => ({ ...previous, difficulty: item.id }))}>
                <span className="bars" aria-hidden="true">{[1, 2, 3].map(bar => <i key={bar} data-lit={bar <= item.bars} />)}</span>
                <strong>{item.label}</strong><small>{item.description}</small>
              </button>)}</div>
            <button className="primary start-btn" onClick={() => {
              if (save.sound) playSound('select');
              if (match && !match.winner) setPanel('replace');
              else start(save.difficulty);
            }}><Play size={19} fill="currentColor" /> ゲーム開始 <ArrowRight size={20} /></button>
            {match && !match.winner && <button className="secondary resume" onClick={() => setInMatch(true)}><RotateCcw size={16} /> 対戦を再開 <span>TURN {match.turn}</span></button>}
          </div>
          <div className="lobby-links">
            <button className="text-btn" onClick={() => setPanel('rules')}><BookOpen size={16} /> {save.tutorialSeen ? '遊び方' : 'はじめての方へ'} <ChevronRight size={15} /></button>
            <button className="text-btn" onClick={() => setPanel('stats')}><Trophy size={16} /> 対戦成績 <ChevronRight size={15} /></button>
          </div>
        </section>
      </div>
      <footer className="lobby-footer"><span><Crosshair size={15} /> CODE BREAKERS</span><span>プレイヤー vs NEXUS</span></footer>
    </main> : <main className="match-layout">
      <section className="board" aria-label="対戦ボード">
        <div className="board-status"><span><Activity size={15} /> {match.difficulty.toUpperCase()}</span>
          <span className={thinking ? 'turn-pill npc-text' : 'turn-pill player-text'} aria-live="polite">
            TURN {String(match.turn).padStart(2, '0')} <i /> {match.winner ? '対戦終了' : thinking ? 'NEXUS の手番' : 'あなたの手番'}
          </span></div>
        <section className="hand-zone opponent" aria-label="相手の手札">
          <div className="identity"><span className="avatar npc-avatar"><Bot size={25} /></span><div><small>対戦相手</small><h2>NEXUS</h2></div></div>
          <div className={'hand ' + (match.winner ? 'revealed' : '')}>{match.hands.npc.map((_, index) =>
            <TileFace key={index} index={index} face={match.winner ? match.hands.npc[index] : undefined} />)}</div>
          <div className="hand-status npc-text">{thinking ? <><span className="thinking"><i /><i /><i /></span>推理中</> : <><LockKeyhole size={14} />{match.winner ? '公開済み' : '非公開'}</>}</div>
        </section>
        <section className="market-zone" aria-labelledby="market-title">
          <div className="market-top"><div><h2 id="market-title">質問カード</h2><p>{match.winner ? '対戦が終了しました。' : !match.market.length ? '公開カードが尽きました。解答のみできます。' : isPlayer ? 'カードを1枚選ぶか、コードを解答してください。' : 'NEXUS が次の一手を考えています。'}</p></div>
            <div className="deck-info"><span><Layers3 size={16} /> 山札 <b>{match.deck.length}</b></span><span>捨て札 <b>{match.discard.length}</b></span></div></div>
          <div className="market">{match.market.map((id, index) => {
            const item = cardById.get(id)!;
            const { Icon, label } = categoryUI[item.category];
            return <button key={id} className={'question-card ' + item.category} aria-pressed={selected?.cardId === id} disabled={!isPlayer}
              style={{ '--i': index } as CSSProperties} onClick={() => {
                if (save.sound) playSound('select');
                setSelected({ cardId: id });
              }}>
              <span className="card-icon"><Icon size={19} /></span><span className="card-category">{label}</span>
              <strong>{item.label}</strong><span className="card-arrow"><ArrowRight size={15} /></span>
            </button>;
          })}</div>
          {lastQuestion?.kind === 'question' && <span className={'discard-flight ' + cardById.get(lastQuestion.question.cardId)!.category}
            key={lastQuestion.turn} aria-hidden="true"><Layers3 size={16} /></span>}
          <div className="recent-events" aria-live="polite">
            {match.history.length ? match.history.slice(-2).map(event => <EventLine event={event} key={event.turn} />) :
              <div className="last-event"><span className="event-icon"><Activity size={17} /></span>
                <div><strong>対戦開始</strong><small>{thinking ? 'NEXUS' : 'あなた'}が先攻です</small></div></div>}
          </div>
        </section>
        <section className="hand-zone player-hand" aria-label="自分の手札">
          <div className="identity"><span className="avatar"><UserRound size={22} /></span><div><small>自分の手札</small><h2>あなた</h2></div></div>
          <div className="hand">{match.hands.player.map((tile, i) => <TileFace key={tile.id} face={tile} index={i} />)}</div>
          <button className="primary solve-button" onClick={() => match.winner ? setResultOpen(true) : setPanel('guess')} disabled={!isPlayer && !match.winner}>
            <Target size={19} />{match.winner ? '対戦結果' : '解答する'}
          </button>
        </section>
        <div className="mobile-actions"><button className="secondary" onClick={() => setPanel('notes')}><PencilLine size={17} /> 推理メモ</button>
          <button className="secondary" onClick={() => setPanel('history')}><HistoryIcon size={17} /> 質問履歴</button></div>
      </section>
      <aside className="sidebar">
        <section className="side-panel"><PanelHeader notes onClick={() => setPanel('notes')} /><Notes notes={save.notes} onChange={note} /></section>
        <section className="side-panel"><PanelHeader onClick={() => setPanel('history')} /><History history={match.history} compact /></section>
      </aside>
    </main>}

    {(panel === 'rules' || (!save.tutorialSeen && !panel && !active)) &&
      <Tutorial onClose={closeRules} first={!save.tutorialSeen} />}
    {panel === 'settings' && <Modal title="設定" onClose={() => setPanel(null)}>
      <label className="setting"><span><strong>効果音</strong><small>カード選択、質問、解読成功</small></span>
        <input type="checkbox" checked={save.sound} onChange={event => {
          const sound = event.target.checked;
          if (sound) playSound('select');
          setSave(previous => ({ ...previous, sound }));
        }} /></label>
      <label className="setting"><span><strong>アニメーションを減らす</strong><small>カードやタイルの動きを抑えます</small></span>
        <input type="checkbox" checked={save.reduced} onChange={event => {
          const reduced = event.target.checked;
          setSave(previous => ({ ...previous, reduced }));
        }} /></label>
    </Modal>}
    {panel === 'stats' && <Modal title="対戦成績" onClose={() => setPanel(null)}>
      <div className="stats">{difficulties.map(({ id, label }) => <div key={id}>
        <strong>{label}</strong><span>{save.stats[id].wins} 勝</span><span>{save.stats[id].losses} 敗</span>
      </div>)}</div>
    </Modal>}
    {panel === 'replace' && <Modal title="新しい対戦を始めますか？" onClose={() => setPanel(null)}>
      <p className="muted">新しく始めると、進行中の対戦と推理メモが置き換わります。</p>
      <footer className="modal-actions"><button className="secondary" onClick={() => setPanel(null)}>キャンセル</button>
        <button className="primary" onClick={() => start(save.difficulty)}>新しく始める</button></footer>
    </Modal>}
    {panel === 'notes' && <Modal title="推理メモ" onClose={() => setPanel(null)} sheet>
      <p className="muted">タイルを押して状態を切り替えます。数字のタブでは、左からの位置ごとに記録できます。</p>
      <Notes notes={save.notes} onChange={note} />
    </Modal>}
    {panel === 'history' && match && <Modal title="質問履歴" onClose={() => setPanel(null)} sheet><History history={match.history} /></Modal>}
    {panel === 'guess' && isPlayer && <GuessPanel own={match.hands.player} onClose={() => setPanel(null)} onGuess={submitGuess} />}
    {selected && isPlayer && <Modal title="質問を確認" onClose={() => setSelected(null)}>
      <div className={'question-preview ' + cardById.get(selected.cardId)!.category}>
        <span><Crosshair size={22} /></span><h3>{cardById.get(selected.cardId)!.label}</h3>
      </div>
      {cardById.get(selected.cardId)!.options && <div className="choice-buttons" aria-label="質問する数字">
        {cardById.get(selected.cardId)!.options!.map(option => <button key={option} className="secondary"
          aria-pressed={selected.option === option} onClick={() => setSelected({ cardId: selected.cardId, option })}>{option} の位置</button>)}
      </div>}
      <footer className="modal-actions"><button className="secondary" onClick={() => setSelected(null)}>キャンセル</button>
        <button className="primary" disabled={!!cardById.get(selected.cardId)!.options && selected.option === undefined}
          onClick={submitQuestion}>質問する <ArrowRight size={17} /></button></footer>
    </Modal>}
    {active && match.winner && resultOpen && !panel && <Modal title="対戦結果" onClose={() => setResultOpen(false)}>
      <div className={'result ' + (match.winner === 'player' ? 'victory' : 'defeat')}>
        {match.winner === 'player' ? <Sparkles size={37} /> : <Bot size={37} />}
        <h3>{match.winner === 'player' ? 'CODE BROKEN' : 'NEXUS WINS'}</h3>
        <p>{match.winner === 'player' ? 'あなたがコードを解読しました。' : 'NEXUS が先にコードを解読しました。'}</p>
        <small>NEXUS の手札</small><div className="hand revealed">{match.hands.npc.map((tile, i) => <TileFace face={tile} index={i} key={tile.id} />)}</div>
        {match.winner === 'npc' && <><small>NEXUS が解読した手札</small><div className="hand revealed">{match.hands.player.map((tile, i) => <TileFace face={tile} index={i} key={tile.id} />)}</div></>}
        <div className="result-stats"><span><b>{match.turn}</b> ターン</span><span><b>{match.discard.length}</b> 質問</span></div>
      </div>
      <footer className="modal-actions"><button className="secondary" onClick={home}>タイトルへ</button>
        <button className="primary" onClick={() => start(match.difficulty)}><RotateCcw size={17} /> 再戦する</button></footer>
    </Modal>}
  </div>;
}

function withMatch(previous: ReturnType<typeof load>, match: Match) {
  if (!match.winner || previous.match?.winner) return { ...previous, match };
  const record = previous.stats[match.difficulty];
  const key = match.winner === 'player' ? 'wins' : 'losses';
  return { ...previous, match, stats: { ...previous.stats, [match.difficulty]: { ...record, [key]: record[key] + 1 } } };
}

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Binary, Blocks, CircleHelp, Crosshair, Fingerprint, Hash, Layers3, X } from 'lucide-react';
import type { Category, Face } from './rules.ts';
import { labelTile } from './rules.ts';

export const categoryUI = {
  color: { label: '色', Icon: Layers3 },
  value: { label: '数字', Icon: Hash },
  parity: { label: '偶数・奇数', Icon: Binary },
  pattern: { label: '並び・位置', Icon: Blocks },
} satisfies Record<Category, { label: string; Icon: typeof Hash }>;

export function TileFace({ face, index = 0 }: { face?: Face; index?: number }) {
  return <span className={'tile ' + (face?.color ?? 'hidden-tile')} style={{ '--i': index } as CSSProperties}
    aria-label={face ? labelTile(face) : '裏向きのタイル'}>
    {face ? <><small>{face.color === 'yellow' ? '◆' : face.color === 'red' ? '▲' : '●'}</small>{face.value}</> : <Fingerprint size={25} aria-hidden="true" />}
  </span>;
}

export function Logo() {
  return <span className="mark"><Crosshair size={21} aria-hidden="true" /></span>;
}

export function Modal({ title, children, onClose, sheet = false }: {
  title: string; children: ReactNode; onClose: () => void; sheet?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={ref} className={sheet ? 'sheet' : undefined} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-inner">
      <header><h2 id="dialog-title">{title}</h2><button className="icon-btn" onClick={onClose} aria-label="閉じる"><X size={19} /></button></header>
      {children}
    </div>
  </dialog>;
}

const steps = [
  ['数字タイルの内訳', '赤と青にそれぞれ 0〜9（5を除く）が1枚ずつ、黄色の5が2枚。自分と相手に5枚ずつ配り、残りは非公開です。'],
  ['左から小さい順', '手札は数字の昇順。同じ数字は赤、青の順です。黄色の5同士は同じものとして扱います。'],
  ['公開カードは最大6枚', '21枚の質問から6枚を公開します。使ったカードは捨て、山札が残っていれば1枚補充します。'],
  ['質問を選んで確定', '自分のターンでは質問か解答を1回できます。「1 または 2」は片方を選んでから質問します。'],
  ['回答を手がかりに', '回答は自動で計算されます。「左から」は回答者の手札で数えます。偶数には0も含まれます。'],
  ['推理メモを使う', '候補表と位置ごとのメモに、ありそう・なし・確定を付けられます。質問履歴も見返せます。'],
  ['5枚すべてを解答', '色と数字を左から順に指定して提出します。自分の手札にある実物タイルは使えません。'],
  ['先に解読した側が勝利', '外すと答えは伏せたまま相手の手番へ。公開カードが尽きたら、解答だけで勝負します。'],
];

export function Tutorial({ onClose, first }: { onClose: () => void; first: boolean }) {
  const [step, setStep] = useState(first ? 0 : -1);
  return <Modal title="遊び方" onClose={onClose}>
    {step >= 0 ? <>
      <div className="tutorial-progress" aria-label={String(step + 1) + ' / 8'}>{steps.map(([title], index) =>
        <button key={title} aria-label={title} aria-current={index === step ? 'step' : undefined} onClick={() => setStep(index)} />)}</div>
      <div className="tutorial-step"><CircleHelp size={30} /><h3>{steps[step][0]}</h3><p>{steps[step][1]}</p></div>
      <footer className="modal-actions"><button className="secondary" onClick={() => setStep(step - 1)}>戻る</button>
        <button className="primary" onClick={() => step === 7 ? onClose() : setStep(step + 1)}>{step === 7 ? '完了' : '次へ'}</button></footer>
    </> : <>
      <ol className="rules-list">{steps.map(([title, content]) => <li key={title}><strong>{title}</strong><p>{content}</p></li>)}</ol>
      <footer className="modal-actions"><button className="secondary" onClick={() => setStep(0)}>チュートリアルを見る</button></footer>
    </>}
  </Modal>;
}

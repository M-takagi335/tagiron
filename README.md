# tagiron
たぎろん

# CODE BREAKERS

公開された質問カードから手がかりを集め、相手の5枚を色・数字・位置まで当てるブラウザゲームです。対戦相手の NEXUS は、自分の手札と質問の回答から候補を絞ります。

## 起動

Node.js 22 を用意し、このフォルダで実行します。

```powershell
npm.cmd ci
npm.cmd run dev
```

ターミナルに表示されるローカル URL をブラウザで開きます。同じネットワークのスマートフォンから確認するときは `npm.cmd run dev -- --host 0.0.0.0` で起動し、表示された Network URL を開きます。進行中の対戦・推理メモ・設定・成績は、同じブラウザと URL で再開できます。

## 検証

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

ブラウザテストにはインストール済みの Google Chrome を使用します。PC 幅とモバイルのタッチ設定で本番ビルドを検証します。ゲームを読み込んだ後は、通信が切断されても対戦を続けられます。

# 臨床力カード（地域で怖くない臨床力アプリ）

教育・訓練用のオフラインPWA。地域で専門外の急変に出会っても最初の一手が打て、使うほど自分に染み込むことを目指す。

- 仕様：元の設計書（2026-11-09 通勤音声版）と「設計分析と改訂設計 v1.1」。食い違うときは改訂設計を優先する。
- このリポジトリはMVP。仕組みは全部、カードは「ループ検証の5枚」の空欄サンプルだけ（医学的な中身は入っていない）。

## 目的

現場で引いたカードを、8時間以上あとに「見ずに言う」練習に変える。安全（現場では全文をすぐ見せ、何も問わない）と学習（あとで問う）を、同じ画面でなく時間で分ける。

## 対象分人

- 現場の層：当直中の医師（自分。地域の内科系）
- 学習の層：学習者としての自分。次に自治医大の同期

一つのアプリで二つの層が混ざらないかは、運用して確かめる（DESIGN.md の未決）。

## 使う場面

| 場面 | 画面 | すること |
|---|---|---|
| 急変のその場 | 現場（ホーム→カード） | 状態の大ボタンから1〜2タップでカード。まずやることと呼ぶ基準を最初の画面で見る |
| 当直前（3分） | 学習→当直前ブリーフィング | 1枚を出す。頭の中で最初の5分を言ってから開く |
| 当直明けの朝・翌日 | 学習→今日の想起 | 見ずに言う→照合→自己評価4段階 |
| 時間がないとき・調べたいとき | 参照 | 検索か分野から項目を開き、要約とポイントだけ読む。薬は商品名でも引ける |
| 月に1回 | 記録 | 見ずに言える数の推移、段階の測定（始めと4週後） |
| 勤務先が変わるとき | 設定 | 施設プロフィール（段階＋設備スイッチ）、自施設メモ、書き出し |

## 守ること

- 患者の個別データの入力欄、体重や検査値から計算・判定する機能は作らない。
- AIはアプリに入れない。通信なしで全機能が動く。
- 学習記録・施設プロフィール・自施設メモは端末内（IndexedDB）だけ。JSONで書き出し・読み込みできる。
- 書籍の文と図はカードに写さない。書籍の頁は `public: false` の出典に置き、配布版のビルドで落とす。

## 動かす

```sh
npm install
npm run dev            # 開発
npm run build          # 自分用ビルド（dist/、Service Worker つき）
npm run build:public   # 配布版ビルド（public:false の出典を落とす）
npm run preview        # dist/ を http://localhost:4173 で配る
npm run check          # カード・練習・科の点検（下書きの空欄は警告）
npm run check:strict   # 警告も誤りにする（完成の基準の確認用）
npm test               # 単体テスト（vitest）
npm run e2e            # Playwright（ビルドして preview で確かめる）
```

## カードを書く

1. `content/templates/card.json` をコピーして `content/cards/<id>.json` に置く。
2. 公開のガイドラインから下書きし、版とCQ・頁を `sources` に書く。AIは下書きと要約まで。
3. 書籍2〜3冊で照合し、`checkedScope` に照合した範囲としていない範囲を書く。
4. 自分の言葉で書き直す。設備が要る行は `requires` と `ifMissing`（呼ぶ・送る・つなぐ）を必ず対にする。
5. `npm run check` を通し、`review.level` を上げる（REVIEW.md）。

## 参照の項目・薬を書く

1. 項目は `content/topics/<id>.json`、薬は `content/drugs/<id>.json`。形は `schema/topic.schema.json` と `schema/drug.schema.json`。
2. 要約は5行まで、ポイントは7行まで。1行は60字を目安にする。
3. 薬の用法用量は行ごとに根拠（添付文書かガイドラインか）と出典番号を書く。添付文書の出典（type `label`）を1件以上置く。
4. 体重別の量は自分で計算して `weightTable` に置き、注記に計算の前提（濃度・体重の刻み）を書く。アプリは計算しない。
5. 照合した範囲を `verification` に書き、`npm run check` を通してから `review.level` を上げる。

## 構成

```
content/        registry.json（状態・場面・設備・分野）、cards/、drills/、specialties/、topics/、drugs/、templates/
schema/         JSON Schema
scripts/        check（点検）、gen-sw（Service Worker 生成）、gen-icons
src/logic/      検索（search）、今日の想起（queue）、間隔反復（srs、差し替え可）、習熟（mastery）、施設（facility）、ダッシュボード
src/store/      IndexedDB と書き出し・読み込み
src/screens/    現場、学習、参照、記録、設定
src/theme.ts    色（ライト／ダーク）とコントラスト計算
tests/          unit（vitest）、e2e（Playwright）
```

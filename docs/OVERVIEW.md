# Aegis — プロダクト概要

> **ひとことで：AIサービスのための「自律オンコールSRE」。**
> AIサービスが*静かに壊れた*瞬間に気づいて、原因を突き止め、安全に直し、学習する——人間が起きる前に。
>
> たとえば：「プロンプトをちょっと直したら回答の根拠性が落ちて誤回答が増えた」を**数秒で検知 → 前の版に自動ロールバック → 同じ失敗を他のAIサービスにも予防接種**。

DevOps × AI Agent Hackathon 2026 提出作品 / repo: https://github.com/nvidia9875/aegis

---

## 1. 何を解決するのか

AIサービス（RAGチャット等）は、プロンプト・モデル・データを頻繁に更新する。その結果——

- **静かに品質が劣化する**：根拠性ダウン、ハルシネーション増（エラーにならないので気づけない）
- **コストが突然爆発する**：高価モデルへの誤ルート、トークン肥大
- **新種の攻撃**：ツール出力経由のプロンプトインジェクション、PII漏えい
- **普通の障害もある**：レイテンシ悪化、エラー急増、検索基盤の劣化

これらを人間がオンコールで手作業対応している。Aegisはそれを**自律で肩代わり**する。

---

## 2. どんなチェックができるのか（検知一覧）★ここが核心

Aegisは対象AIサービスの指標を常時見て、**統計的に「いつもと違う」を早期検知**し、障害を分類して対処する。

### 検知の仕組み（共通）
- **CUSUM / Wald SPRT**：ベースラインからの有意なズレを*逐次的に*検知。「たまたま」を除外し、覗き見によるp-hack無しで**早く・誤検知少なく**捉える。
- **方向性**：根拠性や検索健全性は“下がったら異常”、コストやレイテンシは“上がったら異常”を自動判定。
- **品質系（judge）**：Vertex AI Gen AI Evaluation ＋ Gemini judge で根拠性・指示遵守・安全性をスコア化（cloud-mode）。

### チェックできる障害（カテゴリ別）

| カテゴリ | チェック内容（何を防ぐ） | 見る指標 | 検知方法 | 検知したら（自動対処） | リスク階層 |
|---|---|---|---|---|---|
| **品質** | 根拠性リグレッション（回答が文書に基づかなくなる） | groundedness | SPRT/CUSUM＋Vertex Eval | プロンプト/リビジョンを前版へロールバック | L1 自動 |
| 品質 | ハルシネーション急増 | hallucination_rate | judge＋統計 | ロールバック | L1 自動 |
| 品質 | 指示逸脱（システム指示を守らない） | instruction adherence | Vertex Eval judge | ロールバック | L1 自動 |
| **安全** | PII漏えい急増 | pii_rate | regex/NER＋judge | ロールバック/該当機能OFF | L1 自動 |
| 安全 | プロンプトインジェクション（ツール出力・取得文書経由） | 挙動/trajectory | 検知ルール | 該当ツールをフラグOFF／破壊的操作は承認 | L1 / L2 |
| **コスト** | コスト爆発（$/リクエスト急騰） | cost_per_req | CUSUM | 安価モデルへフェイルオーバー／誤ルート是正 | L1 自動 |
| コスト | トークン肥大 | tokens_per_req | CUSUM | 同上 | L1 自動 |
| **性能/信頼性** | レイテンシ悪化 | latency_p95_ms | CUSUM/SPRT | スケール／ロールバック | L1 自動 |
| 性能/信頼性 | エラー率スパイク | error_rate | CUSUM | リビジョン・ロールバック | L1 自動 |
| 性能/信頼性 | 依存/プロバイダ障害 | error/latency | 統計 | 別モデル/依存へフェイルオーバー | L1 自動 |
| 性能/信頼性 | 検索基盤（ベクタ索引）劣化 | retrieval_health | SPRT | 索引再構築（重い・不可逆）→ **人間承認** | L2 承認 |

### さらに2種類の“チェック”
- **変更相関チェック（原因究明）**：直近の GitHub デプロイ／プロンプト・モデル・設定変更と相関し、「**どの変更（rev-X）が原因か**」を*証拠付き*で特定。
- **CIゲート（本番に出る前）**：PR時にオフライン評価を実行し、**品質が下がる変更はマージをブロック**（Vertex Eval）。

> **正直な現状**：demo-mode（決定論・再現可能）で注入→検知→修復まで通せるのは
> **根拠性低下 / コスト爆発 / レイテンシ / エラー率 / 検索基盤劣化** の5系統（`fault_injector/`）。
> **cloud-mode（`AEGIS_DEMO_MODE=false`）では実Geminiが原因究明（RCA）し、ADKがエージェントを駆動**（`aegis_platform/cloud/`。Vertex AI／Gemini APIどちらも可）。安全設計＝*LLMは既知アクションの選択のみ・リスク階層はpolicyが決定・失敗時はrunbookへ自動フォールバック*。さらに対象サービスを設定すれば、**`ROLLBACK_REVISION` は実Cloud RunトラフィックをAdmin APIで本当にロールバック**する（Act＝実物。失敗時は決定論twinへ自動デグレード）。
> judge系メトリクス（PII/ハルシネーション/指示遵守）とCIゲートのVertex Eval化は継続項目。

---

## 3. 検知したらどう動くか（自律ループ）

```
Detect（検知）→ Perceive（ログ/トレース収集）→ Recall（既知の抗体を想起）
→ Reason（原因究明・複雑度ルーターで安価→高性能モデルへ）
→ Act（対処）→ Verify（回復確認・MTTR記録）→ Reflect（ポストモーテム・改善）→ Immunize（艦隊に免疫付与）
```

- **対処レバー**：プロンプト/リビジョンのロールバック・モデルフェイルオーバー・スケール・フラグOFF・索引再構築。
- **Governanceゲート**：リバーシブルな対処は**自動（L0/L1）**、不可逆・高影響は**人間承認（L2）**＋blast-radius提示＋**全操作を監査ログ**。
- **Recall（即時緩和）**：過去に解決済みなら抗体で*診断を飛ばして*即対処（MTTR≈0）。

品質：**backend 87 passed / 1 skipped・カバレッジ92%（TDD）**／ruffクリーン／dashboard typecheck・build green。

---

## 4. 強み

- **“ループを閉じる”**：観測系ツール（LangSmith/Langfuse/Arize/Braintrust/Latitude等）は*観測＋手動eval*止まりで修正は人間。Aegisは**検知→診断→修復→検証→学習を自律で完遂**する。差別化は、古典インフラ指標だけでなく**AIサービス品質メトリクス（根拠性・ハルシ・PII）まで対象**にし、**Fleet Immunity**で艦隊全体に展開する点。
- **Fleet Immunity＝複利の堀**：1件の対応が艦隊全体を免疫化。価値が *#サービス×#インシデント* で増える。
- **本番に出せる自律**：不可逆操作は承認ゲート＋監査で安全。
- **デモが事故らない**：全層プロバイダ非依存（Protocol）＝demo-mode決定論的・再現可能。

---

## 5. どんなときに生きるか（ユースケース）

- **A. 社内RAG/サポートBot**：プロンプト更新で根拠性が静かに低下 → 自動検知＆ロールバック。
- **B. ツール実行エージェント**：injectionで誤操作 → ツールOFF／破壊的操作はL2承認。
- **C. 生成AI SaaS（高速デプロイ）**：CIで品質リグレッションをゲート＋コスト爆発を自動収束。
- **D. AIサービス艦隊（AI sprawl）**：Fleet Immunityで1件の対応が全社を予防接種。
- **E. 規制/高リスク（金融・医療補助AI）**：自律×安全（不可逆はGovernanceゲート）。
- **F. RAG検索基盤**：retrieval低下を検知 → 索引再構築はL2承認で安全に。

**具体ウォークスルー（デモ正本）**：① `support-rag` にプロンプト変更 → 根拠性0.92→0.55＆コスト急騰 ② 検知→直近デプロイと相関→**rollback_prompt自動修復**→抗体ab-1生成 ③ 別サービス`argus-review`が同障害 → **抗体で即時緩和（Fleet Immunity）** ④ 破損ベクタ索引 → rebuild_indexは**L2承認**。

---

## 6. 3つのコンセプトの実現

### 🛠 つくる（Google CloudのAIでエージェントを設計・実装）
- Aegis Operator を **ADKの明示ワークフロー**＋**7認知機能**で構築（ループ上限/タイムアウトで暴走抑止）。
- **Gemini**（RCA/ポストモーテム）・**Flash/Gemma**（複雑度ルーターの安価ティア）・**Vertex AI Gen AI Evaluation**（品質リグレッション検知）・**ADK/A2A/MCP**。
- Model Service・Diagnoser・ツールは**Protocol抽象**。`local`=決定論デモ／`cloud`=Gemini/ADK/Vertex/Cloud Run実アダプタの二層。

### 🔁 まわす（GitHub連携・CI/CDで継続改善）
- **GitHub Actions CI**：push/PRで backend（uv→ruff→pytest）＋ dashboard（typecheck→build）を自動チェック＝**壊れてないか確認**。
- “継続的にAIを改善”の中身：**Runbook自己改善**（内省でMTTR逓減）＋**Fleet Immunity**（解決を抗体化して再利用）。
- Operatorは**直近GitHubデプロイと相関**して原因特定、**CIゲート**でリグレッションを止める設計。

### 🚀 とどける（Cloud Runで本番品質をスケーラブルに）
- `backend/Dockerfile`＋`dashboard/Dockerfile`、`infra/deploy.sh` で **API＋ダッシュボードを Cloud Run へ**（オートスケール・$PORT対応・scale-to-zero）。
- ヘルスチェック・Secret Manager・CORS・Demo mode常時稼働で誰でも動作確認可能。修復もCloud Runのリビジョン切替で実現。

---

## 7. 検証（正しく動くかの“証明”）

主張ではなく**数値で実証**する。`fault_injector` の既知の障害を*正解(ground truth)*として注入し、実物の自律ループを回して採点する**ベンチマーク**を内蔵（`aegis_platform.bench`）。決定論・ローカル完結（GCP不要）で、CI（`pytest`）にも自動で乗る。

```bash
cd backend && uv run python -m aegis_platform.bench
```

| 指標 | 結果 | 意味 |
|---|---|---|
| 検知率(recall) | **100%** | 注入した障害をすべて検知 |
| 分類精度 | **100%** | IncidentClass を正しく特定 |
| 原因リビジョン特定 | **100%** | 障害を起こした `rev-bad` を証拠付きで指摘 |
| 自律解決率(L0/L1) | **80%** | 5件中4件を**無人**で解決（不可逆の1件のみ承認待ち） |
| 全体解決率(承認込み) | **100%** | 承認後にL2も治癒 |
| **誤操作率** | **0%** | 不可逆操作を*無断実行ゼロ*＝安全境界の証明 |
| Governanceゲート遵守(L2) | **yes** | 索引再構築は承認待ち→承認後に治癒 |
| Fleet Immunity 緩和 | **1件** | 別サービスの再発を**診断を飛ばして**抗体で治癒 |

> **検証の3層**：① TDD（87 passed / 1 skipped・カバレッジ92%＝検出器/ループ/ゲート/免疫の単体・結合）／② 上記**メタeval（本ベンチ）**＝障害注入の正解と突合／③ judge信頼性（cloud-mode：Vertex AI Gen AI Evaluation＋LLM-judge較正）。
> human-baseline MTTR比較・実Gemini RCAの採点は cloud-mode の継続項目。

---

## 8. 必須要件 / 動かす
- 必須：**Cloud Run**（実行）＋ **Gemini ＋ ADK（＋Vertex AI Gen AI Evaluation）**（AI）。任意：Firebase / Elasticsearch / BigQuery / Pub/Sub / Monitoring。
- アーキ詳細：`docs/ARCHITECTURE.md`

```bash
# 自律ループの正本デモ（決定論）
cd backend && uv run python -m aegis_platform.demo
# 証明ベンチ（障害注入→自律修復を採点）
cd backend && uv run python -m aegis_platform.bench
# control-plane API
cd backend && uv run uvicorn aegis_platform.api.app:app --reload
# Mission Control（3D可視化・Demo mode既定）
cd dashboard && pnpm install && pnpm dev
# cloud-mode（実Gemini RCA＋ADK）。Vertex: GOOGLE_CLOUD_PROJECT を指定（ADC・キー不要）
cd backend && uv sync --extra cloud && \
  AEGIS_DEMO_MODE=false GOOGLE_CLOUD_PROJECT=<proj> GOOGLE_GENAI_USE_VERTEXAI=true \
  uv run uvicorn aegis_platform.api.app:app
# または Gemini API キー方式： AEGIS_DEMO_MODE=false GEMINI_API_KEY=<key> GOOGLE_GENAI_USE_VERTEXAI=false
```

> `/api/health` の `diagnoser` フィールドで現在の稼働モードを確認できる（`RunbookDiagnoser`＝demo／`GeminiDiagnoser`・`AdkDiagnoser`＝cloud）。

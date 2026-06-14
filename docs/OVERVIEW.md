# Aegis — プロダクト概要

> **Aegis（イージス）= AIサービスのための自律SRE。**
> AIサービスが壊れた瞬間に、検知 → 原因究明 → 安全な修復 → 学習 までを*自律で*回し、
> 不可逆な操作だけ人間の承認を求め、得た知見を*艦隊全体に予防接種*する。
> ——人間が起きる前に。

DevOps × AI Agent Hackathon 2026 提出作品 / リポジトリ: https://github.com/nvidia9875/aegis

---

## 1. これは何か（概要）

AIサービス（RAGチャット等）は、プロンプト/モデル変更で*静かに品質が劣化*し、コストが爆発し、ハルシネーション・PII漏えい・プロンプトインジェクションが起きる——従来監視では捉えにくい「新種の障害」が増えている。これを人間がオンコールで手作業対応しているのが現状。

**Aegis** は、その一連を肩代わりする**自律メタ・エージェント（“エージェントのためのSRE”）**。中核は8段の自律ループ：

```
Detect → Perceive → Recall → Reason → Act → Verify → Reflect → Immunize
（検知 → 収集 → 想起 → 推論 → 実行 → 検証 → 内省 → 免疫化）
```

不確実な環境で*多段の判断とツール実行*を自律で行うため、「AIエージェントである必然性」が中核にある（単なる監視ダッシュボードではない）。

---

## 2. できること（機能）

| 機能 | 内容 | 実装 |
|---|---|---|
| **異常検知** | 品質/コスト/レイテンシ/エラー等を統計的に検知（**CUSUM＋Wald SPRT**：覗き見によるp-hack無しで早期検知） | `telemetry/` |
| **インシデント分類** | 異常 → 障害クラス＋重大度に分類（groundedness_regression / cost_explosion / dependency_outage 等） | `telemetry/incidents.py` |
| **自律RCA（原因究明）** | 直近のデプロイ/設定変更と相関し根本原因を特定。**複雑度ルーター**で安価モデル→難案件のみ高性能モデルへエスカレーション | `operator/`, `model_service/` |
| **自律修復** | リバーシブルな対処（ロールバック/スケール/フラグOFF/モデルフェイルオーバー）を自動適用、検証して回復確認、MTTR記録 | `operator/loop.py` |
| **Governanceゲート** | リスク階層 **L0/L1=自動・L2=人間承認**。不可逆/高blast-radiusは必ず承認。全操作を不変監査ログ化 | `governance/` |
| **Fleet Immunity（艦隊免疫）** | 解決済みインシデントを一般化した**抗体**にして、新サービス登録時に予防接種＋全該当サービスへ展開。同一障害は*診断を飛ばして即時緩和*（MTTR≈0） | `immunity/` |
| **Runbook自己改善** | インシデント毎に診断/対応を内省し改善（MTTR逓減）＝「まわす」 | `operator/`（Reflectionステップ） |
| **Fault Injector** | 上記障害を*決定論的に*再現（デモ/検証用） | `fault_injector/` |
| **control-plane API** | 状態取得・障害注入・承認・正本デモ実行をHTTPで提供 | `api/`（FastAPI） |
| **Mission Control** | 自律ループ・Fleet Immunity・実メトリクスを3D(WebGL)で可視化 | `dashboard/`（Next.js + R3F） |

品質: **backend 61テスト・カバレッジ~96%（TDD）**、ruffクリーン、dashboardはtypecheck/build green。

---

## 3. 強み（差別化）

- **唯一“ループを閉じる”**：既存のLLM/Agent観測ツール（LangSmith/Langfuse/Arize/Braintrust/Latitude等）は概ね *観測＋手動eval＋CIゲート*止まりで、修正は人間。Aegisは **検知→診断→修復→検証→昇格** を*自律で閉じる*（Observe→Heal）。
- **Fleet Immunity＝複利の堀**：1サービスのインシデントが艦隊全体を免疫化。価値が *#サービス×#インシデント* で複利化するデータ・ネットワーク効果。競合はper-agent/per-projectで持たない。
- **“本番に出せる自律”**：不可逆操作はGovernanceゲートで止め、blast-radius提示＋人間承認＋監査ログ。安全性を設計で担保。
- **研究裏付け**：異常検知=SPRT/CUSUM、自己改善=反射的進化(GEPA系)、評価=Vertex Gen AI Eval、記憶=Reflexion型。Agent評価サーベイの未解決課題（コスト軽視/静的データ/粗い指標/component disentanglement）に対応。
- **デモ安全＝デモが事故らない**：全体がプロバイダ非依存の抽象（Protocol）で、**demo-modeは決定論的・再現可能**。“信頼性”が売りのプロダクトとして、ライブデモが崩れない。

---

## 4. 3つのコンセプトの実現方法

### 🛠 つくる — Google CloudのAIを中核にAIエージェントを設計・実装
- **エージェント設計**：Aegis Operator を **ADK（Agent Development Kit）の明示的ワークフロー**として構築。書籍『Designing AI Agents』の**7認知機能**（Perception/Memory/Reasoning/Action/Reflection/Collaboration/Governance）に実装をマッピングし、ループ上限・タイムアウトで*unbounded looping*を抑止。
- **Google Cloud AI**：
  - **Gemini** … RCA/診断/ポストモーテム生成、**Gemini Flash/Gemma** … 複雑度ルーターの安価ティア
  - **Vertex AI Gen AI Evaluation** … 対象AIサービスの品質/根拠性リグレッション検知
  - **ADK** … エージェントのオーケストレーション、**A2A/MCP** … サービス/ツール接続
- **設計の要**：Model Service・Diagnoser・各ツールは**プロバイダ非依存のProtocol**。`AEGIS_ENV=local`（demo）では決定論的実装（FakeProvider/RunbookDiagnoser/SimulatedService）で動作し、`AEGIS_ENV=cloud` で **Gemini/ADK/Vertex/Cloud Run の実アダプタ**に差し替わる二層構成。
  > 現状：demo-modeはフル機能で動作。cloud-mode実アダプタの結線は継続項目（#11）。

### 🔁 まわす — GitHub連携 / CI/CD でAIを継続的に改善するサイクル
- **DevOpsフロー**：`/.github/workflows/ci.yml` で **GitHub Actions CI**（backend: `uv sync`→ruff→pytest、dashboard: typecheck→build）。`infra/deploy.sh` で Cloud Run へ配信。
- **“AIを継続的に改善”の中身**＝Aegis自身の学習ループ：
  1. **Runbook自己改善**：インシデント毎にReflectionで診断/対応を改善 → MTTRが逓減
  2. **Fleet Immunity**：解決を抗体化して蓄積・再利用（`immunity/`）→ 同一障害の対応が高速化・自動化
- **CI連携の思想**：Operatorは**直近のGitHubデプロイ/設定変更と相関**して原因を特定（`get_recent_deploys`）。プロンプト/モデル変更のリグレッションをCIゲートで止める設計（Vertex Eval）。
- **証明（まわす効果の実証）**：既知インシデント注入で *検知率・MTTR(自律vs人手)・自律解決率・誤操作≈0・予防件数* を計測する検証計画（`docs/ARCHITECTURE.md` / `SUBMISSION.md`）。

### 🚀 とどける — Cloud Run で本番品質をスケーラブルに届ける
- **Cloud Run デプロイ**：`backend/Dockerfile`（control-plane API）と `dashboard/Dockerfile`（Next.js standalone）を用意。`PROJECT_ID=... ./infra/deploy.sh` で **API＋ダッシュボードを Cloud Run に配信**（オートスケール、`$PORT`対応）。
- **本番品質の配慮**：ヘルスチェック、Secret Manager前提の鍵管理、CORS、初期JSは遅延ロードで軽量維持、**Mission Control は Demo mode 常時稼働**で誰でも動作確認可能。
- **修復レバーもCloud Run**：Aegisの自動修復は **Cloud Runのリビジョン切替/トラフィック**でロールバックを実現（実アダプタ＝cloud-mode）。

---

## 5. 必須要件の充足 / アーキテクチャ
- **アプリ実行(必須)**：**Cloud Run**（API・対象サービス・ダッシュボード）
- **AI技術(必須)**：**Gemini ＋ ADK（＋Vertex AI Gen AI Evaluation）**
- 任意/加点：Firebase Hosting / Elasticsearch（Incident KB）/ BigQuery / Pub/Sub / Cloud Monitoring・Logging・Trace
- 図と詳細：`docs/ARCHITECTURE.md`

## 6. 動かす（demo）
```bash
# 自律ループの正本ナラティブ（決定論的）
cd backend && uv run python -m aegis_platform.demo

# control-plane API
cd backend && uv run uvicorn aegis_platform.api.app:app --reload
#   POST /api/demo/run / POST /api/inject / POST /api/approve / GET /api/state

# Mission Control（3D可視化）
cd dashboard && pnpm install && pnpm dev   # Demo mode 既定
```

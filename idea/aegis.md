# Aegis — The Autonomous SRE that heals your AI service before you wake up

> DevOps × AI Agent Hackathon 2026 提出アイデア
> タグ: `findy_hackathon`

## ワンライナー
AIサービスが落ちた瞬間、**Aegis**がログ・トレース・直近デプロイ・品質メトリクスを自律で突き合わせて原因を特定し、**リバーシブルな修復は自動で**、**不可逆な操作は人間承認（Governanceゲート）で**実行し、ポストモーテムを書き、そのインシデントを**“抗体”として艦隊全体に予防接種（Fleet Immunity）**する——人間が起きる前に。

## 解決したい課題と背景
オンコール（夜間/休日のインシデント対応）はDevOps/SREの最大の痛み。とりわけ**AIサービス**は、プロンプト/モデル変更で*静かに品質が劣化*し、コストが爆発し、ハルシネーションやPII漏えいが起きる——従来の監視では捉えにくい新種の障害が増えている。検知・原因究明・安全な修復・再発防止の一連を、人間が叩き起こされて手作業で回しているのが現状。

## 想定ユーザー
AIサービス/エージェントを本番運用するチーム、SRE、プラットフォームエンジニア。

## プロダクトの特徴（差別化）
1. **自律自己修復ループ**: Detect→Perceive→Recall→Reason→Act→Verify→Reflect→Immunize を自律実行（不確実下の多段判断＝AIエージェントである必然性）。
2. **Governanceゲート（信頼境界）**: リバーシブルな操作（Cloud Runロールバック/スケール/フラグOFF/モデルフェイルオーバー）は自動、破壊的・高影響な操作は人間承認。全操作を監査ログ化＝“本番に出せる自律”。
3. **Fleet Immunity（横断インシデント抗体）**: 1サービスで学んだ「症状＋原因＋修復」を一般化した*抗体*として艦隊全体に展開。新サービスは登録時に予防接種され、同一failure-classは診断を飛ばして即時緩和（MTTR≈0）。価値が #サービス×#インシデント で複利化する堀。
4. **Runbook自己改善**: インシデント毎に診断/対応を反射的に改善し、MTTRが逓減（GEPA系の反射的進化）。
5. **Mission Control（ライブNOC）**: 自己修復ループと艦隊免疫を超グラフィカルに可視化。「何が起きて何を直したか」が一目。

## 監視対象（デモ題材）= AIチャット/RAG API
古典インフラ障害（不良デプロイ/レイテンシ/依存断）に加え、**AI固有障害**（品質/根拠性リグレッション・コスト爆発・ハルシネーション/PII・プロンプトインジェクション・プロバイダ障害）を扱う。

## 2分デモ
健全 → 「無害そうな」プロンプト/モデル変更で根拠性急落＋コストスパイク → Aegisが直近デプロイと相関して原因特定（実況）→ 前リビジョンへ自動ロールバックで回復（MTTR表示）→ ポストモーテム自動投稿 → 次は破壊的操作が必要でGovernanceゲート停止→人間承認 → 別サービスに同一障害→抗体で即時緩和（艦隊免疫）。

## 技術スタック（Google Cloud中核）
- 実行: **Cloud Run**（対象サービス / Aegis / Mission Control）
- AI: **Gemini** ＋ **ADK**（エージェント）＋ **Vertex AI Gen AI Evaluation**（品質リグレッション検知）＋ Gemini Flash/Gemma（複雑度ルーター）
- 観測/イベント: Cloud Monitoring・Logging・Trace(OTel) / Pub/Sub / Cloud Scheduler
- データ: BigQuery（インシデント/MTTR/コスト/監査）/ Firestore（登録簿/Runbook）
- 任意/加点: Elasticsearch（Incident KB意味検索）/ Firebase Hosting / Secret Manager
- フロント: Next.js + React Flow + framer-motion + visx

## なぜ勝てるか（審査基準）
①自律性＝ループが価値の中心 ②課題＝DevOps最大の痛点＋AI固有障害という新規性 ③ユーザビリティ＝Mission Controlで一目 ④体験＝「寝てる間に直った」＋艦隊免疫の締め ⑤実装力＝Cloud Run/ADK/Vertex/BigQueryを深く活用。

詳細な実装計画は `/Users/shun/.claude/plans/` のプランファイル、または `docs/` を参照。

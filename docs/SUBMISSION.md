# Submission — DevOps × AI Agent Hackathon 2026

## ProtoPedia fields (draft)

- **作品ステータス**: 公開
- **作品タイトル**: Aegis — AIサービスを自己修復する自律SRE
- **概要**: AIサービスが落ちた瞬間、Aegisがログ・トレース・直近デプロイ・品質メトリクスを自律で突き合わせて原因を特定し、リバーシブルな修復は自動で、不可逆な操作は人間承認（Governanceゲート）で実行し、そのインシデントを“抗体”として艦隊全体に予防接種する（Fleet Immunity）。人間が起きる前に。
- **画像**: `aegis-3d-hq-idle.png`（3Dシーン・待機）, `aegis-3d-hq-active.png`（インシデント対応中・コア赤プラズマ＋エネルギービーム＋実ループ可視化）, `aegis-hud-02-gate.png`（Governanceゲート）（three.js/R3F製。プラズマ/フレネルコア・反射床・星屑・bloom/DoF/色収差。周辺パネルも全てWebGL内で実CIデータのみ）
- **動画**: YouTube（2分／`docs/DEMO_SCRIPT.md` の台本）— *提出前に録画*
- **システム構成**: `docs/ARCHITECTURE.md` の図 + 技術補足
- **開発素材**: Python, uv, FastAPI, pytest / Google ADK, Gemini, Vertex AI Gen AI Evaluation, Cloud Run, Cloud Monitoring/Logging/Trace, Pub/Sub, BigQuery, Firestore / Next.js, TypeScript, framer-motion, Tailwind v4
- **タグ**: `findy_hackathon`, AI-Agent, SRE, DevOps, AIOps
- **ストーリー**:
  - ① 課題と背景: オンコール／インシデント対応はDevOpsの最大の痛み。とりわけAIサービスは、プロンプト/モデル変更で“静かに”品質が劣化し、コストが爆発し、ハルシネーションやPII漏えいが起きる新種の障害が増えている。
  - ② 想定ユーザー: AIサービス／エージェントを本番運用するチーム・SRE・プラットフォームエンジニア。
  - ③ プロダクトの特徴: 自律自己修復ループ（必然性）／Governanceゲート（不可逆操作は人間承認＝本番に出せる自律）／Fleet Immunity（横断インシデント抗体＝複利の堀）／Runbook自己改善（MTTR逓減）／Mission Control（ライブNOC）。

## Google Form（正式エントリーの3点）

1. GitHub（公開リポジトリ）: <this repo URL>
2. デプロイURL（動作確認可能）: Cloud Run の Mission Control URL（`infra/deploy.sh` 実行後に出力。Demo mode常時稼働）
3. ProtoPedia 作品URL: <after registering>

## 必須開発要件の充足

- アプリ実行(必須): **Cloud Run** ✓（API・対象サービス・ダッシュボード）
- AI技術(必須): **Gemini ＋ ADK（＋ Vertex AI Gen AI Evaluation）** ✓
- 任意/加点: Elasticsearch（Incident KB）, Firebase Hosting ✓

## デプロイ手順

```bash
# 1) 一度だけ: gcloud をインストールし認証
gcloud auth login
gcloud auth application-default login

# 2) デプロイ
PROJECT_ID=your-gcp-project ./infra/deploy.sh
# → 出力された Dashboard URL を提出
```

## 提出前チェックリスト

- [ ] `./infra/deploy.sh` で Cloud Run にデプロイ、URL が動作
- [ ] 2分デモ動画を YouTube にアップ
- [ ] アーキ図を画像化（`docs/ARCHITECTURE.md` ベース）
- [ ] ProtoPedia 登録（タグ `findy_hackathon`）
- [ ] Google Form 提出（GitHub / デプロイURL / ProtoPedia URL）
- [ ] backend: `uv run pytest` green / dashboard: `pnpm build` green

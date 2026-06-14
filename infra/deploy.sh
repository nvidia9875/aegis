#!/usr/bin/env bash
# Deploy Aegis to Cloud Run. Prereqs: `gcloud auth login` and a billing-enabled project.
#
#   PROJECT_ID=your-project ./infra/deploy.sh
#
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID=your-gcp-project}"
REGION="${REGION:-asia-northeast1}"

echo "▸ project=$PROJECT_ID region=$REGION"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "▸ enabling APIs…"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com >/dev/null

echo "▸ deploying control-plane API (demo mode)…"
gcloud run deploy aegis-api \
  --source backend \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi
API_URL=$(gcloud run services describe aegis-api --region "$REGION" --format='value(status.url)')

echo "▸ deploying Mission Control dashboard…"
# Dashboard works fully in self-contained Demo mode. To enable Live mode against the
# API, rebuild with: --set-build-env-vars NEXT_PUBLIC_AEGIS_API="$API_URL"
gcloud run deploy aegis-dashboard \
  --source dashboard \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi

DASH_URL=$(gcloud run services describe aegis-dashboard --region "$REGION" --format='value(status.url)')

echo ""
echo "✅ deployed"
echo "   API:       $API_URL"
echo "   Dashboard: $DASH_URL   ← submit this URL"

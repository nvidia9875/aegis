#!/usr/bin/env bash
# Deploy Aegis to Cloud Run. Prereqs: `gcloud auth login` and a billing-enabled project.
#
#   PROJECT_ID=your-project ./infra/deploy.sh                 # deterministic demo mode (default)
#   PROJECT_ID=your-project AEGIS_DEMO_MODE=false ./infra/deploy.sh   # live Gemini + ADK (Vertex)
#
# Cloud mode uses Vertex AI via the Cloud Run service account (no API key needed) — grant it
# roles/aiplatform.user. Demo mode is deterministic, free, and never calls Gemini.
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID=your-gcp-project}"
REGION="${REGION:-asia-northeast1}"
AEGIS_DEMO_MODE="${AEGIS_DEMO_MODE:-true}"
MAX_INSTANCES="${MAX_INSTANCES:-3}"

echo "▸ project=$PROJECT_ID region=$REGION demo_mode=$AEGIS_DEMO_MODE"
gcloud config set project "$PROJECT_ID" >/dev/null
PNUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

echo "▸ enabling APIs…"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  aiplatform.googleapis.com >/dev/null

# Least-privilege runtime service account (only Vertex AI, never Editor).
RUN_SA="aegis-run@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$RUN_SA" >/dev/null 2>&1; then
  echo "▸ creating runtime service account $RUN_SA …"
  gcloud iam service-accounts create aegis-run \
    --display-name="Aegis Cloud Run runtime (least privilege)" >/dev/null
fi
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA}" --role="roles/aiplatform.user" >/dev/null

# Vertex location for Gemini/ADK (GOOGLE_CLOUD_LOCATION is what ADK reads).
VERTEX_LOCATION="${VERTEX_LOCATION:-$REGION}"
# Predictable dashboard origin → CORS allowlist (no wildcard).
DASH_ORIGIN="https://aegis-dashboard-${PNUM}.${REGION}.run.app"

# Runtime config — cloud mode drives Gemini RCA through Vertex AI (ADC, key-less).
API_ENV="AEGIS_DEMO_MODE=${AEGIS_DEMO_MODE},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
API_ENV="${API_ENV},GOOGLE_CLOUD_REGION=${VERTEX_LOCATION},GOOGLE_CLOUD_LOCATION=${VERTEX_LOCATION}"
API_ENV="${API_ENV},GOOGLE_GENAI_USE_VERTEXAI=true,AEGIS_ALLOWED_ORIGINS=${DASH_ORIGIN}"

echo "▸ deploying control-plane API…"
gcloud run deploy aegis-api \
  --source backend \
  --region "$REGION" \
  --allow-unauthenticated \
  --service-account "$RUN_SA" \
  --max-instances "$MAX_INSTANCES" \
  --port 8080 \
  --memory 1Gi \
  --set-env-vars "$API_ENV"
API_URL=$(gcloud run services describe aegis-api --region "$REGION" --format='value(status.url)')

echo "▸ deploying Mission Control dashboard…"
# Bake the API URL so the dashboard's Live mode can hit the control plane.
gcloud run deploy aegis-dashboard \
  --source dashboard \
  --region "$REGION" \
  --allow-unauthenticated \
  --service-account "$RUN_SA" \
  --max-instances "$MAX_INSTANCES" \
  --port 8080 \
  --memory 512Mi \
  --set-build-env-vars "NEXT_PUBLIC_AEGIS_API=${API_URL}"

DASH_URL=$(gcloud run services describe aegis-dashboard --region "$REGION" --format='value(status.url)')

echo ""
echo "✅ deployed"
echo "   API:       $API_URL"
echo "   Dashboard: $DASH_URL   ← submit this URL"

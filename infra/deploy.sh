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

echo "▸ project=$PROJECT_ID region=$REGION demo_mode=$AEGIS_DEMO_MODE"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "▸ enabling APIs…"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com >/dev/null

# Vertex location for Gemini/ADK (GOOGLE_CLOUD_LOCATION is what ADK reads).
VERTEX_LOCATION="${VERTEX_LOCATION:-$REGION}"

# Runtime config — cloud mode drives Gemini RCA through Vertex AI (ADC, key-less).
API_ENV="AEGIS_DEMO_MODE=${AEGIS_DEMO_MODE},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
API_ENV="${API_ENV},GOOGLE_CLOUD_REGION=${VERTEX_LOCATION},GOOGLE_CLOUD_LOCATION=${VERTEX_LOCATION}"
API_ENV="${API_ENV},GOOGLE_GENAI_USE_VERTEXAI=true"

echo "▸ deploying control-plane API…"
gcloud run deploy aegis-api \
  --source backend \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --set-env-vars "$API_ENV"
API_URL=$(gcloud run services describe aegis-api --region "$REGION" --format='value(status.url)')

# Cloud mode: grant the Cloud Run runtime service account access to Vertex AI.
if [ "$AEGIS_DEMO_MODE" = "false" ]; then
  SA=$(gcloud run services describe aegis-api --region "$REGION" \
    --format='value(spec.template.spec.serviceAccountName)')
  if [ -z "$SA" ]; then
    PNUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
    SA="${PNUM}-compute@developer.gserviceaccount.com"
  fi
  echo "▸ granting roles/aiplatform.user to $SA …"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA}" --role="roles/aiplatform.user" >/dev/null
fi

echo "▸ deploying Mission Control dashboard…"
# Bake the API URL so the dashboard's Live mode can hit the control plane.
gcloud run deploy aegis-dashboard \
  --source dashboard \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --set-build-env-vars "NEXT_PUBLIC_AEGIS_API=${API_URL}"

DASH_URL=$(gcloud run services describe aegis-dashboard --region "$REGION" --format='value(status.url)')

echo ""
echo "✅ deployed"
echo "   API:       $API_URL"
echo "   Dashboard: $DASH_URL   ← submit this URL"

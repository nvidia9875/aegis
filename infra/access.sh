#!/usr/bin/env bash
# Toggle Cloud Run access between private (IAP, allowlisted Google accounts) and public.
#
#   ./infra/access.sh public     # open to everyone (judging day)
#   ./infra/access.sh private     # IAP-only, allowlisted Google accounts (development)
#
# One-time prerequisite for private mode (already done, console only on no-org projects):
#   - OAuth consent screen (Branding) configured
#   - a Custom OAuth client created and attached to each service's IAP settings
#   - grant access:  gcloud beta iap web add-iam-policy-binding --resource-type=cloud-run \
#       --region=REGION --service=SVC --member=user:EMAIL --role=roles/iap.httpsResourceAccessor
set -euo pipefail

MODE="${1:?usage: access.sh public|private}"
PROJECT_ID="${PROJECT_ID:-devops-hackathon-499407}"
REGION="${REGION:-us-central1}"
SERVICES=("aegis-api" "aegis-dashboard")

for SVC in "${SERVICES[@]}"; do
  case "$MODE" in
    public)
      echo "▸ $SVC → PUBLIC (no IAP, allUsers)"
      gcloud beta run services update "$SVC" --region="$REGION" --project="$PROJECT_ID" --no-iap
      gcloud run services add-iam-policy-binding "$SVC" --region="$REGION" --project="$PROJECT_ID" \
        --member=allUsers --role=roles/run.invoker >/dev/null
      ;;
    private)
      echo "▸ $SVC → PRIVATE (IAP, allowlist only)"
      gcloud run services remove-iam-policy-binding "$SVC" --region="$REGION" --project="$PROJECT_ID" \
        --member=allUsers --role=roles/run.invoker >/dev/null 2>&1 || true
      gcloud beta run services update "$SVC" --region="$REGION" --project="$PROJECT_ID" --iap
      ;;
    *)
      echo "usage: access.sh public|private" >&2; exit 1 ;;
  esac
done

echo "✅ access mode: $MODE"

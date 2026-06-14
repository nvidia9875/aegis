# Aegis control-plane API — deployable to Cloud Run.
# Ships with the lightweight `cloud` extra (Gemini + ADK) so cloud mode is one env flip
# away (AEGIS_DEMO_MODE=false). Demo mode is the default and never touches Google Cloud.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1

COPY pyproject.toml ./
COPY uv.lock* ./
COPY src ./src

RUN uv sync --no-dev --extra cloud

EXPOSE 8080
# Cloud Run injects $PORT (default 8080). Shell form so it expands.
CMD uv run uvicorn aegis_platform.api.app:app --host 0.0.0.0 --port ${PORT:-8080}

# Aegis control-plane API — deployable to Cloud Run.
# Runs in demo mode by default (no GCP deps needed); add `--extra gcp` for cloud mode.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1

COPY pyproject.toml ./
COPY uv.lock* ./
COPY src ./src

RUN uv sync --no-dev

EXPOSE 8080
# Cloud Run injects $PORT (default 8080). Shell form so it expands.
CMD uv run uvicorn aegis_platform.api.app:app --host 0.0.0.0 --port ${PORT:-8080}

# Cloud Run image (A10). Build context = backend/. Keyless ADC at runtime (no creds baked in).
FROM python:3.12-slim

# uv (pinned binary from the official image).
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# Install runtime deps only (no dev group) against the lockfile for reproducibility.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app

# Cloud Run provides $PORT (defaults to 8080 locally).
CMD ["sh", "-c", "uv run --no-dev uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

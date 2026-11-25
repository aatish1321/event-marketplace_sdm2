FROM python:3-slim

WORKDIR /app

ENV UV_LINK_MODE=copy
# Install uv
RUN pip install uv

# Copy backend code
COPY . .

# Install dependencies
RUN uv sync --locked

# Expose port 8000
EXPOSE 8000

# Run Django behind Render's HTTPS proxy.
CMD ["sh", "-c", "uv run --no-sync gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 1"]

FROM python:3-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy backend code
COPY . .

# Install dependencies
RUN uv sync

# Expose port 8000
EXPOSE 8000

# Run Django development server
CMD ["uv", "run", "manage.py", "runserver", "0.0.0.0:8000"]

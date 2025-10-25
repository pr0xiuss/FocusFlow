#frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY FocusFlow/package*.json ./
RUN npm install

COPY FocusFlow/ ./
RUN npm run build

#backend
FROM python:3.12-slim AS backend-build

WORKDIR /app/backend

#dependencies for mysqlclient and building packages
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

#react build into jango static folder
COPY --from=frontend-build /app/frontend/dist ./static/frontend

#environment variables for jango
ENV DJANGO_SETTINGS_MODULE=config.settings
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# Deployment Guide

This guide covers deploying the Quantum Circuit Debugger to production. Choose the approach that best fits your infrastructure.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Option 1 — Railway (Easiest)](#option-1--railway)
4. [Option 2 — Render](#option-2--render)
5. [Option 3 — AWS EC2 / Any VPS](#option-3--aws-ec2--any-vps)
6. [Option 4 — Docker on DigitalOcean / Linode](#option-4--docker-on-digitalocean--linode)
7. [Production Dockerfiles](#production-dockerfiles)
8. [Domain & HTTPS](#domain--https)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Docker** & **Docker Compose** installed (for containerised deployment).
- **Node.js 22+** and **Python 3.9+** (for manual deployment).
- A domain name (optional but recommended for HTTPS).
- A Git remote (GitHub / GitLab) with the project pushed.

---

## Environment Configuration

Before deploying, you need to update the backend API URL used by the frontend.

### Step 1: Make the API URL configurable

In `frontend/utils/api.ts`, change the hardcoded URL:

```diff
- const API_URL = 'http://localhost:8000';
+ const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

### Step 2: Set the environment variable

When deploying, set `NEXT_PUBLIC_API_URL` to your backend's public URL:

```bash
# Example for a Railway/Render deployment
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

> **Note:** Next.js requires `NEXT_PUBLIC_` prefix for client-side environment variables.

### Step 3: Update docker-compose.yml for production

Create a `docker-compose.prod.yml`:

```yaml
services:
  backend:
    container_name: quantum-backend
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
    restart: always

  frontend:
    container_name: quantum-frontend
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        - NEXT_PUBLIC_API_URL=https://your-backend-domain.com
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: always
```

---

## Option 1 — Railway

[Railway](https://railway.app) is the easiest way to deploy full-stack Docker apps.

### Steps

1. **Push to GitHub** (if not already):
   ```bash
   git add -A && git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Create a Railway project**:
   - Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo.
   - Select your repository.

3. **Add the Backend service**:
   - Click **+ New Service** → **Docker** → set Root Directory to `backend`.
   - Railway auto-detects the Dockerfile.
   - Set port variable: `PORT=8000`.
   - Click **Deploy**.

4. **Add the Frontend service**:
   - Click **+ New Service** → **Docker** → set Root Directory to `frontend`.
   - Add environment variable:
     ```
     NEXT_PUBLIC_API_URL=https://<backend-service>.up.railway.app
     ```
   - Click **Deploy**.

5. **Generate domains**:
   - In each service's **Settings** → **Networking** → **Generate Domain**.
   - The frontend domain is your app's public URL.

### Cost
- Railway's free tier includes $5/month credit (sufficient for demos).
- Pro plan: $5/month + usage.

---

## Option 2 — Render

[Render](https://render.com) offers free-tier hosting for web services.

### Backend (Web Service)

1. Go to Render Dashboard → **New** → **Web Service**.
2. Connect your GitHub repo.
3. Configure:
   - **Name**: `quantum-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Port**: `8000`
4. Click **Create Web Service**.

### Frontend (Web Service)

1. **New** → **Web Service**.
2. Configure:
   - **Name**: `quantum-frontend`
   - **Root Directory**: `frontend`
   - **Runtime**: Docker
   - **Environment Variable**:
     ```
     NEXT_PUBLIC_API_URL=https://quantum-backend.onrender.com
     ```
3. Click **Create Web Service**.

### Cost
- Free tier: 750 hours/month (sleeps after 15 min inactivity).
- Starter plan: $7/month per service.

---

## Option 3 — AWS EC2 / Any VPS

For full control, deploy on a Linux server.

### 1. Provision a server

- **AWS EC2**: Ubuntu 22.04, `t2.medium` or larger (4GB RAM recommended for Qiskit).
- **DigitalOcean / Linode / Hetzner**: Any VPS with 4GB+ RAM.

### 2. Install Docker

```bash
# SSH into your server
ssh ubuntu@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Clone and deploy

```bash
git clone https://github.com/your-username/quantum-circuit-debugger.git
cd quantum-circuit-debugger

# Update API URL for your domain
export NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Start in production mode
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Set up Nginx reverse proxy

```bash
sudo apt install nginx -y
```

Create `/etc/nginx/sites-available/quantum`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/quantum /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Add HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

Certbot auto-renews certificates every 90 days.

---

## Option 4 — Docker on DigitalOcean / Linode

Use the Docker compose setup directly on a cloud VPS.

### One-Line Deploy

```bash
# After SSHing into your VPS
git clone https://github.com/your-username/quantum-circuit-debugger.git
cd quantum-circuit-debugger
docker compose up -d --build
```

This starts:
- Backend on port `8000`
- Frontend on port `3000`

Then configure a reverse proxy (Nginx/Caddy) and HTTPS as described in Option 3.

---

## Production Dockerfiles

For production, create optimised Dockerfiles:

### `backend/Dockerfile.prod`

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .

RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Use multiple workers for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### `frontend/Dockerfile.prod`

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Accept build-time API URL
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
```

---

## Domain & HTTPS

### Using Caddy (Alternative to Nginx)

Caddy auto-obtains HTTPS certificates. Create a `Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:8000
}
```

Run Caddy:
```bash
sudo apt install caddy -y
sudo caddy start
```

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| CORS errors in browser | Ensure backend CORS allows your frontend domain in `main.py` |
| Frontend can't reach backend | Verify `NEXT_PUBLIC_API_URL` is set correctly (use HTTPS in production) |
| Docker build fails (memory) | Ensure at least 4GB RAM on host (Qiskit + texlive need space) |
| Render/Railway timeout | Free tiers have cold starts; upgrade for always-on services |
| LaTeX export fails | Ensure `texlive` packages are installed in the backend Docker image |

### CORS Configuration

If deploying frontend and backend on different domains, update `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://yourdomain.com",  # Add your production domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Quick Reference

| What | Command |
|------|---------|
| Local dev (Docker) | `docker-compose up --build` |
| Production (Docker) | `docker compose -f docker-compose.prod.yml up -d --build` |
| Rebuild single service | `docker compose up --build -d backend` |
| View logs | `docker logs quantum-backend -f` |
| Stop all | `docker compose down` |

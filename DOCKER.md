# goHR Docker Setup

## Quick Start

```bash
docker compose up --build
```

Then open **http://localhost:9173/**

## Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 9173 | Nginx serves built SPA + proxies /api, /auth |
| backend | 8080 | Node.js auth server (SQLite) |

## Login Credentials

| Role | Login ID | Password |
|------|----------|----------|
| Admin | ADM-001 | Admin123 |
| Manager | MGR-001 | manager123 |
| Employee | EMP-001 | employee123 |
| Vendor | VND-001 | vendor123 |

## Useful Commands

```bash
# Build and start
docker compose up --build

# Start in background
docker compose up -d --build

# Stop
docker compose down

# View logs
docker compose logs -f

# Stop and remove data (clean start)
docker compose down -v
```
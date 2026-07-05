<div align="center">

<img src="web/src/assets/app.svg" width="88" alt="CollabReef" />

# CollabReef

An open-source, self-hosted collaborative workspace that brings notes, whiteboards, spreadsheets, kanban, calendars, and maps into one place — with real-time co-editing powered by Y.js.

**English** · [繁體中文](./README.zh-TW.md)

</div>

## Features

### Collaborative views
- **Notes** — rich-text notes with real-time co-editing powered by Y.js
- **Whiteboard** — multi-layer canvas with freehand drawing, shapes, text, sticky notes, and connector edges
- **Spreadsheet** — collaborative spreadsheet with formulas, cell styling, merging, and frozen rows/columns
- **Kanban board** — drag-and-drop task management with customizable columns
- **Calendar** — event scheduling with date ranges, timed events, and all-day support
- **Map** — geographic markers with location pinning

### Rich text editor
- **Slash commands** — quickly insert content blocks with the `/` menu
- **Embeds** — YouTube, Instagram, TikTok, Threads
- **Media** — images, videos, attachments, carousels
- **Blocks** — sub-pages, inline view previews, location, calendar event, rating, tags

### Sharing & access control
- **Public sharing** — share notes and views via public links
- **Explore page** — browse publicly shared notes
- **Visibility levels** — per-resource access control: private, workspace, or public

### Workspace & user management
- **Multiple workspaces** — organize content by project or topic
- **Member roles** — owner, admin, and member role assignments
- **Member invitations** — invite members by email
- **Admin panel** — manage users, reset passwords, disable or delete accounts

### Developer & power user
- **File management** — upload, rename, download, and delete files with S3/MinIO support
- **API keys** — create and manage API keys with expiry support
- **Fully self-hosted** — full data ownership, SQLite or PostgreSQL
- **Docker ready** — deploy in minutes with Docker Compose

## Architecture

CollabReef runs as three services behind an Nginx reverse proxy:

| Service | Role |
|---|---|
| **api** | Go backend serving the REST API, auth, storage, and gRPC document access |
| **collab** | Node.js real-time collaboration server (Hocuspocus + Y.js) for live co-editing |
| **nginx** | Reverse proxy routing traffic and serving the built web frontend |

## Tech stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS, TipTap, Y.js / Hocuspocus, Zustand, TanStack Query, React Router, Radix UI, React Flow, Fortune Sheet, Leaflet, i18next
- **Backend** — Go, Echo, GORM, gRPC, JWT, goldmark, MinIO client
- **Collab server** — Node.js, Hocuspocus, Y.js, gRPC
- **Storage & database** — SQLite or PostgreSQL, local filesystem or S3/MinIO
- **Infrastructure** — Docker, Docker Compose, Nginx

## Installation

### Docker Compose (recommended)

```yaml
services:
  api:
    image: ti777777/collabreef
    container_name: collabreef-api
    command: ["./api"]
    volumes:
      - collabreef_data:/usr/local/app/bin
    environment:
      PORT: 8080
      DB_DRIVER: sqlite3
      DB_DSN: /usr/local/app/bin/collabreef.db
      # APP_SECRET: your-secret-key
      # APP_DISABLE_SIGNUP: true
    restart: unless-stopped

  collab:
    image: ti777777/collabreef
    container_name: collabreef-collab
    command: ["node", "collab/src/index.js"]
    environment:
      PORT: 3000
      GRPC_ADDR: collabreef-api:50051
      # APP_SECRET: your-secret-key
    depends_on:
      - api
    restart: unless-stopped

  nginx:
    image: ti777777/collabreef-nginx
    container_name: collabreef-nginx
    ports:
      - "80:80"
    depends_on:
      - api
      - collab
    restart: unless-stopped

volumes:
  collabreef_data:
    driver: local
```

```bash
docker compose up -d
```

The app will be available at `http://localhost`.

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `APP_SECRET` | Secret key for signing tokens | — |
| `APP_DISABLE_SIGNUP` | Disable public registration | `false` |
| `DB_DRIVER` | Database driver (`sqlite3` or `postgres`) | `sqlite3` |
| `DB_DSN` | Database connection string | — |
| `STORAGE_TYPE` | Storage backend (local or `s3`) | local |
| `STORAGE_S3_ENDPOINT` | S3/MinIO endpoint | — |
| `STORAGE_S3_ACCESS_KEY` | S3/MinIO access key | — |
| `STORAGE_S3_SECRET_KEY` | S3/MinIO secret key | — |
| `STORAGE_S3_BUCKET` | S3/MinIO bucket name | — |

See [`.env.example`](./.env.example) for the full list.

## Development

Run each service in its own terminal.

```bash
# Backend API (Go)
cd api && go run ./cmd/api

# Collab server (Node.js)
cd collab && npm install && npm start

# Web frontend (Vite)
cd web && npm install && npm run dev
```

Copy `.env.example` to `.env` and adjust as needed before starting.

## Contributing

Contributions are welcome! Fork the repo, create a feature branch, and open a pull request.

## License

CollabReef is licensed under the **MIT License**.

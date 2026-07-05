<div align="center">

<img src="web/src/assets/app.svg" width="88" alt="CollabReef" />

# CollabReef

An open-source, self-hosted collaborative workspace that brings notes, whiteboards, spreadsheets, kanban, calendars, and maps into one place — with real-time co-editing.

**English** · [繁體中文](./README.zh-TW.md)

</div>

## Features

- **Notes** — rich-text notes with real-time co-editing, slash commands, embeds, and media
- **Whiteboard** — freehand drawing, shapes, text, sticky notes, and connectors
- **Spreadsheet** — collaborative spreadsheet with formulas, styling, and merging
- **Kanban** — drag-and-drop task management
- **Calendar** — event scheduling with timed and all-day events
- **Map** — geographic markers and location pinning
- **Sharing** — public links, an explore page, and per-resource visibility control
- **Workspaces** — multiple workspaces, member roles, invitations, and an admin panel
- **Self-hosted** — full data ownership, SQLite or PostgreSQL, S3/MinIO file storage, API keys

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

The app will be available at `http://localhost`. See [`.env.example`](./.env.example) for the full list of configuration options.

## Development

Run each service in its own terminal:

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

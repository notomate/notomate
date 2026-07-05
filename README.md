<div align="center">

<img src="web/src/assets/app.svg" width="88" alt="CollabReef" />

# CollabReef

A simple, self-hosted, all-in-one note-taking app.

**English** · [繁體中文](./README.zh-TW.md)

</div>

Write anything, anywhere — memos, journals, work notes, checklists, or a blog. The block-based editor supports rich text, media, embeds, and more, so you can capture complete notes in one place. Fully self-hosted, so your data stays yours.

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

The app will be available at `http://localhost`. See [`.env.example`](./.env.example) for configuration options.

## Contributing

Contributions are welcome! Fork the repo, create a feature branch, and open a pull request.

## License

CollabReef is licensed under the **MIT License**.

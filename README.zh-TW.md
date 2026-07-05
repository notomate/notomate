<div align="center">

<img src="web/src/assets/app.svg" width="88" alt="CollabReef" />

# CollabReef

一個簡單、可自行架設、功能完整的筆記軟體。

[English](./README.md) · **繁體中文**

</div>

隨手記下任何內容 — memos、日記、工作筆記、checklist 或部落格。以區塊（block）為基礎的編輯器支援富文本、媒體、嵌入等多種內容，讓你在同一處寫下完整的筆記。完全自行架設，資料始終屬於你自己。

## 安裝

### Docker Compose（推薦）

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

啟動後即可於 `http://localhost` 存取應用程式。設定選項請參閱 [`.env.example`](./.env.example)。

## 貢獻

歡迎貢獻！Fork 此專案、建立功能分支，然後發起 Pull Request。

## 授權

CollabReef 採用 **MIT 授權條款**。

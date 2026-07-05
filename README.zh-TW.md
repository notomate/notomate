<div align="center">

<img src="web/src/assets/app.svg" width="88" alt="CollabReef" />

# CollabReef

一個開源、可自行架設的協作工作空間，將筆記、白板、試算表、看板、行事曆與地圖整合於一處，並支援即時共同編輯。

[English](./README.md) · **繁體中文**

</div>

## 功能

- **筆記** — 富文本筆記，支援即時共同編輯、斜線指令、嵌入與媒體
- **白板** — 手繪、形狀、文字、便利貼與連接線
- **試算表** — 協作試算表，支援公式、樣式與合併
- **看板** — 拖曳式任務管理
- **行事曆** — 事件排程，支援定時與全天事件
- **地圖** — 地理標記與位置釘選
- **分享** — 公開連結、探索頁面，以及每個資源獨立的可見性控制
- **工作區** — 多工作區、成員角色、邀請與管理員面板
- **自行架設** — 完整資料主權，支援 SQLite 或 PostgreSQL、S3/MinIO 檔案儲存、API 金鑰

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

啟動後即可於 `http://localhost` 存取應用程式。完整設定選項請參閱 [`.env.example`](./.env.example)。

## 開發

請在各自的終端機中執行每個服務：

```bash
# 後端 API（Go）
cd api && go run ./cmd/api

# 協作伺服器（Node.js）
cd collab && npm install && npm start

# 前端（Vite）
cd web && npm install && npm run dev
```

啟動前請將 `.env.example` 複製為 `.env` 並依需求調整。

## 貢獻

歡迎貢獻！Fork 此專案、建立功能分支，然後發起 Pull Request。

## 授權

CollabReef 採用 **MIT 授權條款**。

<div align="center">

<img src="web/src/assets/app.svg" width="88" alt="CollabReef" />

# CollabReef

一個開源、可自行架設的協作工作空間，將筆記、白板、試算表、看板、行事曆與地圖整合於一處，並由 Y.js 驅動即時共同編輯。

[English](./README.md) · **繁體中文**

</div>

## 功能

### 協作視圖
- **筆記** — 富文本筆記，支援由 Y.js 驅動的即時共同編輯
- **白板** — 多圖層畫布，支援手繪、形狀、文字、便利貼與連接線
- **試算表** — 協作試算表，支援公式、儲存格樣式、合併與凍結列/欄
- **看板** — 拖曳式任務管理，可自訂欄位
- **行事曆** — 事件排程，支援日期範圍、定時事件與全天事件
- **地圖** — 地理標記與位置釘選

### 富文本編輯器
- **斜線指令** — 使用 `/` 選單快速插入內容區塊
- **嵌入** — YouTube、Instagram、TikTok、Threads
- **媒體** — 圖片、影片、附件、輪播
- **區塊** — 子頁面、內嵌視圖預覽、位置、行事曆事件、評分、標籤

### 分享與存取控制
- **公開分享** — 透過公開連結分享筆記與視圖
- **探索頁面** — 瀏覽公開分享的筆記
- **可見性層級** — 每個資源獨立設定：私人、工作區或公開

### 工作區與使用者管理
- **多工作區** — 依專案或主題組織內容
- **成員角色** — 擁有者、管理員與成員角色分配
- **成員邀請** — 透過 Email 邀請成員
- **管理員面板** — 管理使用者、重設密碼、停用或刪除帳號

### 開發者與進階使用者
- **檔案管理** — 上傳、重新命名、下載與刪除檔案，支援 S3/MinIO
- **API 金鑰** — 建立與管理具有到期日支援的 API 金鑰
- **完全自行架設** — 完整資料主權，支援 SQLite 或 PostgreSQL
- **Docker 就緒** — 使用 Docker Compose 幾分鐘內完成部署

## 架構

CollabReef 由三個服務組成，並置於 Nginx 反向代理之後：

| 服務 | 角色 |
|---|---|
| **api** | Go 後端，提供 REST API、認證、儲存與 gRPC 文件存取 |
| **collab** | Node.js 即時協作伺服器（Hocuspocus + Y.js），負責即時共同編輯 |
| **nginx** | 反向代理，負責流量路由並提供建置後的前端 |

## 技術棧

- **前端** — React 19、TypeScript、Vite、Tailwind CSS、TipTap、Y.js / Hocuspocus、Zustand、TanStack Query、React Router、Radix UI、React Flow、Fortune Sheet、Leaflet、i18next
- **後端** — Go、Echo、GORM、gRPC、JWT、goldmark、MinIO client
- **協作伺服器** — Node.js、Hocuspocus、Y.js、gRPC
- **儲存與資料庫** — SQLite 或 PostgreSQL、本機檔案系統或 S3/MinIO
- **基礎設施** — Docker、Docker Compose、Nginx

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

啟動後即可於 `http://localhost` 存取應用程式。

### 環境變數

| 變數 | 說明 | 預設值 |
|---|---|---|
| `APP_SECRET` | 用於簽署 Token 的金鑰 | — |
| `APP_DISABLE_SIGNUP` | 停用公開註冊 | `false` |
| `DB_DRIVER` | 資料庫驅動（`sqlite3` 或 `postgres`） | `sqlite3` |
| `DB_DSN` | 資料庫連線字串 | — |
| `STORAGE_TYPE` | 儲存後端（本機或 `s3`） | 本機 |
| `STORAGE_S3_ENDPOINT` | S3/MinIO 端點 | — |
| `STORAGE_S3_ACCESS_KEY` | S3/MinIO 存取金鑰 | — |
| `STORAGE_S3_SECRET_KEY` | S3/MinIO 私密金鑰 | — |
| `STORAGE_S3_BUCKET` | S3/MinIO Bucket 名稱 | — |

完整清單請參閱 [`.env.example`](./.env.example)。

## 開發

請在各自的終端機中執行每個服務。

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

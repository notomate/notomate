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

## 工作流(Beta)

CollabReef 內建類似 Gitea Actions 的自動化系統。工作流以 workspace 為範圍(側邊欄的「工作流」頁面),使用與 GitHub Actions 相容的 YAML 定義,由獨立的 runner 服務透過 [act](https://github.com/nektos/act) 在 Docker 容器中執行每個 job。

支援的觸發方式:

- `note` — workspace 內筆記 `created` / `updated` / `deleted` 事件(更新事件會去抖動)
- `schedule` — 標準五欄位 cron 排程
- `workflow_dispatch` — 手動觸發,可帶輸入參數

```yaml
name: Notify on note changes
on:
  note:
    types: [created, updated]
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:
    inputs:
      message:
        default: "hello"
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "event=$CB_EVENT_NAME workspace=$CB_WORKSPACE_ID note=$CB_NOTE_ID"
          cat "$GITHUB_EVENT_PATH"   # 完整事件內容(JSON)
```

Job 可透過 `$GITHUB_EVENT_PATH` 讀取事件內容,並有 `CB_EVENT_NAME`、`CB_WORKSPACE_ID`、`CB_NOTE_ID`、`CB_RUN_ID`、`CB_RUN_NUMBER` 等環境變數。

### 啟用 Runner

Runner 為選用服務。為 api 與 runner 設定相同的 `RUNNER_REGISTRATION_TOKEN`(參閱 `.env.example`),並加入 runner 容器(需掛載 Docker socket):

```yaml
  runner:
    image: ti777777/collabreef-runner
    container_name: collabreef-runner
    environment:
      CB_INSTANCE_ADDR: collabreef-api:50051
      CB_RUNNER_REGISTRATION_TOKEN: your-registration-token
      CB_RUNNER_LABELS: ubuntu-latest:docker://node:20-bullseye
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - collabreef_runner_data:/data
    depends_on:
      - api
    restart: unless-stopped
```

站台管理員可在 workspace 設定頁查看已註冊的 runner 與註冊 token。

**安全性注意事項**

- 工作流會在 runner 主機的 Docker daemon 上執行任意指令。僅 workspace 擁有者/管理員可建立或編輯工作流,runner 主機屬於你的信任邊界。
- 請勿在工作流 YAML 中放入機密 — 定義對所有 workspace 成員可見。若 job 需要呼叫 CollabReef API,請使用 API key,並注意會修改筆記的工作流可能自我觸發(每個工作流每分鐘 30 次執行的上限為保險機制)。
- gRPC 連接埠(50051)請保留在內部網路;runner 協定有 token 驗證但無 TLS。

## 貢獻

歡迎貢獻!Fork 此專案、建立功能分支，然後發起 Pull Request。

## 授權

CollabReef 採用 **MIT 授權條款**。

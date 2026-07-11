# 工作流範例

這裡是幾個可以直接複製貼上到 workspace「工作流」頁面的範例,示範最常見的
用法:定期抓取外部資料,再透過 Notomate HTTP API 把結果寫成筆記。

| 檔案 | 觸發方式 | 說明 |
| --- | --- | --- |
| [`scheduled-note.yml`](./scheduled-note.yml) | `schedule` / `workflow_dispatch` | 最小範本:不抓外部資料,單純示範定期在同一個 workspace 建立一則新筆記(例如每日日誌),並用標題去重避免手動重跑造成重複。 |
| [`manual-note-from-input.yml`](./manual-note-from-input.yml) | `workflow_dispatch` | 沒有排程,純手動觸發:填入 `title`/`content` 兩個輸入欄位,就用該內容建立一則筆記;示範如何用 `github.event.inputs` 讀取 `workflow_dispatch` 的輸入。 |
| [`rss-to-notes.yml`](./rss-to-notes.yml) | `schedule` / `workflow_dispatch` | 訂閱一個 RSS feed,每篇新文章各自建立一則筆記,並用內容全文搜尋做去重。 |
| [`hacker-news-digest.yml`](./hacker-news-digest.yml) | `schedule` / `workflow_dispatch` | 每天彙整 Hacker News 熱門文章成單一摘要筆記,示範純 JSON API(不需金鑰)。 |
| [`github-releases-watch.yml`](./github-releases-watch.yml) | `schedule` / `workflow_dispatch` | 監控指定 repo 的最新 GitHub release,有新版就建立通知筆記。 |

## 如何使用

1. 打開任一 `.yml` 檔,把內容整份複製貼到 workspace 的「工作流」頁面建立新工作流。
2. 到「使用者設定 > API Keys」建立一組 API key(這組 key 所屬的使用者必須是
   目標 workspace 的成員)。
3. 到 workspace 的「工作流」設定頁,依照每個範例檔開頭的註解新增對應的
   **vars**(一般參數,例如 feed 網址)與 **secrets**(機密值,例如上一步的
   API key)。所有範例都需要:
   - `secrets.NM_API_KEY` — 呼叫 Notomate API 用的 API key
   - `vars.NM_API_BASE_URL` — runner 容器可以連到的 api 服務位址。若 api 與
     runner 在同一個 docker compose 專案內,通常是 `http://notomate-api:8080`
     (對照 [`README.zh-TW.md`](../../README.zh-TW.md) 的 compose 範例中
     `container_name: notomate-api`、`PORT: 8080`)。
4. 儲存並執行一次(`workflow_dispatch`)確認成功,再交給排程跑。

## 備註

- 每個範例都用 Node.js(runner 預設標籤 `ubuntu-latest` 對應 `node:20-bullseye`
  映像)寫一支小腳本到暫存檔再執行,避免在 YAML 裡處理複雜的 JSON escape。
- 工作流定義(含 `on`/`jobs` 內容)對所有 workspace 成員可見,所以 feed
  網址、repo 名稱這類「不機密但會變動」的參數放在 **vars**,API key、token
  等一律放在 **secrets**,用 `${{ vars.X }}` / `${{ secrets.X }}` 注入,不要
  直接寫死在 `run:` 腳本裡。
- 會建立/修改筆記的工作流要留意自我觸發的風險 — 每個工作流每分鐘有 30 次
  執行次數上限作為保險機制,詳見主 README 的「工作流」章節。
- RSS 範例內建的是簡易版 `<item>` 正規表達式解析器,足以應付大多數 RSS 2.0
  feed,但不是完整的 XML/Atom parser;若來源 feed 格式特殊需自行調整
  `sync.js` 部分。

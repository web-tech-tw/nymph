# Nymph

Nymph 是一個由 AI 驅動的多功能自動化機器人，旨在協助自動化資源管理、活動監控以及提供即時支援。

## 主要功能

* **多平台整合**：支援 Line, Discord, Matrix 的訊息監聽與串接。
* **AI Agent 核心**：整合 OpenAI (透過 LangChain)，提供智慧對話與翻譯功能。
* **對話記憶**：基於 Redis 儲存對話歷史，支援上下文理解。
* **開發友善**：支援 OpenAPI 文件匯出，並內建 Dockerfile 以利容器化部署。

## 系統需求

* Node.js >= 20
* Redis (用於儲存對話記憶)
* OpenAI 帳戶與 API Key

## 快速開始

1. **安裝相依套件**

```bash
npm install
```

2. **啟動開發環境**

請先在專案根目錄建立 `.env` 檔案（參考下方說明），接著啟動伺服器：

```bash
npm run dev
```

3. **執行測試**

```bash
npm run test
```

## 環境變數設定 (.env)

**核心設定 (AI 功能必填)：**

* `OPENAI_BASE_URL` — OpenAI API 網址
* `OPENAI_API_KEY` — OpenAI API 金鑰
* `OPENAI_MODEL_NAME` — 模型名稱 (例如 `gpt-4o`)
* `OPENAI_SYSTEM_PROMPT` — Agent 的系統提示詞 (System Prompt)
* `REDIS_URI` — Redis 連線字串

**平台整合 (選填，視需求啟用)：**

* `DISCORD_BOT_TOKEN`
* `LINE_CHANNEL_SECRET`
* `LINE_CHANNEL_TOKEN`

**.env 範例** (請勿將真實金鑰提交至版控系統)：

```ini
NODE_ENV=development
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL_NAME=gpt-4o
OPENAI_SYSTEM_PROMPT=You are an assistant.
REDIS_URI=redis://localhost:6379

```

## 專案結構

* `app.js` — 應用程式入口與路由設定
* `src/init/` — 初始化模組 (Express, 資料庫, 監聽服務)
* `src/listeners/` — 各平台的事件處理器 (Event Handlers)
* `src/clients/langchain.js` — AI Agent 核心實作 (聊天、翻譯、記憶管理)
* `src/clients/` — 第三方 API 客戶端封裝
* `src/bridges/` — 橋接邏輯 (訊息查找/發送)
* `export_openapi.js` — OpenAPI JSON 匯出工具

## 開發備忘

* 匯出 OpenAPI 文件：`node export_openapi.js`
* 執行單元測試：`npm run test`

## 參與貢獻

歡迎提交 PR 或 Issue！提交前請務必遵循本專案的程式碼規範。

## 授權

MIT — 詳情請參閱 `LICENSE` 文件。

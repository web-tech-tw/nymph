# Nymph (寧芙)

> **您的專屬 AI 技術顧問**  
> 來自 Web-Tech-TW  
> 匠心打造 以開源 AI 技術驅動的多平台智慧技術顧問服務

Nymph 是一個由社群驅動的資深技術顧問智慧體服務，由臺灣網際網路技術推廣組織（Web Tech TW）營運與維護，專為開發者提供專業、深入且具脈絡的系統架構諮詢、除錯指引與工程經驗檢索。

![Nymph Avatar](avatar.png)

---

## 服務核心能力

* **資深技術架構諮詢**：提供前端、後端、雲端架構、網路通訊與資安素養等領域的專業技術建議與除錯診斷。
* **社群工程知識庫檢索**：即時檢索社群歷年沉澱的技術討論、架構決策紀錄與真實除錯筆記。
* **長脈絡多輪對話**：具備上下文理解與對話記憶能力，在多輪討論中持續追蹤問題脈絡。
* **跨平台與多元管道支援**：支援透過 Discord、LINE，或透過 Model Context Protocol (MCP) 直接接入個人開發環境。

---

## 如何使用 Nymph 服務

### 1. 在 Discord 中使用

* **邀請機器人**：點擊 [邀請 Nymph 至 Discord 伺服器](https://discord.com/oauth2/authorize?client_id=921702227016560690)。
* **伺服器頻道**：在已加入 Nymph 的伺服器頻道中 `@Nymph` 並輸入你的問題。
* **私訊諮詢**：直接向 Nymph 發送私訊 (DM) 進行一對一技術諮詢。

### 2. 在 LINE 中使用

* **一對一諮詢**：點擊 [加入 Nymph 官方帳號](https://line.me/R/ti/p/@336jwweq) 為好友，直接發送訊息進行諮詢。
* **群組諮詢**：將 Nymph 邀請加入 LINE 群組，即可在群組中發送訊息進行提問。

### 3. 在個人開發工具中使用（透過 MCP 遠端串接）

你可以透過 Model Context Protocol (MCP) 標準，將 Nymph 作為遠端技術顧問直接整合進你的編輯器或 AI 客戶端（如 Antigravity、Claude Code/Desktop、Codex、Cursor 等）。

#### 步驟一：申請 MCP 連線權杖 (Token)

1. 開啟瀏覽器前往 Nymph 服務網站的權杖管理頁面（[https://web-tech.tw/nymph/mcp/tokens](https://web-tech.tw/nymph/mcp/tokens)）。
2. 點擊「使用 Sara 登入」，透過臺灣網際網路技術推廣組織的 Sara 統一身分系統完成登入。
3. 在管理介面中輸入權杖標籤（例如：`Cursor IDE` 或 `My MacBook`），點擊「簽發新權杖」。
4. 複製產生的專屬權杖金鑰（Token）。

#### 步驟二：在個人工具中掛載 Nymph

以 **Antigravity** 為例，將 Nymph 伺服器資訊加入你的 MCP 設定檔（如 `mcp_config.json` 或 `mcp.json`）：

```json
{
  "mcpServers": {
    "nymph": {
      "type": "http",
      "url": "https://web-tech.tw/nymph/mcp",
      "headers": {
        "Authorization": "Bearer <你的_MCP_TOKEN>"
      }
    }
  }
}
```

#### 步驟三：在編輯器中調用 Nymph 工具

完成連線後，你的 AI 助手即可在對話中直接調用以下 Nymph 專屬能力：

* `consult_nymph_wisdom`：向寧芙發起深入的技術諮詢、架構分析與除錯診斷。
* `absorb_nymph_wisdom`：檢索並汲取社群歷年沉澱的工程知識庫、架構決策與解決方案。
* `my_nymph_impression`：取得這份 MCP 連線權杖持有者的個人檔案。

---

## 常見諮詢範例

* **架構與技術選型**
  > 「我們正在規劃大型前後端分離專案，請分析微前端架構與 Monorepo 方案在維護成本與效能上的取捨。」

* **疑難排查與錯誤診斷**
  > 「在 Docker 容器內編譯原生 Node.js 模組時出現 node-gyp 報錯，常見的原因與排查步驟是什麼？」

* **社群知識庫查詢**
  > 「請幫我搜尋社群知識庫，看看過往關於 OAuth2 與 JWT 權杖更新機制的最佳實踐與決策紀錄。」

* **網路通訊與資安概念**
  > 「請說明 HTTP/2 多工傳輸與 HTTP/3 基於 QUIC 的連線機制在封包遺失場景下的差異。」

---

## 關於我們

Nymph 由臺灣網際網路技術推廣組織 (Taiwan Web Technology Promotion Organization) 維護與推廣，旨在協助社群成員互相交流技術、傳承工程經驗與共同成長。

* 官方網站：[臺灣網際網路技術推廣組織](https://web-tech.tw)
* 機器人安裝：[Discord 機器人](https://discord.com/oauth2/authorize?client_id=921702227016560690)｜[LINE 官方帳號](https://line.me/R/ti/p/@336jwweq)

---

## 授權

本專案採用 [MIT License](LICENSE) 授權。

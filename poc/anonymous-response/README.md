# Anonymous Response PoC

本目錄實作 `docs/specs/phase-0-anonymous-response-poc.md` 的第一個候選架構：

```text
Static public form → Google Apps Script Web App → Creator-owned Google Sheet
```

目前程式已可供部署，但尚未在真實 Google Account 上完成驗收，因此不能宣告 Phase 0 通過。

## Contents

- `apps-script/Code.gs`：Submission endpoint、驗證、去重與 Sheet 寫入。
- `apps-script/appsscript.json`：明確 OAuth scope 與 Web App 設定。
- `public-form/`：不含 Credential 的靜態測試表單。
- `tests/validation.test.js`：可在本機執行的資料驗證測試。

## 1. Run Local Validation Tests

需要 Node.js 18 或更新版本：

```powershell
node .\poc\anonymous-response\tests\validation.test.js
```

這些測試不會連線至 Google，也不代表跨來源提交已通過。

## 2. Create Test Resources

使用專用測試 Google Account：

1. 建立一份空白 Google Spreadsheet。
2. 從 Spreadsheet URL 複製 Spreadsheet ID。
3. 建立一個 standalone Apps Script project。
4. 將 `Code.gs` 與 `appsscript.json` 的內容加入 Project。
5. 在 Project Settings → Script Properties 加入：
   - `SPREADSHEET_ID`：測試 Spreadsheet ID。
   - `SHEET_NAME`：`Responses`。
6. 在 Apps Script editor 執行 `initializePoc`。
7. 檢查授權畫面，只授予 PoC 所需的 Spreadsheet scope。
8. 確認 Sheet 中已建立規格要求的標題列。

Spreadsheet ID 只存在 Apps Script Script Properties，不得加入公開表單。

## 3. Deploy the Web App

在 Apps Script 中選擇 Deploy → New deployment → Web app：

- Execute as：部署者。
- Who has access：任何人，包括未登入者。

部署後複製以 `/exec` 結尾的 URL。`/dev` URL 僅供有 Project 編輯權的人測試，不適用於匿名驗收。

Web App 會以部署者權限寫入試算表，因此必須使用專用測試帳號與測試資料。

## 4. Configure and Serve the Static Form

將 `/exec` URL 填入 `public-form/config.js`：

```javascript
window.TRANSFORMER_POC_CONFIG = Object.freeze({
  endpointUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
});
```

不要直接以 `file://` 開啟頁面。可在 repository root 執行任一靜態伺服器，例如：

```powershell
npx serve .\poc\anonymous-response\public-form
```

若不想安裝工具，也可以部署到預定使用的 Static Hosting，以便記錄真實 Origin 的行為。

## 5. Required Manual Verification

部署後依序記錄：

1. 未登入 Google 的瀏覽器是否可以載入 `/exec` health endpoint。
2. 公開表單的 POST 是否到達 Apps Script。
3. Browser 是否允許 JavaScript 讀取重新導向後的 JSON Response。
4. 成功提交是否只新增一列。
5. 重送相同 `submissionId` 是否回傳 `duplicate: true` 且不新增列。
6. 竄改 `formId`、`schemaVersion`、欄位及目的地是否被拒絕。
7. 公式形式的輸入是否以純文字呈現。
8. HTML、JavaScript、Storage、Request 與 Response 中是否不存在建立者 Credential。

特別注意第 3 點：使用 `text/plain` 可以避免一般 JSON POST 的 CORS preflight，但這不保證 Browser 能讀取 Apps Script 經重新導向後的 Response。若只能使用 `no-cors` opaque response，便無法可靠區分成功與失敗，PoC 不應直接判定為通過。

## 6. Current Security Properties

- Spreadsheet ID 與 Sheet name 來自 Script Properties，不接受 Client 指定。
- Request 使用欄位 allowlist、型別、長度、Form ID 與 Schema version 驗證。
- Spreadsheet formula markers 會在寫入前中和。
- Script lock 避免並行請求繞過 PoC 的重複檢查。
- 相同 `submissionId` 不會重複新增資料列。
- 公開錯誤僅包含穩定 code 與安全訊息。

## 7. Known PoC Limitations

- Endpoint URL 是公開資訊，不是 Secret。
- 尚未實作 CAPTCHA、進階 Rate limiting 或可靠 Origin 驗證。
- Sheet-based duplicate lookup 會隨資料量增加而變慢，不是正式大規模設計。
- Apps Script Content Service 無法由本地測試證明完整 HTTP/CORS 行為。
- Apps Script 和 Google Services 受配額與執行限制影響，且限制可能變更。
- 目前需由建立者手動建立、授權與部署 Apps Script。

## Official References

- Web apps: https://developers.google.com/apps-script/guides/web
- Web app manifest: https://developers.google.com/apps-script/manifest/web-app-api-executable
- Authorization: https://developers.google.com/apps-script/guides/services/authorization
- Apps Script quotas: https://developers.google.com/apps-script/guides/services/quotas
- Spreadsheet Range values: https://developers.google.com/apps-script/reference/spreadsheet/range

# Phase 0 — Anonymous Response Submission PoC

> Status: Completed — Accept with Limitations  
> Version: 0.1.0  
> Parent Spec: `docs/visual-form-builder-initial-spec.md`  
> Development Method: Spec-Driven Development

---

## 1. Purpose

本階段要驗證：在 TransFormer 不維護自有 Backend Server 的前提下，未登入的匿名填答者是否能安全地將表單回覆寫入表單建立者擁有的 Google Sheet。

本階段只處理阻礙產品成立的技術風險，不開發完整 Visual Editor。

## 2. Success Statement

若 PoC 成功，系統應能完成以下流程：

```text
Creator-owned Google Sheet
        ↑
Creator-authorized submission endpoint
        ↑ HTTPS request
Public static form
        ↑
Anonymous respondent
```

匿名填答者不需登入 Google，且公開表單、瀏覽器儲存空間及網路回應中不得包含建立者的 OAuth Access Token、Google Password、Gemini API Key 或其他私人 Credential。

## 3. Scope

### 3.1 In Scope

- 建立最小公開 HTML 表單。
- 建立一個由表單建立者授權的 Response Submission Endpoint。
- 將合法回覆新增至指定 Google Sheet。
- 驗證請求資料是否符合伺服端保存的欄位定義。
- 驗證匿名存取、跨來源請求及錯誤處理行為。
- 記錄部署方式、權限、限制、配額與已知風險。
- 針對候選架構做接受或拒絕決策。

### 3.2 Out of Scope

- 完整 Visual Editor。
- 完整 Form Renderer。
- Conditional Flow。
- Google Sheet 自動建立流程。
- 正式 UI 與視覺設計。
- Gemini 整合。
- 完整反垃圾訊息服務。
- 生產環境等級監控與分析。
- 保證 exactly-once delivery。

## 4. Constraints

PoC 必須遵守：

1. TransFormer 核心前端可部署於 Static Web Hosting。
2. 不部署或維護 TransFormer 自有 Backend Server。
3. 匿名填答者不需擁有或登入 Google Account。
4. 不得將建立者的 Google Credential 傳送給匿名填答者。
5. Client 提供的 Spreadsheet ID、欄位名稱、時間戳或目的地不得直接視為可信資料。
6. Endpoint 僅能寫入部署時已綁定或由可信設定指定的 Spreadsheet 與 Sheet。
7. 未知欄位必須拒絕或忽略，不得直接建立新的資料欄。
8. 回應與錯誤訊息不得暴露 Credential、內部設定或 Google Account 資訊。

## 5. Candidate Architecture

第一個候選方案為 Google Apps Script Web App：

```text
Static Form
    │
    │ POST response
    ▼
Creator-owned Google Apps Script Web App
    │
    │ append validated row
    ▼
Creator-owned Google Sheet
```

Apps Script 是否適合作為正式方案，必須由本 PoC 的實驗結果決定。目前不得將下列事項視為已證實：

- Web App 是否能滿足所需的匿名存取模式。
- Browser 跨來源提交的實際行為與限制。
- 建立者授權、部署及重新部署的操作成本。
- Apps Script 與 Sheets 的實際配額是否足以支援目標使用情境。
- 是否能提供足夠的濫用、垃圾提交與速率限制防護。
- Public endpoint URL 洩漏後所造成的風險是否可接受。

## 6. Trust Boundaries

### 6.1 Trusted

- 建立者本人執行的 Google 授權流程。
- 建立者擁有的 Apps Script Project。
- Apps Script 內由建立者設定的 Spreadsheet ID、Sheet name 與欄位定義。
- Google 平台在授權範圍內提供的身分與執行環境。

### 6.2 Untrusted

- 公開表單中的所有 Client-side code 與資料。
- 匿名填答者提供的所有欄位和值。
- `formId`、欄位名稱、時間戳、來源網址及 HTTP headers。
- 從其他網站或自動化工具送出的請求。
- 放在公開 JavaScript、HTML、URL 或 Form Schema 中的任何值。

## 7. Minimal Data Contract

PoC 的公開請求格式：

```json
{
  "formId": "poc_contact_form",
  "schemaVersion": 1,
  "submissionId": "client-generated-uuid",
  "answers": {
    "name": "Ada",
    "email": "ada@example.com",
    "message": "Hello"
  }
}
```

PoC 的 Sheet 欄位：

```text
Received At | Submission ID | Schema Version | Name | Email | Message
```

規則：

- `Received At` 必須由可信執行環境產生，不使用 Client 提供的時間。
- Spreadsheet ID 與 Sheet name 不得由公開請求指定。
- `formId` 必須與 Endpoint 內的可信設定一致。
- `schemaVersion` 必須為 Endpoint 支援的版本。
- `answers` 僅接受 `name`、`email`、`message`。
- 所有文字欄位必須有長度上限。
- 寫入 Sheet 時，必須避免讓以 `=`, `+`, `-`, `@` 開頭的使用者輸入被當成 Spreadsheet formula 執行。
- `submissionId` 用於觀察與處理重複提交，但本 PoC 不承諾 exactly-once delivery。

## 8. Functional Requirements

### FR-01 Anonymous Submission

未登入 Google 的使用者必須能提交符合資料契約的 Response。

### FR-02 Creator-owned Destination

合法 Response 必須新增至建立者預先指定的 Google Sheet。

### FR-03 Fixed Destination

匿名填答者不得透過 Request 改變 Spreadsheet、Sheet 或 Apps Script 權限。

### FR-04 Server-side Validation

Endpoint 必須在寫入前驗證：

- Request 結構。
- `formId`。
- `schemaVersion`。
- 允許的欄位集合。
- 必填欄位。
- 欄位型別與長度。

### FR-05 Safe Timestamp

Endpoint 必須產生接收時間，不得信任 Client timestamp。

### FR-06 Safe Error Handling

失敗時必須回傳可判斷的安全結果，且不得洩漏 Stack trace、Credential 或內部 Google 資源資訊。

### FR-07 Credential Isolation

瀏覽器載入的資源、Request、Response、Log 及公開 Form Schema 中不得出現建立者 Credential。

### FR-08 Duplicate Observation

Endpoint 必須記錄或辨識相同 `submissionId` 的重複請求，以便評估重試策略；正式去重方式留待架構決策。

## 9. Security Requirements

### SR-01 Input Allowlist

Endpoint 必須以 allowlist 處理欄位，不得把 Request 中任意 key 直接映射成 Sheet 欄位。

### SR-02 Formula Injection

所有寫入試算表的使用者字串必須以純文字儲存，或經過能防止 Formula Injection 的處理。

### SR-03 Payload Limit

必須設定每個欄位與整體 Payload 的上限。超過限制時不得寫入。

### SR-04 Destination Isolation

不得接受公開 Request 提供的 Spreadsheet ID、Sheet name、OAuth Token 或其他目的地設定。

### SR-05 Information Disclosure

公開錯誤訊息僅能包含穩定的錯誤代碼與安全描述。

### SR-06 Endpoint Exposure

不得把公開 Endpoint URL 或公開 Form Schema 中的固定字串視為 Secret。PoC 必須記錄 Endpoint 被任意第三方呼叫時的防護能力與殘餘風險。

### SR-07 Abuse Assessment

PoC 至少要測試並記錄：

- 快速連續提交。
- 相同 `submissionId` 重複提交。
- 從非預期 Origin 提交。
- 超大 Payload。
- 未知欄位與竄改後的 `formId`。

## 10. Acceptance Scenarios

### AC-P0-01 Valid Anonymous Submission

```gherkin
Given the endpoint is bound to a creator-owned Google Sheet
And the respondent is not signed in to Google
When the respondent submits a valid response
Then exactly one test row is appended during the test execution
And the row contains an endpoint-generated received time
And no creator credential is returned to the respondent
```

### AC-P0-02 Fixed Destination

```gherkin
Given the endpoint is bound to Spreadsheet A
When a request includes a Spreadsheet B identifier
Then no data is written to Spreadsheet B
And the untrusted destination value is rejected or ignored
```

### AC-P0-03 Unknown Field

```gherkin
Given the allowed fields are name, email and message
When a request also contains an admin field
Then the admin field is rejected or ignored according to the documented policy
And it is not added as a new Sheet column
```

### AC-P0-04 Invalid Schema Version

```gherkin
Given the endpoint supports schema version 1
When a request declares schema version 2
Then no row is written
And a safe validation error is returned
```

### AC-P0-05 Formula-like Input

```gherkin
Given a text answer begins with a spreadsheet formula marker
When the response is accepted
Then the answer is stored as inert text
And no spreadsheet formula is executed
```

### AC-P0-06 Oversized Payload

```gherkin
Given the request exceeds the documented size limit
When it is submitted
Then no row is written
And a safe validation error is returned
```

### AC-P0-07 Submission Failure

```gherkin
Given the destination Sheet is temporarily unavailable
When a valid response is submitted
Then the respondent receives a failure result
And the UI can distinguish the failure from a successful submission
And no credential or internal stack trace is exposed
```

### AC-P0-08 Credential Inspection

```gherkin
Given the public form is loaded in a clean browser session
When its HTML, JavaScript, browser storage and network traffic are inspected
Then no creator OAuth token, Google password or private API key is present
```

### AC-P0-09 Duplicate Submission

```gherkin
Given a valid response has been submitted with a submission ID
When the same request is submitted again
Then the observed behavior is documented
And the PoC report states whether duplicates are accepted, rejected or deduplicated
```

### AC-P0-10 Untrusted Origin

```gherkin
Given a third-party site knows the public endpoint URL
When it sends a syntactically valid request
Then the actual behavior is recorded
And the residual spam and abuse risk is included in the architecture decision
```

## 11. Experiment Plan

### Experiment 1 — Deployment and Authorization

確認建立者如何建立、授權與部署候選 Submission Endpoint，並記錄所需 OAuth scopes、匿名存取設定及重新部署流程。

### Experiment 2 — Browser Submission

從本機及至少一個 Static Hosting origin 提交資料，記錄 HTTP method、redirect、CORS、Content-Type 與 Response parsing 的實際行為。

### Experiment 3 — Validation and Safe Write

實作固定目的地、欄位 allowlist、長度限制、Schema version 驗證與 Formula Injection 防護，執行 AC-P0-01 至 AC-P0-06。

### Experiment 4 — Failure and Retry

模擬目的地錯誤、權限被撤銷、暫時性失敗與重複提交，執行 AC-P0-07 及 AC-P0-09。

### Experiment 5 — Exposure and Abuse

檢查公開資源與 Network traffic，並從非預期來源提交、連續提交與竄改請求，執行 AC-P0-08 及 AC-P0-10。

### Experiment 6 — Operational Limits

記錄平台配額、執行時間限制、並行限制、部署擁有權、維護成本及建立者需要完成的步驟。此資料必須附上查證日期與來源。

## 12. Evidence to Collect

PoC 報告必須包含：

- 測試日期與環境。
- 部署與授權步驟。
- 所使用的 OAuth scopes。
- Sanitized Request 與 Response 範例。
- Sheet 寫入結果截圖或等價紀錄，不包含私人資料。
- 每一項 Acceptance Scenario 的 Pass/Fail 結果。
- Credential inspection 結果。
- 配額與平台限制的官方來源。
- 已知安全、隱私及使用體驗限制。
- 可重現 PoC 的操作說明。

## 13. Exit Criteria

只有同時符合以下條件，Phase 0 才可標記完成：

1. AC-P0-01 至 AC-P0-10 均已執行並留下證據。
2. 所有 Critical security failure 已修正，或候選方案已被拒絕。
3. 建立者 Credential 未出現在公開 Client 或網路回應中。
4. 固定目的地與伺服端驗證已被實際證明。
5. 已確認匿名存取及 Browser submission 的實際行為。
6. 已記錄操作成本、配額與殘餘濫用風險。
7. 已建立 Architecture Decision Record。
8. Parent Spec 中受影響的 Open Questions 已更新。

## 14. Decision Outcomes

PoC 結束後只能選擇以下結果之一：

### Accept

候選方案符合必要需求，且殘餘風險可接受，可以進入 Form Schema 階段。

### Accept with Limitations

候選方案可用，但必須把限制明確加入產品規格，例如提交量限制、建立者部署步驟或有限的 Abuse protection。

### Reject

候選方案無法滿足必要安全性、匿名提交、操作性或可用性要求。必須評估其他 user-owned execution/storage 方案，或修改「無自建 Backend」的產品限制。

## 15. Deliverables

Phase 0 預期產出：

```text
docs/specs/phase-0-anonymous-response-poc.md
poc/anonymous-response/README.md
poc/anonymous-response/public-form/
poc/anonymous-response/apps-script/
docs/reports/phase-0-anonymous-response-results.md
docs/decisions/ADR-001-response-submission.md
```

本文件是第一個產出。其他項目應依本規格逐步實作，不應在實驗完成前預先宣告架構決策。

## 16. Review Decisions Required

開始實作前，需要產品負責人確認：

1. PoC 是否可以使用一個專用的測試 Google Account 與測試 Spreadsheet。
2. 若 Endpoint 為公開可呼叫且只能提供有限的 Abuse protection，是否仍可能接受為 MVP 限制。
3. MVP 是否接受 at-least-once submission，也就是少數情況可能產生重複列，再由 `submissionId` 協助辨識。
4. 建立者是否可以接受一次性的 Apps Script 授權與部署步驟；若不可接受，PoC 必須把自動化建立流程納入評估。

### Decision Record — 2026-09-18

產品負責人已同意本 PoC 採用以下預設：

1. 使用專用測試 Google Account 與測試 Spreadsheet。
2. PoC 階段允許有限的 Abuse protection；是否可作為 MVP 限制由實驗結果決定。
3. MVP 暫時接受 at-least-once submission，使用 `submissionId` 協助辨識重複資料。
4. PoC 階段接受手動授權與部署 Apps Script，產品化前再評估自動化。

### Validation Record — 2026-09-18

產品負責人回報 AC-P0-01 至 AC-P0-10 全部通過。驗證環境為 Chrome，Static Form 從 localhost 提供。詳細結果與殘餘限制記錄於：

- `docs/reports/phase-0-anonymous-response-results.md`
- `docs/decisions/ADR-001-response-submission.md`

# Renderer v1

> Status: Renderer UI Skeleton Implemented — Full Acceptance Pending  
> Version: 1.0.0  
> Phase: 2 — Renderer  
> Depends On: `docs/specs/form-schema-v1.md`

## 1. Purpose

Renderer v1 將通過驗證的 Form Schema v1 呈現為可填寫表單，負責：

- 顯示目前 Block 及其所有 Cards。
- 依 Layout preset 排列 Cards。
- 管理目前填答狀態。
- 驗證目前 Block 的 Input Cards。
- 根據 Flow 前往下一個 Block 或提交。
- 在 Preview mode 模擬完整填答，但不寫入正式 Response。

Renderer 不得依賴 Visual Editor 的 UI state。

```text
Form Schema v1
      ↓
Schema Validator
      ↓
Renderer Core ← Answer State
      ↓
Card + Layout UI
      ↓
Navigation / Submission Adapter
```

## 2. Scope

### 2.1 In Scope

- Text、Image、Short Text、Long Text、Single Choice、Multiple Choice Cards。
- Vertical、Two Columns、Image Left、Image Right、Hero Layouts。
- Desktop、Tablet、Mobile responsive behavior。
- Simple Flow 與 Conditional Flow。
- Current Block validation。
- Back navigation。
- Preview mode 與 Public mode。
- Accessible keyboard operation and error messaging。
- Safe text and Image URL rendering。
- Schema-only integration tests。

### 2.2 Out of Scope

- Visual Editor。
- Drag and Drop。
- Form publishing UI。
- Google OAuth UI。
- Google Sheet setup UI。
- Apps Script deployment automation。
- File Upload。
- Markdown、Rich Text 或 arbitrary HTML。
- Custom themes and CSS injection。
- Analytics。
- Offline submission queue。
- Server-side validation implementation。

## 3. Architecture Boundary

Renderer 分為三個責任：

### 3.1 Renderer Core

Framework-independent domain behavior：

- Current Block state。
- Answer state。
- Validation。
- History。
- Flow evaluation。
- Response construction。

### 3.2 Renderer UI

- 將 Block、Layout 與 Cards 轉換為 UI。
- 將使用者操作傳給 Renderer Core。
- 顯示 errors、loading 及 submission status。

### 3.3 Submission Adapter

- Preview Adapter：攔截 Response，不發出 Network Request。
- Public Adapter：將 Response 送往已設定的 Submission Endpoint。

Renderer Core 不得直接依賴 Google Apps Script、Google Sheets 或特定 HTTP endpoint。

## 4. Renderer Input

概念介面：

```javascript
createRenderer({
  form,
  mode: 'preview',
  initialAnswers: {},
  submissionAdapter,
  onEvent
})
```

| Input | Required | Description |
|---|---:|---|
| `form` | yes | Form Schema v1 object |
| `mode` | yes | `preview` or `public` |
| `initialAnswers` | no | 依 `fieldKey` 提供的初始值 |
| `submissionAdapter` | public only | 接受完整 Response envelope |
| `onEvent` | no | 接收不含填答內容的 lifecycle events |

初始化時必須先執行 Schema Validator。Schema 無效時不得嘗試部分呈現。

## 5. Renderer State

```javascript
{
  status: 'active',
  currentBlockId: 'block_identity',
  history: [],
  answers: {},
  touched: {},
  errors: {},
  submissionId: 'submission_xxx',
  submitError: null
}
```

### 5.1 Status

支援：

- `initializing`
- `active`
- `submitting`
- `submitted`
- `submissionError`
- `fatalError`

### 5.2 State Invariants

- `currentBlockId` 必須存在於 Form Schema。
- `history` 只包含實際到達過的 Block ID。
- `answers` 使用 `fieldKey`，不得使用 label 作為 key。
- Content Card 不得出現在 `answers`。
- `submissionId` 在一次填答 session 中保持不變。
- Renderer state 不得被寫回 Form Schema object。
- Renderer 不得 mutate 呼叫者提供的 Form Schema。

## 6. Initialization

初始化順序：

1. 驗證 Form Schema。
2. 若無效，進入 `fatalError` 並回報 validation errors。
3. 驗證 `initialAnswers` 的欄位與型別。
4. 產生或載入本次 session 的 `submissionId`。
5. 設定 `currentBlockId = startBlockId`。
6. 進入 `active`。

Preview 與 Public mode 必須使用相同 Renderer Core。

## 7. Card Rendering

### 7.1 Text

- `heading`：使用符合文件階層的 heading presentation。
- `body`：一般段落。
- `caption`：次要說明文字。
- `content` 必須以 plain text 呈現，不解析 HTML 或 Markdown。

### 7.2 Image

- 僅載入 Schema Validator 已接受的 HTTPS URL。
- 使用 `alt` 作為替代文字。
- `alt` 為空字串時視為 decorative Image。
- `caption` 存在時以語意化 caption 呈現。
- 載入失敗時顯示非阻斷 placeholder，不得使整個 Block 崩潰。
- 不使用 Image URL 作為 Script、Style、iframe 或可執行內容來源。

### 7.3 Short Text

- 使用單行文字輸入。
- 套用 `placeholder`、`minLength` 與 `maxLength`。
- Value 必須為 string。

### 7.4 Long Text

- 使用多行文字輸入。
- 套用 `placeholder`、`minLength` 與 `maxLength`。
- Value 必須為 string。

### 7.5 Single Choice

- Options 應以互斥控制項呈現。
- Answer 儲存 Option ID，不儲存 label。
- 所有 Options 必須可使用鍵盤操作。

### 7.6 Multiple Choice

- Options 應以可複選控制項呈現。
- Answer 為不重複 Option ID array。
- Renderer 必須執行 `minSelections` 與 `maxSelections`。

## 8. Layout Rendering

Renderer 必須依 Schema 的 named `areas` 呈現，不能重新推測 Card 分類。

### 8.1 Vertical

```text
main
┌────────────┐
│ Card       │
│ Card       │
└────────────┘
```

### 8.2 Two Columns

```text
┌──────────┬──────────┐
│ left     │ right    │
└──────────┴──────────┘
```

Mobile order：`left` → `right`。

### 8.3 Image Left

```text
┌──────────┬──────────┐
│ media    │ content  │
└──────────┴──────────┘
```

Mobile order：`media` → `content`。

### 8.4 Image Right

```text
┌──────────┬──────────┐
│ content  │ media    │
└──────────┴──────────┘
```

Mobile order：`media` → `content`，讓 Image 在內容前提供情境。

### 8.5 Hero

```text
┌─────────────────────┐
│ hero                │
├─────────────────────┤
│ title               │
├─────────────────────┤
│ content             │
└─────────────────────┘
```

所有 viewport 維持 `hero` → `title` → `content`。

### 8.6 Responsive Breakpoints

- Mobile：小於 `768px`。
- Tablet：`768px`–`1023px`。
- Desktop：`1024px` 以上。
- Two-column layouts 在 Mobile 必須降級為單欄。
- Renderer 不得造成水平頁面捲動。
- Image 必須限制在所屬 area 寬度內。

## 9. Answer Validation

按下 Next 或 Submit 時，只驗證目前 Block。

### 9.1 Required

- Short/Long Text：trim 後不得為空。
- Single Choice：必須有合法 Option ID。
- Multiple Choice：必須符合 `minSelections`；若 `required=true` 且未指定 `minSelections`，至少選一項。

### 9.2 Optional

- 未填寫時不產生 error。
- 一旦有值，仍必須符合 type、length、Option 與 selection constraints。

### 9.3 Error Presentation

- Error 必須與 Input 以程式方式關聯。
- 第一個 Error 應取得 focus 或被捲動至可見位置。
- Error summary 必須可供螢幕閱讀器理解。
- Error 不得只以顏色表示。
- 修正後 Error 應在重新驗證時清除。

## 10. Navigation

### 10.1 Next

1. 標記目前 Block Inputs 為 touched。
2. 驗證目前 Block。
3. 驗證失敗時停留在目前 Block。
4. 驗證成功時使用 Flow Evaluator 決定 destination。
5. 將目前 Block ID 加入 `history`。
6. 進入下一個 Block，將 viewport/focus 移到 Block 開頭。

### 10.2 Back

- Start Block 不顯示 Back。
- Back 回到 `history` 最後一個 Block。
- Back 不驗證目前 Block。
- 已填 answers 暫時保留。
- Back 後修改影響 Conditional Flow 的 answer，再次 Next 時必須清除舊的 forward path。
- 最終 Response 只包含最後一次有效路徑上到達過的 Input fields。

### 10.3 Submit Destination

Flow destination 為 `submit` 時：

1. 建立 reached-path field allowlist。
2. 移除非最終路徑上的 answers。
3. 建立 Response envelope。
4. Preview mode 交給 Preview Adapter。
5. Public mode 交給 Public Submission Adapter。

## 11. Response Construction

```json
{
  "formId": "form_identity_demo",
  "formRevision": 1,
  "submissionId": "submission_01abcxyz",
  "answers": {
    "identity": "option_student",
    "school_name": "Example University"
  }
}
```

Rules：

- 不包含 Content Cards。
- 不包含未到達路徑的 fields。
- Optional empty answer 可以省略。
- String answer 保留使用者輸入；是否 trim 必須在所有 modes 一致。
- Multiple Choice answer 保持 Schema Option 順序，不使用點擊順序。
- Response 必須通過 revision binding validation。

## 12. Submission Behavior

### 12.1 Preview Mode

- 不發送 Network Request。
- 顯示可檢視的 Response summary。
- 可重新開始 Preview。
- 不寫入正式 Response storage。

### 12.2 Public Mode

- Submit 時進入 `submitting`。
- `submitting` 時停用重複 Submit，但不得封鎖 assistive technology 的狀態通知。
- 成功後進入 `submitted`。
- 失敗後進入 `submissionError`，保留 answers 與相同 `submissionId`。
- Retry 必須重用相同 `submissionId`。
- 不可確認結果的 Network failure 必須明確告知可能已送達，不得宣稱一定失敗。

## 13. Accessibility

- 所有功能必須可只使用鍵盤完成。
- Input 必須有可辨識 label。
- Block 變更後 focus 必須移到新 Block 的 heading 或等價容器。
- Dynamic status 使用適當 live region。
- Back、Next、Submit 必須有明確 accessible name。
- Choice groups 必須有 group label。
- Responsive reflow 不得產生與視覺順序不同的 focus order。
- Renderer 不得以 Drag 作為任何填答操作的必要方式。

## 14. Security and Privacy

- 所有 Form text 使用文字節點呈現。
- 不將 Form content 傳送到非必要第三方。
- 不在 telemetry event 中包含 answers。
- Image URL 不得變成 executable context。
- Public Form 不得包含 Creator Credential。
- Submission Adapter URL 是公開 endpoint，不得視為 Secret。
- Renderer errors 不顯示 Stack trace、Credential 或內部 Google resource ID。

## 15. Events

可選 `onEvent` 只允許以下不含回答內容的事件：

```text
renderer_initialized
block_viewed
validation_failed
navigation_next
navigation_back
submission_started
submission_succeeded
submission_failed
```

Event 可以包含：

- Form ID。
- Form revision。
- Block ID。
- Error code。
- Timestamp。

Event 不得包含：

- Answer value。
- Card content 或 label。
- Email、姓名或其他 Response data。
- Credential。

## 16. Error Model

```javascript
{
  code: 'RENDERER_SCHEMA_INVALID',
  path: '/blocks/0/cards/1',
  message: 'Form cannot be displayed.'
}
```

Stable error categories：

- `RENDERER_SCHEMA_INVALID`
- `RENDERER_INITIAL_ANSWER_INVALID`
- `RENDERER_FIELD_INVALID`
- `RENDERER_FLOW_FAILED`
- `RENDERER_SUBMISSION_FAILED`
- `RENDERER_FATAL`

Public UI 顯示安全且可理解的訊息；完整 developer diagnostics 只能透過開發模式或安全 logging boundary 提供。

## 17. Acceptance Criteria

### AC-R2-01 Schema-only Rendering

Given canonical Form Schema fixture 且沒有 Editor state，When 初始化 Renderer，Then 從 `startBlockId` 完整呈現第一個 Block。

### AC-R2-02 All Card Types

Given 包含六種 v1 Card types 的有效 Schema，When 呈現，Then 每種 Card 依規格顯示且 Input 可操作。

### AC-R2-03 Block Page Semantics

Given Block 包含多個 Cards，When 進入 Block，Then 所有 Cards 同時顯示。

### AC-R2-04 Layout Areas

Given 每一種 Layout preset，When Desktop 呈現，Then Cards 出現在 Schema 指定 area 與順序。

### AC-R2-05 Mobile Reflow

Given viewport 小於 768px，When 呈現 two-column Layout，Then areas 依規定順序降級為單欄且不產生水平頁面捲動。

### AC-R2-06 Current Block Validation

Given Required Input 未填，When 按 Next，Then 停留在目前 Block 並顯示可存取的 Error。

### AC-R2-07 Simple Flow

Given 無 condition 的 Block transition，When 目前 Block 有效且按 Next，Then 進入指定 Block。

### AC-R2-08 Conditional Flow

Given `identity = option_student`，When 按 Next，Then 進入 Student Block。

### AC-R2-09 Back and Branch Change

Given 使用者進入 Student Block 後返回並改選 Worker，When 再按 Next，Then 進入 Worker Block 且最終 Response 不包含 Student-only answers。

### AC-R2-10 Preview Isolation

Given Preview mode，When 完成表單，Then 可檢視 Response summary 且 Submission Adapter 未發出正式寫入請求。

### AC-R2-11 Public Submission Success

Given Public mode 與成功的 Submission Adapter，When 完成表單，Then 只送出一次、顯示成功狀態並保留穩定 `submissionId`。

### AC-R2-12 Retry

Given Submission Adapter 回報暫時失敗，When 使用者 Retry，Then answers 保留且重用相同 `submissionId`。

### AC-R2-13 Plain-text Safety

Given Text Card 或 label 含 `<script>` 字串，When 呈現，Then 字串以文字顯示且沒有 Script 執行。

### AC-R2-14 Invalid Schema

Given Schema Validator 回報錯誤，When 初始化，Then Renderer 顯示安全 fatal state 且不部分呈現 Form。

### AC-R2-15 Keyboard Completion

Given 使用者只使用鍵盤，When 填寫、導航與提交，Then 所有核心操作均可完成。

### AC-R2-16 Editor Independence

Given Renderer package 未載入任何 Editor module，When 使用 canonical fixture 執行 integration test，Then AC-S1-02 通過。

## 18. Test Layers

### Unit Tests

- Answer validation。
- Reached path filtering。
- Response construction。
- History and branch invalidation。
- Renderer state transitions。

### Component Tests

- 每種 Card。
- 每種 Layout。
- Error presentation。
- Image failure fallback。

### Integration Tests

- Canonical Schema → multi-Block completion。
- Conditional branch and Back。
- Preview Adapter isolation。
- Public Adapter success、failure and retry。
- Invalid Schema fatal state。

### Browser Tests

- Desktop、Tablet、Mobile viewport。
- Keyboard-only completion。
- Chrome，以及正式支援清單中的其他 browsers。

## 19. Deliverables

```text
docs/specs/renderer-v1.md
src/renderer/core/
src/renderer/cards/
src/renderer/layouts/
src/renderer/adapters/
tests/renderer/unit/
tests/renderer/integration/
tests/renderer/browser/
```

## 20. Review Decisions

開始實作前需確認：

1. Renderer v1 是否提供 Back navigation。
2. Branch 改變後是否從最終 Response 移除舊路徑 answers。
3. Image Right 在 Mobile 是否改為 Image 先於 Content。
4. Responsive breakpoints 是否採 768px 與 1024px。
5. Renderer Core 是否保持 framework-independent，Submission 透過 Adapter 注入。
6. Preview completion 是否顯示 Response summary，但絕不呼叫正式 Submission Adapter。

### Decision Record — 2026-09-18

產品負責人已確認：

1. Renderer v1 提供 Back navigation。
2. Branch 改變後，最終 Response 移除舊路徑 answers。
3. Image Right 在 Mobile 以 Image 先於 Content。
4. Responsive breakpoints 採用 768px 與 1024px。
5. Renderer Core 保持 framework-independent，Submission 透過 Adapter 注入。
6. Preview completion 顯示 Response summary，且絕不呼叫正式 Submission Adapter。

### Core Implementation Record — 2026-09-18

已完成 framework-independent Renderer Session：

- Schema-only initialization and safe fatal state。
- Answer state and Current Block validation。
- Next、Back、Conditional Flow and branch invalidation。
- Reached-path Response filtering。
- Preview isolation。
- Public Submission Adapter boundary、failure and retry。
- Stable `submissionId` across retries。
- Privacy-safe lifecycle events。

新增 16 項 Renderer Core tests；連同既有測試共 36 項全部通過。

### UI Implementation Record — 2026-09-19

依 ADR-002 完成：

- React + TypeScript + Vite Static Renderer skeleton。
- 六種 Card components。
- 五種 named-area Layout components 與 Mobile reflow CSS。
- Accessible labels、Choice groups、error summary、focus management and keyboard navigation。
- Preview Response summary and safe fatal/submission states。
- Native ESM boundary between React UI and framework-independent Core。
- 7 項 jsdom component/integration tests，全部通過。
- Chrome desktop/mobile Playwright tests 4 項，包含純鍵盤 completion 與 mobile horizontal overflow，全部通過。
- TypeScript check 與 Vite production Static build 通過。

Firefox 與 WebKit browser binaries 因執行環境無法從 Playwright CDN 下載而尚未驗收。所有 Card/Layout 組合、Tablet breakpoint、Public HTTP Adapter 與完整 browser matrix 仍屬 Phase 2 後續 acceptance scope。

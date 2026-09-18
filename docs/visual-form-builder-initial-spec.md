# Visual Form Builder — Initial Specification

> Status: Draft  
> Version: 0.1.0  
> Development Method: Spec-Driven Development

---

## 1. Product Overview

### 1.1 Purpose

本專案旨在建立一個**完全以前端為核心的免費視覺化表單製作工具**。

使用者可透過視覺化介面建立表單，使用 Card、Block 與 Flow 組合內容、頁面與互動流程。

系統不自行維護應用程式伺服器，應盡可能使用 Static Web App 架構，並利用使用者自行授權或提供的第三方服務完成資料儲存與 AI 功能。

### 1.2 Core Principles

系統設計必須遵守以下原則：

1. **Static-first**

   - 核心應用必須可部署於 Static Web Hosting。
   - 不依賴專案自行維護的 Backend Server。

2. **Free-first**

   - 核心表單建立、發布與填答功能不得因平台訂閱而受限制。

3. **User-owned Data**

   - 表單與填答資料應盡可能儲存在使用者自己的服務或裝置中。
   - 平台本身不建立中央化 Response Database。

4. **Visual-first**

   - 表單結構主要透過視覺化操作建立。
   - 使用者不需要撰寫程式碼。

5. **AI Optional**
   - AI 不得成為建立、發布或填寫表單的必要條件。
   - AI 功能應使用使用者自行提供或授權的 AI Service。

---

## 2. Product Scope

### 2.1 In Scope

第一階段系統應包含：

- 視覺化表單編輯器
- Card
- Block
- Block Layout
- Flow
- Conditional Flow
- Form Preview
- Form Publishing
- Form Response Collection
- Google Account Integration
- Google Sheets Integration
- Local Draft Storage
- Optional Gemini Integration

### 2.2 Out of Scope

第一階段不包含：

- 自建 Backend Server
- 自建使用者帳號系統
- 自建資料庫
- 自建 AI inference service
- 即時多人協作
- 付款功能
- Enterprise SSO
- 完整 BI / Analytics Platform
- 自由 HTML / JavaScript Injection
- AI 作為必要依賴

---

## 3. Domain Model

系統的表單結構分為：

```text
Form
 │
 ├── Block
 │    │
 │    ├── Card
 │    ├── Card
 │    └── Card
 │
 ├── Block
 │    └── Card
 │
 └── Block
      └── Card
```

核心關係：

```text
Card → Content
Block → Page
Flow → Navigation
```

---

## 4. Card

### 4.1 Definition

Card 是表單中的**最小內容單位**。

Card 不代表一個頁面。

多個 Card 可以存在於同一個 Block。

### 4.2 Initial Card Types

MVP 至少支援：

#### Content Cards

- Text
- Image

#### Input Cards

- Short Text
- Long Text
- Single Choice
- Multiple Choice

未來可以擴充：

- Number
- Date
- Time
- Rating
- File Upload
- Video
- Divider
- Address
- Email
- Phone

### 4.3 Card Operations

使用者必須能：

- 建立 Card
- 編輯 Card
- 刪除 Card
- 複製 Card
- 將 Card 移動至其他 Block
- 調整同一 Block 內 Card 順序

---

## 5. Block

### 5.1 Definition

Block 是表單中的**頁面單位**。

當填答者進入一個 Block 時，Block 內所有 Card 應同時顯示。

例如：

```text
Block A

┌──────────────────────┐
│ Image Card           │
│                      │
│ Question Card        │
│                      │
│ Short Text Card      │
│                      │
│       [Next]         │
└──────────────────────┘
```

若一個 Block 僅包含一個 Card，該 Card 仍視為存在於一個獨立 Block 中。

### 5.2 Block Operations

使用者必須能：

- 建立 Block
- 刪除 Block
- 複製 Block
- 移動 Card 至 Block
- 從 Block 移出 Card
- 設定 Layout
- 設定下一個 Block
- 設定 Conditional Flow

---

## 6. Block Layout

### 6.1 Definition

每個 Block 可以選擇預設 Layout。

Layout 負責決定 Block 內 Cards 的視覺排列方式，但不得改變 Card 本身的資料語意。

### 6.2 MVP Layouts

至少提供：

#### Vertical

```text
[ Card ]

[ Card ]

[ Card ]
```

#### Two Columns

```text
[ Card ][ Card ]
```

#### Image Left

```text
[ Image ][ Content ]
```

#### Image Right

```text
[ Content ][ Image ]
```

#### Hero

```text
[      Image      ]

[      Title      ]

[     Content     ]
```

### 6.3 Responsive Requirement

所有 Layout 必須能在：

- Desktop
- Tablet
- Mobile

正常顯示。

Mobile layout 可以自動降級，例如：

```text
Desktop

[A][B]

↓

Mobile

[A]
[B]
```

---

## 7. Flow

### 7.1 Definition

Flow 定義 Block 之間的導航關係。

最基本 Flow：

```text
Block A
   ↓
Block B
   ↓
Block C
```

### 7.2 Conditional Flow

系統應允許依據使用者回答決定下一個 Block。

例如：

```text
             ┌→ Student Block
Identity ────┤
             └→ Worker Block
```

規則範例：

```text
IF identity == "student"
THEN next = student_block

ELSE
next = worker_block
```

### 7.3 Flow Validation

發布前系統應檢查：

- 是否存在 Start Block
- 是否存在無法到達的 Block
- 是否存在缺少目的地的 Flow
- Conditional Flow 是否引用不存在的 Card
- 是否存在明顯無法離開的循環

發現問題時不得無提示發布。

---

## 8. Visual Editor

使用者應能透過視覺化介面管理表單。

Editor 至少應呈現：

```text
┌──────────────┐
│ Components   │
│              │
│ Text         │
│ Image        │
│ Short Input  │
│ Choice       │
└──────────────┘

        Visual Canvas

     [ Block A ]
          │
          ▼
     [ Block B ]
       ↙      ↘
[ Block C ] [ Block D ]
```

### 8.1 Required Interactions

使用者應能：

- Drag Card
- Drop Card into Block
- Drag Block
- Connect Blocks
- Select Block
- Edit Card
- Change Layout
- Delete connection
- Preview Form

所有 Drag 操作應另外提供非 Drag 的操作方式。

---

## 9. Form Preview

使用者可以在發布前模擬填答。

Preview 必須：

- 使用與正式表單相同的 Renderer
- 支援 Block Layout
- 支援 Flow
- 支援 Conditional Flow
- 不寫入正式 Response

---

## 10. Local Storage

使用者在尚未連接 Google Account 時仍可以建立表單。

Draft 應儲存於瀏覽器本地端。

建議：

```text
IndexedDB
```

而非依賴 Server Database。

使用者應能：

- 建立 Local Form
- 修改 Local Form
- 關閉頁面後重新開啟
- 刪除 Local Form

---

## 11. Google Integration

### 11.1 Authentication

需要 Google 功能時，系統應透過 Google OAuth 取得使用者授權。

不得自行保存：

- Google Password
- Long-lived plaintext credentials

應遵守最小權限原則。

### 11.2 Google Sheets

使用者可以將 Form 綁定 Google Sheet。

Response 應能轉換成：

```text
Timestamp | Field A | Field B | Field C
```

並寫入使用者指定的 Spreadsheet。

---

## 12. Public Response Submission

系統必須允許未登入的填答者提交表單。

例如：

```text
Creator
   ↓
Publish Form
   ↓
Public URL
   ↓
Anonymous Respondent
   ↓
Submit
   ↓
Creator-owned Google Sheet
```

### Critical Constraint

不得將 Creator 的 OAuth Access Token、Gemini API Key 或其他私人 Credential 暴露給填答者。

在不建立專案自有 Backend Server 的前提下，系統必須找到安全的 Response Submission Mechanism。

此功能在正式開發 Editor 前必須完成 Technical Proof of Concept。

---

## 13. Gemini Integration

Gemini 為 Optional Feature。

沒有設定 Gemini 時，所有核心功能仍必須正常運作。

### Possible AI Features

未來可以支援：

- Generate Form
- Generate Questions
- Rewrite Question
- Generate Choices
- Suggest Flow
- Summarize Responses

例如：

```text
User:
「幫我建立一份活動滿意度問卷」

        ↓

Gemini

        ↓

Form Schema

        ↓

Visual Editor
```

AI 產生的內容不得直接破壞既有 Form Schema。

---

## 14. Form Schema

表單應具有平台無關的 Schema。

概念範例：

```json
{
  "id": "form_xxx",
  "title": "活動報名",
  "version": 1,
  "startBlock": "block_1",
  "blocks": [
    {
      "id": "block_1",
      "layout": "vertical",
      "cards": [
        {
          "id": "card_1",
          "type": "text",
          "content": "歡迎報名"
        }
      ],
      "next": "block_2"
    }
  ]
}
```

Renderer 不應直接依賴 Editor UI state。

應維持：

```text
Editor
   ↓
Form Schema
   ↓
Renderer
```

而非：

```text
Editor UI
   ↓
直接生成 Form
```

---

## 15. Security Requirements

### SEC-01

不得在公開 Form 中包含 Creator credential。

### SEC-02

不得將 Gemini API Key 寫入公開 Form Schema。

### SEC-03

Google OAuth scope 應遵守最小權限原則。

### SEC-04

所有使用者輸入內容在 Renderer 中必須安全處理，避免 XSS。

### SEC-05

第三方圖片、URL 等內容不得允許執行任意 Script。

---

## 16. Privacy Requirements

平台預設不應收集：

- Form Responses
- Form Content
- Gemini Prompts
- Google Sheet Content

若未來加入 telemetry，必須：

- 明確揭露
- 可停用
- 不包含 Form Response Content

---

## 17. MVP

MVP 的目的不是完成完整產品，而是驗證：

> **能否在沒有自建 Backend Server 的情況下完成 Visual Form → Publish → Anonymous Response → User-owned Storage。**

MVP：

```text
Create Form
     ↓
Card
     ↓
Block
     ↓
Layout
     ↓
Simple Flow
     ↓
Preview
     ↓
Publish
     ↓
Anonymous Response
     ↓
Google Sheet
```

MVP 不要求：

- AI
- Collaboration
- Analytics
- File Upload
- Advanced Themes
- Payment
- Enterprise Features

---

## 18. MVP Acceptance Criteria

產品達成 MVP 的最低條件：

### AC-01

Given 使用者沒有登入  
When 開啟 Editor  
Then 可以建立並編輯 Local Form。

### AC-02

Given 一個 Block  
When 使用者加入多個 Card  
Then Cards 應同時出現在該 Block 頁面。

### AC-03

Given Block 包含多個 Cards  
When 使用者切換 Layout  
Then Renderer 應依選擇重新排列 Cards。

### AC-04

Given Form 包含多個 Blocks  
When 使用者建立 Flow  
Then 填答者應依 Flow 順序進入下一個 Block。

### AC-05

Given Conditional Flow  
When 填答者選擇指定答案  
Then 系統應進入符合條件的 Block。

### AC-06

Given 使用者連接 Google Account  
When 綁定 Spreadsheet  
Then Form Response 可以寫入該 Spreadsheet。

### AC-07

Given Public Form  
When 匿名使用者填寫並提交  
Then Response 可以寫入 Creator-owned storage，且匿名使用者無法取得 Creator credential。

### AC-08

Given Gemini 未設定  
When 使用者建立、發布與填寫 Form  
Then 所有核心功能仍正常運作。

---

## 19. Open Questions

以下問題目前尚未決定，不應在 Spec 中假定答案：

### OQ-01

公開表單的 Anonymous Response 如何在沒有自建 Backend 的情況下安全寫入 Google Sheets？

**Resolved for MVP:** 採用 Creator-owned Google Apps Script Web App 作為 Submission Endpoint，詳見 `docs/decisions/ADR-001-response-submission.md`。此決策帶有限制，並須在正式發布前完成 production origin 與多瀏覽器驗證。

### OQ-02

Form Schema 最終儲存於：

- Local only
- Google Drive
- Google Sheets
- 其他 user-owned storage

### OQ-03

Public Form Schema 如何發布與取得？

### OQ-04

Google Apps Script 是否適合作為 Creator-owned execution environment？

**Resolved for MVP:** Phase 0 PoC 驗證通過，結論為 Accept with Limitations。Apps Script 適合作為 MVP 的 Creator-owned execution environment，限制詳見 ADR-001。

### OQ-05

是否需要離線編輯能力？

### OQ-06

Conditional Flow 第一版允許多複雜的 Boolean expression？

### OQ-07

Gemini 授權採用 API Key、OAuth 或其他機制？

---

## 20. Development Order

開發順序不得直接從完整 UI 開始。

建議依序驗證：

```text
Phase 0
Anonymous Response PoC
        ↓
Phase 1
Form Schema
        ↓
Phase 2
Renderer
        ↓
Phase 3
Card + Block Editor
        ↓
Phase 4
Layout
        ↓
Phase 5
Flow Editor
        ↓
Phase 6
Google Integration
        ↓
Phase 7
Publish
        ↓
Phase 8
Optional Gemini
```

任何 Phase 若發現與 Static-first 原則存在根本衝突，應先更新 Specification，再繼續實作。

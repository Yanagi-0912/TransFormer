# Form Schema v1

> Status: Implemented — Phase 2 Renderer Integration Pending  
> Version: 1.0.0  
> Schema Version: 1  
> Phase: 1 — Form Schema

## 1. Purpose

Form Schema 是 Editor、Renderer、Preview、Publish 與 Response Submission 之間的穩定資料契約。

本規格定義 MVP 所需的 Form、Block、Card、Layout 與 Flow，不依賴任何特定 UI framework 或 Editor state。

```text
Editor → Form Schema → Validator → Renderer
                         ↓
                       Publish
```

## 2. Design Principles

1. **Platform-independent**：Schema 不包含 React component、DOM reference、Canvas position 或選取狀態。
2. **Deterministic**：相同 Schema 與 answers 必須產生相同 Layout 與下一個目的地。
3. **Strictly validated**：未知 type、未知欄位及失效 reference 不得被靜默接受。
4. **Stable identity**：Form、Block、Card、Option 與 Transition 都有不因排序改變的 ID。
5. **Safe by default**：Schema 不允許任意 HTML、JavaScript、CSS 或 Creator Credential。
6. **Versioned**：Schema 格式版本與表單內容 revision 分開管理。

## 3. Root Form Object

```json
{
  "schemaVersion": 1,
  "id": "form_activity_signup",
  "revision": 1,
  "title": "活動報名",
  "description": "請填寫以下資料。",
  "startBlockId": "block_welcome",
  "blocks": [],
  "flow": {
    "transitions": []
  }
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `schemaVersion` | integer | yes | v1 固定為 `1` |
| `id` | string | yes | 全域 Form ID |
| `revision` | integer | yes | 從 `1` 開始，每次發布新內容遞增 |
| `title` | string | yes | 1–120 characters |
| `description` | string | no | 0–2000 characters，plain text |
| `startBlockId` | string | yes | 必須引用存在的 Block |
| `blocks` | Block[] | yes | 1–200 Blocks；ID 不得重複 |
| `flow` | Flow | yes | 定義 Block navigation |

## 4. Identifier Rules

所有 ID 使用：

```regex
^[a-z][a-z0-9_]{2,63}$
```

ID 在所屬集合中必須唯一：

- Block ID 在 Form 中唯一。
- Card ID 在 Form 中唯一，不只在 Block 中唯一。
- Input Card 的 `fieldKey` 在 Form 中唯一。
- Option ID 在其 Card 中唯一。
- Transition ID 在 Form 中唯一。

已發布 revision 中的 ID 不得因重新排序或修改顯示文字而改變。

## 5. Block

```json
{
  "id": "block_welcome",
  "title": "歡迎",
  "cards": [],
  "layout": {
    "preset": "vertical",
    "areas": {
      "main": []
    }
  }
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | string | yes | 符合 ID 規則 |
| `title` | string | no | Editor 與 accessibility 使用，0–120 characters |
| `cards` | Card[] | yes | 1–100 Cards |
| `layout` | Layout | yes | 每個 Card 必須被放置一次 |

Block 是 Renderer 的頁面單位。進入 Block 時，其所有 Cards 同時呈現。

## 6. Card Common Fields

每種 Card 都包含：

```json
{
  "id": "card_intro",
  "type": "text"
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | string | yes | Form-wide unique |
| `type` | string | yes | 必須為支援的 Card type |

Schema v1 不包含 Editor-only state，例如：

- selected
- expanded
- canvas coordinates
- drag state
- panel state
- undo history

## 7. Content Cards

### 7.1 Text Card

```json
{
  "id": "card_intro",
  "type": "text",
  "content": "歡迎報名本次活動。",
  "variant": "body"
}
```

Rules:

- `content`：1–10000 characters，plain text。
- `variant`：`heading`、`body` 或 `caption`。
- 不允許 HTML 或 JavaScript。

### 7.2 Image Card

```json
{
  "id": "card_cover",
  "type": "image",
  "url": "https://example.com/activity.jpg",
  "alt": "活動會場",
  "caption": "去年活動照片"
}
```

Rules:

- `url`：只允許 `https:` URL，最多 2048 characters。
- `alt`：必填，可為空字串；最多 500 characters。
- `caption`：optional，最多 1000 characters。
- Renderer 不得執行 URL 內容或將其作為 Script 載入。

## 8. Input Cards

所有 Input Card 具有：

| Field | Type | Required | Rules |
|---|---|---:|---|
| `fieldKey` | string | yes | Form-wide unique，符合 ID 規則 |
| `label` | string | yes | 1–500 characters |
| `description` | string | no | 0–2000 characters，plain text |
| `required` | boolean | yes | 不得依 UI 預設值省略 |

Response 使用 `fieldKey` 作為穩定欄位名稱；Flow 使用 `cardId` 引用來源 Card。

### 8.1 Short Text

```json
{
  "id": "card_name",
  "type": "shortText",
  "fieldKey": "participant_name",
  "label": "姓名",
  "required": true,
  "placeholder": "請輸入姓名",
  "minLength": 1,
  "maxLength": 100
}
```

Rules:

- `placeholder`：optional，最多 200 characters。
- `minLength`：0–1000，預設 `0`。
- `maxLength`：1–1000，預設 `200`。
- `minLength <= maxLength`。

### 8.2 Long Text

```json
{
  "id": "card_comment",
  "type": "longText",
  "fieldKey": "comment",
  "label": "留言",
  "required": false,
  "maxLength": 2000
}
```

Rules:

- 與 Short Text 相同。
- `maxLength` 上限為 10000，預設 `2000`。

### 8.3 Single Choice

```json
{
  "id": "card_identity",
  "type": "singleChoice",
  "fieldKey": "identity",
  "label": "您的身分",
  "required": true,
  "options": [
    { "id": "option_student", "label": "學生" },
    { "id": "option_worker", "label": "在職人士" }
  ]
}
```

Rules:

- `options`：2–100 items。
- Option `id` 必須在 Card 中唯一。
- Option `label`：1–500 characters。
- Response 儲存 Option ID，不儲存 label 作為識別值。

### 8.4 Multiple Choice

```json
{
  "id": "card_interests",
  "type": "multipleChoice",
  "fieldKey": "interests",
  "label": "感興趣的主題",
  "required": false,
  "minSelections": 0,
  "maxSelections": 2,
  "options": [
    { "id": "option_design", "label": "設計" },
    { "id": "option_engineering", "label": "工程" }
  ]
}
```

Rules:

- `minSelections`：0 到 options count，預設 `0`。
- `maxSelections`：1 到 options count，預設為 options count。
- `minSelections <= maxSelections`。
- Response 為不重複 Option ID array。

## 9. Layout

Layout 使用 `preset` 和 `areas` 明確指定 Card 位置，避免 Renderer 推測 Card 用途。

```json
{
  "preset": "twoColumns",
  "areas": {
    "left": ["card_name"],
    "right": ["card_email"]
  }
}
```

Schema v1 presets：

| Preset | Required areas |
|---|---|
| `vertical` | `main` |
| `twoColumns` | `left`, `right` |
| `imageLeft` | `media`, `content` |
| `imageRight` | `content`, `media` |
| `hero` | `hero`, `title`, `content` |

Layout invariants：

1. Block 中每一個 Card ID 必須在 `areas` 中出現一次。
2. `areas` 不得引用其他 Block 或不存在的 Card。
3. 同一 Card 不得出現在兩個 area。
4. `imageLeft`、`imageRight` 的 `media` 只能包含 Image Card。
5. `hero` 的 `hero` 只能包含最多一個 Image Card。
6. Area array order 就是該區域內的顯示順序。
7. Mobile Renderer 可以將 areas 依 preset 定義的順序堆疊，但不得改變 Card 資料語意。

## 10. Flow

Flow 是 Form-level directed graph：

```json
{
  "transitions": [
    {
      "id": "transition_welcome_identity",
      "fromBlockId": "block_welcome",
      "destination": {
        "type": "block",
        "blockId": "block_identity"
      },
      "priority": 0
    }
  ]
}
```

### 10.1 Destination

前往 Block：

```json
{ "type": "block", "blockId": "block_identity" }
```

提交 Form：

```json
{ "type": "submit" }
```

### 10.2 Conditional Transition

Schema v1 只支援單一 Choice predicate，不支援任意 Boolean expression：

```json
{
  "id": "transition_to_student",
  "fromBlockId": "block_identity",
  "destination": {
    "type": "block",
    "blockId": "block_student"
  },
  "priority": 0,
  "condition": {
    "cardId": "card_identity",
    "operator": "equals",
    "optionId": "option_student"
  }
}
```

Supported operators：

- `equals`：Single Choice answer 等於 Option ID。
- `contains`：Multiple Choice answer 包含 Option ID。

Flow evaluation：

1. 取得目前 Block 的 outgoing transitions。
2. 依 `priority` 由小到大評估有 `condition` 的 transitions。
3. 第一個 condition 為 true 的 transition 勝出。
4. 若沒有 condition 成立，使用無 `condition` 的 fallback transition。
5. 若沒有符合項目或 fallback，Renderer 回報 Flow error，不得猜測目的地。

Flow invariants：

- `fromBlockId` 與 block destination 必須存在。
- Condition `cardId` 必須引用其 `fromBlockId` 內的 Choice Card。
- `optionId` 必須存在於該 Choice Card。
- 每個 Block 最多一個無 condition 的 fallback。
- 同一 Block 的 transition priorities 不得重複。
- 每個可到達 Block 必須有至少一個 outgoing transition，包括 `submit`。
- Start Block 必須可到達至少一個 `submit` destination。
- 不允許從 Start Block 無法到達的 Block。
- Validator 必須偵測不存在任何 submit path 的封閉循環。

## 11. Response Shape

Renderer 收集的邏輯 Response：

```json
{
  "formId": "form_activity_signup",
  "formRevision": 1,
  "submissionId": "submission_01abcxyz",
  "answers": {
    "participant_name": "Ada",
    "identity": "option_student",
    "interests": ["option_design"]
  }
}
```

Rules:

- Answer key 必須是 Input Card 的 `fieldKey`。
- Content Card 不產生 answer。
- Single Choice 儲存 Option ID。
- Multiple Choice 儲存 Option ID array。
- 未顯示或未回答的 optional field 可以省略。
- Required validation 以實際經過 Flow 的 Blocks 為準；未到達的 Block 不要求答案。
- Submission Endpoint 必須以已發布 Schema revision 驗證 Response，不能信任 Client。

## 12. Versioning and Migration

- `schemaVersion`：描述 Schema 格式，目前固定為 `1`。
- `revision`：描述單一 Form 的已發布內容版本。
- 編輯未發布 draft 不必增加 revision。
- 每次 Publish 產生不可變的 revision snapshot。
- Schema 格式升級必須提供明確 migration；Renderer 不得自行猜測未知版本。
- Submission 必須包含 `formRevision`，避免用新版 Schema 錯誤解讀舊頁面提交。

## 13. Security Requirements

Schema v1 不得包含：

- OAuth Access Token。
- Google Password。
- Gemini API Key。
- Spreadsheet write Credential。
- 任意 HTML、JavaScript 或 executable URL。
- Editor DOM、framework component 或 runtime object。

Renderer 必須：

- 將所有文字內容視為 plain text。
- 不使用未消毒的 `innerHTML`。
- 僅載入通過 URL policy 的 Image。
- 對 Response 再做型別與長度驗證。

## 14. Validation Levels

### 14.1 Structural Validation

檢查 required fields、type、enum、字串長度及未知欄位。

### 14.2 Referential Validation

檢查 Start Block、Layout Card、Transition Block、Condition Card 與 Option references。

### 14.3 Semantic Validation

檢查唯一 ID、Layout placement、Flow reachability、submit path、closed cycle 與 Card-specific constraints。

Validator error 格式：

```json
{
  "code": "FLOW_UNKNOWN_BLOCK",
  "path": "/flow/transitions/2/destination/blockId",
  "message": "Transition references an unknown block."
}
```

`code` 與 `path` 是程式可依賴的穩定欄位；`message` 用於人類閱讀及未來在地化。

## 15. Acceptance Criteria

### AC-S1-01 Round Trip

Given 一份有效 Form Schema，When serialize 後再 deserialize，Then 所有 Form 語意與 ID 保持不變。

### AC-S1-02 Editor Independence

Given 一份有效 Schema，When 沒有載入 Editor state，Then Renderer 仍能完整呈現 Form。

### AC-S1-03 Unknown Type

Given Card type 不在 v1 支援清單，When 驗證，Then 回傳穩定 validation error 且不得 Renderer fallback。

### AC-S1-04 Broken Reference

Given Layout、Flow 或 Condition 引用不存在的 ID，When 驗證，Then Schema 無效並指出 JSON path。

### AC-S1-05 Layout Completeness

Given Card 未放入 area 或重複放入多個 areas，When 驗證，Then Schema 無效。

### AC-S1-06 Deterministic Flow

Given 相同 Schema 與 answers，When 重複評估 Flow，Then 每次得到相同 destination。

### AC-S1-07 Conditional Flow

Given Single Choice answer 為 `option_student`，When 評估 `equals` condition，Then 選擇 Student destination。

### AC-S1-08 Fallback Flow

Given 沒有 condition 成立，When 存在 fallback，Then 選擇 fallback destination。

### AC-S1-09 Closed Cycle

Given 可到達的 Blocks 形成沒有 submit path 的封閉循環，When 驗證，Then Schema 無效。

### AC-S1-10 Credential Rejection

Given Schema 含有未知 Credential 欄位，When strict validation，Then Schema 無效。

### AC-S1-11 Revision Binding

Given Response 的 `formRevision` 與 Endpoint 支援的已發布 revision 不符，When 提交，Then Response 被安全拒絕。

## 16. Deliverables

Phase 1 完成時應產生：

```text
docs/specs/form-schema-v1.md
schemas/form-schema-v1.schema.json
src/domain/schema types
src/domain/schema validator
src/domain/flow evaluator
tests/schema fixtures
tests/schema validation tests
tests/flow evaluation tests
```

## 17. Review Decisions

實作前需確認：

1. Schema v1 的 Conditional Flow 是否接受只支援 `equals` 與 `contains`，不提供 AND、OR、NOT。
2. Layout 是否接受以 named `areas` 明確放置 Card，而不是由 Renderer 推測。
3. Text Card v1 是否維持 plain text，不支援 Markdown 或 Rich Text。
4. Image Card v1 是否只允許公開 `https:` URL，不納入上傳與 `data:` URL。
5. Form 發布後是否採 immutable revision snapshot。

### Decision Record — 2026-09-18

產品負責人已確認：

1. Conditional Flow v1 只支援 `equals` 與 `contains`，不支援 AND、OR、NOT。
2. Layout 使用 named `areas` 明確放置 Card。
3. Text Card v1 僅支援 plain text。
4. Image Card v1 僅接受公開 `https:` URL。
5. 每次 Publish 建立 immutable revision snapshot。

### Implementation Record — 2026-09-18

已完成：

- JSON Schema Draft 2020-12 contract。
- Structural、referential 與 semantic Validator。
- Deterministic Flow Evaluator。
- Response-to-revision binding Validator。
- Canonical conditional-flow fixture。
- 14 項 Phase 1 automated tests，全部通過。

AC-S1-02「Editor Independence」必須由 Phase 2 Renderer 使用純 Form Schema 的整合測試完成。在該測試通過前，本規格不標記為完全完成。

# ADR-002 — Renderer UI Technology Stack

> Status: Accepted  
> Date: 2026-09-19  
> Decision Owner: Product Owner and TransFormer Project

## Context

Renderer Core 已以 framework-independent JavaScript 實作。Phase 2 接下來需要建立可存取、可響應並能在瀏覽器驗收的 Renderer UI；後續 Phase 3 也需要支援 Card、Block 與 Visual Editor 的互動元件。

專案仍需符合 Static-first：Production build 必須輸出可部署到 Static Hosting 的檔案，不要求 Node.js Server。

## Decision

採用：

- React 19.3.0：Renderer UI component model。
- TypeScript 7.0.2：UI boundary 與 component props 的靜態型別。
- Vite 8.3.0：Development server 與 Static production build。
- Vitest 5.0.1 + jsdom 29.1.1 + Testing Library：Component and integration tests。
- Playwright 1.63.0：Desktop、Mobile、keyboard 與跨瀏覽器 acceptance tests。

版本為 2026-09-19 從 npm registry 查得，實際 dependency graph 由 `package-lock.json` 固定。

## Boundary

既有 `src/domain/` 與 `src/renderer/core/` 保持 framework-independent。React UI 只能透過 Renderer Session public API 使用 Core，不得將 React state、DOM node 或 component reference 寫入 Form Schema 或 Core state。

Browser-facing source modules使用 native ESM；不加入將 application CommonJS 轉譯到瀏覽器的額外 plugin。

```text
React Renderer UI
        ↓ public methods / immutable snapshots
Renderer Session Core
        ↓
Schema Validator + Flow Evaluator
```

## Rationale

- React component model 適合六種 Card、五種 Layout 與後續 Visual Editor 的組合需求。
- TypeScript 可在 UI 與無框架 Core 的邊界提供明確 contract。
- Vite 產生 Static assets，符合 Static-first。
- Testing Library 以 accessible roles 與 labels 驗證使用者可觀察行為。
- Playwright 可在 Chromium、Firefox、WebKit 及 Mobile viewport 驗證 browser acceptance。

## Consequences

### Positive

- Renderer 與未來 Editor 可以共享 Card components 和型別。
- UI tests 可優先使用使用者可見語意，而非 component internals。
- Production deployment 仍只需要 Static Hosting。
- Core domain behavior 不被綁定到 React。

### Negative

- 增加 npm dependency、build step 與 lockfile 維護。
- Browser acceptance 需要下載 Playwright browser binaries。
- 現有 CommonJS Core 與 TypeScript UI 之間需要 declaration boundary。
- Major dependency upgrade 必須重新執行 component、build 與 browser tests。

## Rejected Alternatives

### Framework-free DOM UI

可降低初始依賴，但後續 Visual Editor、component composition 與互動測試的維護成本較高。

### Next.js or another server-oriented framework

Renderer 與 Editor 不需要 SSR 或專案自有 server，會增加與 Static-first 無關的部署複雜度。

### Coupling Core state to React hooks

拒絕，因為會破壞 Renderer Core 的 framework independence 以及 Schema-only testing boundary。

## Verification

- `npm run typecheck`
- `npm run test:core`
- `npm run test:ui`
- `npm run build`
- `npm run test:e2e`（安裝 Playwright browsers 後）

## Official References

- React TypeScript: https://react.dev/learn/typescript
- React build from scratch: https://react.dev/learn/build-a-react-app-from-scratch
- Vite: https://vite.dev/guide/
- Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Playwright: https://playwright.dev/docs/intro

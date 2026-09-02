# Assistant Reading Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render safe, typographically complete Markdown and replace the rounded-card AI workspace with an immersive, readable conversation surface and collapsible history rail.

**Architecture:** Markdown rendering is isolated in a dedicated message component. Assistant layout state stays in `AssistantPage`, while presentation is handled by focused CSS classes over the existing `CanvasPage` background system. Existing conversation persistence and API contracts remain unchanged.

**Tech Stack:** React 19, TypeScript, `react-markdown`, `remark-gfm`, CSS, Vitest, Testing Library, Playwright CLI for visual verification.

**Repository constraint:** Do not commit, merge, push, or create a PR before the user's evening review. Do not implement homepage animation.

---

### Task 1: Add safe Markdown rendering

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`
- Create: `frontend/src/components/assistant/MarkdownMessage.tsx`
- Create: `frontend/src/components/assistant/MarkdownMessage.test.tsx`
- Modify: `frontend/src/components/assistant/Conversation.tsx`

- [ ] **Step 1: Install the minimal Markdown dependencies**

Run: `pnpm add react-markdown remark-gfm`

- [ ] **Step 2: Write failing rendering and security tests**

Cover headings, paragraphs, bold text, lists, block quotes, tables, inline/fenced code, external links with `_blank` and safe `rel`, raw HTML displayed as text/not mounted, and user messages remaining literal text.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `pnpm test:run -- --reporter=dot src/components/assistant/MarkdownMessage.test.tsx`  
Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement `MarkdownMessage`**

Use `ReactMarkdown` with `remarkGfm`. Do not add `rehype-raw`. Override anchors to apply safe external-link attributes, and wrap the renderer in `.markdown-message` for controlled typography.

- [ ] **Step 5: Use Markdown only for assistant messages**

In `Conversation`, render:

```tsx
{message.role === 'assistant'
  ? <MarkdownMessage content={message.content} />
  : <p className="message__plain-text">{message.content}</p>}
```

- [ ] **Step 6: Run focused tests**

Expected: all Markdown and conversation tests pass.

### Task 2: Restructure the assistant page without a chat card

**Files:**
- Modify: `frontend/src/pages/AssistantPage.tsx`
- Modify: `frontend/src/components/assistant/Conversation.tsx`
- Modify: `frontend/src/components/assistant/PromptComposer.tsx`
- Modify: `frontend/src/styles/canvas-glass.css`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/pages/AssistantPage.test.tsx`

- [ ] **Step 1: Add failing structural tests**

Assert the page has an `assistant-reading-surface`, no `assistant-chat` glass panel, a conversation region, a bottom composer, and a history control with `aria-expanded=false` initially.

- [ ] **Step 2: Run the page test and verify failure**

Run: `pnpm test:run -- --reporter=dot src/pages/AssistantPage.test.tsx`  
Expected: FAIL on the new reading-surface semantics.

- [ ] **Step 3: Replace the large rounded container**

Remove `GlassPanel` around the chat. Build one centered reading column directly inside the canvas, with a restrained toolbar, starter prompts, message stream, and composer. Preserve all existing save/reset/session behavior.

- [ ] **Step 4: Restyle messages and composer**

Assistant messages use open typography and subtle separators. User messages align right with a minimal translucent accent. The composer uses a thin translucent strip and visible focus outline, not a thick floating pill.

- [ ] **Step 5: Add Markdown typography**

Define responsive styles for `h1`-`h4`, paragraphs, strong/emphasis, lists, quote, links, inline code, scrollable code blocks, and tables. Use readable line lengths and contrast over every candidate background.

- [ ] **Step 6: Run the page and conversation tests**

Expected: persistence, send, retry, and resource recommendation tests remain green.

### Task 3: Implement the collapsible history rail

**Files:**
- Modify: `frontend/src/pages/AssistantPage.tsx`
- Modify: `frontend/src/styles/canvas-glass.css`
- Test: `frontend/src/pages/AssistantPage.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Verify default collapsed state, opening via “打开历史记录”, closing via button/Escape, restoring a conversation closes the rail, and mobile markup exposes a dialog-like drawer label.

- [ ] **Step 2: Implement the rail**

Desktop collapsed width is icon-sized. Expanded width contains reset/new conversation, a search input, and recent conversations. Mobile uses a fixed overlay drawer. Preserve deletion and maximum-five conversation behavior.

- [ ] **Step 3: Keep demand clues compact**

Move clues into a small summary above the conversation or a secondary rail section. Do not retain the existing permanent navy card.

- [ ] **Step 4: Run accessibility-focused tests**

Expected: `aria-expanded`, labels, focus visibility, Escape handling, restore, and delete behavior pass.

### Task 4: Prepare three background candidates

**Files:**
- Read: `frontend/public/brand/assistant-desk.webp`
- Read: `frontend/public/brand/campus-hero.webp`
- Read: `frontend/public/brand/profile-walkway.webp`
- Read: `frontend/public/brand/home-campus-life-wide.webp`
- Modify only if necessary: `frontend/src/data/pagePhotography.ts`
- Create visual artifacts under: `output/playwright/assistant-background-*.png`

- [ ] **Step 1: Inspect existing licensed/project-owned images**

Compare subject placement, text-safe negative space, resolution, and compatibility with a low-saturation overlay.

- [ ] **Step 2: Use one reversible default for implementation**

Keep `assistant-desk.webp` unless another existing image materially improves readability. The final selection remains pending user review.

- [ ] **Step 3: Capture three actual-page previews**

Run the local app and use Playwright to capture the same assistant layout with desk, snow-campus, and walkway/grass candidates at desktop size. Save named PNGs under `output/playwright/` for the evening review.

- [ ] **Step 4: Check mobile readability**

Capture the leading candidate at a mobile viewport and verify focal cropping, composer visibility, and readable Markdown contrast.

### Task 5: Full verification and preview handoff

**Files:**
- Verify only.

- [ ] **Step 1: Run frontend verification**

```powershell
pnpm test:run -- --reporter=dot
pnpm lint
pnpm build
```

- [ ] **Step 2: Run browser smoke checks**

Verify initial assistant state, Markdown fixture response, history open/close, long conversation scrolling, narrow viewport, and no horizontal overflow.

- [ ] **Step 3: Keep the preview available**

Start the local Vite server and provide the local URL plus the three background screenshots. Do not commit or upload.

# USTC Navigator Frontend V1 Implementation Plan

> **For Codex:** Use the executing-plans skill to implement this plan task by task. Follow test-driven development for user-visible behavior and run the verification suite before claiming completion.

**Goal:** Deliver a polished, responsive first frontend version of the USTC campus resource navigator with four working routes, realistic local data, an exploration-led homepage, resource discovery, details, and an AI assistant interaction shell.

**Architecture:** A standalone Vite React application lives in `frontend/`. Domain types and a data adapter isolate the UI from the crawler's evolving JSON schema. React Router owns page navigation; page state remains local and URL-driven where useful. The first version reads bundled data and exposes no private credentials or write APIs.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Lucide React, Vitest, Testing Library, Playwright.

---

## Task 1: Scaffold the frontend and quality toolchain

**Files:**

- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/app/App.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/eslint.config.js`
- Create: `frontend/playwright.config.ts`

**Step 1: Add package scripts and dependencies**

Scripts must include `dev`, `build`, `lint`, `test`, `test:run`, and `test:e2e`. Install runtime dependencies for React, routing, and icons, plus development dependencies for Vite, TypeScript, Tailwind, Vitest, Testing Library, ESLint, and Playwright.

**Step 2: Add the minimum application entry**

Mount `App` inside `StrictMode`; import the global stylesheet. Configure the `@` alias to `frontend/src` in TypeScript, Vite, Vitest, and Playwright-compatible imports.

**Step 3: Configure Tailwind and test environments**

Use the Tailwind Vite plugin. Configure Vitest for `jsdom`, setup files, CSS support, and coverage-ready source inclusion. Add `@testing-library/jest-dom` in the setup file.

**Step 4: Install and verify the scaffold**

Run:

```powershell
cd frontend
pnpm install
pnpm build
pnpm test:run
```

Expected: build succeeds and the empty test suite exits successfully.

**Step 5: Commit**

```powershell
git add frontend
git commit -m "chore: scaffold member C frontend"
```

## Task 2: Build the resource domain model and data adapter

**Files:**

- Create: `frontend/src/domain/resource.ts`
- Create: `frontend/src/domain/categories.ts`
- Create: `frontend/src/data/resourceAdapter.ts`
- Create: `frontend/src/data/resourceAdapter.test.ts`
- Create: `frontend/src/data/resources.ts`
- Create: `frontend/src/data/featuredResources.ts`
- Copy: `data without log in/原始数据_整合.json` to `frontend/src/data/raw/resources.json`

**Step 1: Write failing adapter tests**

Test that the adapter:

- generates stable IDs for crawler rows without IDs;
- preserves explicit IDs from the future API shape;
- maps all known legacy categories into one of the eight agreed top-level groups;
- normalizes missing summaries, tags, source labels, and dates safely;
- rejects malformed rows that have neither a title nor a URL;
- never emits a `javascript:` destination.

Run `pnpm test:run -- resourceAdapter.test.ts` and confirm failure because implementation does not exist.

**Step 2: Implement types, taxonomy, and adapter**

Define the normalized `Resource`, `ResourceCategory`, `ResourceSource`, and `ResourceAccess` types. Add the eight category definitions with label, short description, accent token, icon name, and legacy-category aliases. Use a deterministic lightweight hash over URL/title for fallback IDs.

**Step 3: Add the data entry module**

Import the copied raw JSON and export normalized resources, counts by category, a resource lookup map, and a small curated featured list. Keep raw data imports out of components.

**Step 4: Verify and commit**

Run:

```powershell
pnpm test:run -- resourceAdapter.test.ts
pnpm build
```

Expected: adapter tests and type checking pass.

```powershell
git add frontend/src/domain frontend/src/data
git commit -m "feat: normalize campus resource data"
```

## Task 3: Establish brand assets, visual tokens, and application shell

**Files:**

- Create: `frontend/public/brand/ustc-mark.svg` or add the official downloadable mark in its supplied format
- Create: `frontend/public/brand/campus-hero.jpg`
- Create: `frontend/public/brand/SOURCES.md`
- Create: `frontend/src/app/router.tsx`
- Create: `frontend/src/layout/AppShell.tsx`
- Create: `frontend/src/layout/AppShell.test.tsx`
- Create: `frontend/src/components/BrandMark.tsx`
- Create: `frontend/src/components/PageTransition.tsx`
- Create: `frontend/src/pages/NotFoundPage.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/styles.css`

**Step 1: Source authorized official assets**

Download the school mark and one campus photograph from official USTC pages only. Record the source page, direct asset URL, retrieval date, and authorization note in `SOURCES.md`. Optimize the hero image for web without changing its meaning or adding synthetic content.

**Step 2: Write failing shell tests**

Test desktop navigation labels, the mobile menu button, active-route semantics, the “学生参赛项目” disclosure, and a skip-to-content link.

**Step 3: Implement the visual system and shell**

Use a restrained palette centered on USTC deep blue, warm paper white, ink, and one cyan accent. Use no more than two font families. Add fluid typography, focus rings, reduced-motion support, and reusable surface/button classes. Implement a sticky translucent navigation bar with a real blur only where contrast remains readable.

**Step 4: Configure routes**

Wire `/`, `/resources`, `/resources/:id`, `/assistant`, and a 404 page. Route placeholders may be minimal at this task only.

**Step 5: Verify and commit**

Run `pnpm test:run -- AppShell.test.tsx` and `pnpm build`.

```powershell
git add frontend/public/brand frontend/src/app frontend/src/layout frontend/src/components frontend/src/pages frontend/src/styles.css
git commit -m "feat: establish USTC navigation shell"
```

## Task 4: Implement the exploration-led homepage

**Files:**

- Create: `frontend/src/pages/HomePage.tsx`
- Create: `frontend/src/pages/HomePage.test.tsx`
- Create: `frontend/src/components/home/HeroExplorer.tsx`
- Create: `frontend/src/components/home/CategoryAtlas.tsx`
- Create: `frontend/src/components/home/FeaturedStrip.tsx`
- Create: `frontend/src/components/home/AssistantInvitation.tsx`
- Modify: `frontend/src/app/router.tsx`

**Step 1: Write failing homepage tests**

Test that the page renders the product proposition, global search, all eight categories, truthful resource counts, featured resources, and the AI assistant entry. Test that submitting a search navigates to `/resources?q=...`, and category selection navigates with `category=...`.

**Step 2: Build the image-led hero**

Use the campus photograph as a full-width visual stage with strong text contrast and restrained path/node decoration. The headline should explain the outcome in one sentence; search should be the primary action and “让 AI 帮我梳理” the secondary action. Avoid generic AI copy and decorative dashboard metrics.

**Step 3: Build the eight-category atlas**

Create an asymmetric but scannable editorial grid. Each category has a distinct icon, short plain-language description, count, and hover/focus response. Keep all text live HTML; no text embedded in images.

**Step 4: Add featured resources and assistant invitation**

Use real normalized dataset entries and preserve the original official destination. Add only two or three restrained motions: hero reveal, category hover path, and section entrance; respect `prefers-reduced-motion`.

**Step 5: Verify and commit**

Run `pnpm test:run -- HomePage.test.tsx` and `pnpm build`.

```powershell
git add frontend/src/pages/HomePage.tsx frontend/src/pages/HomePage.test.tsx frontend/src/components/home frontend/src/app/router.tsx
git commit -m "feat: add campus exploration homepage"
```

## Task 5: Implement the resource hall and discovery controls

**Files:**

- Create: `frontend/src/pages/ResourcesPage.tsx`
- Create: `frontend/src/pages/ResourcesPage.test.tsx`
- Create: `frontend/src/components/resources/ResourceFilters.tsx`
- Create: `frontend/src/components/resources/CategoryTree.tsx`
- Create: `frontend/src/components/resources/ResourceCard.tsx`
- Create: `frontend/src/components/resources/ResourceResults.tsx`
- Create: `frontend/src/lib/resourceSearch.ts`
- Create: `frontend/src/lib/resourceSearch.test.ts`
- Modify: `frontend/src/app/router.tsx`

**Step 1: Write failing search/filter tests**

Cover normalized title/summary/tag/source matching, category filtering, blank queries, stable relevance order, pagination, and URL query parsing.

**Step 2: Implement pure search/filter functions**

Keep search logic framework-independent. Prefer exact title matches, then tags, then summary/search text. Return original normalized resources and do not mutate source arrays.

**Step 3: Write failing page interaction tests**

Test initial query/category restoration from the URL, result counts, category tree toggles, clear filters, empty state, resource links, and external official links.

**Step 4: Implement the page**

Use a compact two-level category tree as secondary navigation and an editorial results list as the main area. On mobile, collapse filters into an accessible drawer. Paginate or progressively reveal results so 1,000+ records do not render at once.

**Step 5: Verify and commit**

Run:

```powershell
pnpm test:run -- resourceSearch.test.ts ResourcesPage.test.tsx
pnpm build
```

```powershell
git add frontend/src/pages/ResourcesPage* frontend/src/components/resources frontend/src/lib/resourceSearch* frontend/src/app/router.tsx
git commit -m "feat: add searchable resource hall"
```

## Task 6: Implement resource details and missing-resource behavior

**Files:**

- Create: `frontend/src/pages/ResourceDetailPage.tsx`
- Create: `frontend/src/pages/ResourceDetailPage.test.tsx`
- Create: `frontend/src/components/resources/ResourceMetadata.tsx`
- Create: `frontend/src/components/resources/RelatedResources.tsx`
- Modify: `frontend/src/app/router.tsx`

**Step 1: Write failing detail tests**

Test title, summary fallback, category breadcrumb, source authority, update date, tags, access/cost/how-to fields when present, safe official link behavior, related resources, and an unknown-ID state.

**Step 2: Implement detail presentation**

Treat the original source link as the primary completion action. Make absent fields disappear gracefully instead of displaying empty labels. Related resources should share category/tags and exclude the current item.

**Step 3: Verify and commit**

Run `pnpm test:run -- ResourceDetailPage.test.tsx` and `pnpm build`.

```powershell
git add frontend/src/pages/ResourceDetailPage* frontend/src/components/resources frontend/src/app/router.tsx
git commit -m "feat: add resource detail experience"
```

## Task 7: Implement the AI assistant interaction shell

**Files:**

- Create: `frontend/src/pages/AssistantPage.tsx`
- Create: `frontend/src/pages/AssistantPage.test.tsx`
- Create: `frontend/src/components/assistant/Conversation.tsx`
- Create: `frontend/src/components/assistant/PromptComposer.tsx`
- Create: `frontend/src/components/assistant/NeedClarifier.tsx`
- Create: `frontend/src/components/assistant/ResourceRecommendation.tsx`
- Create: `frontend/src/services/assistantClient.ts`
- Create: `frontend/src/services/assistantClient.test.ts`
- Modify: `frontend/src/app/router.tsx`

**Step 1: Write failing client-contract tests**

Define the frontend request/response shape independently of transport. Test timeout/error normalization and a local demo response provider. Keep the API base URL in `VITE_API_BASE_URL` with no secrets.

**Step 2: Write failing interaction tests**

Test starter prompts, message submission, loading state, clarification choices for vague needs, recommended resource cards, retry after error, keyboard submission, and empty-input rejection.

**Step 3: Implement the assistant shell**

Make the assistant a guided navigator, not an open-ended chatbot clone. Use a split layout on desktop: conversation on the left, evolving “需求线索” on the right. Use progressive disclosure on mobile. The demo provider must be clearly labeled and replaceable by B/D's endpoint through the service module.

**Step 4: Verify and commit**

Run:

```powershell
pnpm test:run -- assistantClient.test.ts AssistantPage.test.tsx
pnpm build
```

```powershell
git add frontend/src/pages/AssistantPage* frontend/src/components/assistant frontend/src/services frontend/src/app/router.tsx
git commit -m "feat: add guided AI navigator shell"
```

## Task 8: Add browser flows, accessibility checks, and final polish

**Files:**

- Create: `frontend/e2e/navigation.spec.ts`
- Create: `frontend/e2e/resources.spec.ts`
- Create: `frontend/e2e/assistant.spec.ts`
- Create: `frontend/README.md`
- Modify: `frontend/src/styles.css`
- Modify: components as required by verified defects

**Step 1: Write Playwright flows**

Cover:

- homepage search to filtered resource results;
- category exploration to resource details to official source;
- guided assistant prompt to recommendation;
- mobile navigation at a 390px viewport;
- keyboard-only access to primary flows.

**Step 2: Run the app and inspect real rendering**

Run `pnpm dev --host 127.0.0.1`, then inspect at desktop and mobile sizes. Check image crops, long Chinese titles, focus order, overflow, loading/empty/error states, and reduced-motion behavior. Capture screenshots for comparison but do not commit temporary screenshots.

**Step 3: Fix defects using TDD**

For each functional defect, add a failing unit or browser regression test before changing production behavior. For purely visual defects, document the viewport and expected correction, then verify with a new screenshot.

**Step 4: Add handoff documentation**

Document install/run/test commands, environment variables, the data-adapter boundary, expected assistant API contract, asset sources, and the known distinction between local demo data and final backend data.

**Step 5: Run full verification**

```powershell
cd frontend
pnpm lint
pnpm test:run
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: every command exits 0. Also run `git diff --check` from the repository root.

**Step 6: Commit**

```powershell
git add frontend
git commit -m "test: verify responsive frontend flows"
```

## Completion Criteria

- The four agreed routes are usable without a backend.
- Homepage visibly supports free exploration rather than presenting a generic dashboard.
- All 1,000+ current crawler records are discoverable through the adapter and resource hall.
- Official assets have recorded provenance; no untracked third-party artwork is embedded.
- Desktop and mobile primary flows pass automated browser tests.
- The frontend contains no API keys, cookies, or user-specific absolute paths.
- The branch remains isolated as `member-C-frontend` and is ready for teammate review.

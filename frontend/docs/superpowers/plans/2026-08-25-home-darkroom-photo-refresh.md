# Home Darkroom Photo Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the homepage into one continuous real-photography narrative and replace the blurred resource-hall image with a high-resolution real photograph.

**Architecture:** Preserve all search and navigation behavior. Replace the two `CanvasPage` story sections with one `HomeStory` scroll canvas containing two layered real photographs and two semantic text chapters; keep the resource page component unchanged and update only its registered visual asset.

**Tech Stack:** React 19, TypeScript, CSS, WebP, Vitest, Playwright.

---

### Task 1: Acquire and validate real photography

**Files:**
- Modify: `public/brand/SOURCES.md`
- Add: `public/brand/home-life-real.webp`
- Add: `public/brand/resources-campus-hd.webp`
- Modify: `src/data/pagePhotography.ts`
- Test: `src/data/visualAssets.test.ts`

- [ ] Add failing assertions that the homepage life image and resource image are distinct, marked `official` or `stock`, and use the new paths.
- [ ] Run `pnpm vitest run src/data/visualAssets.test.ts` and verify RED.
- [ ] Source two real photographs from traceable official or licensed pages, download originals, resize only when longer than 3200px, and export WebP at quality 88 with a minimum 2560px long edge.
- [ ] Update `pageVisuals.homeIntro`, `pageVisuals.homeTeam`, and `pageVisuals.resources` so the homepage story uses the new real photograph and resources use the independent HD photograph.
- [ ] Record original URL, creator, license, download date, dimensions, and conversion details in `SOURCES.md`.
- [ ] Run the asset test and verify GREEN.

### Task 2: Replace the stacked homepage canvases

**Files:**
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/components/home/HomeStory.tsx`
- Modify: `src/styles/canvas-glass.css`

- [ ] Replace the existing two-canvas assertions with a failing contract for one `.home-darkroom` region, two photo layers, and two text chapters.
- [ ] Run `pnpm vitest run src/pages/HomePage.test.tsx` and verify RED.
- [ ] Rebuild `HomeStory` as one semantic section with `.home-darkroom__campus`, `.home-darkroom__life`, `.home-darkroom__blend`, `.home-darkroom__about`, and `.home-darkroom__team` elements.
- [ ] Add desktop styles for a roughly 130vh sticky photographic stage, a 30vh double-exposure transition, cardless typography, and a static reduced-motion fallback.
- [ ] Run the homepage tests and verify GREEN.

### Task 3: Verify desktop rendering and behavior

**Files:**
- Modify: `e2e/navigation.spec.ts`
- Modify: `src/styles/canvas-glass.css` only for observed visual defects.

- [ ] Add a desktop assertion that the homepage contains one darkroom story region and that the resources canvas uses `/brand/resources-campus-hd.webp` at opacity 1.
- [ ] Run the targeted Playwright test and verify it fails before the final registry/style connection, then passes after it.
- [ ] Inspect `/` and `/resources` at 1440×900 and 1920×1080; verify no hard horizontal photo bands, no opaque story cards, no blur from source resolution, and no horizontal overflow.
- [ ] Run `pnpm lint`, `pnpm test:run`, `pnpm build`, and `pnpm exec playwright test --project=chromium`.

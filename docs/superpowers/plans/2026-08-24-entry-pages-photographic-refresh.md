# USTC Navigator Entry Pages Photographic Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the formal, AI-like entry copy on the home, resource, and assistant pages with three distinct official USTC photographs and concise, natural prompts.

**Architecture:** Keep routing, data services, search state, and assistant behavior unchanged. Introduce one presentation-only `PhotographicHero` component for shared image, veil, caption, and content layout; each page supplies its own image, heading, actions, and accessible description. Store every official photograph locally under `frontend/public/brand/` and document provenance.

**Tech Stack:** React 19, TypeScript, Vite, CSS, Vitest, Testing Library, Playwright.

---

### Task 1: Lock the new page copy and image semantics with failing tests

**Files:**
- Modify: `frontend/src/pages/HomePage.test.tsx`
- Modify: `frontend/src/pages/ResourcesPage.test.tsx`
- Modify: `frontend/src/pages/AssistantPage.test.tsx`

- [ ] **Step 1: Update the homepage expectation**

```tsx
expect(screen.getByRole('heading', { name: '今天，想在科大做点什么？' })).toBeInTheDocument()
expect(screen.getByRole('img', { name: '中国科学技术大学郭沫若广场校园风景' })).toBeInTheDocument()
expect(screen.queryByText(/不必先知道部门名称/)).not.toBeInTheDocument()
```

- [ ] **Step 2: Add the resource hall expectations**

```tsx
expect(screen.getByRole('heading', { name: '要找的入口，从这里出发。' })).toBeInTheDocument()
expect(screen.getByRole('img', { name: '中国科学技术大学东区西大门' })).toBeInTheDocument()
expect(screen.queryByText(/把分散的入口/)).not.toBeInTheDocument()
```

- [ ] **Step 3: Update the assistant expectations**

```tsx
expect(screen.getByRole('heading', { name: '先说说，你想做什么。' })).toBeInTheDocument()
expect(screen.getByRole('img', { name: '雪后的中国科学技术大学校园与勤奋学习红专并进石碑' })).toBeInTheDocument()
expect(screen.queryByText(/猜部门和系统/)).not.toBeInTheDocument()
```

- [ ] **Step 4: Run the focused tests and confirm RED**

Run:

```powershell
cd frontend
pnpm test:run -- HomePage.test.tsx ResourcesPage.test.tsx AssistantPage.test.tsx
```

Expected: FAIL because the old headings and images are still rendered.

### Task 2: Localize and document the three official photographs

**Files:**
- Create: `frontend/public/brand/guo-moruo-square.webp`
- Create: `frontend/public/brand/east-gate.webp`
- Reuse: `frontend/public/brand/campus-hero.webp`
- Modify: `frontend/public/brand/SOURCES.md`

- [ ] **Step 1: Download the two approved official images**

```powershell
Invoke-WebRequest 'https://welcome.ustc.edu.cn/upload/ustcedu_/campus_album/6994d26b88d1c1be41b27cdcc063a128.jpg' -OutFile "$env:TEMP\guo-moruo-square.jpg"
Invoke-WebRequest 'https://welcome.ustc.edu.cn/upload/ustcedu_/campus_album/2e0534b8d31dbc2488c583fb7030a2aa.jpg' -OutFile "$env:TEMP\east-gate.jpg"
```

- [ ] **Step 2: Convert and resize for the web**

Use the bundled Pillow runtime to keep aspect ratio, cap the long edge at 2200 px, and save WebP at quality 84.

- [ ] **Step 3: Append exact provenance**

Record the source page `https://welcome.ustc.edu.cn/`, direct image URL, page label, retrieval date `2026-08-24`, and conversion details for both new files.

- [ ] **Step 4: Verify the assets**

Run a read-only image inspection and confirm both files decode, are non-zero, and have a long edge no greater than 2200 px.

### Task 3: Add the shared photographic hero and connect all three pages

**Files:**
- Create: `frontend/src/components/PhotographicHero.tsx`
- Modify: `frontend/src/components/home/HeroExplorer.tsx`
- Modify: `frontend/src/pages/ResourcesPage.tsx`
- Modify: `frontend/src/pages/AssistantPage.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add the shared presentation component**

```tsx
import type { ReactNode } from 'react'

interface PhotographicHeroProps {
  imageSrc: string
  imageAlt: string
  eyebrow: ReactNode
  title: ReactNode
  titleId: string
  children?: ReactNode
  caption: string
  className?: string
}

export default function PhotographicHero(props: PhotographicHeroProps) {
  return (
    <header className={`photo-entry ${props.className ?? ''}`} aria-labelledby={props.titleId}>
      <img className="photo-entry__image" src={props.imageSrc} alt={props.imageAlt} />
      <div className="photo-entry__veil" aria-hidden="true" />
      <div className="photo-entry__content shell-width">
        <div>
          <span className="photo-entry__eyebrow">{props.eyebrow}</span>
          <h1 id={props.titleId}>{props.title}</h1>
        </div>
        {props.children && <div className="photo-entry__actions">{props.children}</div>}
      </div>
      <span className="photo-entry__caption">{props.caption}</span>
    </header>
  )
}
```

- [ ] **Step 2: Connect the homepage**

Use `/brand/guo-moruo-square.webp`, the approved heading, the existing search form, resource count, and assistant link. Remove the route-node decoration and formal explanatory paragraph.

- [ ] **Step 3: Connect the resource hall**

Use `/brand/east-gate.webp`, the approved heading, and four non-interactive category cues. Keep `ResourceFilters` and all URL-driven behavior in `resources-workspace`; move the source-accuracy note directly above the results metadata.

- [ ] **Step 4: Connect the assistant page**

Use `/brand/campus-hero.webp`, the approved heading, starter-prompt cues, and the existing service status. Keep conversation state and `sendMessage` unchanged.

- [ ] **Step 5: Implement the visual system**

Add shared full-bleed image, deep-blue veil, warm-gold eyebrow, warm-paper continuation, responsive cropping, image reveal, and title rise. Maintain visible focus and `prefers-reduced-motion` behavior.

- [ ] **Step 6: Run focused tests and confirm GREEN**

```powershell
pnpm test:run -- HomePage.test.tsx ResourcesPage.test.tsx AssistantPage.test.tsx
```

Expected: all focused tests pass.

### Task 4: Verify interaction, rendering, and regression safety

**Files:**
- Modify only when a verified defect requires correction.

- [ ] **Step 1: Run static verification**

```powershell
pnpm lint
pnpm test:run
pnpm build
```

Expected: every command exits 0.

- [ ] **Step 2: Run core browser flows**

```powershell
pnpm test:e2e
```

Expected: homepage search, resource filtering, details, and assistant flows pass.

- [ ] **Step 3: Inspect real rendering**

Open `/`, `/resources`, and `/assistant` at desktop width and 390 px. Verify each page has a distinct photograph, readable text, deliberate crops, no horizontal overflow, and usable primary controls.

- [ ] **Step 4: Check the final diff**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only planned frontend, asset, source, test, and documentation changes appear.


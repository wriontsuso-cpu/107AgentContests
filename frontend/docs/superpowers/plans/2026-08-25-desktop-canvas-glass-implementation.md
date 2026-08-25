# Desktop Canvas Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild USTC Navigator's desktop pages as clear, photo-led canvases with readable warm and navy glass surfaces, while preserving every existing resource, AI, profile, and external-link behavior.

**Architecture:** Add two visual primitives (`CanvasPage` and `GlassPanel`) and a typed visual-asset registry, then compose existing page logic inside them. Keep business components and stores unchanged; place new desktop art direction in a focused stylesheet loaded after the legacy stylesheet so the redesign is isolated and reversible.

**Tech Stack:** React 19, TypeScript, Vite, CSS, Vitest + Testing Library, Playwright, IndexedDB profile store, WebP assets.

---

## File map

- Create `src/components/visual/CanvasPage.tsx`: full-page image, localized shade, fallback state, and content layer.
- Create `src/components/visual/GlassPanel.tsx`: shared warm/navy glass surface.
- Create `src/components/visual/DecorativeArtwork.tsx`: non-semantic art that hides cleanly on load failure.
- Create `src/components/visual/VisualPrimitives.test.tsx`: primitive contract tests.
- Create `src/data/visualAssets.test.ts`: asset mapping, uniqueness, and provenance tests.
- Modify `src/data/pagePhotography.ts`: typed page and detail visual registry.
- Create `src/styles/canvas-glass.css`: desktop-only canvas, glass, page composition, and reduced-motion styles.
- Modify `src/main.tsx`: load the new stylesheet after `styles.css`.
- Modify `src/components/home/HomeStory.tsx`: two photo-led story canvases.
- Modify `src/pages/ResourcesPage.tsx`: one continuous resource canvas with glass search/sidebar/results.
- Modify `src/pages/ProfilePage.tsx`: keep hero, form, dashboard, and warnings on one canvas.
- Modify `src/pages/AssistantPage.tsx`: desk canvas plus warm chat and navy side rail.
- Modify `src/pages/ResourceDetailPage.tsx`: category canvas plus shared glass regions.
- Modify the corresponding page tests and `e2e/navigation.spec.ts`.
- Add `public/brand/resources-campus-life.webp`, `profile-walkway.webp`, `home-intro.webp`, `home-team.webp`, and `assistant-desk.webp`.
- Add `public/brand/decorative-route.svg` and `decorative-cat.svg`.
- Modify `public/brand/SOURCES.md`: record Pexels and generated-asset provenance.

### Task 1: Add visual primitives

**Files:**
- Create: `src/components/visual/VisualPrimitives.test.tsx`
- Create: `src/components/visual/CanvasPage.tsx`
- Create: `src/components/visual/GlassPanel.tsx`
- Create: `src/components/visual/DecorativeArtwork.tsx`

- [ ] **Step 1: Write the failing primitive tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CanvasPage from './CanvasPage'
import GlassPanel from './GlassPanel'
import DecorativeArtwork from './DecorativeArtwork'

describe('visual primitives', () => {
  it('keeps the source image fully present and exposes a fallback when it fails', () => {
    render(<CanvasPage src="/brand/test.webp" alt="测试场景"><p>内容</p></CanvasPage>)
    const canvas = screen.getByTestId('canvas-page')
    const image = screen.getByRole('img', { name: '测试场景' })
    expect(canvas).toHaveClass('canvas-page')
    expect(image).toHaveClass('canvas-page__image')
    fireEvent.error(image)
    expect(canvas).toHaveClass('canvas-page--fallback')
    expect(screen.getByText('内容')).toBeVisible()
  })

  it('renders named warm and navy glass surfaces', () => {
    const { rerender } = render(<GlassPanel tone="warm">搜索</GlassPanel>)
    expect(screen.getByText('搜索')).toHaveClass('glass-panel', 'glass-panel--warm')
    rerender(<GlassPanel tone="navy" as="aside">分类</GlassPanel>)
    expect(screen.getByText('分类').tagName).toBe('ASIDE')
    expect(screen.getByText('分类')).toHaveClass('glass-panel--navy')
  })

  it('keeps decorative artwork non-semantic and hides it after a load failure', () => {
    const { container } = render(<DecorativeArtwork src="/brand/decorative-cat.svg" className="cat-doodle" />)
    const image = container.querySelector('img')!
    expect(image).toHaveAttribute('alt', '')
    fireEvent.error(image)
    expect(image).not.toBeVisible()
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test:run src/components/visual/VisualPrimitives.test.tsx`

Expected: FAIL because `CanvasPage` and `GlassPanel` do not exist.

- [ ] **Step 3: Implement the primitives**

```tsx
// src/components/visual/CanvasPage.tsx
import { useState, type PropsWithChildren } from 'react'

interface CanvasPageProps extends PropsWithChildren {
  src: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
  focalPoint?: string
}

export default function CanvasPage({ src, alt, className = '', loading = 'eager', focalPoint = 'center', children }: CanvasPageProps) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`canvas-page${failed ? ' canvas-page--fallback' : ''} ${className}`.trim()} data-testid="canvas-page">
      {!failed && <img className="canvas-page__image" src={src} alt={alt} loading={loading} decoding="async" style={{ objectPosition: focalPoint }} onError={() => setFailed(true)} />}
      <div className="canvas-page__shade" aria-hidden="true" />
      <div className="canvas-page__content">{children}</div>
    </div>
  )
}
```

```tsx
// src/components/visual/GlassPanel.tsx
import { createElement, type ElementType, type HTMLAttributes, type PropsWithChildren } from 'react'

interface GlassPanelProps extends PropsWithChildren<HTMLAttributes<HTMLElement>> {
  tone: 'warm' | 'navy'
  as?: ElementType
}

export default function GlassPanel({ tone, as = 'div', className = '', children, ...props }: GlassPanelProps) {
  return createElement(as, { ...props, className: `glass-panel glass-panel--${tone} ${className}`.trim() }, children)
}
```

```tsx
// src/components/visual/DecorativeArtwork.tsx
import { useState } from 'react'

export default function DecorativeArtwork({ src, className = '' }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <img src={src} alt="" role="presentation" aria-hidden="true" className={`decorative-artwork ${className}`.trim()} hidden={failed} onError={() => setFailed(true)} />
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `pnpm test:run src/components/visual/VisualPrimitives.test.tsx`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the primitives**

```bash
git add src/components/visual
git commit -m "feat: add canvas and glass visual primitives"
```

### Task 2: Acquire and register the mixed visual assets

**Files:**
- Create: `src/data/visualAssets.test.ts`
- Modify: `src/data/pagePhotography.ts`
- Add: `public/brand/resources-campus-life.webp`
- Add: `public/brand/profile-walkway.webp`
- Add: `public/brand/home-intro.webp`
- Add: `public/brand/home-team.webp`
- Add: `public/brand/assistant-desk.webp`
- Add: `public/brand/decorative-route.svg`
- Add: `public/brand/decorative-cat.svg`
- Modify: `public/brand/SOURCES.md`

- [ ] **Step 1: Write the failing asset-registry test**

```ts
import { describe, expect, it } from 'vitest'
import { detailPhotography, pageVisuals } from './pagePhotography'

describe('pageVisuals', () => {
  it('assigns distinct desktop canvases with traceable provenance', () => {
    const pageEntries = Object.values(pageVisuals)
    expect(new Set(pageEntries.map((entry) => entry.src)).size).toBe(pageEntries.length)
    expect(pageVisuals.resources.kind).toBe('stock')
    expect(pageVisuals.profile.kind).toBe('stock')
    expect(pageVisuals.assistant.kind).toBe('generated')
    expect(pageEntries.every((entry) => entry.src.endsWith('.webp'))).toBe(true)
    expect(new Set(Object.values(detailPhotography)).size).toBe(Object.values(detailPhotography).length)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test:run src/data/visualAssets.test.ts`

Expected: FAIL because `pageVisuals` is not exported.

- [ ] **Step 3: Download the two licensed Pexels photos and convert them to WebP**

Use the browser download action on these exact source pages:

- Resources: `https://www.pexels.com/photo/urban-cyclist-rides-through-university-campus-37142875/`
- Profile: `https://www.pexels.com/photo/tree-lined-pathway-in-urban-campus-setting-31522894/`

Save the originals as `output/assets/resources-campus-life.jpg` and `output/assets/profile-walkway.jpg`, then convert with Pillow, keeping the long edge at 2000px:

```bash
python -c "from PIL import Image; from pathlib import Path; pairs=[(Path('output/assets/resources-campus-life.jpg'),Path('public/brand/resources-campus-life.webp')),(Path('output/assets/profile-walkway.jpg'),Path('public/brand/profile-walkway.webp'))]; [(lambda im,out:(im.thumbnail((2000,2000)),im.save(out,'WEBP',quality=84)))(Image.open(src).convert('RGB'),out) for src,out in pairs]"
```

- [ ] **Step 4: Generate the three decorative scene assets**

Use the image generation tool once per prompt, with no embedded text, logos, UI, or recognizable institution marks:

1. `home-intro.webp`: “Warm editorial illustration of a sunlit student desk beside a window, notebook, folded campus map with small location pins, leaves, subtle orange tabby cat silhouette, cream navy and apricot palette, realistic paper textures, wide 16:9 composition, calm space on the left for Chinese typography.”
2. `home-team.webp`: “Warm cinematic student collaboration room for four university teammates, laptops, notebooks, sticky notes and soft afternoon light, friendly lived-in atmosphere, no visible faces, cream navy and apricot palette, wide 16:9 composition, calm space on the right for typography.”
3. `assistant-desk.webp`: “Cozy night study desk with an unfolded generic campus map, books, warm desk lamp, hand-drawn route marks and tiny star motifs, deep navy shadows with apricot light, photographic illustration, wide 16:9, calm central-left area for a chat interface, no text or logos.”

Convert generated outputs to WebP at a maximum long edge of 2000px and save them to the exact paths above.

- [ ] **Step 5: Implement the typed registry**

```ts
import type { ResourceCategoryId } from '@/domain/categories'

export interface PageVisual {
  src: string
  alt: string
  kind: 'official' | 'stock' | 'generated'
  focalPoint: string
}

export const pageVisuals = {
  homeIntro: { src: '/brand/home-intro.webp', alt: '窗边书桌与校园地图插画', kind: 'generated', focalPoint: 'center 48%' },
  homeTeam: { src: '/brand/home-team.webp', alt: '学生团队协作空间插画', kind: 'generated', focalPoint: 'center 50%' },
  resources: { src: '/brand/resources-campus-life.webp', alt: '林荫校园道路与自行车', kind: 'stock', focalPoint: 'center 48%' },
  assistant: { src: '/brand/assistant-desk.webp', alt: '夜间书桌、地图与书本插画', kind: 'generated', focalPoint: 'center 52%' },
  profile: { src: '/brand/profile-walkway.webp', alt: '明亮的林荫校园步道', kind: 'stock', focalPoint: 'center 50%' },
} as const satisfies Record<string, PageVisual>

export const detailPhotography: Record<ResourceCategoryId, string> = {
  services: '/brand/detail-services.webp', learning: '/brand/detail-learning.webp', research: '/brand/detail-research.webp',
  competition: '/brand/detail-competition.webp', community: '/brand/detail-community.webp', life: '/brand/detail-life.webp',
  wellbeing: '/brand/detail-wellbeing.webp', future: '/brand/detail-future.webp', other: '/brand/east-gate.webp',
}
```

- [ ] **Step 6: Add two original lightweight SVG decorations**

```svg
<!-- public/brand/decorative-route.svg -->
<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 126 C64 18 130 154 218 36" fill="none" stroke="#e8864a" stroke-width="5" stroke-linecap="round" stroke-dasharray="3 13"/>
  <g fill="#0b315e"><circle cx="22" cy="126" r="8"/><circle cx="122" cy="96" r="8"/><circle cx="218" cy="36" r="8"/></g>
  <g fill="#fff7ea"><circle cx="66" cy="36" r="3"/><circle cx="154" cy="32" r="4"/><circle cx="188" cy="124" r="3"/><circle cx="98" cy="138" r="2.5"/></g>
</svg>
```

```svg
<!-- public/brand/decorative-cat.svg -->
<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <path d="M36 110 C42 76 72 58 108 66 C138 72 150 98 136 120 C119 146 65 143 40 121" fill="none" stroke="#0b315e" stroke-width="7" stroke-linecap="round"/>
  <path d="M48 82 L55 57 L75 73 M111 71 L132 55 L136 88" fill="none" stroke="#0b315e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M136 119 C164 111 166 142 143 147 C126 151 117 140 124 132" fill="none" stroke="#e8864a" stroke-width="7" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 7: Record provenance**

Append entries to `public/brand/SOURCES.md` containing the five image filenames, both Pexels source pages and creators, the download date, conversion details, and an explicit “AI 生成装饰素材，不代表中国科大真实场景” note for the generated files. Record the two SVGs as original project decoration under the same navy/apricot palette.

- [ ] **Step 8: Run the registry test and commit**

Run: `pnpm test:run src/data/visualAssets.test.ts`

Expected: PASS.

```bash
git add src/data/pagePhotography.ts src/data/visualAssets.test.ts public/brand public/brand/SOURCES.md
git commit -m "feat: add mixed campus life visual assets"
```

### Task 3: Add the desktop canvas-glass stylesheet

**Files:**
- Modify: `src/main.tsx`
- Create: `src/styles/canvas-glass.css`
- Modify: `e2e/navigation.spec.ts`

- [ ] **Step 1: Replace the old opacity regression with a failing canvas contract**

```ts
test('desktop canvas keeps its photograph visible behind glass surfaces', async ({ page }) => {
  await page.goto('/resources')
  const canvas = page.getByTestId('canvas-page')
  await expect(canvas.locator('.canvas-page__image')).toHaveCSS('opacity', '1')
  await expect(canvas.locator('.glass-panel--warm').first()).toHaveCSS('backdrop-filter', /blur/)
  const warm = await canvas.locator('.glass-panel--warm').first().evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(warm).not.toBe('rgb(255, 255, 255)')
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm exec playwright test e2e/navigation.spec.ts --grep "desktop canvas" --project=chromium`

Expected: FAIL because pages do not yet render `CanvasPage` or `GlassPanel`.

- [ ] **Step 3: Import the new stylesheet after legacy styles**

```ts
import '@/styles.css'
import '@/styles/canvas-glass.css'
```

- [ ] **Step 4: Create the visual tokens and primitive CSS**

```css
:root {
  --canvas-navy: 4 24 54;
  --canvas-cream: 250 247 239;
  --canvas-apricot: #e8864a;
  --glass-border: rgba(255,255,255,.36);
  --glass-shadow: 0 24px 70px rgba(3,18,43,.22);
}

.canvas-page { position:relative; isolation:isolate; min-height:calc(100vh - 78px); overflow:hidden; background:linear-gradient(135deg,#102d51,#d77b48); }
.canvas-page__image { position:absolute; z-index:-3; inset:0; width:100%; height:100%; object-fit:cover; opacity:1; animation:canvas-arrive 1.1s cubic-bezier(.22,1,.36,1) both; }
.canvas-page__shade { position:absolute; z-index:-2; inset:0; background:linear-gradient(90deg,rgba(3,18,43,.35),rgba(3,18,43,.08) 52%,rgba(3,18,43,.2)); pointer-events:none; }
.canvas-page__content { position:relative; min-height:inherit; }
.canvas-page--fallback .canvas-page__shade { background:radial-gradient(circle at 84% 14%,rgba(232,134,74,.5),transparent 28%),linear-gradient(135deg,#0a315e,#efe0cb); }
.glass-panel { border:1px solid var(--glass-border); box-shadow:var(--glass-shadow); backdrop-filter:blur(18px) saturate(115%); }
.glass-panel--warm { color:#14233b; background:rgba(var(--canvas-cream),.89); }
.glass-panel--navy { color:#f8f5ee; background:rgba(var(--canvas-navy),.76); }
.decorative-artwork { position:absolute; z-index:1; pointer-events:none; filter:drop-shadow(0 10px 22px rgba(3,18,43,.16)); }
@keyframes canvas-arrive { from { transform:scale(1.02); filter:saturate(.82); } to { transform:scale(1); filter:saturate(1); } }
@media (prefers-reduced-motion:reduce) { .canvas-page__image { animation:none; } }
```

- [ ] **Step 5: Commit the base stylesheet**

```bash
git add src/main.tsx src/styles/canvas-glass.css e2e/navigation.spec.ts
git commit -m "feat: add desktop canvas glass styling"
```

### Task 4: Recompose the home page

**Files:**
- Modify: `src/components/home/HomeStory.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/styles/canvas-glass.css`

- [ ] **Step 1: Add failing home visual assertions**

Add to the existing first home test:

```tsx
expect(screen.getByRole('img', { name: '窗边书桌与校园地图插画' })).toHaveAttribute('src', '/brand/home-intro.webp')
expect(screen.getByRole('img', { name: '学生团队协作空间插画' })).toHaveAttribute('src', '/brand/home-team.webp')
expect(screen.getAllByTestId('canvas-page')).toHaveLength(2)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test:run src/pages/HomePage.test.tsx`

Expected: FAIL because both story panels still reuse郭沫若广场.

- [ ] **Step 3: Rebuild `HomeStory` with the visual primitives**

```tsx
import CanvasPage from '@/components/visual/CanvasPage'
import GlassPanel from '@/components/visual/GlassPanel'
import { pageVisuals } from '@/data/pagePhotography'

export default function HomeStory() {
  return (
    <section className="home-story home-story--canvas" aria-label="网站与队伍介绍">
      <CanvasPage {...pageVisuals.homeIntro} loading="lazy" className="home-story-canvas home-story-canvas--intro">
        <GlassPanel tone="warm" as="article" className="home-story-glass shell-width">
          <span className="eyebrow">WHY USTC NAVIGATOR · 关于网站</span>
          <h2 aria-label="在科大，找入口不必绕远路。">在科大，找入口<br aria-hidden="true" />不必绕远路。</h2>
          <p>USTC Navigator 将散落在不同单位页面里的校园资源，整理成更容易搜索和确认的入口。你可以直接查找，也可以把想做的事告诉校园助手。</p>
        </GlassPanel>
      </CanvasPage>
      <CanvasPage {...pageVisuals.homeTeam} loading="lazy" className="home-story-canvas home-story-canvas--team">
        <GlassPanel tone="navy" as="article" className="home-story-glass shell-width">
          <span className="eyebrow">ABOUT THE TEAM · 关于我们</span>
          <h2>我们是，啊对对队。</h2>
          <p>我们来自中国科学技术大学网络空间安全学院。余伊健、朱荣骐、陈泰然、赵世斌，因为一次对校园信息分散的共同感受走到一起，希望把查找资源这件小事，做得更简单、更可靠。</p>
        </GlassPanel>
      </CanvasPage>
    </section>
  )
}
```

- [ ] **Step 4: Add desktop composition styles and verify GREEN**

```css
.home-story--canvas { display:grid; gap:1px; }
.home-story-canvas { min-height:680px; display:grid; align-items:center; }
.home-story-glass { width:min(650px,calc(100% - 96px)); margin:0 6vw; padding:52px 58px; border-radius:18px; }
.home-story-canvas--team .home-story-glass { justify-self:end; }
.home-story-glass h2 { margin:14px 0 22px; font-family:var(--serif); font-size:clamp(44px,5vw,72px); line-height:1.06; }
.home-story-glass p { margin:0; font-size:16px; line-height:2; }
```

Run: `pnpm test:run src/pages/HomePage.test.tsx`

Expected: all HomePage tests PASS.

- [ ] **Step 5: Commit the home page**

```bash
git add src/components/home/HomeStory.tsx src/pages/HomePage.test.tsx src/styles/canvas-glass.css
git commit -m "feat: turn home stories into photo canvases"
```

### Task 5: Recompose resource hall and profile page

**Files:**
- Modify: `src/pages/ResourcesPage.test.tsx`
- Modify: `src/pages/ResourcesPage.tsx`
- Modify: `src/pages/ProfilePage.test.tsx`
- Modify: `src/pages/ProfilePage.tsx`
- Modify: `src/styles/canvas-glass.css`

- [ ] **Step 1: Add failing page-structure assertions**

```tsx
// ResourcesPage.test.tsx, in the introduction test
expect(screen.getByRole('img', { name: '林荫校园道路与自行车' })).toHaveAttribute('src', '/brand/resources-campus-life.webp')
expect(screen.getByTestId('canvas-page')).toContainElement(screen.getByRole('searchbox', { name: '搜索资源' }))
expect(screen.getAllByText(/条结果|正在整理校园资源/).length).toBeGreaterThan(0)

// ProfilePage.test.tsx, in the creation test
expect(screen.getByRole('img', { name: '明亮的林荫校园步道' })).toHaveAttribute('src', '/brand/profile-walkway.webp')
expect(screen.getByTestId('canvas-page')).toContainElement(screen.getByLabelText('昵称'))
```

- [ ] **Step 2: Run both tests and verify RED**

Run: `pnpm test:run src/pages/ResourcesPage.test.tsx src/pages/ProfilePage.test.tsx`

Expected: FAIL because the pages still split hero and content into separate backgrounds.

- [ ] **Step 3: Wrap the entire resource page in one canvas**

Add imports for `CanvasPage`, `GlassPanel`, `DecorativeArtwork`, and `pageVisuals`. Replace the `PhotographicHero` + `PageBackdrop` composition with this complete return tree; the state and helper functions above `return` remain unchanged:

```tsx
<CanvasPage {...pageVisuals.resources} className="resources-canvas">
  <header className="canvas-hero shell-width">
    <span className="eyebrow">RESOURCE DIRECTORY · 资源目录</span>
    <h1 id="resources-title">要找的入口，<br />从这里出发。</h1>
    <p>搜索、筛选，直接去官方页面。</p>
    <DecorativeArtwork src="/brand/decorative-route.svg" className="resources-route-doodle" />
  </header>
  <section className="resources-workspace resources-workspace--glass shell-width">
    <GlassPanel tone="warm" className="resources-search-glass">
      <ResourceFilters
        query={filters.query}
        category={filters.category}
        group={filters.legacyCategory}
        tag={filters.tag}
        tags={availableTags}
        onSearch={(query) => updateParams({ query })}
        onCategoryChange={(category) => updateParams({ category, legacyCategory: undefined, tag: undefined })}
        onGroupChange={(legacyCategory) => updateParams({ legacyCategory, tag: undefined })}
        onTagChange={(tag) => updateParams({ tag })}
        onClear={clearFilters}
      />
    </GlassPanel>
    <GlassPanel tone="warm" className="resource-results resource-results--glass">
      {!pageData && !error && <div className="resource-loading" role="status">正在整理校园资源…</div>}
      {error && <div className="resource-empty" role="alert"><h2>资源目录加载失败</h2><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>重新加载</button></div>}
      {pageData && <ResourceResults resources={pageData.items} total={pageData.total} page={pageData.page} totalPages={pageData.totalPages} onPageChange={(page) => updateParams({ page })} onClear={clearFilters} />}
    </GlassPanel>
  </section>
</CanvasPage>
```

Style `.resource-sidebar` as the navy inset within `resources-search-glass`.

- [ ] **Step 4: Keep the entire profile flow on one canvas**

Add imports for `CanvasPage`, `GlassPanel`, `DecorativeArtwork`, and `pageVisuals`, then add these exact title variables before `return`:

```tsx
const profileTitleLabel = activeProfile ? `你好，${activeProfile.nickname}。` : profiles.length > 0 ? '解锁本机档案' : '本机档案，只属于这台浏览器。'
const profileTitle = activeProfile ? `你好，${activeProfile.nickname}。` : profiles.length > 0 ? '解锁本机档案' : <>本机档案，<br aria-hidden="true" />只属于这台浏览器。</>
```

Then replace the opening `<main className="profile-page">` and complete `profile-hero` section with:

```tsx
<CanvasPage {...pageVisuals.profile} className="profile-canvas">
  <main className="profile-canvas__layout shell-width">
    <section className="profile-canvas__intro">
      <span className="eyebrow">LOCAL PROFILE</span>
      <h1 aria-label={profileTitleLabel}>{profileTitle}</h1>
      <p>档案和最近会话仅保存在当前浏览器，不能跨设备同步。清除网站数据后将永久删除，PIN 忘记后也无法恢复。</p>
      <DecorativeArtwork src="/brand/decorative-cat.svg" className="profile-cat-doodle" />
    </section>
```

Change `<section className="profile-panel">` to `<GlassPanel tone="warm" as="section" className="profile-panel profile-panel--glass">`, change its matching closing tag to `</GlassPanel>`, then close the new wrapper with `</main></CanvasPage>`. Do not change the alerts, forms, handlers, fields, dashboard, or delete confirmation between those tags.

- [ ] **Step 5: Add the desktop page styles**

```css
.resources-canvas,.profile-canvas { background-attachment:fixed; }
.canvas-hero { min-height:430px; display:grid; align-content:end; padding-block:100px 68px; color:white; }
.canvas-hero h1,.profile-canvas__intro h1 { margin:15px 0; font-family:var(--serif); font-size:clamp(54px,6vw,84px); line-height:1.02; }
.resources-workspace--glass { display:grid; grid-template-columns:300px minmax(0,1fr); gap:28px; padding-bottom:100px; }
.resources-search-glass,.resource-results--glass { border-radius:18px; }
.resources-search-glass { padding:22px; align-self:start; }
.resources-search-glass .resource-sidebar { color:white; background:rgba(var(--canvas-navy),.78); border-radius:14px; }
.resource-results--glass { padding:26px 30px; }
.resource-results--glass .resource-card { border:0; border-bottom:1px solid rgba(15,36,63,.14); border-radius:0; background:transparent; box-shadow:none; }
.profile-canvas__layout { min-height:calc(100vh - 78px); display:grid; grid-template-columns:minmax(0,1.05fr) minmax(460px,.75fr); align-items:center; gap:7vw; padding-block:88px; }
.profile-canvas__intro { color:white; text-shadow:0 2px 24px rgba(3,18,43,.32); }
.profile-panel--glass { width:100%; padding:36px; border-radius:18px; }
```

- [ ] **Step 6: Run both test files and commit**

Run: `pnpm test:run src/pages/ResourcesPage.test.tsx src/pages/ProfilePage.test.tsx`

Expected: all tests PASS.

```bash
git add src/pages/ResourcesPage.tsx src/pages/ResourcesPage.test.tsx src/pages/ProfilePage.tsx src/pages/ProfilePage.test.tsx src/styles/canvas-glass.css
git commit -m "feat: move resources and profiles onto photo canvases"
```

### Task 6: Recompose assistant and detail pages

**Files:**
- Modify: `src/pages/AssistantPage.test.tsx`
- Modify: `src/pages/AssistantPage.tsx`
- Modify: `src/pages/ResourceDetailPage.test.tsx`
- Modify: `src/pages/ResourceDetailPage.tsx`
- Modify: `src/styles/canvas-glass.css`

- [ ] **Step 1: Add failing visual assertions without changing behavior tests**

```tsx
// AssistantPage.test.tsx
expect(screen.getByRole('img', { name: '夜间书桌、地图与书本插画' })).toHaveAttribute('src', '/brand/assistant-desk.webp')
expect(screen.getByTestId('canvas-page')).toContainElement(screen.getByRole('textbox', { name: '描述你的需求' }))

// ResourceDetailPage.test.tsx
expect(screen.getByTestId('canvas-page')).toContainElement(screen.getByRole('heading', { name: resource.title }))
expect(screen.getByTestId('canvas-page')).toContainElement(screen.getByRole('link', { name: '前往资源原页面' }))
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm test:run src/pages/AssistantPage.test.tsx src/pages/ResourceDetailPage.test.tsx`

Expected: FAIL because neither page uses `CanvasPage`.

- [ ] **Step 3: Put the assistant workspace on the desk canvas**

Add imports for `CanvasPage`, `GlassPanel`, `DecorativeArtwork`, and `pageVisuals`. Replace the `PhotographicHero` block with this exact header:

```tsx
<header className="canvas-hero assistant-canvas__hero shell-width">
  <span className="eyebrow"><Sparkles size={13} /> CAMPUS ASSISTANT · 校园助手</span>
  <h1 id="assistant-title" aria-label="先说说，你想做什么。">先说说，<br aria-hidden="true" />你想做什么。</h1>
  <p>一句话就好，剩下的交给我。</p>
  <div className="assistant-mode"><i /><span>{import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_USE_MOCKS !== 'true' ? '服务已连接' : '演示数据模式'}</span></div>
  <DecorativeArtwork src="/brand/decorative-route.svg" className="assistant-route-doodle" />
</header>
```

Replace the exact wrapper tags without changing their children:

```tsx
// PageBackdrop opening and closing
<CanvasPage {...pageVisuals.assistant} className="assistant-canvas">
</CanvasPage>

// workspace opening
<div className="assistant-workspace assistant-workspace--glass shell-width">

// chat opening and matching closing
<GlassPanel tone="warm" className="assistant-chat">
</GlassPanel>

// side opening and matching closing
<GlassPanel tone="navy" className={`assistant-side${historyOpen ? ' assistant-side--open' : ''}`}>
</GlassPanel>
```

Delete the old `PhotographicHero` and `PageBackdrop` imports after the move.

- [ ] **Step 4: Put detail content on the category canvas**

Wrap the current loaded-resource article with `<CanvasPage src={detailPhotography[category.id]} alt={`${category.label}校园背景`} loading="lazy" className="detail-canvas">` and close it immediately after `</article>`. Remove the old `detail-page__background` and `detail-page__veil` nodes. Change the exact opening tags as follows, leaving their children untouched:

```tsx
<article className="detail-page detail-page--canvas">
<GlassPanel tone="navy" as="header" className="detail-hero">
<GlassPanel tone="warm" className="detail-main">
<GlassPanel tone="warm" as="aside" className="detail-aside">
<GlassPanel tone="warm" className="detail-related-glass"><RelatedResources current={resource} /></GlassPanel>
```

Replace the matching `</header>`, `.detail-main` `</div>`, and `.detail-aside` `</aside>` tags with `</GlassPanel>`. Do not move the breadcrumb, primary external link, metadata, tags, or how-to content outside their current semantic regions.

- [ ] **Step 5: Add desktop workspace styling**

```css
.assistant-canvas__hero { min-height:330px; }
.assistant-workspace--glass { display:grid; grid-template-columns:minmax(0,1fr) 330px; gap:26px; padding-bottom:90px; }
.assistant-workspace--glass .assistant-chat,.assistant-workspace--glass .assistant-side { border-radius:18px; }
.assistant-workspace--glass .assistant-side { color:#f7f4ed; }
.detail-canvas { padding:70px 0 100px; }
.detail-page--canvas { background:transparent; }
.detail-page--canvas .detail-hero { width:min(1180px,calc(100% - 48px)); margin:0 auto 28px; border-radius:18px; }
.detail-page--canvas .detail-content { gap:28px; }
.detail-page--canvas .detail-main,.detail-page--canvas .detail-aside,.detail-related-glass { border-radius:18px; padding:34px; }
.detail-related-glass { width:min(1180px,calc(100% - 48px)); margin:28px auto 0; }
```

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test:run src/pages/AssistantPage.test.tsx src/pages/ResourceDetailPage.test.tsx`

Expected: all tests PASS.

```bash
git add src/pages/AssistantPage.tsx src/pages/AssistantPage.test.tsx src/pages/ResourceDetailPage.tsx src/pages/ResourceDetailPage.test.tsx src/styles/canvas-glass.css
git commit -m "feat: add glass canvases to assistant and details"
```

### Task 7: Desktop visual verification and regression cleanup

**Files:**
- Modify: `e2e/navigation.spec.ts`
- Modify: `e2e/resources.spec.ts` only if selectors changed without behavior changes.
- Modify: `src/styles/canvas-glass.css`
- Remove: `src/components/PageBackdrop.tsx` only after `rg "PageBackdrop" src` returns no imports.

- [ ] **Step 1: Add exact desktop structure checks**

```ts
test('desktop pages expose distinct full canvas imagery without horizontal overflow', async ({ page }) => {
  const cases = [
    ['/resources', '/brand/resources-campus-life.webp'],
    ['/assistant', '/brand/assistant-desk.webp'],
    ['/profile', '/brand/profile-walkway.webp'],
  ] as const
  for (const [path, src] of cases) {
    await page.goto(path)
    const canvas = page.getByTestId('canvas-page')
    await expect(canvas.locator('.canvas-page__image')).toHaveAttribute('src', src)
    const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    expect(widths.scroll, `${path} should not overflow`).toBeLessThanOrEqual(widths.client)
  }
})
```

- [ ] **Step 2: Run targeted desktop E2E and fix only observed issues**

Run: `pnpm exec playwright test e2e/navigation.spec.ts e2e/resources.spec.ts --project=chromium`

Expected: all desktop navigation/resource tests PASS. If an assertion fails, record the failing selector or viewport measurement before editing CSS.

- [ ] **Step 3: Inspect at both approved desktop sizes**

Use the browser viewport capability at 1440×900 and 1920×1080. Capture screenshots for `/`, `/resources`, `/assistant`, `/profile`, and one resource detail. Verify:

- the background subject is recognizable below the first viewport;
- glass gaps expose continuous photography;
- forms and long lists remain readable;
- resource cards no longer look like stacked opaque white cards;
- profile forms remain on the same image canvas;
- generated decoration is not presented as an actual USTC scene.

- [ ] **Step 4: Remove the obsolete backdrop wrapper**

Run: `rg "PageBackdrop|page-photo-surface" src`

Expected: no component imports. Delete `src/components/PageBackdrop.tsx`, then remove only the obsolete `.page-photo-surface*` rules from `src/styles.css`.

- [ ] **Step 5: Run the full verification suite**

Run each command independently:

```bash
pnpm lint
pnpm test:run
pnpm build
pnpm exec playwright test --project=chromium
```

Expected: lint exit 0; 58 or more unit tests pass; build exit 0; all desktop Playwright tests pass with no failures.

- [ ] **Step 6: Commit the verified desktop redesign**

```bash
git add e2e src public/brand/SOURCES.md
git commit -m "test: verify desktop canvas glass redesign"
```

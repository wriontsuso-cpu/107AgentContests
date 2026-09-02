# Assistant Brightness and Message Backing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提亮 AI 问答云图，并为 AI 与用户对话正文增加克制的半透明高亮底框。

**Architecture:** 保持现有 React 结构和数据逻辑不变，只在 `canvas-glass.css` 中调整 AI 页面遮罩、消息正文和响应式样式。使用浏览器计算样式作为视觉回归断言，并继续运行现有 AssistantPage 测试。

**Tech Stack:** React 19、TypeScript、CSS、Vitest、本地浏览器检查。

---

### Task 1: 建立视觉回归基线

**Files:**
- Inspect: `frontend/src/styles/canvas-glass.css`

- [ ] **Step 1: 在桌面视口读取当前计算样式**

读取 `.canvas-page__image` 的 `opacity/filter` 与 `.message--assistant .message__body` 的 `backgroundColor/borderLeftWidth`。

- [ ] **Step 2: 验证旧样式不满足目标**

预期当前背景亮度仍为 `brightness(.9)`，消息正文背景为透明或未设置高亮边框。

### Task 2: 提亮背景并增加正文底框

**Files:**
- Modify: `frontend/src/styles/canvas-glass.css`

- [ ] **Step 1: 调整云图和遮罩**

```css
.assistant-canvas .canvas-page__image {
  opacity: .96;
  filter: saturate(.82) contrast(.98) brightness(1.02);
}

.assistant-canvas .canvas-page__shade {
  background:
    linear-gradient(180deg, rgb(4 18 37 / 28%), rgb(4 18 37 / 34%) 40%, rgb(4 18 37 / 52%)),
    linear-gradient(90deg, rgb(3 18 43 / 44%), rgb(3 18 43 / 8%) 58%, rgb(3 18 43 / 16%));
}
```

- [ ] **Step 2: 为 AI 与用户消息正文增加轻薄底框**

AI 使用浅青冷白玻璃层和青色左边线；用户使用暖白玻璃层和橙色左边线。圆角固定 4px，避免气泡感；手机端将内边距缩小到 `11px 12px 13px`。

- [ ] **Step 3: 将快捷提问分隔线降低到 10%–12% 白色透明度**

### Task 3: 验证桌面与手机端

**Files:**
- Test: `frontend/src/pages/AssistantPage.test.tsx`

- [ ] **Step 1: 运行 AI 页面测试**

Run: `pnpm --dir frontend exec vitest run src/pages/AssistantPage.test.tsx`

Expected: 5 tests pass.

- [ ] **Step 2: 浏览器复查**

在 1440×900 和 390×844 下确认云图明显变亮、标题仍清晰、消息底框不遮挡 Markdown 与输入框、页面无横向溢出。

- [ ] **Step 3: 运行 lint 与构建**

Run: `pnpm --dir frontend lint`

Run: `pnpm --dir frontend build`

Expected: 两条命令退出码均为 0；保留工作区未提交状态。

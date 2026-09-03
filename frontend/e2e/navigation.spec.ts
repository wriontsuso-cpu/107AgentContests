import { expect, test } from '@playwright/test'

test('homepage stays focused on the product and team story', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '在科大，找入口不必绕远路' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我们是，啊对对队' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '近期常用入口' })).toHaveCount(0)
  await expect(page.getByText(/摄影来源/)).toHaveCount(0)
  await expect(page.getByText(/学生参赛项目/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: '让 AI 帮我梳理' })).toBeVisible()
  await expect(page.getByRole('link', { name: '帮我找资源' })).toHaveCount(0)
})

test('homepage search enters the resource directory', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '今天，想在科大做点什么？' })).toBeVisible()
  await page.getByRole('searchbox', { name: '搜索校园资源' }).fill('图书馆')
  await page.getByRole('button', { name: '搜索' }).click()

  await expect(page).toHaveURL(/\/resources\?q=/)
  await expect(page.getByRole('searchbox', { name: '搜索资源' })).toHaveValue('图书馆')
  await expect(page.getByText(/条结果/)).toBeVisible()
})

test('mobile navigation exposes all primary destinations', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile navigation behavior')
  await page.goto('/')
  await page.getByRole('button', { name: '打开导航菜单' }).click()

  await expect(page.getByRole('link', { name: '资源大厅' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'AI 导航' })).toBeVisible()
  await expect(page.getByRole('link', { name: '云端账户' })).toBeVisible()
})

test('resource cards open verified official destinations', async ({ page }) => {
  await page.goto('/resources')
  const officialLink = page.getByRole('link', { name: /打开官方页面/ }).first()
  await expect(officialLink).toBeVisible()
  await expect(officialLink).toHaveAttribute('target', '_blank')
  await expect(officialLink).toHaveAttribute('href', /^https?:\/\//)
})

test('a local account can be registered, signed out and signed in', async ({ page }) => {
  await page.goto('/profile')
  await page.getByLabel('用户名').fill('端到端测试')
  await page.getByLabel('设置密码').fill('strong password 2468')
  await page.getByLabel('确认密码').fill('strong password 2468')
  await page.getByRole('button', { name: '注册并登录' }).click()
  await expect(page.getByRole('heading', { name: '你好，端到端测试' })).toBeVisible()
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.getByLabel('用户名').fill('端到端测试')
  await page.getByLabel('密码').fill('strong password 2468')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '你好，端到端测试' })).toBeVisible()
})

for (const width of [1280, 1440, 1920]) {
  test(`homepage keeps intentional headline lines at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    const lines = page.getByTestId('headline-line')
    await expect(lines).toHaveCount(4)
    for (const line of await lines.all()) {
      await expect(line).toHaveCSS('white-space', 'nowrap')
    }
    await expect(page.locator('.home-snow-story__team')).toHaveCSS('text-align', 'left')
  })
}

test('resource search placeholder has enough room to remain readable', async ({ page }) => {
  await page.goto('/resources')
  const search = page.getByRole('searchbox', { name: '搜索资源' })
  await expect(search).toHaveAttribute('placeholder', '搜索资源名称、用途或发布单位')
  const fit = await search.evaluate((input) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    const style = getComputedStyle(input)
    context.font = style.font
    return input.getBoundingClientRect().width >= context.measureText(input.placeholder).width + 12
  })
  expect(fit).toBe(true)
})

test('primary pages do not overflow the viewport', async ({ page }) => {
  for (const path of ['/', '/resources', '/assistant', '/profile']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right > document.documentElement.clientWidth + 1 || rect.left < -1)
        .slice(0, 8)
        .map(({ element, rect }) => ({
          name: `${element.tagName.toLowerCase()}.${element.className}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        })),
    }))

    expect(dimensions.scrollWidth, `${path} should fit within the viewport: ${JSON.stringify(dimensions.offenders)}`).toBeLessThanOrEqual(
      dimensions.clientWidth,
    )
  }
})

test('desktop canvas keeps its photograph visible behind glass surfaces', async ({ page }) => {
  await page.goto('/resources')

  const canvas = page.getByTestId('canvas-page')
  await expect(canvas.locator('.canvas-page__image')).toHaveCSS('opacity', '1')
  await expect(canvas.locator('.glass-panel--warm').first()).toHaveCSS('backdrop-filter', /blur/)
  const warm = await canvas.locator('.glass-panel--warm').first().evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(warm).not.toBe('rgb(255, 255, 255)')
})

test('homepage keeps the hero photograph at viewport scale for a crisp result', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  const imageBox = await page.locator('.home-snow-canvas .canvas-page__image').boundingBox()
  expect(imageBox).not.toBeNull()
  expect(imageBox!.height).toBeLessThanOrEqual(1000)
  await expect(page.locator('.home-snow-canvas .canvas-page__image')).toHaveCSS('transform', 'none')
})

test('resource directory footer remains visible above its fixed photograph', async ({ page }) => {
  await page.goto('/resources')
  const footer = page.locator('.site-footer')
  await footer.scrollIntoViewIfNeeded()

  const footerIsTopmost = await footer.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 40))
    return topmost === element || element.contains(topmost)
  })
  expect(footerIsTopmost).toBe(true)
  const photograph = page.locator('.resources-canvas .canvas-page__image')
  await expect(photograph).toBeVisible()
  const stacking = {
    footer: Number.parseInt(await footer.evaluate((element) => getComputedStyle(element).zIndex), 10),
    photograph: Number.parseInt(await photograph.evaluate((element) => getComputedStyle(element).zIndex), 10),
  }
  expect(stacking.footer).toBeGreaterThan(stacking.photograph)
  await expect(footer.getByText('资源信息以原发布单位页面为准')).toBeVisible()
})

test('keyboard users can reach and submit the primary search', async ({ page }) => {
  await page.goto('/')
  await page.locator('body').focus()
  for (let step = 0; step < 12; step += 1) {
    if (await page.getByRole('searchbox', { name: '搜索校园资源' }).evaluate((element) => element === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(page.getByRole('searchbox', { name: '搜索校园资源' })).toBeFocused()
  await page.keyboard.type('奖助学金')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/q=/)
  await expect(page.getByRole('searchbox', { name: '搜索资源' })).toHaveValue('奖助学金')
})

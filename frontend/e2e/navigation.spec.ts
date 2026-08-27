import { expect, test } from '@playwright/test'

test('homepage stays focused on the product and team story', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '在科大，找入口不必绕远路。' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我们是，啊对对队。' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '近期常用入口' })).toHaveCount(0)
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
  await expect(page.getByRole('link', { name: '创建档案' })).toBeVisible()
})

test('resource cards open verified official destinations', async ({ page }) => {
  await page.goto('/resources')
  const officialLink = page.getByRole('link', { name: /打开官方页面/ }).first()
  await expect(officialLink).toBeVisible()
  await expect(officialLink).toHaveAttribute('target', '_blank')
  await expect(officialLink).toHaveAttribute('href', /^https?:\/\//)
})

test('a local profile can be created, locked and unlocked', async ({ page }) => {
  await page.goto('/profile')
  await page.getByLabel('昵称').fill('端到端测试')
  await page.getByLabel('设置 PIN').fill('2468')
  await page.getByLabel('确认 PIN').fill('2468')
  await page.getByRole('button', { name: '创建并进入' }).click()
  await expect(page.getByRole('heading', { name: '你好，端到端测试。' })).toBeVisible()
  await page.getByRole('button', { name: '锁定档案' }).click()
  await page.getByLabel('输入 PIN').fill('2468')
  await page.getByRole('button', { name: '解锁' }).click()
  await expect(page.getByRole('heading', { name: '你好，端到端测试。' })).toBeVisible()
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

import { expect, test } from '@playwright/test'

test('homepage search enters the resource directory', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /从一个需要/ })).toBeVisible()
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
})

test('primary pages do not overflow the viewport', async ({ page }) => {
  for (const path of ['/', '/resources', '/assistant']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))

    expect(dimensions.scrollWidth, `${path} should fit within the viewport`).toBeLessThanOrEqual(
      dimensions.clientWidth,
    )
  }
})

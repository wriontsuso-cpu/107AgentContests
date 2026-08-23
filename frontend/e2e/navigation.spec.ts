import { expect, test } from '@playwright/test'

const categoryLabels = ['办事与公共服务', '学习与学术', '科研与创新', '竞赛与实践', '社团与校园活动', '生活设施', '身心健康与权益', '升学就业与国际交流']

test('homepage exposes all eight exploration directions', async ({ page }) => {
  await page.goto('/')
  for (const label of categoryLabels) await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible()
})

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

test('keyboard users can reach and submit the primary search', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: '搜索校园资源' }).focus()
  await page.keyboard.type('奖助学金')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/q=/)
  await expect(page.getByRole('searchbox', { name: '搜索资源' })).toHaveValue('奖助学金')
})

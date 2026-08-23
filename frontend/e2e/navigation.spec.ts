import { expect, test } from '@playwright/test'

const categories = [
  ['办事与公共服务', 'services'], ['学习与学术', 'learning'], ['科研与创新', 'research'], ['竞赛与实践', 'competition'],
  ['社团与校园活动', 'community'], ['生活设施', 'life'], ['身心健康与权益', 'wellbeing'], ['升学就业与国际交流', 'future'],
] as const

test('homepage exposes all eight exploration directions', async ({ page, isMobile }) => {
  await page.goto('/')
  for (const [label, id] of categories) {
    await page.goto('/')
    await page.getByRole('link', { name: new RegExp(label) }).click()
    await expect(page).toHaveURL(new RegExp(`category=${id}`))
    if (isMobile) await page.getByRole('button', { name: '打开分类筛选' }).click()
    await expect(page.getByRole('button', { name: new RegExp(label) })).toHaveAttribute('aria-pressed', 'true')
  }
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

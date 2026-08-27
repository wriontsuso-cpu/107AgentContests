import { expect, test } from '@playwright/test'
import { resources } from '../src/data/resources'

test('legacy detail links remain traceable and recoverable', async ({ page }) => {
  await page.goto(`/resources/${resources[0].id}`)

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const originalLink = page.getByRole('link', { name: '前往资源原页面' })
  await expect(originalLink).toBeVisible()
  await expect(originalLink).toHaveAttribute('target', '_blank')
  await expect(originalLink).toHaveAttribute('rel', 'noopener noreferrer')
})

test('search, two-level category and tag stay synchronized with the URL', async ({ page, isMobile }) => {
  await page.goto('/resources?q=图书馆&category=learning')
  if (isMobile) await page.getByRole('button', { name: '打开分类筛选' }).click()
  await page.getByRole('button', { name: '图书馆资源', exact: true }).click()
  await expect(page).toHaveURL(/group=/)
  await page.getByLabel('标签', { exact: true }).selectOption('图书馆资源')
  await expect(page).toHaveURL(/q=.*category=learning.*group=.*tag=/)
  await expect(page.getByText(/条结果/)).toBeVisible()
})

test('an unknown resource has a recoverable not-found state', async ({ page }) => {
  await page.goto('/resources/not-a-real-resource')
  await expect(page.getByRole('heading', { name: '这条资源暂时找不到' })).toBeVisible()
  await expect(page.getByRole('link', { name: '返回资源大厅' })).toHaveAttribute('href', '/resources')
})

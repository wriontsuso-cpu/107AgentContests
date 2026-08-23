import { expect, test } from '@playwright/test'

test('category exploration reaches a traceable resource detail', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /学习与学术/ }).click()

  await expect(page).toHaveURL(/category=learning/)
  await page.getByRole('link', { name: /查看详情/ }).first().click()

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const originalLink = page.getByRole('link', { name: '前往资源原页面' })
  await expect(originalLink).toBeVisible()
  await expect(originalLink).toHaveAttribute('target', '_blank')
})

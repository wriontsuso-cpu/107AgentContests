import { expect, test } from '@playwright/test'

test('guided assistant turns a starter need into recommendations', async ({ page }) => {
  await page.goto('/assistant')
  await page.getByRole('button', { name: '我想参加竞赛或实践项目' }).click()

  await expect(page.locator('.message--assistant').last()).toContainText('竞赛与实践')
  await expect(page.locator('.assistant-resource')).toHaveCount(0)
  await page.getByRole('button', { name: '最近就能参加' }).click()
  const officialLink = page.locator('.assistant-resource').first()
  await expect(officialLink).toBeVisible()
  await expect(officialLink).toHaveAttribute('target', '_blank')
  await expect(officialLink).toHaveAttribute('href', /^https?:\/\//)
})

test('assistant reading surface keeps my message aligned to the right', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/assistant')
  const readingSurface = page.locator('.assistant-reading-surface')
  await expect(readingSurface).toBeVisible()
  await expect(page.locator('.assistant-history-rail')).toBeHidden()

  await page.getByRole('button', { name: '我想参加竞赛或实践项目' }).click()
  const myMessage = page.locator('.message--user').first()
  await expect(myMessage.getByText('我', { exact: true })).toBeVisible()
  const [messageBox, conversationBox] = await Promise.all([myMessage.boundingBox(), page.locator('.conversation').boundingBox()])
  expect(messageBox!.x + messageBox!.width).toBeGreaterThan(conversationBox!.x + conversationBox!.width * 0.88)
})

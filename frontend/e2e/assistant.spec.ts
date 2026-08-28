import { expect, test } from '@playwright/test'

test('guided assistant turns a starter need into recommendations', async ({ page, isMobile }) => {
  await page.goto('/assistant')
  await page.getByRole('button', { name: '我想参加竞赛或实践项目' }).click()

  await expect(page.getByText(/竞赛与实践/).first()).toBeVisible()
  if (!isMobile) await expect(page.getByText('需求较宽泛')).toBeVisible()
  await expect(page.locator('.assistant-resource')).toHaveCount(0)
  await page.getByRole('button', { name: '最近就能参加' }).click()
  const officialLink = page.locator('.assistant-resource').first()
  await expect(officialLink).toBeVisible()
  await expect(officialLink).toHaveAttribute('target', '_blank')
  await expect(officialLink).toHaveAttribute('href', /^https?:\/\//)
})

test('desktop assistant panels align and my message sits on the right', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/assistant')
  const chat = page.locator('.assistant-chat')
  const side = page.locator('.assistant-side')
  const [chatBox, sideBox] = await Promise.all([chat.boundingBox(), side.boundingBox()])
  expect(chatBox).not.toBeNull()
  expect(sideBox).not.toBeNull()
  expect(Math.abs(chatBox!.y - sideBox!.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(chatBox!.height - sideBox!.height)).toBeLessThanOrEqual(2)

  const sections = side.locator(':scope > aside')
  const [cluesBox, historyBox] = await Promise.all([sections.nth(0).boundingBox(), sections.nth(1).boundingBox()])
  expect(Math.abs(cluesBox!.height - historyBox!.height)).toBeLessThanOrEqual(2)

  await page.getByRole('button', { name: '我想参加竞赛或实践项目' }).click()
  const myMessage = page.locator('.message--user').first()
  await expect(myMessage.getByText('我', { exact: true })).toBeVisible()
  const [messageBox, conversationBox] = await Promise.all([myMessage.boundingBox(), page.locator('.conversation').boundingBox()])
  expect(messageBox!.x + messageBox!.width).toBeGreaterThan(conversationBox!.x + conversationBox!.width * 0.88)
})

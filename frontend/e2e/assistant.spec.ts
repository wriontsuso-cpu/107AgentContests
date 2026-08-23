import { expect, test } from '@playwright/test'

test('guided assistant turns a starter need into recommendations', async ({ page }) => {
  await page.goto('/assistant')
  await page.getByRole('button', { name: '我想参加竞赛或实践项目' }).click()

  await expect(page.getByText(/竞赛与实践/).first()).toBeVisible()
  await expect(page.locator('.assistant-resource').first()).toBeVisible()
  await expect(page.getByText('需求较宽泛')).toBeVisible()
})

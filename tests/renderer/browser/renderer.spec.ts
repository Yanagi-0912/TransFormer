import { expect, test } from '@playwright/test'

test('completes the preview using keyboard-accessible controls', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '選擇身分' })).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('radio', { name: '學生' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: '在職人士' })).toBeChecked()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '下一步' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '工作資料' })).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: '公司名稱' })).toBeFocused()
  await page.keyboard.type('Example Company')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '送出' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '提交完成' })).toBeVisible()
  await expect(page.getByText(/Example Company/)).toBeVisible()
})

test('does not overflow horizontally at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
})

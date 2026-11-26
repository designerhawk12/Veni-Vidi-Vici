import { test, expect } from '@playwright/test'

test('product home is separate from the workspace and demo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Plans change/i })).toBeVisible()
  await expect(page.getByText('TechMeet', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Product demo/i }).first()).toHaveAttribute('href', '/demo')

  await page.goto('/workspace')
  await expect(page.getByRole('heading', { name: 'Create a workspace' })).toBeVisible()
  await expect(page.getByText('TechMeet', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'History' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'History' })).not.toHaveAttribute('aria-current', 'page')

  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Goals & Facts' })).toBeVisible()
  await expect(page.getByText('TechMeet 2026', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Goals & Facts' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'History' })).not.toHaveAttribute('aria-current', 'page')
})

test('stale attempt denial remains visible in browser demo', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: /Stale/i }).click().catch(() => {})
  await expect(page.getByText(/Actions/i).first()).toBeVisible()
})

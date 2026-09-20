import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FormSchemaV1 } from '../../../src/domain/schema/form-schema-types'
import { FormRenderer } from '../../../src/ui/renderer/FormRenderer'
import fixture from '../../schema/fixtures/valid-conditional-form.json'

function validForm(): FormSchemaV1 {
  return structuredClone(fixture) as FormSchemaV1
}

function renderPreview(form = validForm(), submissionAdapter = vi.fn()) {
  render(
    <FormRenderer
      form={form}
      mode="preview"
      submissionAdapter={submissionAdapter}
      submissionIdFactory={() => 'submission_component_123'}
    />,
  )
  return { submissionAdapter }
}

describe('FormRenderer', () => {
  it('renders the Start Block from Schema without Editor state', () => {
    renderPreview()
    expect(screen.getByRole('heading', { name: '身分資料', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '選擇身分', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('請選擇您的身分。')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /您的身分/ })).toBeInTheDocument()
  })

  it('shows an accessible validation error and focuses the invalid field', async () => {
    const user = userEvent.setup()
    renderPreview()
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('heading', { name: '請修正以下欄位' })).toBeInTheDocument()
    expect(screen.getAllByText('This field is required.').length).toBeGreaterThan(0)
    expect(screen.getByRole('radio', { name: '學生' })).toHaveAttribute('aria-invalid', 'true')
  })

  it('follows Conditional Flow and supports Back navigation', async () => {
    const user = userEvent.setup()
    renderPreview()
    await user.click(screen.getByRole('radio', { name: '學生' }))
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('heading', { name: '學生資料' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /學校名稱/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '上一步' }))
    expect(screen.getByRole('heading', { name: '選擇身分' })).toBeInTheDocument()
  })

  it('removes answers from an abandoned branch in Preview summary', async () => {
    const user = userEvent.setup()
    const { submissionAdapter } = renderPreview()
    await user.click(screen.getByRole('radio', { name: '學生' }))
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.type(screen.getByRole('textbox', { name: /學校名稱/ }), 'Old University')
    await user.click(screen.getByRole('button', { name: '上一步' }))
    await user.click(screen.getByRole('radio', { name: '在職人士' }))
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.type(screen.getByRole('textbox', { name: /公司名稱/ }), 'Example Company')
    await user.click(screen.getByRole('button', { name: '送出' }))

    const summary = screen.getByText(/Example Company/)
    expect(summary).toBeInTheDocument()
    expect(summary).not.toHaveTextContent('Old University')
    expect(submissionAdapter).not.toHaveBeenCalled()
  })

  it('renders text-looking HTML as inert text', () => {
    const form = validForm()
    const textCard = form.blocks[0].cards[0]
    if (textCard.type !== 'text') throw new Error('Fixture changed unexpectedly.')
    textCard.content = '<script>window.compromised = true</script>'
    renderPreview(form)
    expect(screen.getByText('<script>window.compromised = true</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })

  it('shows a non-blocking fallback when an Image fails', () => {
    const form = validForm()
    form.blocks[0].cards.unshift({
      id: 'card_image',
      type: 'image',
      url: 'https://example.com/missing.jpg',
      alt: '活動照片',
    })
    form.blocks[0].layout.areas.main.unshift('card_image')
    renderPreview(form)
    fireEvent.error(screen.getByRole('img', { name: '活動照片' }))
    expect(screen.getByRole('img', { name: '活動照片' })).toHaveTextContent('圖片無法載入')
  })

  it('renders a safe fatal state instead of a partial invalid Form', () => {
    const form = validForm()
    ;(form.blocks[0].cards[0] as { type: string }).type = 'unsafeHtml'
    renderPreview(form)
    expect(screen.getByRole('alert')).toHaveTextContent('無法顯示這份表單')
    expect(screen.queryByText('請選擇您的身分。')).not.toBeInTheDocument()
  })
})

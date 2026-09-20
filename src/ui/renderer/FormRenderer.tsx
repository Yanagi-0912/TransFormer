import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { AnswerValue, Answers, FormSchemaV1 } from '../../domain/schema/form-schema-types'
import {
  createRendererSession,
  type RendererSession,
  type SubmissionAdapter,
} from '../../renderer/core/renderer-session'
import { LayoutRenderer } from './LayoutRenderer'

interface FormRendererProps {
  form: FormSchemaV1
  mode: 'preview' | 'public'
  initialAnswers?: Answers
  submissionAdapter?: SubmissionAdapter
  submissionIdFactory?: () => string
}

export function FormRenderer(props: FormRendererProps) {
  const sessionRef = useRef<RendererSession | null>(null)
  const [, refresh] = useReducer(value => value + 1, 0)

  if (!sessionRef.current) {
    sessionRef.current = createRendererSession({
      form: props.form,
      mode: props.mode,
      initialAnswers: props.initialAnswers,
      submissionAdapter: props.submissionAdapter,
      submissionIdFactory: props.submissionIdFactory,
    })
  }

  const session = sessionRef.current
  const state = session.getState()
  const block = session.getCurrentBlock()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (state.status === 'active') headingRef.current?.focus()
  }, [state.currentBlockId, state.status])

  const terminalBlock = useMemo(() => {
    if (!block) return false
    const outgoing = props.form.flow.transitions.filter(item => item.fromBlockId === block.id)
    return outgoing.length > 0 && outgoing.every(item => item.destination.type === 'submit')
  }, [block, props.form.flow.transitions])

  if (state.status === 'fatalError') {
    return (
      <main className="tf-renderer tf-state-panel" role="alert">
        <h1>無法顯示這份表單</h1>
        <p>表單格式無效，請聯絡表單建立者。</p>
      </main>
    )
  }

  if (state.status === 'submitted') {
    return (
      <main className="tf-renderer tf-state-panel">
        <h1 tabIndex={-1}>提交完成</h1>
        {props.mode === 'preview' && state.responseSummary ? (
          <section aria-labelledby="preview-summary-title" className="tf-preview-summary">
            <h2 id="preview-summary-title">Preview Response</h2>
            <pre>{JSON.stringify(state.responseSummary, null, 2)}</pre>
          </section>
        ) : (
          <p role="status">感謝您的填寫，回覆已成功送出。</p>
        )}
      </main>
    )
  }

  if (!block) return null

  const disabled = state.status === 'submitting'
  const errorEntries = Object.entries(state.errors)

  const updateAnswer = (fieldKey: string, value: AnswerValue) => {
    session.setAnswer(fieldKey, value)
    refresh()
  }

  const goNext = async () => {
    const result = await session.next()
    refresh()
    if (result.ok === false && 'errors' in result) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
    }
  }

  const goBack = () => {
    session.back()
    refresh()
  }

  const retry = async () => {
    await session.retrySubmission()
    refresh()
  }

  return (
    <main className="tf-renderer">
      <header className="tf-form-header">
        <p className="tf-eyebrow">{props.mode === 'preview' ? 'Preview' : 'Form'}</p>
        <h1>{props.form.title}</h1>
        {props.form.description ? <p>{props.form.description}</p> : null}
      </header>

      <section className="tf-block" aria-labelledby={`block-title-${block.id}`}>
        <h2 id={`block-title-${block.id}`} className="tf-block-title" tabIndex={-1} ref={headingRef}>
          {block.title || '表單頁面'}
        </h2>

        {errorEntries.length > 0 ? (
          <div className="tf-error-summary" role="alert" aria-labelledby="error-summary-title">
            <h3 id="error-summary-title">請修正以下欄位</h3>
            <ul>
              {errorEntries.map(([fieldKey, error]) => <li key={fieldKey}>{error.message}</li>)}
            </ul>
          </div>
        ) : null}

        <LayoutRenderer
          block={block}
          answers={state.answers}
          errors={state.errors}
          disabled={disabled}
          onChange={updateAnswer}
        />

        {state.status === 'submissionError' && state.submitError ? (
          <div className="tf-submit-error" role="alert">
            <p>{state.submitError.message}</p>
            <button type="button" onClick={retry}>重新送出</button>
          </div>
        ) : null}

        <nav className="tf-actions" aria-label="表單導覽">
          {state.history.length > 0 ? (
            <button className="tf-button tf-button-secondary" type="button" disabled={disabled} onClick={goBack}>
              上一步
            </button>
          ) : <span />}
          <button className="tf-button tf-button-primary" type="button" disabled={disabled} onClick={goNext}>
            {disabled ? '送出中…' : terminalBlock ? '送出' : '下一步'}
          </button>
        </nav>
      </section>
    </main>
  )
}

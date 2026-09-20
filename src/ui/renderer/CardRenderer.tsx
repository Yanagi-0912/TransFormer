import { useState } from 'react'
import type { AnswerValue, Card, ImageCard, InputCard } from '../../domain/schema/form-schema-types'
import type { FieldError } from '../../renderer/core/renderer-session'

interface CardRendererProps {
  card: Card
  value: AnswerValue | undefined
  error?: FieldError
  disabled: boolean
  onChange: (fieldKey: string, value: AnswerValue) => void
}

export function CardRenderer(props: CardRendererProps) {
  const { card } = props
  switch (card.type) {
    case 'text': {
      if (card.variant === 'heading') return <h2 className="tf-text-heading">{card.content}</h2>
      if (card.variant === 'caption') return <p className="tf-text-caption">{card.content}</p>
      return <p className="tf-text-body">{card.content}</p>
    }
    case 'image':
      return <ImageCardView card={card} />
    case 'shortText':
      return (
        <InputFrame card={card} error={props.error}>
          <input
            id={inputId(card.id)}
            name={card.fieldKey}
            type="text"
            value={typeof props.value === 'string' ? props.value : ''}
            placeholder={card.placeholder}
            minLength={card.minLength}
            maxLength={card.maxLength}
            required={card.required}
            disabled={props.disabled}
            aria-invalid={Boolean(props.error)}
            aria-describedby={describedBy(card, props.error)}
            onChange={event => props.onChange(card.fieldKey, event.target.value)}
          />
        </InputFrame>
      )
    case 'longText':
      return (
        <InputFrame card={card} error={props.error}>
          <textarea
            id={inputId(card.id)}
            name={card.fieldKey}
            value={typeof props.value === 'string' ? props.value : ''}
            placeholder={card.placeholder}
            minLength={card.minLength}
            maxLength={card.maxLength}
            required={card.required}
            disabled={props.disabled}
            aria-invalid={Boolean(props.error)}
            aria-describedby={describedBy(card, props.error)}
            onChange={event => props.onChange(card.fieldKey, event.target.value)}
          />
        </InputFrame>
      )
    case 'singleChoice': {
      const selected = typeof props.value === 'string' ? props.value : ''
      return (
        <ChoiceFrame card={card} error={props.error}>
          {card.options.map(option => (
            <label className="tf-choice" key={option.id}>
              <input
                type="radio"
                name={card.fieldKey}
                value={option.id}
                checked={selected === option.id}
                disabled={props.disabled}
                aria-invalid={Boolean(props.error)}
                aria-describedby={describedBy(card, props.error)}
                onChange={() => props.onChange(card.fieldKey, option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </ChoiceFrame>
      )
    }
    case 'multipleChoice': {
      const selected = Array.isArray(props.value) ? props.value : []
      return (
        <ChoiceFrame card={card} error={props.error}>
          {card.options.map(option => (
            <label className="tf-choice" key={option.id}>
              <input
                type="checkbox"
                name={card.fieldKey}
                value={option.id}
                checked={selected.includes(option.id)}
                disabled={props.disabled}
                aria-invalid={Boolean(props.error)}
                aria-describedby={describedBy(card, props.error)}
                onChange={event => {
                  const next = event.target.checked
                    ? [...selected, option.id]
                    : selected.filter(id => id !== option.id)
                  props.onChange(card.fieldKey, next)
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </ChoiceFrame>
      )
    }
  }
}

function ImageCardView({ card }: { card: ImageCard }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <div className="tf-image-fallback" role="img" aria-label={card.alt || '圖片無法載入'}>圖片無法載入</div>
  }
  return (
    <figure className="tf-image-card">
      <img src={card.url} alt={card.alt} onError={() => setFailed(true)} />
      {card.caption ? <figcaption>{card.caption}</figcaption> : null}
    </figure>
  )
}

function InputFrame({ card, error, children }: { card: InputCard; error?: FieldError; children: React.ReactNode }) {
  return (
    <div className="tf-field">
      <label htmlFor={inputId(card.id)}>{card.label}{card.required ? <span aria-hidden="true"> *</span> : null}</label>
      {card.description ? <p id={descriptionId(card.id)} className="tf-field-description">{card.description}</p> : null}
      {children}
      {error ? <p id={errorId(card.id)} className="tf-field-error">{error.message}</p> : null}
    </div>
  )
}

function ChoiceFrame({ card, error, children }: { card: InputCard; error?: FieldError; children: React.ReactNode }) {
  return (
    <fieldset className="tf-field tf-choice-group" aria-describedby={describedBy(card, error)}>
      <legend>{card.label}{card.required ? <span aria-hidden="true"> *</span> : null}</legend>
      {card.description ? <p id={descriptionId(card.id)} className="tf-field-description">{card.description}</p> : null}
      <div className="tf-choice-list">{children}</div>
      {error ? <p id={errorId(card.id)} className="tf-field-error">{error.message}</p> : null}
    </fieldset>
  )
}

function describedBy(card: InputCard, error?: FieldError) {
  return [card.description ? descriptionId(card.id) : '', error ? errorId(card.id) : ''].filter(Boolean).join(' ') || undefined
}

function inputId(cardId: string) { return `field-${cardId}` }
function descriptionId(cardId: string) { return `description-${cardId}` }
function errorId(cardId: string) { return `error-${cardId}` }

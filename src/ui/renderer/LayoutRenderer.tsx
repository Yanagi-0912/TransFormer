import type { AnswerValue, Card, FormBlock } from '../../domain/schema/form-schema-types'
import type { FieldError } from '../../renderer/core/renderer-session'
import { CardRenderer } from './CardRenderer'

interface LayoutRendererProps {
  block: FormBlock
  answers: Record<string, AnswerValue>
  errors: Record<string, FieldError>
  disabled: boolean
  onChange: (fieldKey: string, value: AnswerValue) => void
}

const areaOrder = {
  vertical: ['main'],
  twoColumns: ['left', 'right'],
  imageLeft: ['media', 'content'],
  imageRight: ['media', 'content'],
  hero: ['hero', 'title', 'content'],
} as const

export function LayoutRenderer({ block, answers, errors, disabled, onChange }: LayoutRendererProps) {
  const cards = new Map(block.cards.map(card => [card.id, card]))
  const areas = areaOrder[block.layout.preset]

  return (
    <div className={`tf-layout tf-layout-${block.layout.preset}`} data-layout={block.layout.preset}>
      {areas.map(area => (
        <div className={`tf-layout-area tf-area-${area}`} data-area={area} key={area}>
          {(block.layout.areas[area] || []).map(cardId => {
            const card = cards.get(cardId) as Card
            const fieldKey = 'fieldKey' in card ? card.fieldKey : undefined
            return (
              <CardRenderer
                card={card}
                value={fieldKey ? answers[fieldKey] : undefined}
                error={fieldKey ? errors[fieldKey] : undefined}
                disabled={disabled}
                onChange={onChange}
                key={card.id}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

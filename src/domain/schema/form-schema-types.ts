export type TextVariant = 'heading' | 'body' | 'caption'
export type LayoutPreset = 'vertical' | 'twoColumns' | 'imageLeft' | 'imageRight' | 'hero'

export interface ChoiceOption {
  id: string
  label: string
}

interface CardBase {
  id: string
}

interface InputCardBase extends CardBase {
  fieldKey: string
  label: string
  description?: string
  required: boolean
}

export interface TextCard extends CardBase {
  type: 'text'
  content: string
  variant: TextVariant
}

export interface ImageCard extends CardBase {
  type: 'image'
  url: string
  alt: string
  caption?: string
}

export interface ShortTextCard extends InputCardBase {
  type: 'shortText'
  placeholder?: string
  minLength?: number
  maxLength?: number
}

export interface LongTextCard extends InputCardBase {
  type: 'longText'
  placeholder?: string
  minLength?: number
  maxLength?: number
}

export interface SingleChoiceCard extends InputCardBase {
  type: 'singleChoice'
  options: ChoiceOption[]
}

export interface MultipleChoiceCard extends InputCardBase {
  type: 'multipleChoice'
  minSelections?: number
  maxSelections?: number
  options: ChoiceOption[]
}

export type ContentCard = TextCard | ImageCard
export type InputCard = ShortTextCard | LongTextCard | SingleChoiceCard | MultipleChoiceCard
export type Card = ContentCard | InputCard

export interface BlockLayout {
  preset: LayoutPreset
  areas: Record<string, string[]>
}

export interface FormBlock {
  id: string
  title?: string
  cards: Card[]
  layout: BlockLayout
}

export type FlowDestination =
  | { type: 'block'; blockId: string }
  | { type: 'submit' }

export interface FlowCondition {
  cardId: string
  operator: 'equals' | 'contains'
  optionId: string
}

export interface FlowTransition {
  id: string
  fromBlockId: string
  destination: FlowDestination
  priority: number
  condition?: FlowCondition
}

export interface FormSchemaV1 {
  schemaVersion: 1
  id: string
  revision: number
  title: string
  description?: string
  startBlockId: string
  blocks: FormBlock[]
  flow: { transitions: FlowTransition[] }
}

export type AnswerValue = string | string[]
export type Answers = Record<string, AnswerValue>

export interface FormResponse {
  formId: string
  formRevision: number
  submissionId: string
  answers: Answers
}

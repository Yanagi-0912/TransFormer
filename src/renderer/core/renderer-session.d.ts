import type {
  AnswerValue,
  Answers,
  FormBlock,
  FormResponse,
  FormSchemaV1,
} from '../../domain/schema/form-schema-types'

export interface FieldError {
  code: string
  message: string
}

export interface RendererError extends FieldError {
  path: string
}

export interface RendererState {
  status:
    | 'initializing'
    | 'active'
    | 'submitting'
    | 'submitted'
    | 'submissionError'
    | 'fatalError'
  currentBlockId: string | null
  history: string[]
  answers: Answers
  touched: Record<string, boolean>
  errors: Record<string, FieldError>
  submissionId: string
  submitError: RendererError | null
  responseSummary: FormResponse | null
  fatalErrors: RendererError[]
}

export interface RendererEvent {
  type: string
  formId?: string
  formRevision?: number
  timestamp: string
  blockId?: string
  destinationBlockId?: string
  errorCode?: string
}

export type SubmissionAdapter = (
  response: FormResponse,
) => Promise<{ ok: true; [key: string]: unknown }>

export interface RendererSessionOptions {
  form: FormSchemaV1
  mode: 'preview' | 'public'
  initialAnswers?: Answers
  submissionAdapter?: SubmissionAdapter
  submissionIdFactory?: () => string
  onEvent?: (event: RendererEvent) => void
}

export interface RendererSession {
  getState(): RendererState
  getCurrentBlock(): FormBlock | null
  setAnswer(fieldKey: string, value: AnswerValue): void
  next(): Promise<Record<string, unknown>>
  back(): Record<string, unknown>
  retrySubmission(): Promise<Record<string, unknown>>
}

export class RendererSessionError extends Error {
  code: string
}

export function createRendererSession(options: RendererSessionOptions): RendererSession

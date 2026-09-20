import type { FormSchemaV1 } from '../domain/schema/form-schema-types'
import demoFormData from '../../tests/schema/fixtures/valid-conditional-form.json'
import { FormRenderer } from './renderer/FormRenderer'

const demoForm = demoFormData as FormSchemaV1

export function App() {
  return (
    <FormRenderer
      form={demoForm}
      mode="preview"
      submissionIdFactory={() => 'submission_preview_demo'}
    />
  )
}

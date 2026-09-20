import { validateFormSchema } from '../../domain/schema/validate-form-schema.js';
import { validateResponseBinding } from '../../domain/schema/validate-response-binding.js';
import { evaluateNext, FlowEvaluationError } from '../../domain/flow/evaluate-flow.js';

class RendererSession {
  constructor(options) {
    const settings = options || {};
    this.form = settings.form;
    this.mode = settings.mode;
    this.submissionAdapter = settings.submissionAdapter;
    this.onEvent = typeof settings.onEvent === 'function' ? settings.onEvent : null;
    this.inputCards = new Map();
    this.cardsByBlock = new Map();
    this.pendingResponse = null;

    this.state = {
      status: 'initializing',
      currentBlockId: null,
      history: [],
      answers: {},
      touched: {},
      errors: {},
      submissionId: createSubmissionId(settings.submissionIdFactory),
      submitError: null,
      responseSummary: null,
      fatalErrors: [],
    };

    this.initialize(settings.initialAnswers || {});
  }

  initialize(initialAnswers) {
    const schemaErrors = validateFormSchema(this.form);
    if (schemaErrors.length > 0) {
      this.failInitialization('RENDERER_SCHEMA_INVALID', schemaErrors);
      return;
    }
    if (this.mode !== 'preview' && this.mode !== 'public') {
      this.failInitialization('RENDERER_MODE_INVALID', [rendererError('RENDERER_MODE_INVALID', '/mode', 'Renderer mode is invalid.')]);
      return;
    }
    if (this.mode === 'public' && typeof this.submissionAdapter !== 'function') {
      this.failInitialization('RENDERER_ADAPTER_REQUIRED', [rendererError('RENDERER_ADAPTER_REQUIRED', '/submissionAdapter', 'Public mode requires a Submission Adapter.')]);
      return;
    }

    for (const block of this.form.blocks) {
      this.cardsByBlock.set(block.id, block.cards);
      for (const card of block.cards) {
        if (isInputCard(card)) this.inputCards.set(card.fieldKey, card);
      }
    }

    const initialErrors = validateInitialAnswers(initialAnswers, this.inputCards);
    if (initialErrors.length > 0) {
      this.failInitialization('RENDERER_INITIAL_ANSWER_INVALID', initialErrors);
      return;
    }

    this.state.answers = cloneJson(initialAnswers);
    this.state.currentBlockId = this.form.startBlockId;
    this.state.status = 'active';
    this.emit('renderer_initialized', { blockId: this.form.startBlockId });
    this.emit('block_viewed', { blockId: this.form.startBlockId });
  }

  getState() {
    return cloneJson(this.state);
  }

  getCurrentBlock() {
    if (!this.state.currentBlockId) return null;
    const block = this.form.blocks.find(item => item.id === this.state.currentBlockId);
    return block ? cloneJson(block) : null;
  }

  setAnswer(fieldKey, value) {
    this.assertInteractive();
    if (!this.inputCards.has(fieldKey)) {
      throw new RendererSessionError('RENDERER_FIELD_UNKNOWN', 'Answer field does not exist.');
    }
    this.state.answers[fieldKey] = cloneJson(value);
    delete this.state.errors[fieldKey];
  }

  async next() {
    this.assertInteractive();
    const blockId = this.state.currentBlockId;
    const validation = validateBlockAnswers(
      this.cardsByBlock.get(blockId) || [],
      this.state.answers
    );

    for (const card of this.cardsByBlock.get(blockId) || []) {
      if (isInputCard(card)) this.state.touched[card.fieldKey] = true;
    }
    this.state.errors = validation;
    if (Object.keys(validation).length > 0) {
      this.emit('validation_failed', { blockId, errorCode: 'RENDERER_FIELD_INVALID' });
      return { ok: false, errors: cloneJson(validation) };
    }

    let destination;
    try {
      destination = evaluateNext(this.form, blockId, this.state.answers);
    } catch (error) {
      const code = error instanceof FlowEvaluationError ? error.code : 'RENDERER_FLOW_FAILED';
      this.state.status = 'fatalError';
      this.state.fatalErrors = [rendererError('RENDERER_FLOW_FAILED', '/flow', 'Form navigation failed.')];
      this.emit('submission_failed', { blockId, errorCode: code });
      return { ok: false, fatal: true };
    }

    if (destination.type === 'block') {
      this.state.history.push(blockId);
      this.state.currentBlockId = destination.blockId;
      this.state.errors = {};
      this.state.submitError = null;
      this.emit('navigation_next', { blockId, destinationBlockId: destination.blockId });
      this.emit('block_viewed', { blockId: destination.blockId });
      return { ok: true, destination: cloneJson(destination) };
    }

    return this.submitCurrentPath();
  }

  back() {
    if (this.state.status !== 'active' && this.state.status !== 'submissionError') {
      throw new RendererSessionError('RENDERER_NOT_INTERACTIVE', 'Renderer is not interactive.');
    }
    if (this.state.history.length === 0) return { ok: false, atStart: true };

    const previousBlockId = this.state.history.pop();
    const fromBlockId = this.state.currentBlockId;
    this.state.currentBlockId = previousBlockId;
    this.state.status = 'active';
    this.state.errors = {};
    this.state.submitError = null;
    this.state.responseSummary = null;
    this.pendingResponse = null;
    this.emit('navigation_back', { blockId: fromBlockId, destinationBlockId: previousBlockId });
    this.emit('block_viewed', { blockId: previousBlockId });
    return { ok: true, destination: { type: 'block', blockId: previousBlockId } };
  }

  async retrySubmission() {
    if (this.mode !== 'public' || this.state.status !== 'submissionError' || !this.pendingResponse) {
      throw new RendererSessionError('RENDERER_RETRY_UNAVAILABLE', 'No failed submission is available for retry.');
    }
    return this.sendPublicResponse(this.pendingResponse);
  }

  async submitCurrentPath() {
    const reachedBlockIds = [...this.state.history, this.state.currentBlockId];
    const response = buildResponse(this.form, this.state, reachedBlockIds);
    const bindingErrors = validateResponseBinding(this.form, response);
    if (bindingErrors.length > 0) {
      this.state.status = 'fatalError';
      this.state.fatalErrors = bindingErrors;
      return { ok: false, fatal: true };
    }

    this.pendingResponse = response;
    if (this.mode === 'preview') {
      this.state.status = 'submitted';
      this.state.responseSummary = cloneJson(response);
      this.emit('submission_succeeded', { blockId: this.state.currentBlockId });
      return { ok: true, submitted: true, preview: true, response: cloneJson(response) };
    }
    return this.sendPublicResponse(response);
  }

  async sendPublicResponse(response) {
    this.state.status = 'submitting';
    this.state.submitError = null;
    this.emit('submission_started', { blockId: this.state.currentBlockId });
    try {
      const result = await this.submissionAdapter(cloneJson(response));
      if (!result || result.ok !== true) throw new Error('Adapter returned an unsuccessful result.');
      this.state.status = 'submitted';
      this.state.responseSummary = null;
      this.emit('submission_succeeded', { blockId: this.state.currentBlockId });
      return { ok: true, submitted: true, preview: false, result: cloneJson(result) };
    } catch (_error) {
      this.state.status = 'submissionError';
      this.state.submitError = rendererError(
        'RENDERER_SUBMISSION_FAILED',
        '',
        'Submission could not be confirmed and may already have arrived.'
      );
      this.emit('submission_failed', {
        blockId: this.state.currentBlockId,
        errorCode: 'RENDERER_SUBMISSION_FAILED',
      });
      return { ok: false, submitted: false, retryable: true };
    }
  }

  assertInteractive() {
    if (this.state.status !== 'active') {
      throw new RendererSessionError('RENDERER_NOT_INTERACTIVE', 'Renderer is not interactive.');
    }
  }

  failInitialization(code, errors) {
    this.state.status = 'fatalError';
    this.state.fatalErrors = cloneJson(errors);
    this.emit('validation_failed', { errorCode: code });
  }

  emit(type, details) {
    if (!this.onEvent) return;
    try {
      this.onEvent(Object.freeze({
        type,
        formId: this.form && this.form.id,
        formRevision: this.form && this.form.revision,
        timestamp: new Date().toISOString(),
        ...details,
      }));
    } catch (_error) {
      // Optional observers must never break form completion.
    }
  }
}

class RendererSessionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RendererSessionError';
    this.code = code;
  }
}

function createRendererSession(options) {
  return new RendererSession(options);
}

function validateInitialAnswers(answers, inputCards) {
  if (!isObject(answers)) {
    return [rendererError('RENDERER_INITIAL_ANSWER_INVALID', '/initialAnswers', 'Initial answers must be an object.')];
  }
  const errors = [];
  for (const [fieldKey, value] of Object.entries(answers)) {
    const card = inputCards.get(fieldKey);
    if (!card) {
      errors.push(rendererError('RENDERER_INITIAL_FIELD_UNKNOWN', `/initialAnswers/${escapePointer(fieldKey)}`, 'Initial answer field is unknown.'));
      continue;
    }
    const error = validatePresentAnswer(card, value);
    if (error) errors.push(rendererError(error.code, `/initialAnswers/${escapePointer(fieldKey)}`, error.message));
  }
  return errors;
}

function validateBlockAnswers(cards, answers) {
  const errors = {};
  for (const card of cards) {
    if (!isInputCard(card)) continue;
    const present = Object.prototype.hasOwnProperty.call(answers, card.fieldKey);
    const value = answers[card.fieldKey];
    if (!present || isEmptyAnswer(value)) {
      if (isAnswerRequired(card)) {
        errors[card.fieldKey] = { code: 'FIELD_REQUIRED', message: 'This field is required.' };
      }
      continue;
    }
    const error = validatePresentAnswer(card, value);
    if (error) errors[card.fieldKey] = error;
  }
  return errors;
}

function validatePresentAnswer(card, value) {
  if (card.type === 'shortText' || card.type === 'longText') {
    if (typeof value !== 'string') return { code: 'FIELD_TYPE', message: 'Answer must be text.' };
    const min = card.minLength ?? 0;
    const max = card.maxLength ?? (card.type === 'shortText' ? 200 : 2000);
    const length = value.trim().length;
    if (length < min || length > max) return { code: 'FIELD_LENGTH', message: 'Answer length is invalid.' };
    return null;
  }

  const optionIds = new Set(card.options.map(option => option.id));
  if (card.type === 'singleChoice') {
    if (typeof value !== 'string' || !optionIds.has(value)) {
      return { code: 'FIELD_OPTION', message: 'Selected option is invalid.' };
    }
    return null;
  }

  if (!Array.isArray(value)) return { code: 'FIELD_TYPE', message: 'Answer must be an array.' };
  if (new Set(value).size !== value.length || value.some(item => typeof item !== 'string' || !optionIds.has(item))) {
    return { code: 'FIELD_OPTION', message: 'Selected options are invalid.' };
  }
  const min = card.minSelections ?? (card.required ? 1 : 0);
  const max = card.maxSelections ?? card.options.length;
  if (value.length < min || value.length > max) {
    return { code: 'FIELD_SELECTION_COUNT', message: 'The number of selected options is invalid.' };
  }
  return null;
}

function buildResponse(form, state, reachedBlockIds) {
  const reached = new Set(reachedBlockIds);
  const answers = {};
  for (const block of form.blocks) {
    if (!reached.has(block.id)) continue;
    for (const card of block.cards) {
      if (!isInputCard(card) || !Object.prototype.hasOwnProperty.call(state.answers, card.fieldKey)) continue;
      const value = state.answers[card.fieldKey];
      if (isEmptyAnswer(value)) continue;
      if (card.type === 'multipleChoice') {
        const selected = new Set(value);
        answers[card.fieldKey] = card.options.map(option => option.id).filter(id => selected.has(id));
      } else {
        answers[card.fieldKey] = value;
      }
    }
  }
  return {
    formId: form.id,
    formRevision: form.revision,
    submissionId: state.submissionId,
    answers,
  };
}

function isInputCard(card) {
  return ['shortText', 'longText', 'singleChoice', 'multipleChoice'].includes(card.type);
}

function isAnswerRequired(card) {
  if (card.type === 'multipleChoice') return card.required || (card.minSelections ?? 0) > 0;
  if (card.type === 'shortText' || card.type === 'longText') return card.required || (card.minLength ?? 0) > 0;
  return card.required;
}

function isEmptyAnswer(value) {
  return value === undefined || value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);
}

function createSubmissionId(factory) {
  const value = typeof factory === 'function' ? factory() : defaultSubmissionId();
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) {
    throw new RendererSessionError('RENDERER_SUBMISSION_ID_INVALID', 'Submission ID factory returned an invalid ID.');
  }
  return value;
}

function defaultSubmissionId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `submission_${globalThis.crypto.randomUUID().replace(/-/g, '_')}`.slice(0, 64);
  }
  return `submission_${Date.now()}_${Math.random().toString(36).slice(2)}`.slice(0, 64);
}

function rendererError(code, path, message) {
  return { code, path, message };
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapePointer(value) {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

export {
  createRendererSession,
  RendererSession,
  RendererSessionError,
  validateBlockAnswers,
  buildResponse,
};

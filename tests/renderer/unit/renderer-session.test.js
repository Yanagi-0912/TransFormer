import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  createRendererSession,
  RendererSessionError,
} from '../../../src/renderer/core/renderer-session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixturePath = path.join(
  __dirname,
  '..',
  '..',
  'schema',
  'fixtures',
  'valid-conditional-form.json'
);

function validForm() {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function previewSession(form = validForm(), options = {}) {
  return createRendererSession({
    form,
    mode: 'preview',
    submissionIdFactory: () => 'submission_renderer_123',
    ...options,
  });
}

test('initializes from Schema only at the Start Block', () => {
  const session = previewSession();
  const state = session.getState();
  assert.equal(state.status, 'active');
  assert.equal(state.currentBlockId, 'block_identity');
  assert.equal(session.getCurrentBlock().id, 'block_identity');
});

test('enters a safe fatal state for an invalid Schema', () => {
  const form = validForm();
  form.blocks[0].cards[0].type = 'unsafeHtml';
  const session = previewSession(form);
  assert.equal(session.getState().status, 'fatalError');
  assert.ok(session.getState().fatalErrors.some(error => error.code === 'CARD_TYPE_UNKNOWN'));
});

test('rejects unknown initial answers', () => {
  const session = previewSession(validForm(), {
    initialAnswers: { unknown_field: 'value' },
  });
  assert.equal(session.getState().status, 'fatalError');
  assert.ok(session.getState().fatalErrors.some(error => error.code === 'RENDERER_INITIAL_FIELD_UNKNOWN'));
});

test('validates the current Block before navigation', async () => {
  const session = previewSession();
  const result = await session.next();
  assert.equal(result.ok, false);
  assert.equal(session.getState().currentBlockId, 'block_identity');
  assert.equal(session.getState().errors.identity.code, 'FIELD_REQUIRED');
});

test('follows a conditional transition', async () => {
  const session = previewSession();
  session.setAnswer('identity', 'option_student');
  const result = await session.next();
  assert.deepEqual(result.destination, { type: 'block', blockId: 'block_student' });
  assert.equal(session.getState().currentBlockId, 'block_student');
});

test('Back returns to the actual prior Block and preserves answers', async () => {
  const session = previewSession();
  session.setAnswer('identity', 'option_student');
  await session.next();
  session.setAnswer('school_name', 'Example University');
  const result = session.back();
  assert.equal(result.ok, true);
  assert.equal(session.getState().currentBlockId, 'block_identity');
  assert.equal(session.getState().answers.school_name, 'Example University');
});

test('branch changes remove old-path answers from the final Response', async () => {
  const adapterCalls = [];
  const session = previewSession(validForm(), {
    submissionAdapter: response => adapterCalls.push(response),
  });

  session.setAnswer('identity', 'option_student');
  await session.next();
  session.setAnswer('school_name', 'Old Branch University');
  session.back();
  session.setAnswer('identity', 'option_worker');
  await session.next();
  session.setAnswer('company_name', 'Example Company');
  const result = await session.next();

  assert.equal(result.preview, true);
  assert.deepEqual(result.response.answers, {
    identity: 'option_worker',
    company_name: 'Example Company',
  });
  assert.equal(adapterCalls.length, 0);
});

test('Preview completion never calls the provided Submission Adapter', async () => {
  let calls = 0;
  const session = previewSession(validForm(), {
    submissionAdapter: async () => { calls += 1; return { ok: true }; },
  });
  session.setAnswer('identity', 'option_worker');
  await session.next();
  const result = await session.next();
  assert.equal(result.preview, true);
  assert.equal(calls, 0);
  assert.equal(session.getState().status, 'submitted');
  assert.equal(session.getState().responseSummary.formRevision, 1);
});

test('Public submission calls its Adapter once with a stable ID', async () => {
  const calls = [];
  const session = createRendererSession({
    form: validForm(),
    mode: 'public',
    submissionIdFactory: () => 'submission_public_123',
    submissionAdapter: async response => {
      calls.push(response);
      return { ok: true };
    },
  });
  session.setAnswer('identity', 'option_worker');
  await session.next();
  const result = await session.next();
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].submissionId, 'submission_public_123');
  assert.equal(session.getState().status, 'submitted');
});

test('failed Public submission can retry with the same Response and ID', async () => {
  const calls = [];
  let shouldFail = true;
  const session = createRendererSession({
    form: validForm(),
    mode: 'public',
    submissionIdFactory: () => 'submission_retry_123',
    submissionAdapter: async response => {
      calls.push(response);
      if (shouldFail) throw new Error('temporary failure');
      return { ok: true };
    },
  });
  session.setAnswer('identity', 'option_worker');
  await session.next();
  const failed = await session.next();
  assert.equal(failed.retryable, true);
  assert.equal(session.getState().status, 'submissionError');

  shouldFail = false;
  const retried = await session.retrySubmission();
  assert.equal(retried.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[1].submissionId, 'submission_retry_123');
});

test('Multiple Choice answers use Schema option order in the Response', async () => {
  const form = validForm();
  const worker = form.blocks.find(block => block.id === 'block_worker');
  worker.cards.push({
    id: 'card_skills',
    type: 'multipleChoice',
    fieldKey: 'skills',
    label: 'Skills',
    required: false,
    options: [
      { id: 'option_alpha', label: 'Alpha' },
      { id: 'option_beta', label: 'Beta' },
      { id: 'option_gamma', label: 'Gamma' },
    ],
  });
  worker.layout.areas.main.push('card_skills');

  const session = previewSession(form);
  session.setAnswer('identity', 'option_worker');
  await session.next();
  session.setAnswer('skills', ['option_gamma', 'option_alpha']);
  const result = await session.next();
  assert.deepEqual(result.response.answers.skills, ['option_alpha', 'option_gamma']);
});

test('does not mutate the caller Form Schema', async () => {
  const form = validForm();
  const before = JSON.stringify(form);
  const session = previewSession(form);
  session.setAnswer('identity', 'option_worker');
  await session.next();
  await session.next();
  assert.equal(JSON.stringify(form), before);
});

test('lifecycle events never contain answer values', async () => {
  const events = [];
  const session = previewSession(validForm(), { onEvent: event => events.push(event) });
  session.setAnswer('identity', 'option_worker');
  await session.next();
  await session.next();
  assert.ok(events.length > 0);
  assert.equal(JSON.stringify(events).includes('option_worker'), false);
  assert.equal(events.some(event => Object.hasOwn(event, 'answers')), false);
});

test('a failing lifecycle observer cannot break form initialization', () => {
  const session = previewSession(validForm(), {
    onEvent: () => { throw new Error('observer failure'); },
  });
  assert.equal(session.getState().status, 'active');
});

test('Start Block cannot navigate Back', () => {
  const session = previewSession();
  assert.deepEqual(session.back(), { ok: false, atStart: true });
});

test('prevents interaction while submission is in progress', async () => {
  let resolveSubmission;
  const pending = new Promise(resolve => { resolveSubmission = resolve; });
  const session = createRendererSession({
    form: validForm(),
    mode: 'public',
    submissionIdFactory: () => 'submission_pending_123',
    submissionAdapter: async () => pending,
  });
  session.setAnswer('identity', 'option_worker');
  await session.next();
  const submission = session.next();
  assert.equal(session.getState().status, 'submitting');
  assert.throws(
    () => session.setAnswer('company_name', 'Too late'),
    error => error instanceof RendererSessionError && error.code === 'RENDERER_NOT_INTERACTIVE'
  );
  resolveSubmission({ ok: true });
  await submission;
});

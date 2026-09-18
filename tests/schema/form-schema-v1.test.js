const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { validateFormSchema } = require('../../src/domain/schema/validate-form-schema');
const { validateResponseBinding } = require('../../src/domain/schema/validate-response-binding');
const { evaluateNext, FlowEvaluationError } = require('../../src/domain/flow/evaluate-flow');

const fixturePath = path.join(__dirname, 'fixtures', 'valid-conditional-form.json');

function validForm() {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function errorCodes(form) {
  return validateFormSchema(form).map(error => error.code);
}

test('accepts the canonical Form Schema v1 fixture', () => {
  assert.deepEqual(validateFormSchema(validForm()), []);
});

test('preserves semantics through a JSON round trip', () => {
  const form = validForm();
  const restored = JSON.parse(JSON.stringify(form));
  assert.deepEqual(restored, form);
  assert.deepEqual(validateFormSchema(restored), []);
});

test('rejects an unknown Card type without fallback', () => {
  const form = validForm();
  form.blocks[0].cards[0].type = 'unsafeHtml';
  assert.ok(errorCodes(form).includes('CARD_TYPE_UNKNOWN'));
});

test('rejects a broken Flow Block reference with a JSON pointer path', () => {
  const form = validForm();
  form.flow.transitions[0].destination.blockId = 'block_missing';
  const error = validateFormSchema(form).find(item => item.code === 'FLOW_UNKNOWN_BLOCK');
  assert.equal(error.path, '/flow/transitions/0/destination/blockId');
});

test('rejects missing and duplicate Layout placements', () => {
  const form = validForm();
  form.blocks[0].layout.areas.main = ['card_intro', 'card_intro'];
  const codes = errorCodes(form);
  assert.ok(codes.includes('LAYOUT_CARD_DUPLICATE'));
  assert.ok(codes.includes('LAYOUT_CARD_MISSING'));
});

test('evaluates an equals condition deterministically', () => {
  const form = validForm();
  for (let index = 0; index < 5; index += 1) {
    assert.deepEqual(
      evaluateNext(form, 'block_identity', { identity: 'option_student' }),
      { type: 'block', blockId: 'block_student' }
    );
  }
});

test('uses the fallback when no condition matches', () => {
  assert.deepEqual(
    evaluateNext(validForm(), 'block_identity', { identity: 'option_worker' }),
    { type: 'block', blockId: 'block_worker' }
  );
});

test('throws a stable error when no transition matches', () => {
  const form = validForm();
  form.flow.transitions = form.flow.transitions.filter(
    transition => transition.id !== 'transition_to_worker'
  );
  assert.throws(
    () => evaluateNext(form, 'block_identity', { identity: 'option_worker' }),
    error => error instanceof FlowEvaluationError && error.code === 'FLOW_NO_MATCHING_TRANSITION'
  );
});

test('rejects a reachable closed cycle with no submit path', () => {
  const form = validForm();
  for (const transition of form.flow.transitions) {
    if (transition.destination.type === 'submit') {
      transition.destination = { type: 'block', blockId: 'block_identity' };
    }
  }
  assert.ok(errorCodes(form).includes('FLOW_NO_SUBMIT_PATH'));
});

test('rejects an unknown credential property', () => {
  const form = validForm();
  form.oauthAccessToken = 'must-not-be-accepted';
  const error = validateFormSchema(form).find(item => item.code === 'UNKNOWN_PROPERTY');
  assert.equal(error.path, '/oauthAccessToken');
});

test('rejects a Condition that references a Choice Card in another Block', () => {
  const form = validForm();
  form.flow.transitions[2].condition = {
    cardId: 'card_identity',
    operator: 'equals',
    optionId: 'option_student',
  };
  assert.ok(errorCodes(form).includes('FLOW_CONDITION_CARD_SCOPE'));
});

test('rejects non-HTTPS Image URLs', () => {
  const form = validForm();
  form.blocks[1].cards[0] = {
    id: 'card_school',
    type: 'image',
    url: 'http://example.com/image.jpg',
    alt: 'Example',
  };
  assert.ok(errorCodes(form).includes('IMAGE_URL_PROTOCOL'));
});

test('accepts a Response bound to the exact published revision', () => {
  const form = validForm();
  assert.deepEqual(validateResponseBinding(form, {
    formId: form.id,
    formRevision: form.revision,
    submissionId: 'submission_12345678',
    answers: { identity: 'option_student' },
  }), []);
});

test('rejects a Response from another Form revision', () => {
  const form = validForm();
  const errors = validateResponseBinding(form, {
    formId: form.id,
    formRevision: form.revision + 1,
    submissionId: 'submission_12345678',
    answers: { identity: 'option_student' },
  });
  assert.ok(errors.some(error => error.code === 'RESPONSE_REVISION_MISMATCH'));
});

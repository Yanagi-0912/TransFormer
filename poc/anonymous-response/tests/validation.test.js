const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'apps-script', 'Code.gs'),
  'utf8'
);
const context = vm.createContext({ console });
vm.runInContext(source, context);

function validPayload() {
  return {
    formId: 'poc_contact_form',
    schemaVersion: 1,
    submissionId: 'submission_12345678',
    answers: {
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Hello',
    },
  };
}

test('accepts and normalizes a valid payload', () => {
  const result = context.validatePayload_(validPayload());
  assert.equal(result.answers.name, 'Ada');
  assert.equal(result.answers.email, 'ada@example.com');
});

test('rejects a destination supplied by the client', () => {
  const payload = validPayload();
  payload.spreadsheetId = 'attacker-selected-sheet';
  assert.throws(
    () => context.validatePayload_(payload),
    error => error.publicCode === 'UNKNOWN_REQUEST_FIELD'
  );
});

test('rejects unknown answer fields', () => {
  const payload = validPayload();
  payload.answers.admin = true;
  assert.throws(
    () => context.validatePayload_(payload),
    error => error.publicCode === 'UNKNOWN_ANSWER_FIELD'
  );
});

test('rejects an unsupported schema version', () => {
  const payload = validPayload();
  payload.schemaVersion = 2;
  assert.throws(
    () => context.validatePayload_(payload),
    error => error.publicCode === 'UNSUPPORTED_SCHEMA'
  );
});

test('rejects an invalid email', () => {
  const payload = validPayload();
  payload.answers.email = 'not-an-email';
  assert.throws(
    () => context.validatePayload_(payload),
    error => error.publicCode === 'INVALID_EMAIL'
  );
});

test('neutralizes spreadsheet formula markers', () => {
  for (const value of ['=1+1', '+1+1', '-1+1', '@SUM(A1:A2)']) {
    assert.equal(context.toSheetText_(value), "'" + value);
  }
  assert.equal(context.toSheetText_('ordinary text'), 'ordinary text');
});

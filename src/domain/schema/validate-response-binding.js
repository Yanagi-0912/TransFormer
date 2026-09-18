/**
 * Validates that a response belongs to the exact immutable Form revision used
 * by the submission endpoint. Answer validation is a separate responsibility.
 *
 * @param {Record<string, any>} publishedForm
 * @param {unknown} response
 * @returns {Array<{code: string, path: string, message: string}>}
 */
function validateResponseBinding(publishedForm, response) {
  const errors = [];
  const add = (code, path, message) => errors.push({ code, path, message });

  if (!isObject(response)) {
    add('RESPONSE_TYPE', '', 'Response must be an object.');
    return errors;
  }

  const allowed = new Set(['formId', 'formRevision', 'submissionId', 'answers']);
  Object.keys(response).forEach(key => {
    if (!allowed.has(key)) add('RESPONSE_UNKNOWN_PROPERTY', `/${escapePointer(key)}`, 'Response property is not allowed.');
  });

  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(response, key)) {
      add('RESPONSE_REQUIRED_PROPERTY', `/${key}`, 'Required response property is missing.');
    }
  }

  if (response.formId !== publishedForm.id) {
    add('RESPONSE_FORM_MISMATCH', '/formId', 'Response does not belong to this Form.');
  }
  if (response.formRevision !== publishedForm.revision) {
    add('RESPONSE_REVISION_MISMATCH', '/formRevision', 'Response does not match the published Form revision.');
  }
  if (typeof response.submissionId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(response.submissionId)) {
    add('RESPONSE_SUBMISSION_ID', '/submissionId', 'Submission ID format is invalid.');
  }
  if (!isObject(response.answers)) {
    add('RESPONSE_ANSWERS_TYPE', '/answers', 'Answers must be an object.');
  }

  return errors;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapePointer(value) {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

module.exports = { validateResponseBinding };

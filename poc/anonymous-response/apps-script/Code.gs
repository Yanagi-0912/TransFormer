/**
 * TransFormer Phase 0 anonymous-response PoC.
 *
 * Trusted destination configuration is stored in Apps Script Script Properties.
 * Public requests cannot select a spreadsheet or sheet.
 */

const POC_CONFIG = Object.freeze({
  FORM_ID: 'poc_contact_form',
  SCHEMA_VERSION: 1,
  DEFAULT_SHEET_NAME: 'Responses',
  MAX_PAYLOAD_BYTES: 8192,
  MAX_SUBMISSION_ID_LENGTH: 64,
  MAX_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 254,
  MAX_MESSAGE_LENGTH: 2000,
  LOCK_TIMEOUT_MS: 5000,
  HEADERS: Object.freeze([
    'Received At',
    'Submission ID',
    'Schema Version',
    'Name',
    'Email',
    'Message',
  ]),
});

/**
 * Health endpoint. It intentionally exposes no destination information.
 */
function doGet() {
  return jsonOutput_({
    ok: true,
    service: 'transformer-anonymous-response-poc',
    schemaVersion: POC_CONFIG.SCHEMA_VERSION,
  });
}

/**
 * Accepts a JSON document sent with Content-Type text/plain.
 * text/plain avoids a browser CORS preflight; response readability still needs
 * to be verified against an actual Apps Script deployment.
 */
function doPost(event) {
  try {
    const rawBody = getRawBody_(event);
    assertPayloadSize_(rawBody);

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      throw publicError_('INVALID_JSON', 'Request body must be valid JSON.');
    }

    const response = validatePayload_(payload);
    const trustedConfig = getTrustedConfig_();
    const lock = LockService.getScriptLock();

    if (!lock.tryLock(POC_CONFIG.LOCK_TIMEOUT_MS)) {
      throw publicError_('BUSY', 'Submission service is busy. Retry later.');
    }

    try {
      const sheet = openTrustedSheet_(trustedConfig);
      ensureHeaders_(sheet);

      if (hasSubmissionId_(sheet, response.submissionId)) {
        return jsonOutput_({
          ok: true,
          duplicate: true,
          submissionId: response.submissionId,
        });
      }

      appendResponse_(sheet, response);
    } finally {
      lock.releaseLock();
    }

    return jsonOutput_({
      ok: true,
      duplicate: false,
      submissionId: response.submissionId,
    });
  } catch (error) {
    console.error(error);
    return jsonOutput_({
      ok: false,
      error: {
        code: error && error.publicCode ? error.publicCode : 'INTERNAL_ERROR',
        message: error && error.publicMessage
          ? error.publicMessage
          : 'Submission could not be processed.',
      },
    });
  }
}

/**
 * Run this once from the Apps Script editor as the creator.
 * Never call it using values from a public request.
 */
function configurePoc(spreadsheetId, optionalSheetName) {
  if (typeof spreadsheetId !== 'string' || spreadsheetId.trim() === '') {
    throw new Error('A spreadsheet ID is required.');
  }

  const sheetName = optionalSheetName || POC_CONFIG.DEFAULT_SHEET_NAME;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId.trim());
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const properties = PropertiesService.getScriptProperties();
  properties.setProperties({
    SPREADSHEET_ID: spreadsheetId.trim(),
    SHEET_NAME: sheetName,
  });

  ensureHeaders_(sheet);
  return { spreadsheetId: spreadsheet.getId(), sheetName: sheet.getName() };
}

/**
 * Initializes the Sheet after SPREADSHEET_ID and SHEET_NAME have been entered
 * in Project Settings > Script Properties.
 */
function initializePoc() {
  const trustedConfig = getTrustedConfig_();
  const spreadsheet = SpreadsheetApp.openById(trustedConfig.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(trustedConfig.sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(trustedConfig.sheetName);
  }
  ensureHeaders_(sheet);
  return { spreadsheetId: spreadsheet.getId(), sheetName: sheet.getName() };
}

function getRawBody_(event) {
  if (!event || !event.postData || typeof event.postData.contents !== 'string') {
    throw publicError_('EMPTY_BODY', 'Request body is required.');
  }
  return event.postData.contents;
}

function assertPayloadSize_(rawBody) {
  const byteLength = Utilities.newBlob(rawBody).getBytes().length;
  if (byteLength > POC_CONFIG.MAX_PAYLOAD_BYTES) {
    throw publicError_('PAYLOAD_TOO_LARGE', 'Request body is too large.');
  }
}

function validatePayload_(payload) {
  assertPlainObject_(payload, 'INVALID_REQUEST', 'Request must be an object.');
  assertAllowedKeys_(
    payload,
    ['formId', 'schemaVersion', 'submissionId', 'answers'],
    'UNKNOWN_REQUEST_FIELD'
  );

  if (payload.formId !== POC_CONFIG.FORM_ID) {
    throw publicError_('INVALID_FORM', 'Unknown form.');
  }
  if (payload.schemaVersion !== POC_CONFIG.SCHEMA_VERSION) {
    throw publicError_('UNSUPPORTED_SCHEMA', 'Unsupported schema version.');
  }

  const submissionId = validateSubmissionId_(payload.submissionId);
  assertPlainObject_(payload.answers, 'INVALID_ANSWERS', 'Answers must be an object.');
  assertAllowedKeys_(
    payload.answers,
    ['name', 'email', 'message'],
    'UNKNOWN_ANSWER_FIELD'
  );

  const name = validateText_(
    payload.answers.name,
    'name',
    1,
    POC_CONFIG.MAX_NAME_LENGTH
  );
  const email = validateText_(
    payload.answers.email,
    'email',
    3,
    POC_CONFIG.MAX_EMAIL_LENGTH
  );
  const message = validateText_(
    payload.answers.message,
    'message',
    0,
    POC_CONFIG.MAX_MESSAGE_LENGTH
  );

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw publicError_('INVALID_EMAIL', 'Email format is invalid.');
  }

  return {
    formId: payload.formId,
    schemaVersion: payload.schemaVersion,
    submissionId: submissionId,
    answers: { name: name, email: email, message: message },
  };
}

function validateSubmissionId_(value) {
  if (typeof value !== 'string') {
    throw publicError_('INVALID_SUBMISSION_ID', 'Submission ID must be a string.');
  }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(value)) {
    throw publicError_('INVALID_SUBMISSION_ID', 'Submission ID format is invalid.');
  }
  return value;
}

function validateText_(value, fieldName, minLength, maxLength) {
  if (typeof value !== 'string') {
    throw publicError_('INVALID_FIELD', fieldName + ' must be a string.');
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw publicError_(
      'INVALID_FIELD_LENGTH',
      fieldName + ' has an invalid length.'
    );
  }
  return normalized;
}

function assertPlainObject_(value, code, message) {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    throw publicError_(code, message);
  }
}

function assertAllowedKeys_(object, allowedKeys, errorCode) {
  const allowed = Object.create(null);
  allowedKeys.forEach(function (key) { allowed[key] = true; });
  const unknown = Object.keys(object).filter(function (key) { return !allowed[key]; });
  if (unknown.length > 0) {
    throw publicError_(errorCode, 'Request contains unsupported fields.');
  }
}

function getTrustedConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  const sheetName = properties.getProperty('SHEET_NAME');

  if (!spreadsheetId || !sheetName) {
    throw publicError_('NOT_CONFIGURED', 'Submission service is not configured.');
  }
  return { spreadsheetId: spreadsheetId, sheetName: sheetName };
}

function openTrustedSheet_(trustedConfig) {
  const spreadsheet = SpreadsheetApp.openById(trustedConfig.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(trustedConfig.sheetName);
  if (!sheet) {
    throw new Error('Configured response sheet does not exist.');
  }
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, POC_CONFIG.HEADERS.length)
      .setValues([POC_CONFIG.HEADERS.slice()]);
    sheet.setFrozenRows(1);
    return;
  }

  const headers = sheet
    .getRange(1, 1, 1, POC_CONFIG.HEADERS.length)
    .getDisplayValues()[0];
  const valid = POC_CONFIG.HEADERS.every(function (header, index) {
    return headers[index] === header;
  });
  if (!valid) {
    throw new Error('Configured sheet headers do not match the PoC schema.');
  }
}

function hasSubmissionId_(sheet, submissionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet
    .getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(submissionId)
    .matchEntireCell(true)
    .findNext() !== null;
}

function appendResponse_(sheet, response) {
  const rowNumber = sheet.getLastRow() + 1;
  const row = [[
    new Date(),
    toSheetText_(response.submissionId),
    response.schemaVersion,
    toSheetText_(response.answers.name),
    toSheetText_(response.answers.email),
    toSheetText_(response.answers.message),
  ]];

  sheet.getRange(rowNumber, 1, 1, row[0].length).setValues(row);
}

function toSheetText_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function publicError_(code, message) {
  const error = new Error(code);
  error.publicCode = code;
  error.publicMessage = message;
  return error;
}

function jsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

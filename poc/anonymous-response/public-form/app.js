(function () {
  'use strict';

  const form = document.querySelector('#poc-form');
  const status = document.querySelector('#status');
  const submitButton = document.querySelector('#submit-button');
  const endpoint = window.TRANSFORMER_POC_CONFIG
    ? window.TRANSFORMER_POC_CONFIG.endpointUrl
    : '';

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    setStatus('正在提交…', 'pending');
    submitButton.disabled = true;

    try {
      assertConfigured(endpoint);
      const formData = new FormData(form);
      const submissionId = getOrCreateSubmissionId();
      const payload = {
        formId: 'poc_contact_form',
        schemaVersion: 1,
        submissionId: submissionId,
        answers: {
          name: String(formData.get('name') || ''),
          email: String(formData.get('email') || ''),
          message: String(formData.get('message') || ''),
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!result.ok) {
        const code = result.error && result.error.code
          ? result.error.code
          : 'UNKNOWN_ERROR';
        throw new Error(code);
      }

      sessionStorage.removeItem('transformer-poc-submission-id');
      form.reset();
      setStatus(
        result.duplicate ? '此回覆先前已成功送出。' : '回覆已成功送出。',
        'success'
      );
    } catch (error) {
      console.error(error);
      setStatus(
        '無法確認回覆是否送達。請保留頁面並檢查部署設定或網路狀態。',
        'error'
      );
    } finally {
      submitButton.disabled = false;
    }
  });

  function getOrCreateSubmissionId() {
    const storageKey = 'transformer-poc-submission-id';
    let value = sessionStorage.getItem(storageKey);
    if (!value) {
      value = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '_')
        : 'submission_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      sessionStorage.setItem(storageKey, value);
    }
    return value;
  }

  function assertConfigured(url) {
    if (!url || url.includes('REPLACE_ME') || !url.startsWith('https://')) {
      throw new Error('ENDPOINT_NOT_CONFIGURED');
    }
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind;
  }
})();

/* global grecaptcha */
let siteKey;

export default function (widgetEl) {
  if (!widgetEl.querySelector('[data-apos-recaptcha-sitekey]')) {
    return;
  }

  siteKey = widgetEl.querySelector('[data-apos-recaptcha-sitekey]').dataset.aposRecaptchaSitekey;

  if (!document.querySelector('[data-apos-recaptcha-script]')) {

    window.enableSubmissions = function () {
      grecaptcha.ready(function() {
        const buttons = document.querySelectorAll('[data-apos-form-submit]');

        [ ...buttons ].forEach(btn => {
          btn.disabled = false;
        });
      });
    };
    addRecaptchaScript(siteKey);
  }

  return {
    getToken
  };
}

function addRecaptchaScript (siteKey) {
  const container = document.querySelector('[data-apos-refreshable]') || document.body;
  const recaptchaScript = document.createElement('script');

  recaptchaScript.src = apos.http.addQueryToUrl('https://www.google.com/recaptcha/api.js', {
    render: siteKey,
    onload: 'enableSubmissions'
  });

  recaptchaScript.setAttribute('data-apos-recaptcha-script', '');
  recaptchaScript.setAttribute('async', '');
  recaptchaScript.setAttribute('defer', '');
  container.appendChild(recaptchaScript);
}

async function getToken (widgetEl) {
  return grecaptcha.execute(siteKey, { action: 'submit' });
}

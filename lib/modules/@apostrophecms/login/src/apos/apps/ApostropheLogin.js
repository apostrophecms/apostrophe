import Vue from 'apostrophe/vue';

export default function() {
  const el = document.querySelector('#apos-login');
  if (el) {
    return new Vue({
      el,
      // TODO check apos.login.browser.components.theApostropheLogin for alternate name
      template: '<component :is="`TheApostropheLogin`" />'
    });
  }
};

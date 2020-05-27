import Vue from 'apostrophe/vue';

console.log('imported');
export default function() {
  console.log('hi');
  const el = document.querySelector('#apos-login');
  console.log(el);
  if (el) {
    return new Vue({
      el,
      // TODO check apos.login.browser.components.theApostropheLogin for alternate name
      template: '<component :is="`TheApostropheLogin`" />'
    });
  }
};

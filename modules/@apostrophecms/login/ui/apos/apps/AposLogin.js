import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  const el = document.querySelector('#apos-login');
  if (el) {
    return new Vue({
      el,
      // TODO check apos.login.browser.components.theAposLogin for alternate name
      template: '<component :is="`TheAposLogin`" />'
    });
  }
  apos.bus.$on('admin-menu-click', async (item) => {
    if (item !== '@apostrophecms/login-logout') {
      return;
    }
    await apos.http.post(`${apos.modules['@apostrophecms/login'].action}/logout`, {});
    window.sessionStorage.setItem('aposStateChange', Date.now());
    window.sessionStorage.setItem('aposStateChangeSeen', '{}');
    location.reload();
  });
};

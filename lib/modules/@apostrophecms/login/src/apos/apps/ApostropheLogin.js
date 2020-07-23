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
  apos.bus.$on('admin-menu-click', async (item) => {
    if (item !== '@apostrophecms/login-logout') {
      return;
    }
    await apos.http.post(`${apos.modules['@apostrophecms/login'].action}/logout`, {});
    location.reload(true);
  });
};

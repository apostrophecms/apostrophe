import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  const el = document.querySelector('#apos-login');
  if (el) {
    return new Vue({
      el,
      render: function (h) {
        return h('TheAposLogin');
      }
    });
  }
  apos.bus.$on('admin-menu-click', async (item) => {
    if (item !== '@apostrophecms/login-logout') {
      return;
    }
    await apos.http.post(`${apos.modules['@apostrophecms/login'].action}/logout`, {});
    window.sessionStorage.setItem('aposStateChange', Date.now());
    window.sessionStorage.setItem('aposStateChangeSeen', '{}');
    try {
      await apos.http.get(location.href, {});
    } catch (e) {
      if (e.status === 404) {
        location.assign('/');
        return;
      }
    }
    location.reload();
  });
};

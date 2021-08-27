export default () => {
  document.addEventListener('click', e => {
    if (!e.target.matches('a[data-apos-cross-domain-session-token]')) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    const token = e.target.getAttribute('data-apos-cross-domain-session-token');
    let href = window.location.protocol + '//';
    href += apos.i18n.locales[e.target.getAttribute('data-apos-locale')];
    href += ':' + window.location.port;
    href += e.target.getAttribute('href');
    if (href.indexOf('/') === -1) {
      href += '?';
    } else if (href.indexOf('=') !== -1) {
      href += '&';
    }
    href += 'aposCrossDomainSessionToken=' + token;
    // Cache buster
    href += '&cb=' + Math.random().toString().replace('.', '');
    window.location.href = href;
  });
};

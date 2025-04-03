// If the page delivers a logged-out content but we know from session storage
// that a user is logged-in, we force-refresh the page to bypass the cache,
// in order to get the logged-in content (with admin UI).
export default function() {
  const isLoggedOutPageContent = !(apos.login && apos.login.user);
  const isLoggedInCookie = apos.util.getCookie(`${self.apos.shortName}.loggedIn`) === 'true';

  if (!isLoggedOutPageContent || !isLoggedInCookie) {
    sessionStorage.setItem('aposRefreshedPages', '{}');

    return;
  }

  const refreshedPages = JSON.parse(sessionStorage.aposRefreshedPages || '{}');

  // Avoid potential refresh loops
  if (!refreshedPages[location.href]) {
    refreshedPages[location.href] = true;
    sessionStorage.setItem('aposRefreshedPages', JSON.stringify(refreshedPages));

    // eslint-disable-next-line no-console
    console.info('Received logged-out content from cache while logged-in, refreshing the page');

    location.reload();
  }
};

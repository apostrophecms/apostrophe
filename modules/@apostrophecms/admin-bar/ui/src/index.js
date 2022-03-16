/**
 * If the page delivers a logged-out content but we know from session storage that a user is logged-in,
 * we force-refresh the page to bypass the cache, in order to get the logged-in content (with admin UI).
 */
export default function() {
  const isLoggedOutPageContent = document.body.getAttribute('data-apos-user-logged-in') !== 'true';
  const isLoggedInCookie = apos.util.getCookie(`${self.apos.shortName}.loggedIn`) === 'true';

  console.log('isLoggedOutPageContent', isLoggedOutPageContent);
  console.log('isLoggedInCookie', isLoggedInCookie);

  if (!isLoggedOutPageContent || !isLoggedInCookie) {
    sessionStorage.setItem('aposRefreshedPages', '{}');

    return;
  }

  const refreshedPages = sessionStorage.aposRefreshedPages ? JSON.parse(sessionStorage.aposRefreshedPages) : {};
  console.log('refreshedPages', refreshedPages);

  // Avoid potential refresh loops
  if (!refreshedPages[location.pathname]) {
    refreshedPages[location.pathname] = true;
    sessionStorage.setItem('aposRefreshedPages', JSON.stringify(refreshedPages));

    console.info('Received logged-out content from cache while logged-in, refreshing the page');

    alert('reloading...');
    location.reload();
  }
};

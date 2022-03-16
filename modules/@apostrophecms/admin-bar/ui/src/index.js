/**
 * If the page delivers a logged-out content but we know from session storage that a user is logged-in,
 * we force-refresh the page to bypass the cache, in order to get the logged-in content (with admin UI).
 */
export default function() {
  const isLoggedOutPageContent = !document.body.getAttribute('data-apos-user-logged-in');

  if (!isLoggedOutPageContent || sessionStorage.aposUserLoggedIn !== 'true') {
    return;
  }

  let refreshedPages = {};
  try {
    refreshedPages = JSON.parse(sessionStorage.aposRefreshedPages);
  } catch {
    // Do nothing, just catching a potential error
    // in the case `sessionStorage.aposRefreshedPages` is not set
  }

  // Avoid potential refresh loops
  if (!refreshedPages[location.pathname]) {
    refreshedPages[location.pathname] = true;
    sessionStorage.setItem('aposRefreshedPages', JSON.stringify(refreshedPages));

    console.info('Received logged-out content from cache while logged-in, refreshing the page');

    location.reload();
  }
};

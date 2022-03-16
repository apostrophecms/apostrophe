/**
 * If the page delivers a logged-out content but we know from session storage that a user is logged-in,
 * we force-refresh the page to bypass the cache, in order to get the logged-in content (with admin UI).
 */
export default function() {
  const isLoggedOutPageContent = document.body.getAttribute('data-apos-user-logged-in') !== 'true';
  const isLoggedInCookie = apos.util.getCookie(`${self.apos.shortName}.loggedIn`) === 'true';

  if (isLoggedOutPageContent && isLoggedInCookie) {
    console.info('Received logged-out content from cache while logged-in, refreshing the page');

    location.reload();
  }
};

/**
 * If the delivered page has a logged-out content, but a cookie say "Hey, I'm logged in",
 * we force-refresh the page to bypass the cache, in order to get the logged-in content.
 */
export default function() {
  const isLoggedInPageContent = document.body.getAttribute('data-apos-user-logged-in');
  console.log('isLoggedInPageContent', isLoggedInPageContent);

  if (isLoggedInPageContent) {
    return;
  }

  if (apos.util.getCookie('loggedIn')) {
    console.log('loggedIn cookie, RELOADING...');
    apos.util.deleteCookie('loggedIn');
    location.reload();
  }
};

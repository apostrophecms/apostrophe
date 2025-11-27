// Add, update or remove the named query parameter
// and return a new URL.
//
// Typically Astro.url is passed in.
//
// If value is undefined, null or empty it is removed
// from the query string.

export default function(url, name, value) {
  const newUrl = new URL(url);
  // Internal query parameters not suitable for public facing URLs
  newUrl.searchParams.delete('aposRefresh');
  newUrl.searchParams.delete('aposMode');
  newUrl.searchParams.delete('aposEdit');
  if ((value == null) || (value === '')) {
    newUrl.searchParams.delete(name);
  } else {
    newUrl.searchParams.set(name, value);
  }
  return newUrl;
}

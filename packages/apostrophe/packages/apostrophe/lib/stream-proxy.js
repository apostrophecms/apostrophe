// Make a request for url and stream it to req.res,
// passing through relevant headers, without downloading
// the whole thing to disk. Site-relative URLs are
// resolved via req.baseUrl. Server-side errors are logged to
// error() which should accept multiple arguments

module.exports = async function(req, url, { error }) {
  const res = req.res;
  if (url.startsWith('/')) {
    // Can't make a self-request without an absolute URL
    url = `${req.baseUrl}${url}`;
  }
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    return send502(e);
  }
  for (const header of [ 'content-type', 'etag', 'last-modified', 'content-disposition', 'cache-control' ]) {
    const result = response.headers.get(header);
    if (result != null) {
      res.header(header, result);
    }
  }
  res.status(response.status);
  if (response.body == null) {
    return res.end();
  }
  response.body.pipeTo(new WritableStream({
    write(chunk) {
      res.write(chunk);
    },
    close() {
      res.end();
    },
    abort(reason) {
      if (!res.headersSent) {
        return send502(reason);
      } else {
        // Only way to signal failure after headers are sent
        res.destroy();
      }
    }
  }));
  function send502(e) {
    error(`Error fetching "ugly URL" ${url} to resolve pretty URL ${req.url}:`, e);
    return res.status(502).send('upstream media error fetching data for pretty URL');
  }
};

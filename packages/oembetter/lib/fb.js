module.exports = function(url, options, response, callback) {

  // if it's a Facebook video, manipulate the response
  if (!(response.provider_name === 'Facebook')) {
    return setImmediate(callback);
  }

  // check if "fb-root" exists, if it doesn't, add it to the DOM
  response.html = response.html.replace(/<div id="fb-root"><\/div>\s*/,
    '<script>(function() { ' +
      'if (!document.getElementById("fb-root")) { ' +
        'var root = document.createElement("div"); ' +
        'root.setAttribute("id", "fb-root"); ' +
        'document.body.appendChild(root); ' +
      '}' +
    '})();</script>');

  // call FB.XFBML.parse() to render special Facebook markup (XFBML)
  response.html = response.html +
    '<script>' +
    '(function() { function reparse() { window.FB ? setTimeout(function() { window.FB.XFBML.parse(); }, 100) : setTimeout(reparse, 100); } reparse(); })();' +
    '</script>';

  // FB doesn't include a thumbnail image URL, pull it manually from their graph API
  if (response.url) {
    const matches = response.url.match(/\/videos\/[^\d]*(\d+)/);
    if (matches) {
      response.thumbnail_url = 'https://graph.facebook.com/' + matches[1] + '/picture';
    }
  }
  return callback(null, response);
};

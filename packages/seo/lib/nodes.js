function getMetaHead(data) {
  const nodes = [];
  const home = data.home;
  const piece = data.piece;
  const page = data.page;
  const global = data.global;
  const document = piece || page;

  // title
  const seoTitle = piece?.seoTitle ||
    page?.seoTitle ||
    home?.seoTitle;
  if (seoTitle) {
    nodes.push({
      name: 'meta',
      attrs: {
        name: 'title',
        content: seoTitle
      }
    });
  }

  // description
  const seoDescription = piece?.seoDescription ||
    page?.seoDescription ||
    home?.seoDescription;
  if (seoDescription) {
    nodes.push({
      name: 'meta',
      attrs: {
        name: 'description',
        content: seoDescription
      }
    });
  }

  // robots
  const seoRobots = document?.seoRobots;
  if (seoRobots?.length) {
    nodes.push({
      name: 'meta',
      attrs: {
        name: 'robots',
        content: seoRobots
      }
    });
  }

  // Google Verification ID
  if (global?.seoGoogleVerificationId) {
    nodes.push({
      name: 'meta',
      attrs: {
        name: 'google-site-verification',
        content: global.seoGoogleVerificationId
      }
    });
  }

  // canonical URL logic
  if (document?._seoCanonical?.length) {
    // canonical page URL
    nodes.push({
      name: 'link',
      attrs: {
        rel: 'canonical',
        href: document._seoCanonical[0]._url
      }
    });
  } else if (document?.seoSelectType &&
    document[document.seoSelectType]?.length) {
    // canonical piece-page URL
    nodes.push({
      name: 'link',
      attrs: {
        rel: 'canonical',
        href: document[document.seoSelectType][0]._url
      }
    });
  }

  // Google Tracking ID
  if (global?.seoGoogleTrackingId) {
    nodes.push({
      comment: 'Global site tag (gtag.js) - Google Analytics'
    });
    nodes.push({
      name: 'script',
      attrs: {
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${global.seoGoogleTrackingId}`
      }
    });
    nodes.push({
      name: 'script',
      body: [ {
        raw: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${global.seoGoogleTrackingId}');
`
      } ]
    });
  }

  return nodes;
}

function getTagManagerHead(data) {
  const nodes = [];
  const global = data.global;

  if (global?.seoGoogleTagManager) {
    nodes.push({
      comment: ' Google Tag Manager '
    });

    nodes.push({
      name: 'script',
      body: [ {
        raw: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${global.seoGoogleTagManager}');`
      } ]
    });

    nodes.push({
      comment: ' End Google Tag Manager '
    });
  }

  return nodes;
}

function getTagManagerBody(data) {
  const nodes = [];
  const global = data.global;

  if (global && global.seoGoogleTagManager) {
    // Comment node for Google Tag Manager (noscript) start
    nodes.push({
      comment: ' Google Tag Manager (noscript) '
    });

    // Noscript tag with iframe
    nodes.push({
      name: 'noscript',
      body: [ {
        name: 'iframe',
        attrs: {
          src: `https://www.googletagmanager.com/ns.html?id=${global.seoGoogleTagManager}`,
          height: '0',
          width: '0',
          style: 'display:none;visibility:hidden'
        }
      } ]
    });

    // Comment node for Google Tag Manager (noscript) end
    nodes.push({
      comment: ' End Google Tag Manager (noscript) '
    });
  }

  return nodes;
}

module.exports = {
  getMetaHead,
  getTagManagerHead,
  getTagManagerBody
};

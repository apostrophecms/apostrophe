// The JSX version of `templateError.html`, rendered when a page fails to
// render. Kept as simple as possible so it cannot fail too.

import { Raw } from '../lib/jsxLayout.js';

const style = "\n    body {\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      background-color: #0f0f0f;\n      color: white;\n      font-family: -apple-system, system-ui, 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';\n      height: 100vh;\n      margin: 0;\n      padding: 0;\n    }\n\n    main {\n      display: flex;\n      justify-content: center;\n    }\n\n    .content, .logo {\n      transition: opacity 300ms ease;\n      transition-delay: 500ms;\n      animation: fadeIn 1000ms;\n      -webkit-animation: fadeIn 1000ms;\n    }\n\n    .logo {\n      position: absolute;\n      top: 30px;\n      right: 30px;\n      width: 60px;\n      height: 60px;\n\n    }\n\n    .content {\n      display: flex;\n      font-size: 14px;\n      align-items: center;\n    }\n\n    .error-code {\n      font-size: 24px;\n      position: relative;\n      display: inline-flex;\n      align-items: center;\n      padding-right: 15px;\n      margin-right: 15px;\n    }\n\n    .error-code:after {\n      display: block;\n      content: \"\";\n      height: 40px;\n      width: 1px;\n      background: #ffffff4d;\n      position: absolute;\n      right: 0;\n    }\n\n    .message {\n      font-weight: normal;\n      font-size: inherit;\n    }\n\n    @keyframes fadeIn {\n      0% {opacity:0;}\n      100% {opacity:1;}\n    }\n\n    @-webkit-keyframes fadeIn {\n      0% {opacity:0;}\n      100% {opacity:1;}\n    }\n\n  ";

const logo = "<svg id=\"Layer_1\" data-name=\"Layer 1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 230.39 230.39\">\n        <defs>\n          <linearGradient id=\"circle\" x1=\"173.17\" y1=\"86.95\" x2=\"141.86\" y2=\"141.17\" gradientUnits=\"userSpaceOnUse\">\n            <stop offset=\"0\" stop-color=\"#cc9300\"/>\n            <stop offset=\"0.47\" stop-color=\"#ea433a\"/>\n            <stop offset=\"1\" stop-color=\"#b327bf\"/>\n          </linearGradient>\n          <linearGradient id=\"Square_2\" data-name=\"Square 2\" x1=\"92.49\" y1=\"41\" x2=\"67.07\" y2=\"110.85\" gradientUnits=\"userSpaceOnUse\">\n            <stop offset=\"0\" stop-color=\"#cc9300\"/>\n            <stop offset=\"0.26\" stop-color=\"#ea433a\"/>\n            <stop offset=\"0.47\" stop-color=\"#b327bf\"/>\n            <stop offset=\"0.76\" stop-color=\"#66f\"/>\n            <stop offset=\"1\" stop-color=\"#00bf9a\"/>\n          </linearGradient>\n          <linearGradient id=\"triangle\" x1=\"75.13\" y1=\"190.31\" x2=\"120.2\" y2=\"143.64\" gradientUnits=\"userSpaceOnUse\">\n            <stop offset=\"0\" stop-color=\"#b327bf\"/>\n            <stop offset=\"0.47\" stop-color=\"#66f\"/>\n            <stop offset=\"1\" stop-color=\"#00c09a\"/>\n          </linearGradient>\n        </defs>\n        <path d=\"M154.49,220.39l-44.16,7c-30.12,4.77-41.53,3.36-53.48-.78a62.25,62.25,0,0,1-29.59-21.5C19.63,195,14.77,184.61,10,154.49L3,110.33C-1.77,80.21-.36,68.8,3.78,56.85a62.25,62.25,0,0,1,21.5-29.59C35.36,19.63,45.78,14.77,75.9,10l44.16-7c30.12-4.77,41.53-3.36,53.48.78a62.18,62.18,0,0,1,29.58,21.5c7.64,10.08,12.5,20.5,17.27,50.62l7,44.16c4.77,30.12,3.36,41.53-.78,53.48a62.18,62.18,0,0,1-21.5,29.58C195,210.76,184.61,215.62,154.49,220.39Z\" style=\"fill-rule: evenodd\"/>\n        <g>\n          <g>\n            <g>\n              <g id=\"Group-21\">\n                <path id=\"Oval-Copy-84\" d=\"M162.43,145.1a31.43,31.43,0,1,0-35.65-26.17A31.28,31.28,0,0,0,162.43,145.1Zm-1.57-9.94a21.37,21.37,0,1,1,17.45-24.39A21.2,21.2,0,0,1,160.86,135.16Z\" style=\"fill: url(#circle)\"/>\n                <path id=\"Rectangle-Copy-64\" d=\"M61,107.94l46.64-7.38a5,5,0,0,0,4.18-5.76l-7.4-46.71a5,5,0,0,0-5.76-4.19L52,51.29a5,5,0,0,0-4.18,5.76l7.4,46.71A5,5,0,0,0,61,107.94Zm3.39-10.72L58.52,60.45l36.7-5.81L101,91.41Z\" style=\"fill: url(#Square_2)\"/>\n                <path id=\"Triangle-Copy-15\" d=\"M90.56,124.91,70.33,181.56a5,5,0,0,0,5.53,6.67l56.94-9a5,5,0,0,0,3.2-8.05L99.29,123.53A5,5,0,0,0,90.56,124.91ZM96.94,137l25.91,33.62L82.66,177Z\" style=\"fill: url(#triangle)\"/>\n              </g>\n            </g>\n          </g>\n        </g>\n      </svg>";

export default function (_data, { __t, helpers }) {
  return (
    <>
      {new Raw('<!DOCTYPE html>\n')}
      <html lang='en-US'>
        <head>
          <meta charset='utf-8' />
          <title>{__t('apostrophe:errorPageTitle')}</title>
          <style type='text/css' dangerouslySetInnerHTML={{ __html: style }} />
        </head>
        <body>
          <main>
            <div className='logo' dangerouslySetInnerHTML={{ __html: logo }} />
            <div className='container'>
              <div className='content'>
                <p className='error-code'>{__t('apostrophe:errorPageStatusCode')}</p>
                <h1 className='message'>{__t('apostrophe:errorPageMessage')}</h1>
              </div>
            </div>
          </main>
          {helpers.modules['@apostrophecms/asset'].refreshOnRestart()}
        </body>
      </html>
    </>
  );
}

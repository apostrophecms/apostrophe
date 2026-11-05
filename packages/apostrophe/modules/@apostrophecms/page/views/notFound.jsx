// The JSX version of `notFound.html`, used when the `jsx` option of
// @apostrophecms/template is set. It extends the project's layout, which may
// be JSX or Nunjucks. A Nunjucks layout gets the styles as its `afterMain`
// block, exactly as `notFound.html` gives them. A JSX layout gets them as
// part of `main`, since it passes on only the props it knows about, and
// every layout knows `main`.

const style = "\n    .apos-not-found {\n      display: flex;\n      justify-content: center;\n      position: absolute;\n      width: 100%;\n      left: 0;\n      right: 0;\n      top: 0;\n      bottom: 0;\n      margin: auto;\n    }\n\n    .apos-not-found__container {\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      justify-content: center;\n      transition: opacity 300ms ease;\n      transition-delay: 500ms;\n      animation: fadeIn 1000ms;\n      -webkit-animation: fadeIn 1000ms;\n    }\n\n    .apos-not-found__home-link {\n      color: currentColor;\n    }\n\n    .apos-not-found__content {\n      display: flex;\n      font-size: 14px;\n      align-items: center;\n    }\n\n    .apos-not-found__error-code,\n    .apos-not-found__message,\n    .apos-not-found__home-link {\n      font-family: -apple-system, system-ui, 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';\n    }\n\n    .apos-not-found__error-code {\n      font-size: 24px;\n      position: relative;\n      display: inline-flex;\n      align-items: center;\n      padding-right: 15px;\n      margin-right: 15px;\n    }\n\n    .apos-not-found__error-code:after {\n      display: block;\n      content: \"\";\n      height: 40px;\n      width: 1px;\n      background: currentColor;\n      position: absolute;\n      right: 0;\n    }\n\n    .apos-not-found__message {\n      font-weight: normal;\n      font-size: inherit;\n      letter-spacing: 0;\n    }\n\n    @keyframes fadeIn {\n      0% {opacity:0;}\n      100% {opacity:1;}\n    }\n\n    @-webkit-keyframes fadeIn {\n      0% {opacity:0;}\n      100% {opacity:1;}\n    }\n  ";

export default function (_data, { Extend, apos, __t }) {
  const layout = apos.template.resolveTemplate(apos.page, 'layout.html');
  const nunjucksLayout = layout && (layout.kind === 'nunjucks');
  const styleTag = <style dangerouslySetInnerHTML={{ __html: style }} />;
  return (
    <Extend
      templateName='layout.html'
      title={__t('apostrophe:notFoundPageTitle')}
      main={
        <>
          <section className='apos-not-found'>
            <div className='apos-not-found__container'>
              <div className='apos-not-found__content'>
                <p className='apos-not-found__error-code'>{__t('apostrophe:notFoundPageStatusCode')}</p>
                <h1 className='apos-not-found__message'>
                  {__t('apostrophe:notFoundPageMessage')}{' '}
                  <a className='apos-not-found__home-link' href='/'>{__t('apostrophe:backToHome')}</a>
                </h1>
              </div>
            </div>
          </section>
          {!nunjucksLayout && styleTag}
        </>
      }
      afterMain={nunjucksLayout ? styleTag : undefined}
    />
  );
}

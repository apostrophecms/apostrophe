// The JSX version of `login.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ outerLayout }, { Extend, __t }) {
  return (
    <Extend
      templateName={outerLayout}
      title={__t('apostrophe:loginPageTitle')}
      bodyClass='apos-login-page'
      beforeMain={
        // Hush up project level styles while login loads
        <style dangerouslySetInnerHTML={{
          __html: `
    body {
      background-color: var(--a-background-primary) !important;
    }
  `
        }} />
      }
      main={<div id='apos-login'></div>}
    />
  );
}

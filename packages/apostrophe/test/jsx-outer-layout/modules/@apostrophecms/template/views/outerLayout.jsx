// A project-level JSX outer layout. Nunjucks and JSX page templates both
// reach it through `data.outerLayout`.
export default function ({
  title, bodyClass, extraHead, beforeMain, main, afterMain
}, { Extend }) {
  return (
    <Extend
      templateName='outerLayoutBase.html'
      title={title}
      bodyClass={bodyClass}
      extraHead={
        <>
          <meta name='jsx-outer-layout' content='yes' />
          {extraHead}
        </>
      }
      beforeMain={beforeMain}
      main={<div className='jsx-outer-main'>{main}</div>}
      afterMain={afterMain}
    />
  );
}

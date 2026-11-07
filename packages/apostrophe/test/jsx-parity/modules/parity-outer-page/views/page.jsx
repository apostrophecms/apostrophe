export default function ({ page, outerLayout }, { Extend, Area }) {
  return (
    <Extend
      templateName={outerLayout}
      title={(title) => <>{title} (no layout)</>}
      bodyClass='outer-page'
      main={<Area doc={page} name='main' />}
    />
  );
}

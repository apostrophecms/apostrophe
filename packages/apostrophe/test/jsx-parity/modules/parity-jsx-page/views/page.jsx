export default function ({ page }, { Extend, Area, Field }) {
  return (
    <Extend
      templateName='layout.html'
      bodyClass='parity-page'
      extraHtml='data-parity="1"'
      standardHead={(standard) => (
        <>
          {standard}
          <meta name='parity' content='yes' />
        </>
      )}
      main={
        <>
          <h1>{page.title}</h1>
          <Field doc={page} name='subtitle' />
          <Area doc={page} name='main' />
        </>
      }
    />
  );
}

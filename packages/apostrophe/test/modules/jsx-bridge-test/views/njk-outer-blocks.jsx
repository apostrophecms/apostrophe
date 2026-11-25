export default function ({
  outerLayout, title, bodyClass, extraHtml, main
}, { Extend }) {
  return (
    <Extend
      templateName={outerLayout}
      title={title}
      bodyClass={bodyClass}
      extraHtml={extraHtml}
      main={main}
    />
  );
}

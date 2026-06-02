export default function (data, { helpers }) {
  return (
    <>
      {helpers.modules['template-jsx-options-test'].options.spiffiness}
      {' '}
      {helpers.modules['template-jsx-options-test'].test(2)}
    </>
  );
}

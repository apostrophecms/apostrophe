export default function (_data, { Extend }) {
  return (
    <Extend
      templateName='njk-layout.html'
      content={<p>from jsx</p>}
    />
  );
}

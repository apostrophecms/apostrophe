// The JSX version of `show.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ outerLayout, piece }, { Extend }) {
  return (
    <Extend
      templateName={outerLayout}
      title={piece?.title}
      main={<h2>{piece?.title}</h2>}
    />
  );
}

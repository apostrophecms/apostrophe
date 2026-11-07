// The JSX version of `inject.html`: the components and nodes injected at one
// position of the outer layout. See `apos.template.prepend()`.
export default function ({ components, html }, { Component, apos }) {
  return (
    <>
      {(components || []).map((component) => {
        const parsed = component.match(/^([^:]+):(.+)$/);
        if (!parsed) {
          throw new Error(`Injected component names look like module-name:componentName, not ${component}`);
        }
        return <Component module={parsed[1]} name={parsed[2]} />;
      })}
      {html ? apos.template.safe(html) : null}
    </>
  );
}

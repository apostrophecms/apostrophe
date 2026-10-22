export default function (data, { Component }) {
  return (
    <section>
      <h1>Welcome</h1>
      <Component module='jsx-component-test' name='greet' who={data.name} />
    </section>
  );
}

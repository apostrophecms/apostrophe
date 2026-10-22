export default function (data, { Component }) {
  return (
    <div class='async-widget'>
      <Component
        module='jsx-component-test'
        name='greet'
        who={data.widget.who}
      />
    </div>
  );
}

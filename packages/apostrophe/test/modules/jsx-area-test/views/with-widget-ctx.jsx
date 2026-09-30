export default function (data, { Widget }) {
  return (
    <section class='wrapper'>
      <Widget
        widget={data.widget}
        with={{
          'jsx-ctx': { tag: 'from-widget-with' }
        }}
      />
    </section>
  );
}

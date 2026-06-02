export default function (data, { Widget }) {
  return (
    <section class='wrapper'>
      <Widget widget={data.widget} />
    </section>
  );
}

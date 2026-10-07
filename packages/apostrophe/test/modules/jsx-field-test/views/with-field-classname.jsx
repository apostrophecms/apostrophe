export default function (data, { Field }) {
  return (
    <main>
      <Field
        doc={data.piece}
        name='name'
        with={{
          tag: 'h2',
          className: 'lede'
        }}
      />
    </main>
  );
}

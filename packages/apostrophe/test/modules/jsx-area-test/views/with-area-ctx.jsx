export default function (data, { Area }) {
  return (
    <main>
      <Area
        doc={data.piece}
        name='main'
        with={{
          'jsx-ctx': { tag: 'from-area-with' }
        }}
      />
    </main>
  );
}

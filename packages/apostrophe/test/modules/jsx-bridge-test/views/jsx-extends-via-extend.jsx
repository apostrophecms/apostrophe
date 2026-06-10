export default function (data, { Extend }) {
  return (
    <Extend templateName='jsx-layout.jsx' title='Extend-against-JSX'>
      <main>
        <p>{data.message}</p>
      </main>
    </Extend>
  );
}

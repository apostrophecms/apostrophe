export default function (data, { Template }) {
  return (
    <Template templateName='jsx-layout.jsx' title='JSX-in-JSX'>
      <main>
        <p>{data.message}</p>
      </main>
    </Template>
  );
}

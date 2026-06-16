export default function (data) {
  return (
    <ul>
      {data.items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

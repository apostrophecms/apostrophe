async function bullet(value) {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return <li>{value}</li>;
}

export default async function (data) {
  return (
    <ul>
      {data.items.map((item) => bullet(item))}
    </ul>
  );
}

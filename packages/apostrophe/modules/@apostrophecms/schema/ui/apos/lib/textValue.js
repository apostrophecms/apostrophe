// The browser side of `textValue` in the `string` and `richText` field
// types. A field that stores text can find an object in its property instead,
// when a field of another type, most often an area, once had the same name:
// removing a field from the schema leaves its data in the database, and a new
// field that takes the name inherits it. Such a value was never text, so it
// is edited as an empty one, and saving replaces it.

export default function textValue(value) {
  return ((value != null) && ((typeof value) === 'object')) ? '' : value;
}

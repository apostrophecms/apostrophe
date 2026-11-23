import { reactive } from 'vue';

// Media images the thread shows, read once per page by id: `{ status,
// url, large }`, `status` `loading`, `ready` or `gone` (archived, deleted
// or not the editor's to read)
const images = reactive({});

export function getMediaImage(_id) {
  if (!images[_id]) {
    images[_id] = { status: 'loading' };
    load(_id);
  }
  return images[_id];
}

async function load(_id) {
  try {
    const doc = await apos.http.get(
      `${apos.modules['@apostrophecms/image'].action}/${_id}`,
      { draft: true }
    );
    const urls = doc.attachment?._urls;
    images[_id] = urls
      ? {
        status: 'ready',
        url: urls['one-third'] || urls.original,
        large: urls.full || urls.original
      }
      : { status: 'gone' };
  } catch (e) {
    images[_id] = { status: 'gone' };
  }
}

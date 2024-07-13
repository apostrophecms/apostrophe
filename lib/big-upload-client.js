// Upload files in 4MB chunks
const chunkSize = 1024; // 1024 * 1024 * 4;

// Used to upload very large files, large enough that they
// might exceed the max body size or max uploaded file size
// configured on a proxy server, etc.
//
// `options` is required and may contain a `files` object
// property containing HTML5 `File` objects. It will become
// `req.files` on the receiving end, just like with more typical
// file upload middleware.
//
// `qs` and `body` become `req.query` and `req.body` on the
// receiving end. You may use them for non-file parameters.
//
// An existing query string in `url` is NOT supported. Use `qs`.
//
// The receiving route must use the `self.apos.http.bigUpload`
// function to obtain the middleware and it must be a `post` route.
//
// The query parameter `aposBigUpload` is reserved for internal use.
//
// If a `progress` function is supplied, it is periodically invoked
// with a proportion (between 0.0 and 1.0) as the upload progresses.
// Be aware the receiving end will typically do quite a bit of processing
// after that.

export default async (url, options) => {

  const http = apos.http;

  const progress = options.progress || (n => {});
  const files = options.files || [];
  const info = {};
  let totalBytes = 0;
  let sentBytes = 0;
  console.log('files:', files);
  for (const [ param, file ] of Object.entries(files)) {
    totalBytes += file.size;
    info[param] = {
      name: file.name,
      size: file.size,
      chunks: Math.ceil(file.size / chunkSize)
    };
  }
  console.log('info:', info);
  const { id } = await http.post(url, {
    qs: {
      aposBigUpload: {
        type: 'start'
      }
    },
    body: {
      files: info
    }
  });
  console.log('after start');
  let n = 0;
  for (const [ param, file ] of Object.entries(files)) {
    const { name, size } = file;
    let chunk = 0;
    for (let offset = 0; (offset < size); offset += chunkSize) {
      const formData = new FormData();
      const thisChunkSize = Math.min(chunkSize, size - offset);
      formData.append('chunk', file.slice(offset, offset + thisChunkSize));
      console.log('before chunk');
      await apos.http.post(url, {
        qs: {
          aposBigUpload: {
            type: 'chunk',
            id,
            n,
            chunk
          }
        },
        body: formData
      });
      console.log('after chunk');
      sentBytes += thisChunkSize;
      progress(sentBytes / totalBytes);
      chunk++;
    }
    n++;
  }
  console.log('before end');
  const result = await http.post(url, {
    qs: {
      aposBigUpload: {
        type: 'end',
        id
      },
      ...options.qs
    },
    body: options.body
  });
  console.log('after end');
  console.log(result);
  return result;
}

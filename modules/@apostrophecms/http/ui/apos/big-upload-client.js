// Upload files in 4MB chunks, well under the typical
// proxy server limit on POST size

const defaultChunkSize = 1024 * 1024 * 4;

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
// The receiving route must use the `self.apos.http.bigUploadMiddleware`
// function to obtain the middleware and it must be a `post` route.
//
// The query parameter `aposBigUpload` is reserved for internal use.
//
// If a `progress` function is supplied, it is periodically invoked
// with a proportion (between 0.0 and 1.0) as the upload progresses.
// Be aware the receiving end will typically do quite a bit of processing
// after that.
//
// If `chunkSize` is specified (in bytes) it is used instead of the usual
// 4MB. The chunk size should be big enough for efficiency but small
// enough to avoid proxy server POST limits.
//
// For testing and server-side use an `http` object and a `FormData` constructor
// may be specified otherwise the standard Apostrophe `apos.http` object
// and the browser's `FormData` are used.

export default async (url, options) => {
  const chunkSize = options.chunkSize || defaultChunkSize;
  const http = options.http || window.apos?.http;
  const files = options.files || {};
  const info = {};
  let totalBytes = 0;
  let sentBytes = 0;
  for (const [ param, file ] of Object.entries(files)) {
    totalBytes += file.size;
    info[param] = {
      name: file.name,
      size: file.size,
      type: file.type,
      chunks: Math.ceil(file.size / chunkSize)
    };
  }
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
  let n = 0;
  for (const file of Object.values(files)) {
    const { size } = file;
    let chunk = 0;
    for (let offset = 0; (offset < size); offset += chunkSize) {
      const formData = new FormData();
      const thisChunkSize = Math.min(chunkSize, size - offset);
      formData.append('chunk', file.slice(offset, offset + thisChunkSize));
      await http.post(url, {
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
      sentBytes += thisChunkSize;
      if (typeof options.progress === 'function') {
        progressInterface(options.progress, sentBytes, totalBytes);
      }
      chunk++;
    }
    n++;
  }
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
  return result;
};

function progressInterface(fn, sent, total) {
  if (typeof fn !== 'function') {
    return;
  }
  if (fn.length === 1) {
    fn(sent / total);
    return;
  }

  fn(sent, total);
}

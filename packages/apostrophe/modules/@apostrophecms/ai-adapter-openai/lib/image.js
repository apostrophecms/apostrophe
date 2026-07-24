// The OpenAI Images API, shared by the openai and openai-compatible
// adapters — one REST surface whichever chat dialect an adapter speaks.
// It generates images from a prompt, or edits one or more source images
// with a prompt, and returns the normalized image result the engine
// assembles into its standard return shape:
// { images: [ { type, data } ], model, usage, size }.

// The aspect the core resolved — always one the model declares — mapped
// to the pixel-size string this API takes. An aspect with no mapping and
// an omitted aspect both leave the size unset, so the service picks.
// Every size satisfies gpt-image-2's constraints (dimensions divisible
// by 16, ratio within 1:3 to 3:1); the first three are exactly
// gpt-image-1's fixed sizes, the only ones it accepts.
const SIZES = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
  '4:3': '1152x864',
  '3:4': '864x1152',
  '16:9': '1536x864',
  '9:16': '864x1536'
};

// Extensions for the source media types an edit can carry, so uploaded
// files are named plausibly; anything else uploads as .png.
const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

// Run one image request. `deps` carries the calling adapter's transport
// and config — { apos, apiKey, baseUrl, timeout } — so the same logic
// serves either adapter instance; `request` is the normalized image
// request { prompt, count, aspect, quality, images?, model, signal }.
// `images` present means an edit (the prompt instructs, the sources are
// edited); absent means generation.
module.exports = async function image(deps, request) {
  const size = SIZES[request.aspect];
  const response = request.images
    ? await edit(deps, request, size)
    : await generate(deps, request, size);
  return parse(response, request.model, size);
};

// The image models both adapters declare, with the aspects the core
// resolves against — derived from the size table, one source of truth,
// so a resolved aspect is always mappable here. gpt-image-2 takes
// near-arbitrary sizes and declares the whole table; gpt-image-1 is
// fixed to its three.
module.exports.models = {
  'gpt-image-2': {
    aspects: Object.keys(SIZES)
  },
  'gpt-image-1': {
    aspects: [ '1:1', '3:2', '2:3' ]
  }
};

// text → image: a JSON body to /images/generations
function generate(deps, request, size) {
  return post(deps, 'images/generations', {
    model: request.model,
    prompt: request.prompt,
    n: request.count,
    ...(size !== undefined && { size }),
    ...(request.quality !== undefined && { quality: request.quality })
  }, request.signal);
}

// image(s) + text → image: a multipart body to /images/edits, the source
// images uploaded as files beside the same dial fields
async function edit(deps, request, size) {
  const form = new FormData();
  form.set('model', request.model);
  form.set('prompt', request.prompt);
  form.set('n', String(request.count));
  if (size !== undefined) {
    form.set('size', size);
  }
  if (request.quality !== undefined) {
    form.set('quality', request.quality);
  }
  const sources = await resolveSources(deps, request.images, request.signal);
  for (const source of sources) {
    form.append(
      'image[]',
      new Blob([ source.buffer ], { type: source.contentType }),
      source.filename
    );
  }
  return post(deps, 'images/edits', form, request.signal);
}

function post(deps, path, body, signal) {
  return deps.apos.http.post(`${deps.baseUrl}/${path}`, {
    headers: {
      authorization: `Bearer ${deps.apiKey}`
    },
    body,
    timeout: deps.timeout,
    ...(signal && { signal })
  });
}

// The normalized source refs → the bytes an edit uploads. Inline data
// decodes directly; a url is fetched (built-in fetch, since apos.http
// reads text only), and a source that will not load is a caller error,
// not a provider one — a hard stop, no retry.
function resolveSources(deps, images, signal) {
  return Promise.all(images.map(async (source, index) => {
    if (source.data !== undefined) {
      return {
        buffer: Buffer.from(source.data, 'base64'),
        contentType: source.mediaType,
        filename: `source-${index}.${extension(source.mediaType)}`
      };
    }
    const response = await fetch(source.url, {
      ...(signal && { signal })
    });
    if (!response.ok) {
      throw deps.apos.error('invalid', `could not fetch image source "${source.url}": HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType,
      filename: `source-${index}.${extension(contentType)}`
    };
  }));
}

// A response's base64 images plus what the core echoes in metadata: the
// model, normalized token usage when the service reports it, and the
// native pixel size when one was set.
function parse(response, model, size) {
  return {
    images: (response.data || []).map((item) => ({
      type: 'png',
      data: item.b64_json
    })),
    model,
    ...(response.usage && {
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    }),
    ...(size !== undefined && { size })
  };
}

function extension(contentType) {
  return EXTENSIONS[contentType] || 'png';
}

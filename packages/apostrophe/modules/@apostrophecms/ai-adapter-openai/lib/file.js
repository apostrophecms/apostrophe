// A document part as OpenAI's file input: inline data with a filename, the
// same fields in the Responses and the Chat Completions dialects. Shared
// with the openai-compatible adapter.

// `{ filename, file_data }` for a document part. Every example OpenAI gives
// names the file, so a nameless PDF gets a name with its extension
function fileFields({
  data, mediaType, name
}) {
  return {
    filename: name ?? (mediaType === 'application/pdf' ? 'document.pdf' : 'document'),
    file_data: `data:${mediaType};base64,${data}`
  };
}

module.exports = { fileFields };

import { ref } from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';

// Files the editor attaches in a chat tab's composer, before a send takes
// them. A file shows at once and uploads to the chat, under the id the
// browser named it by; the send names the stored ones. One the editor
// removes is deleted on the server once its upload has succeeded, so no
// unsent file is left. What the panel can check on its own (type, size,
// count) is refused before anything is uploaded; the server's refusals
// and an upload that got no answer join the same message, one per paste,
// drop or pick (see `attachRefusals`).

const IMAGE_EXTENSIONS = [ 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'heic', 'heif' ];
// What the browser can show before the server converts it
const SHOWN_EXTENSIONS = [ 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg' ];
// A file chip's second line names its format
const FORMATS = {
  pdf: 'PDF',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  json: 'JSON',
  tokens: 'Tokens',
  md: 'Markdown',
  markdown: 'Markdown'
};

export function getExtension(name) {
  const match = /\.([^.]+)$/.exec(name || '');
  return match ? match[1].toLowerCase() : '';
}

// Shown as a picture: images and SVG
export function isPicture(name) {
  const extension = getExtension(name);
  return IMAGE_EXTENSIONS.includes(extension) || (extension === 'svg');
}

// The extension itself for a format not named here; none without one
export function getFormat(name) {
  const extension = getExtension(name);
  return FORMATS[extension] || extension.toUpperCase();
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

// The URL of a chat's file, through the owner-checked route; an image's
// thumbnail or preview size when `size` names one
export function getFileUrl(chatId, attachmentId, size = null) {
  const { action } = apos.modules['@apostrophecms/assistant'];
  const url = `${action}/chat/${chatId}/attachment/${attachmentId}`;
  return size ? `${url}?size=${size}` : url;
}

/**
 * The attachment state and actions the store spreads into its own.
 *
 * @param {object} options
 * @param {(id: string) => string} options.getChatId The chat a chat tab's
 *   files upload to, a new chat's named before it exists.
 * @param {(e: Error) => void} options.report
 * @returns {object}
 */
export function createAttachments({ getChatId, report }) {
  // By chat tab, in the order attached: `{ key, chatId, name, size,
  // status, attachment, preview }`, `chatId` the chat it uploads to,
  // `status` `uploading` or `stored`, `attachment`
  // the server's description once stored, `preview` a local URL while
  // the server has none
  const attached = ref({});
  // Why the files of the latest paste, drop or pick were not attached, by
  // chat tab: `{ batch, lines }`, each line `{ key, values }` an i18n key
  // with its values
  const attachRefusals = ref({});
  // Local previews of sent images, by attachment id, shown until the
  // server's thumbnail loads
  const previews = ref({});
  // The files removed while uploading, by key: deleted once stored
  const removed = new Set();
  // Sends waiting for their chat tab's uploads, by chat tab
  const waiters = new Map();

  function getConfig() {
    return apos.modules['@apostrophecms/assistant'].attachments;
  }

  // Whether the user may attach files at all: the right to upload, which
  // never changes while the page lives
  function canUpload() {
    return getConfig().canUpload;
  }

  function getAttached(id) {
    return attached.value[id] || [];
  }

  function isUploading(id) {
    return getAttached(id).some(file => file.status === 'uploading');
  }

  function isFull(id) {
    return getAttached(id).length >= getConfig().maxCount;
  }

  /**
   * Attaches files to a chat tab's composer: each one accepted shows at
   * once and uploads; the rest are refused in one message.
   *
   * @param {string} id The chat tab.
   * @param {File[]} files
   */
  function attachFiles(id, files) {
    const config = getConfig();
    const batch = createId();
    const lines = [];
    let count = getAttached(id).length;
    for (const file of files) {
      const extension = getExtension(file.name);
      const kind = config.unreadable?.[extension];
      if (kind) {
        lines.push(line(kind === 'pdf' ? 'apostrophe:assistantAttachNoPdf' : 'apostrophe:assistantAttachNoImages', file));
      } else if (!config.extensions.includes(extension)) {
        lines.push(line('apostrophe:assistantAttachType', file));
      } else if (file.size > config.maxBytes) {
        lines.push(line('apostrophe:assistantAttachSize', file, {
          size: formatSize(file.size),
          limit: formatSize(config.maxBytes)
        }));
      } else if (count >= config.maxCount) {
        lines.push(line('apostrophe:assistantAttachCount', file, { count: config.maxCount }));
      } else {
        count++;
        upload(id, batch, file);
      }
    }
    if (lines.length) {
      attachRefusals.value[id] = {
        batch,
        lines
      };
    }
  }

  async function upload(id, batch, file) {
    const key = createId();
    const chatId = getChatId(id);
    const entry = {
      key,
      chatId,
      name: file.name,
      size: file.size,
      status: 'uploading',
      attachment: null,
      preview: SHOWN_EXTENSIONS.includes(getExtension(file.name))
        ? URL.createObjectURL(file)
        : null
    };
    attached.value[id] = [ ...getAttached(id), entry ];
    const body = new window.FormData();
    body.append('file', file);
    let answer;
    try {
      answer = await apos.http.post(
        `${apos.modules['@apostrophecms/assistant'].action}/chat/${chatId}/attachment`,
        { body }
      );
    } catch (e) {
      drop(id, key);
      if (!removed.delete(key)) {
        refuse(id, batch, refusalLine(e, file));
      }
      settle(id);
      return;
    }
    const { attachment } = answer;
    if (removed.delete(key)) {
      detach(chatId, attachment._id);
      revoke(entry);
    } else {
      attached.value[id] = getAttached(id).map(each => ((each.key === key)
        ? {
          ...each,
          status: 'stored',
          attachment
        }
        : each));
    }
    settle(id);
  }

  // The server's reason, in the editor's words
  function refusalLine(e, file) {
    if (!e.status) {
      return line('apostrophe:assistantAttachNoAnswer', file);
    }
    const data = e.body?.data || {};
    const config = getConfig();
    switch (data.reason) {
      case 'type':
        return line('apostrophe:assistantAttachType', file);
      case 'route':
        return line((data.kind === 'pdf') ? 'apostrophe:assistantAttachNoPdf' : 'apostrophe:assistantAttachNoImages', file);
      case 'size':
        return line('apostrophe:assistantAttachSize', file, {
          size: formatSize(file.size),
          limit: formatSize(data.limit || config.maxBytes)
        });
      case 'pages':
        return line('apostrophe:assistantAttachPages', file, {
          count: data.pages,
          limit: data.limit
        });
      case 'count':
        return line('apostrophe:assistantAttachCount', file, { count: data.limit || config.maxCount });
      case 'unreadable':
        return line((data.kind === 'image')
          ? 'apostrophe:assistantAttachUnreadableImage'
          : 'apostrophe:assistantAttachUnreadable', file);
      default:
        report(e);
        return line('apostrophe:assistantAttachRefused', file);
    }
  }

  function line(key, file, values = {}) {
    return {
      key,
      values: {
        name: file.name,
        ...values
      }
    };
  }

  // A later file of the same paste, drop or pick joins its message; any
  // other replaces it
  function refuse(id, batch, refusal) {
    const current = attachRefusals.value[id];
    attachRefusals.value[id] = {
      batch,
      lines: (current?.batch === batch) ? [ ...current.lines, refusal ] : [ refusal ]
    };
  }

  function dismissAttachRefusal(id) {
    delete attachRefusals.value[id];
  }

  /**
   * Removes a file from a chat tab's composer at once. Stored, it is
   * deleted on the server; uploading, once its upload succeeds.
   *
   * @param {string} id The chat tab.
   * @param {string} key
   */
  function removeAttached(id, key) {
    const entry = getAttached(id).find(file => file.key === key);
    if (!entry) {
      return;
    }
    drop(id, key);
    if (entry.status === 'uploading') {
      removed.add(key);
    } else {
      detach(entry.chatId, entry.attachment._id);
      revoke(entry);
    }
    settle(id);
  }

  function drop(id, key) {
    const rest = getAttached(id).filter(file => file.key !== key);
    if (rest.length) {
      attached.value[id] = rest;
    } else {
      delete attached.value[id];
    }
  }

  // A failed delete leaves the file to the sweep of unsent files
  function detach(chatId, attachmentId) {
    apos.http.delete(
      `${apos.modules['@apostrophecms/assistant'].action}/chat/${chatId}/attachment/${attachmentId}`,
      {}
    ).catch(() => {});
  }

  function revoke(entry) {
    if (entry.preview) {
      URL.revokeObjectURL(entry.preview);
    }
  }

  /**
   * Resolves once the chat tab has no upload under way.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  function whenUploaded(id) {
    if (!isUploading(id)) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      waiters.set(id, [ ...(waiters.get(id) || []), resolve ]);
    });
  }

  function settle(id) {
    if (isUploading(id)) {
      return;
    }
    for (const resolve of waiters.get(id) || []) {
      resolve();
    }
    waiters.delete(id);
  }

  /**
   * Takes a chat tab's stored files for a send: they leave the composer,
   * their local previews kept for the sent message.
   *
   * @param {string} id
   * @returns {object[]} The files taken, to give back if the send is
   *   refused.
   */
  function takeAttached(id) {
    const taken = getAttached(id).filter(file => file.status === 'stored');
    delete attached.value[id];
    delete attachRefusals.value[id];
    for (const file of taken) {
      if (file.preview) {
        previews.value[file.attachment._id] = file.preview;
      }
    }
    return taken;
  }

  // A refused send gives its files back, in front of any attached since
  function giveBack(id, taken) {
    if (taken.length) {
      attached.value[id] = [ ...taken, ...getAttached(id) ];
    }
  }

  function forgetAttached(id) {
    for (const entry of getAttached(id)) {
      if (entry.status === 'uploading') {
        removed.add(entry.key);
      }
    }
    delete attached.value[id];
    delete attachRefusals.value[id];
  }

  return {
    attached,
    attachRefusals,
    previews,
    canUpload,
    getAttached,
    isUploading,
    isFull,
    attachFiles,
    removeAttached,
    dismissAttachRefusal,
    whenUploaded,
    takeAttached,
    giveBack,
    forgetAttached
  };
}

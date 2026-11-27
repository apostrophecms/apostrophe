import { ref } from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';

// Files the editor attaches in a chat tab's composer, before a send takes
// them. A file shows at once and uploads to the chat, under the id the
// browser named it by; the send names the stored ones. One the editor
// removes is deleted on the server once its upload has succeeded, so no
// unsent file is left. The server keeps the unsent files across a page
// load: a chat tab reads them back once per page (`loadAttached`). What the
// panel can check on its own (type, size, count) is refused before
// anything is uploaded; the server's refusals and an upload that got no
// answer join the same message, one per paste, drop or pick (see
// `attachRefusals`).

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
 * @param {(id: string, options?: { create?: boolean }) => string|null}
 *   options.getChatId The chat a chat tab's files upload to, a new chat's
 *   named before it exists; `null` with `create: false` before it is.
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
  // The chat tabs whose unsent files were read on this page, each with the
  // token of its latest read
  const loaded = new Map();
  // The files deleted on the server from this page, by attachment id
  const detached = new Set();

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
        lines.push(line(kind === 'pdf' ? 'aposAssistant:assistantAttachNoPdf' : 'aposAssistant:assistantAttachNoImages', file));
      } else if (!config.extensions.includes(extension)) {
        lines.push(line('aposAssistant:assistantAttachType', file));
      } else if (file.size > getMaxBytes(extension)) {
        lines.push(line('aposAssistant:assistantAttachSize', file, {
          size: formatSize(file.size),
          limit: formatSize(getMaxBytes(extension))
        }));
      } else if (count >= config.maxCount) {
        lines.push(line('aposAssistant:assistantAttachCount', file, { count: config.maxCount }));
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

  function getMaxBytes(extension) {
    const config = getConfig();
    return config.textExtensions.includes(extension)
      ? config.maxTextBytes
      : config.maxBytes;
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
      return line('aposAssistant:assistantAttachNoAnswer', file);
    }
    const data = e.body?.data || {};
    const config = getConfig();
    switch (data.reason) {
      case 'type':
        return line('aposAssistant:assistantAttachType', file);
      case 'route':
        return line((data.kind === 'pdf') ? 'aposAssistant:assistantAttachNoPdf' : 'aposAssistant:assistantAttachNoImages', file);
      case 'size':
        return line('aposAssistant:assistantAttachSize', file, {
          size: formatSize(file.size),
          limit: formatSize(data.limit || config.maxBytes)
        });
      case 'pages':
        return line('aposAssistant:assistantAttachPages', file, {
          count: data.pages,
          limit: data.limit
        });
      case 'count':
        return line('aposAssistant:assistantAttachCount', file, { count: data.limit || config.maxCount });
      case 'unreadable':
        return line((data.kind === 'image')
          ? 'aposAssistant:assistantAttachUnreadableImage'
          : 'aposAssistant:assistantAttachUnreadable', file);
      default:
        report(e);
        return line('aposAssistant:assistantAttachRefused', file);
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

  // A failed delete leaves the file to the sweep of unsent files. A body, so
  // a front whose origin check refuses body-less requests (Astro's) lets it
  // through
  function detach(chatId, attachmentId) {
    detached.add(attachmentId);
    apos.http.delete(
      `${apos.modules['@apostrophecms/assistant'].action}/chat/${chatId}/attachment/${attachmentId}`,
      { body: {} }
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
    // A read still on the wire would bring them back
    if (loaded.has(id)) {
      loaded.set(id, {});
    }
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
    loaded.delete(id);
  }

  /**
   * Reads a chat tab's unsent files from the server into its composer: once
   * per page, or `again` when a send found one gone. The server's list
   * wins over the composer's stored files it already held; files uploading
   * or stored since the read began are kept. A read that fails is tried
   * again the next time the chat tab opens.
   *
   * @param {string} id The chat tab.
   * @param {object} [options]
   * @param {boolean} [options.again]
   */
  async function loadAttached(id, { again = false } = {}) {
    if (loaded.has(id) && !again) {
      return;
    }
    const chatId = getChatId(id, { create: false });
    if (!chatId) {
      return;
    }
    const token = {};
    loaded.set(id, token);
    const held = new Set(getAttached(id)
      .filter(file => file.status === 'stored')
      .map(file => file.key));
    let listed;
    try {
      listed = await listUnsent(chatId);
    } catch (e) {
      if (loaded.get(id) === token) {
        loaded.delete(id);
      }
      return;
    }
    // Closed, sent or read again meanwhile
    if ((loaded.get(id) !== token) || (getChatId(id, { create: false }) !== chatId)) {
      return;
    }
    const current = getAttached(id);
    const byId = new Map(current
      .filter(file => file.attachment)
      .map(file => [ file.attachment._id, file ]));
    const kept = listed
      .filter(attachment => !detached.has(attachment._id))
      .map(attachment => byId.get(attachment._id) || {
        key: createId(),
        chatId,
        name: attachment.name,
        size: attachment.size,
        status: 'stored',
        attachment,
        preview: null
      });
    const listedIds = new Set(listed.map(attachment => attachment._id));
    const later = current.filter(file => !held.has(file.key) &&
      !(file.attachment && listedIds.has(file.attachment._id)));
    for (const file of current) {
      if (held.has(file.key) && !listedIds.has(file.attachment._id)) {
        revoke(file);
      }
    }
    const files = [ ...kept, ...later ];
    if (files.length) {
      attached.value[id] = files;
    } else {
      delete attached.value[id];
    }
  }

  async function listUnsent(chatId) {
    const { attachments } = await apos.http.get(
      `${apos.modules['@apostrophecms/assistant'].action}/chat/${chatId}/attachment`,
      {}
    );
    return attachments;
  }

  /**
   * Drops a chat tab's files and deletes them on the server, those the
   * composer never read back included: closing the New chat tab.
   *
   * @param {string} id
   */
  async function discardAttached(id) {
    const chatId = getChatId(id, { create: false });
    const stored = getAttached(id).filter(file => file.status === 'stored');
    forgetAttached(id);
    for (const file of stored) {
      detach(file.chatId, file.attachment._id);
      revoke(file);
    }
    if (!chatId) {
      return;
    }
    let listed;
    try {
      listed = await listUnsent(chatId);
    } catch (e) {
      // Left to the sweep of unsent files
      return;
    }
    for (const attachment of listed) {
      if (!detached.has(attachment._id)) {
        detach(chatId, attachment._id);
      }
    }
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
    forgetAttached,
    loadAttached,
    discardAttached
  };
}

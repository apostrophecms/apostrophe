const assert = require('assert').strict;
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const FormData = require('form-data');
const { createReadStream } = require('fs');
const t = require('../test-lib/test.js');

// Files attached to a request, on the scripted mock: what is accepted and
// refused before anything is stored, the owner-checked read, the reference
// line in the user message with the bytes only in the outbound call, a file
// gone from storage becoming a note, `read_attachment` per kind,
// `save_attachment_to_media`, `describe_images` on an attachment, tier 1 on
// attached images and PDFs, and a deleted chat leaving no file.

const FIXTURES = path.join(__dirname, 'data/upload_tests');
const UPLOADS = path.join(__dirname, 'public/uploads');
const BASE = '/api/v1/@apostrophecms/assistant/chat';
const PDF = [
  '%PDF-1.4',
  '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
  '2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj',
  '3 0 obj << /Type /Page /Parent 2 0 R >> endobj',
  '4 0 obj << /Type /Page /Parent 2 0 R >> endobj',
  'trailer << /Root 1 0 R >>',
  '%%EOF'
].join('\n');

describe('Assistant: attachments', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let guest;
  let scratch;
  let script = null;
  let calls = [];

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'assistant-attachments-'));
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock(req, request) {
              const caller = getCaller(request);
              calls.push({
                caller,
                request
              });
              return script?.[caller]?.(req, request) || { text: 'Done.' };
            }
          },
          init(self) {
            self.apos.ai.addAdapter(fakeAdapter());
          }
        },
        '@apostrophecms/assistant': {
          options: {
            enabled: true,
            titleEffort: 'none',
            effort: 'high'
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    await t.createAdmin(apos, { username: 'other' });
    guest = await t.createUser(apos, 'guest', { username: 'guest' });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await fs.rm(path.join(UPLOADS, 'apos-ai'), {
      recursive: true,
      force: true
    });
    await fs.rm(scratch, {
      recursive: true,
      force: true
    });
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
    calls = [];
  });

  describe('intake', function () {
    it('accepts each kind, an image by what it really is', async function () {
      const req = userReq(editor);
      const kinds = {};
      for (const [ name, content ] of [
        [ 'photo.jpeg', fixture('crop_image.jpeg') ],
        [ 'brief.pdf', PDF ],
        [ 'page.html', '<p>Hi</p>' ],
        [ 'site.css', 'p { color: red; }' ],
        [ 'brand.tokens', '{}' ],
        [ 'data.json', '[]' ],
        [ 'notes.md', '# Notes' ],
        [ 'logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>' ],
        // A PNG named as a JPEG is stored as the PNG it is
        [ 'wrong.jpg', fixture('upload_image.png') ]
      ]) {
        const chat = `intake-${Object.keys(kinds).length}`;
        kinds[name] = await attach(req, chat, name, content);
      }
      assert.equal(kinds['photo.jpeg'].kind, 'image');
      assert.equal(kinds['photo.jpeg'].mediaType, 'image/jpeg');
      assert(kinds['photo.jpeg'].width > 0);
      assert.equal(kinds['brief.pdf'].kind, 'pdf');
      assert.equal(kinds['brief.pdf'].pages, 2);
      assert.equal(kinds['page.html'].kind, 'html');
      assert.equal(kinds['site.css'].kind, 'css');
      assert.equal(kinds['brand.tokens'].kind, 'tokens');
      assert.equal(kinds['data.json'].kind, 'tokens');
      assert.equal(kinds['notes.md'].kind, 'markdown');
      assert.equal(kinds['logo.svg'].kind, 'svg');
      assert.equal(kinds['wrong.jpg'].mediaType, 'image/png');
      // Nothing of the store's path reaches the browser
      for (const attachment of Object.values(kinds)) {
        assert.equal(attachment.storage, undefined);
      }
      const records = await apos.assistant.attachments.find({
        chatId: { $regex: '^intake-' }
      }).toArray();
      assert.equal(records.length, 9);
      assert(records.every(record => record.status === 'stored'));
      assert(records.every(record => record.requestId === null));
    });

    it('refuses a type, a size, a count, unreadable content and a route that can\'t read it, storing nothing', async function () {
      const req = userReq(editor);
      const chat = 'refusals';
      await assert.rejects(attach(req, chat, 'archive.zip', 'PK'), refusal('type'));
      await assert.rejects(attach(req, chat, 'fake.png', 'not an image'), refusal('unreadable'));
      await assert.rejects(attach(req, chat, 'fake.pdf', 'not a pdf'), refusal('unreadable'));
      await assert.rejects(attach(req, chat, 'broken.json', '{ nope'), refusal('unreadable'));
      const { attachmentMaxBytes } = apos.assistant.options;
      apos.assistant.options.attachmentMaxBytes = 1000;
      try {
        await assert.rejects(attach(req, chat, 'big.png', fixture('upload_image.png')), {
          name: 'invalid',
          data: {
            reason: 'size',
            size: 104260,
            limit: 1000
          },
          message: 'big.png is 102 KB, over the 1 KB limit'
        });
      } finally {
        apos.assistant.options.attachmentMaxBytes = attachmentMaxBytes;
      }
      const { capabilities } = apos.ai.providers.fake;
      capabilities.documentInput = false;
      try {
        await assert.rejects(attach(req, chat, 'brief.pdf', PDF), {
          name: 'invalid',
          data: {
            reason: 'route',
            kind: 'pdf'
          }
        });
        assert(!apos.assistant.getAttachmentExtensions().includes('pdf'));
        assert.deepEqual(apos.assistant.getUnreadableExtensions(), { pdf: 'pdf' });
      } finally {
        capabilities.documentInput = true;
      }
      assert(apos.assistant.getAttachmentExtensions().includes('pdf'));
      for (let i = 0; i < 4; i++) {
        await attach(req, chat, `note-${i}.md`, 'Hi');
      }
      await assert.rejects(attach(req, chat, 'fifth.md', 'Hi'), refusal('count'));
      assert.equal(await apos.assistant.attachments.countDocuments({ chatId: chat }), 4);
    });

    it('refuses a file over the size limit as it streams in, and someone else\'s chat', async function () {
      const jar = await login('editor');
      const own = await upload(jar, 'route-chat', 'upload_image.png');
      assert.equal(own.attachment.kind, 'image');
      const { attachmentMaxBytes } = apos.assistant.options;
      apos.assistant.options.attachmentMaxBytes = 1000;
      try {
        await assert.rejects(upload(jar, 'route-chat', 'upload_image.png'),
          error => (error.status === 400) && (error.body.data.reason === 'size'));
      } finally {
        apos.assistant.options.attachmentMaxBytes = attachmentMaxBytes;
      }
      const chat = await apos.assistant.createChat(userReq(editor));
      const other = await login('other');
      await assert.rejects(upload(other, chat._id, 'upload_image.png'), { status: 404 });
    });

    it('serves a file to its owner only, an HTML file as a download', async function () {
      const req = userReq(editor);
      const image = await attach(req, 'serve', 'photo.png', fixture('upload_image.png'));
      const page = await attach(req, 'serve', 'page.html', '<script>alert(1)</script>');
      const jar = await login('editor');
      const thumbnail = await get(jar, `${BASE}/serve/attachment/${image._id}?size=thumbnail`);
      assert.equal(thumbnail.status, 200);
      assert.equal(thumbnail.headers.get('content-type'), 'image/png');
      assert((await thumbnail.arrayBuffer()).byteLength < 104260);
      const html = await get(jar, `${BASE}/serve/attachment/${page._id}`);
      assert.equal(html.status, 200);
      assert.equal(html.headers.get('content-type'), 'application/octet-stream');
      assert.match(html.headers.get('content-disposition'), /^attachment;/);
      assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
      const other = await login('other');
      const refused = await get(other, `${BASE}/serve/attachment/${image._id}`);
      assert.equal(refused.status, 404);
      // A wrong chat in the URL finds nothing either
      assert.equal((await get(jar, `${BASE}/elsewhere/attachment/${image._id}`)).status, 404);
    });

    it('deletes an unsent file, and never one a request carries', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const dropped = await attach(req, chat._id, 'dropped.md', 'Hi');
      const record = await apos.assistant.attachments.findOne({ _id: dropped._id });
      await apos.assistant.detach(req, chat._id, dropped._id);
      assert.equal(await apos.assistant.attachments.findOne({ _id: dropped._id }), null);
      await assertGone(record.storage);
      const sent = await attach(req, chat._id, 'sent.md', 'Hi');
      await runToEnd(req, chat, 'Read it', [ sent._id ]);
      await assert.rejects(apos.assistant.detach(req, chat._id, sent._id), { name: 'notfound' });
    });
  });

  describe('the send', function () {
    it('names each file in the message, with bytes only in the outbound call', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const image = await attach(req, chat._id, 'photo.png', fixture('upload_image.png'));
      const pdf = await attach(req, chat._id, 'brief.pdf', PDF);
      const svg = await attach(req, chat._id, 'logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
      const request = await runToEnd(req, chat, 'Look at these', [ image._id, pdf._id, svg._id ]);
      assert.equal(request.status, 'completed');
      assert.deepEqual(request.attachments.map(({ _id }) => _id),
        [ image._id, pdf._id, svg._id ]);

      // The engine's request grows as the run goes: its one user message
      const sent = calls.find(call => call.caller === 'run').request.messages
        .find(message => message.role === 'user');
      const line = sent.content.find(part => part.text?.startsWith('Files attached'));
      const listed = JSON.parse(line.text.slice(line.text.indexOf('[')));
      assert.deepEqual(listed.map(({ id, kind }) => [ id, kind ]), [
        [ image._id, 'image' ],
        [ pdf._id, 'PDF' ],
        [ svg._id, 'SVG' ]
      ]);
      assert.equal(listed[1].pages, 2);
      assert.match(listed[0].pixels, /^\d+×\d+$/);
      const media = sent.content.filter(part => [ 'image', 'document' ].includes(part.type));
      // SVG is a reference line only
      assert.deepEqual(media.map(part => part.type), [ 'image', 'document' ]);
      assert.equal(media[0].image.mediaType, 'image/png');
      assert(media[0].image.data.length > 1000);
      assert.equal(Buffer.from(media[1].document.data, 'base64').toString('latin1'), PDF);
      assert.equal(media[1].document.name, 'brief.pdf');

      // The record keeps references, never bytes
      const stored = request.messages[0];
      assert.deepEqual(stored.content
        .filter(part => [ 'image', 'document' ].includes(part.type))
        .map(part => [ part.type, part.attachmentId, part.image, part.document ]), [
        [ 'image', image._id, undefined, undefined ],
        [ 'document', pdf._id, undefined, undefined ]
      ]);
      assert(!JSON.stringify(request).includes(media[0].image.data.slice(0, 200)));
      const records = await apos.assistant.attachments
        .find({ requestId: request._id })
        .toArray();
      assert.equal(records.length, 3);
    });

    it('refuses a file of another chat, one sent already, and too many', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const elsewhere = await attach(req, 'another-chat', 'note.md', 'Hi');
      await assert.rejects(send(req, chat, 'Hi', [ elsewhere._id ]), {
        name: 'invalid',
        data: { reason: 'gone' }
      });
      // A refused send leaves the chat free and the file unclaimed
      assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest, null);
      const mine = await attach(req, chat._id, 'mine.md', 'Hi');
      await runToEnd(req, chat, 'Read it', [ mine._id ]);
      await assert.rejects(send(req, chat, 'Again', [ mine._id ]), refusal('gone'));
      await assert.rejects(send(req, chat, 'Many', [ 'a', 'b', 'c', 'd', 'e' ]), refusal('count'));
    });

    it('goes on with a note when a file is gone from storage, and so do the tools', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const image = await attach(req, chat._id, 'photo.png', fixture('upload_image.png'));
      const page = await attach(req, chat._id, 'page.html', '<p>Hi</p>');
      await runToEnd(req, chat, 'Look', [ image._id, page._id ]);
      for (const _id of [ image._id, page._id ]) {
        const { storage } = await apos.assistant.attachments.findOne({ _id });
        await apos.assistant.removeChatFile(storage);
      }
      calls = [];
      script = {
        run: sequence([
          toolTurn('read_attachment', { attachment: page._id }),
          toolTurn('describe_images', { attachments: [ image._id ] }, 'describe'),
          { text: 'Done.' }
        ])
      };
      const request = await runToEnd(req, chat, 'Look again');
      assert.equal(request.status, 'completed');
      const replayed = calls.find(call => call.caller === 'run').request.messages[0];
      assert(!replayed.content.some(part => part.type === 'image'));
      assert(replayed.content.some(part => part.text ===
        `[The image "photo.png" (attachment ${image._id}) is no longer available.]`));
      assert.equal(resultOf(request, 'call-read_attachment').error,
        'The file "page.html" is no longer available.');
      assert.equal(resultOf(request, 'call-describe').output.attachments[0].error,
        'The file "photo.png" is no longer available.');
      assert(!calls.some(call => call.caller === 'vision'));
      // Found gone, each file is marked so, and the thread is told
      const [ first ] = await apos.assistant.getChatRequests(req, chat._id);
      const [ shown ] = await apos.assistant.presentRequests([ first ]);
      assert.deepEqual(shown.unavailable.toSorted(), [ image._id, page._id ].toSorted());
      const records = await apos.assistant.attachments
        .find({ _id: { $in: [ image._id, page._id ] } })
        .toArray();
      assert(records.every(record => record.status === 'missing'));
      // The owner's route answers not found
      const jar = await login('editor');
      const answer = await get(jar, `${BASE}/${chat._id}/attachment/${page._id}`);
      assert.equal(answer.status, 404);
    });

    it('tells the model how to build from a source once the chat has files', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const system = () => calls.filter(call => call.caller === 'run').at(-1).request.system;
      await runToEnd(req, chat, 'Hello');
      assert(!system().includes('Building from an attached source'));
      const page = await attach(req, chat._id, 'page.html', '<p>Hi</p>');
      await runToEnd(req, chat, 'Build this', [ page._id ]);
      assert(system().includes('Building from an attached source'));
      assert(system().includes('One page per source'));
      // And on, for the rest of the chat
      await runToEnd(req, chat, 'Thanks');
      assert(system().includes('Building from an attached source'));
      assert.equal((await apos.assistant.getChat(req, chat._id)).hasAttachments, true);
    });

    it('brings the files of a retried request the model never answered', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const image = await attach(req, chat._id, 'photo.png', fixture('upload_image.png'));
      script = {
        run: () => {
          throw apos.error('error', 'provider down');
        }
      };
      const failed = await runToEnd(req, chat, 'Look', [ image._id ]);
      assert.equal(failed.status, 'failed');
      script = null;
      calls = [];
      await apos.assistant.retry(req, chat._id, {
        retryOf: failed._id,
        screen: { tabId: 'tab-1' }
      });
      const retried = await waitForEnd(req, chat);
      assert.equal(retried.status, 'completed');
      assert.deepEqual(retried.attachments.map(({ _id }) => _id), [ image._id ]);
      const sent = calls.find(call => call.caller === 'run').request.messages;
      assert.equal(sent.flatMap(message => message.content)
        .filter(part => part.type === 'image').length, 1);
    });
  });

  describe('read_attachment', function () {
    it('reads HTML and SVG trimmed of noise', async function () {
      const html = '<!DOCTYPE html><html><head><script>track()</script>' +
        '<script type="application/json">{"a":1}</script><style>a{color:red}</style></head>' +
        '<body>  <!-- a comment -->\n\n<h1>Hello</h1>' +
        '<img src="data:image/png;base64,' + 'A'.repeat(4000) + '">' +
        '<svg><path d="M0 0L10 10Z"/><polygon points="0,0 1,1"/></svg></body></html>';
      const read = await readOne('page.html', html);
      assert(!read.content.includes('track()'));
      assert(!read.content.includes('"a":1'));
      assert(!read.content.includes('a comment'));
      assert(read.content.includes('<style>a{color:red}</style>'));
      assert(read.content.includes('<h1>Hello</h1>'));
      assert(read.content.includes('d="…"'));
      assert(read.content.includes('points="…"'));
      assert(read.content.includes('data:image/png,… (4 KB left out)'));
      assert(!read.content.includes('AAAA'));
      assert(!/\s{2}/.test(read.content));

      const svg = await readOne('logo.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><!-- c --><title>Logo</title>' +
        '<path d="M0 0 C 1 2 3 4 5 6" fill="#f00"/></svg>');
      assert.equal(svg.kind, 'svg');
      assert(svg.content.includes('<title>Logo</title>'));
      assert(svg.content.includes('d="…"'));
      assert(svg.content.includes('fill="#f00"'));
      assert(!svg.content.includes('<!--'));
    });

    it('reads CSS trimmed, a large stylesheet in parts ending on whole rules', async function () {
      const small = await readOne('site.css', '/* c */\n.button {\n  color: red;\n}\n');
      assert.equal(small.content, '.button{color: red;}');
      const rules = Array.from({ length: 3000 }, (item, index) =>
        `.rule-${index} { margin: ${index}px; padding: 2px; }`).join('\n');
      const first = await readOne('big.css', rules);
      assert.equal(first.parts, 3);
      assert(first.content.length <= 40000);
      assert(first.content.endsWith('}'));
      const last = await readOne('big.css', rules, { part: 3 });
      assert(last.content.endsWith('.rule-2999{margin: 2999px;padding: 2px;}'));
    });

    it('reads token files by shape', async function () {
      const designTokens = await readOne('brand.tokens', JSON.stringify({
        color: {
          $type: 'color',
          primary: {
            $value: '#0055ff',
            $description: 'Buttons and links'
          }
        }
      }));
      assert.equal(designTokens.format, 'design-tokens');
      assert.deepEqual(designTokens.tokens, [ {
        path: 'color.primary',
        value: '#0055ff',
        type: 'color',
        description: 'Buttons and links'
      } ]);
      const styleDictionary = await readOne('tokens.json', JSON.stringify({
        size: { small: { value: '4px' } }
      }));
      assert.equal(styleDictionary.format, 'style-dictionary');
      assert.deepEqual(styleDictionary.tokens, [ {
        path: 'size.small',
        value: '4px'
      } ]);
      const list = await readOne('list.json', JSON.stringify([ {
        name: 'accent',
        value: '#f60',
        usage: 'Highlights only'
      } ]));
      assert.equal(list.format, 'list');
      assert.equal(list.tokens[0].description, 'Highlights only');
      const noted = await readOne('noted.tokens', JSON.stringify(Array.from({ length: 300 },
        (item, index) => ({
          name: `color-${index}`,
          value: '#000',
          usage: 'Used for '.repeat(40)
        }))));
      assert.equal(noted.count, 300);
      assert.equal(noted.parts, 4);
      assert(JSON.stringify(noted.tokens).length <= 40000);
      const other = await readOne('data.json', '{"hello":"world"}');
      assert.equal(other.format, 'json');
      assert.equal(other.content, '{"hello":"world"}');
    });

    it('reads Markdown in parts', async function () {
      const text = 'word '.repeat(20000);
      const first = await readOne('notes.md', text);
      assert.equal(first.part, 1);
      assert.equal(first.parts, 3);
      assert(first.content.endsWith(' '));
      const second = await readOne('notes.md', text, { part: 2 });
      assert.equal(second.part, 2);
      const error = await readOne('notes.md', text, { part: 4 });
      assert.match(error.error, /no part 4/);
    });

    it('measures an image\'s main colors and refuses to read a PDF', async function () {
      const image = await readOne('photo.png', fixture('upload_image.png'));
      assert.equal(image.kind, 'image');
      assert(Array.isArray(image.colors));
      assert(image.colors.length > 0);
      assert.match(image.colors[0].hex, /^#[0-9a-f]{6}$/);
      assert(image.colors.every(color => color.share >= 0.02));
      const pdf = await readOne('brief.pdf', PDF);
      assert.match(pdf.error, /document in the message/);
    });

    it('reads only files of its own chat', async function () {
      const req = userReq(editor);
      const elsewhere = await attach(req, 'not-this-chat', 'note.md', 'Hi');
      const read = await readOne('own.md', 'Hi', { attachment: elsewhere._id });
      assert.match(read.error, /No file attached to this chat/);
    });
  });

  describe('save_attachment_to_media and describe_images', function () {
    it('saves an attached image to Media unchanged and untagged, through the change log', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const image = await attach(req, chat._id, 'launch-photo.png', fixture('upload_image.png'));
      const pdf = await attach(req, chat._id, 'brief.pdf', PDF);
      script = {
        run: sequence([
          toolTurn('save_attachment_to_media', {
            attachment: image._id,
            alt: 'A launch'
          }, 'save'),
          toolTurn('save_attachment_to_media', { attachment: pdf._id }, 'pdf'),
          { text: 'Done.' }
        ])
      };
      const request = await runToEnd(req, chat, 'Save it', [ image._id, pdf._id ]);
      const saved = resultOf(request, 'call-save').output;
      assert.equal(saved.written.length, 1);
      const { _id, title } = saved.written[0];
      assert.equal(title, 'launch-photo');
      const doc = await apos.image.find(apos.task.getReq({ mode: 'draft' }), { _id }).toObject();
      assert.equal(doc.alt, 'A launch');
      assert.deepEqual(doc.tagsIds || [], []);
      assert.equal(doc.attachment.extension, 'png');
      // The file as the chat stored it, which is what Media stores of an upload
      const { storage } = await apos.assistant.attachments.findOne({ _id: image._id });
      const stored = await apos.assistant.readChatFile(storage);
      assert.equal(doc.attachment.length, stored.length);
      const logged = await apos.harness.changes
        .find({ requestId: request._id })
        .toArray();
      assert(logged.some(row => row.aposDocId === doc.aposDocId));
      assert.match(resultOf(request, 'call-pdf').error, /Only images can be saved to Media/);
      // The chat file stays the chat's
      assert(await apos.assistant.attachments.findOne({ _id: image._id }));
    });

    it('refuses to save for a user who may not upload', async function () {
      const req = userReq(guest);
      const chat = await apos.assistant.createChat(req);
      const image = await attach(req, chat._id, 'photo.png', fixture('upload_image.png'));
      script = {
        run: sequence([
          toolTurn('save_attachment_to_media', { attachment: image._id }, 'save'),
          { text: 'Done.' }
        ])
      };
      const count = await apos.image.find(apos.task.getReq({ mode: 'draft' })).toCount();
      const request = await runToEnd(req, chat, 'Save it', [ image._id ]);
      assert.match(resultOf(request, 'call-save').error, /may not upload/);
      assert.equal(await apos.image.find(apos.task.getReq({ mode: 'draft' })).toCount(), count);
    });

    it('describes an attached image at its preview size, and refuses an SVG', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const image = await attach(req, chat._id, 'photo.png', fixture('upload_image.png'));
      const svg = await attach(req, chat._id, 'logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
      script = {
        run: sequence([
          toolTurn('describe_images', { attachments: [ image._id, svg._id ] }, 'describe'),
          { text: 'Done.' }
        ]),
        vision: () => ({ text: 'A beach.' })
      };
      const request = await runToEnd(req, chat, 'What is it?', [ image._id, svg._id ]);
      const { images, attachments } = resultOf(request, 'call-describe').output;
      assert.equal(images, undefined);
      assert.deepEqual(attachments[0], {
        _id: image._id,
        title: 'photo.png',
        description: 'A beach.'
      });
      assert.match(attachments[1].error, /read_attachment/);
      const vision = calls.filter(call => call.caller === 'vision');
      assert.equal(vision.length, 1);
      const { storage } = await apos.assistant.attachments.findOne({ _id: image._id });
      const preview = await apos.assistant.readChatFile(storage, { size: 'preview' });
      assert.equal(vision[0].request.messages[0].content[0].image.data, preview.toString('base64'));
    });
  });

  describe('describe_images by kind', function () {
    it('looks an id up only where its argument says, and needs one image', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const image = await attach(req, chat._id, 'photo.png', fixture('upload_image.png'));
      const media = await apos.image.insert(apos.task.getReq(), {
        title: 'Beach',
        attachment: await apos.attachment.insert(apos.task.getReq(), {
          name: 'upload_image.png',
          path: path.join(FIXTURES, 'upload_image.png')
        })
      });
      script = {
        run: sequence([
          toolTurn('describe_images', {
            images: [ image._id, media._id ],
            attachments: [ media._id, image._id ]
          }, 'mixed'),
          toolTurn('describe_images', {}, 'none'),
          { text: 'Done.' }
        ]),
        vision: () => ({ text: 'A beach.' })
      };
      const request = await runToEnd(req, chat, 'Describe', [ image._id ]);
      const { images, attachments } = resultOf(request, 'call-mixed').output;
      assert.match(images[0].error, /No Media image/);
      assert.equal(images[1].description, 'A beach.');
      assert.match(attachments[0].error, /No file attached to this chat/);
      assert.equal(attachments[1].description, 'A beach.');
      assert.equal(calls.filter(call => call.caller === 'vision').length, 2);
      assert.match(resultOf(request, 'call-none').error, /at least one image/);
    });
  });

  describe('long chats and deletion', function () {
    it('drops old attached images and PDFs with tier 1, and counts them as a provider bills them', async function () {
      const message = apos.assistant.getUserMessage({
        _id: 'r1',
        screen: { tabId: 'tab-1' },
        message: 'Look',
        attachments: [ {
          _id: 'a1',
          name: 'photo.png',
          kind: 'image',
          mediaType: 'image/png',
          size: 1000,
          width: 10,
          height: 10
        }, {
          _id: 'a2',
          name: 'brief.pdf',
          kind: 'pdf',
          mediaType: 'application/pdf',
          size: 1000,
          pages: 3
        } ]
      });
      const withoutMedia = {
        ...message,
        content: message.content.map(part => (part.attachmentId ? null : part))
      };
      assert.equal(apos.assistant.estimateTokens(message),
        apos.assistant.estimateTokens(withoutMedia) + 1600 + 3 * 2000);
      // A widget whose type is called "image" counts as its text
      const widget = {
        _id: 'w1',
        type: 'image',
        caption: 'x'
      };
      assert.equal(apos.assistant.estimateTokens(widget),
        Math.ceil(JSON.stringify(widget).length / 2));
      const [ shortened ] = apos.assistant.applyCheckpoint({
        calls: [],
        media: [ 'r1' ]
      }, [ {
        _id: 'r1',
        sequence: 0,
        messages: [ message ]
      } ]);
      const notes = shortened.messages[0].content
        .filter(part => part.text?.includes('later removed from the chat'))
        .map(part => part.text);
      assert.deepEqual(notes, [
        '[The image "photo.png" was shown here and later removed from the chat to save space.]',
        '[The document "brief.pdf" was shown here and later removed from the chat to save space.]'
      ]);
      const sent = await apos.assistant
        .addAttachmentBytes(editor._id, shortened.messages);
      assert(!sent[0].content.some(part => [ 'image', 'document' ].includes(part.type)));
    });

    it('deletes a chat\'s files, sent and unsent, bytes before records', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const sent = await attach(req, chat._id, 'photo.png', fixture('upload_image.png'));
      await runToEnd(req, chat, 'Look', [ sent._id ]);
      await attach(req, chat._id, 'unsent.md', 'Hi');
      const records = await apos.assistant.attachments
        .find({ chatId: chat._id })
        .toArray();
      assert.equal(records.length, 2);
      await apos.assistant.deleteChat(req, chat._id);
      const left = await apos.assistant.attachments.countDocuments({ chatId: chat._id });
      assert.equal(left, 0);
      for (const { storage } of records) {
        await assertGone(storage);
      }
    });
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  function fixture(name) {
    return { from: path.join(FIXTURES, name) };
  }

  // Attaches a file made from `content`, a string or `{ from }` a fixture
  async function attach(req, chatId, name, content) {
    const file = path.join(scratch, `${apos.util.generateId()}-${name}`);
    if (typeof content === 'string') {
      await fs.writeFile(file, content);
    } else {
      await fs.copyFile(content.from, file);
    }
    return apos.assistant.attach(req, chatId, {
      originalname: name,
      path: file
    });
  }

  // A `read_attachment` call's result in a chat of its own, or `{ error }`
  async function readOne(name, content, input = {}) {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    const file = await attach(req, chat._id, name, content);
    script = {
      run: sequence([
        toolTurn('read_attachment', {
          attachment: file._id,
          ...input
        }, 'read'),
        { text: 'Done.' }
      ])
    };
    const request = await runToEnd(req, chat, 'Read it', [ file._id ]);
    const result = resultOf(request, 'call-read');
    return result.output ?? { error: result.error };
  }

  async function login(username) {
    const jar = await t.loginAs(apos, username);
    // The CSRF cookie a write needs
    await apos.http.get('/', { jar });
    return jar;
  }

  async function upload(jar, chatId, fixtureName) {
    const body = new FormData();
    body.append('file', createReadStream(path.join(FIXTURES, fixtureName)));
    return apos.http.post(`${BASE}/${chatId}/attachment`, {
      jar,
      body
    });
  }

  function get(jar, url) {
    return apos.http.get(url, {
      jar,
      originalResponse: true
    });
  }

  function send(req, chat, message, attachments = []) {
    return apos.assistant.send(req, chat._id, {
      message,
      screen: { tabId: 'tab-1' },
      attachments
    });
  }

  async function runToEnd(req, chat, message, attachments = []) {
    await send(req, chat, message, attachments);
    return waitForEnd(req, chat);
  }

  async function waitForEnd(req, chat) {
    let request;
    await waitFor(async () => {
      const requests = await apos.assistant.getChatRequests(req, chat._id);
      request = requests.at(-1);
      const job = request?.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: request.jobId });
      return request && (request.status !== 'running') && (!job || job.ended);
    });
    return request;
  }

  async function assertGone(storage) {
    for (const stored of [ storage.path, ...Object.values(storage.sizes || {}) ]) {
      await assert.rejects(fs.access(path.join(UPLOADS, stored)), { code: 'ENOENT' });
    }
  }
});

function refusal(reason) {
  return error => (error.name === 'invalid') && (error.data?.reason === reason);
}

function getCaller(request) {
  if (request.messages[0]?.content.some?.(part => part.type === 'image') &&
    (request.messages.length === 1) && !request.tools?.length) {
    return 'vision';
  }
  return 'run';
}

function sequence(turns) {
  const queue = [ ...turns ];
  return (req, request) => {
    const turn = queue.shift();
    return (typeof turn === 'function') ? turn(req, request) : (turn || { text: 'Done.' });
  };
}

function resultOf(request, callId) {
  return request.messages
    .flatMap(message => (message.role === 'tool') ? message.content : [])
    .find(part => part.toolCallId === callId);
}

function toolTurn(name, input = {}, id = name) {
  return {
    content: [ {
      type: 'toolCall',
      id: `call-${id}`,
      name,
      input
    } ],
    finishReason: 'toolCalls',
    usage: {
      inputTokens: 10,
      outputTokens: 2
    }
  };
}

async function waitFor(condition, deadline = Date.now() + 10000) {
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for the condition');
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

function fakeAdapter() {
  return {
    name: 'fake',
    label: 'Fake',
    capabilities: {
      text: true,
      tools: true,
      structured: true,
      imageInput: true,
      documentInput: true
    },
    effort: {
      low: {
        model: 'fake-small',
        description: 'Quick reads'
      },
      medium: {
        model: 'fake-medium',
        description: 'Most work'
      },
      high: {
        model: 'fake-large',
        description: 'Hard problems'
      }
    },
    models: {},
    validate() {},
    async chat() {
      throw new Error('never called under APOS_AI_MOCK');
    }
  };
}

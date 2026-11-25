const assert = require('node:assert/strict');

const getLib = async () => import(
  '../modules/@apostrophecms/notification/ui/apos/lib/notification.js'
);

describe('Notification UI', function () {
  // Notification messages are displayed as text, so their length is
  // measured as text, without ever parsing them as HTML
  it('measures markup as the literal text it is displayed as', async function () {
    const { isLongMessage } = await getLib();
    // 161 characters on screen, only 154 once parsed as HTML
    const message = `<b>${'x'.repeat(154)}</b>`;

    assert.equal(isLongMessage(message), true);
  });

  it('counts entities as the characters displayed', async function () {
    const { isLongMessage } = await getLib();
    // 160 characters on screen, only 156 once parsed as HTML
    const message = `&amp;${'x'.repeat(155)}`;

    assert.equal(isLongMessage(message), false);
    assert.equal(isLongMessage(`${message}x`), true);
  });

  it('treats a missing message as short', async function () {
    const { isLongMessage } = await getLib();

    assert.equal(isLongMessage(null), false);
    assert.equal(isLongMessage(undefined), false);
  });
});

const assert = require('node:assert/strict');
const {
  splitBlocks, getFirstTitle, getPlainMessage, parseMentions, mentionToken
} = require('../modules/@apostrophecms/assistant/ui/apos/universal/message.js');

describe('Assistant: the editor\'s message', function () {
  describe('blocks', function () {
    it('keeps plain text as one block, its line breaks and blank lines included', function () {
      assert.deepEqual(splitBlocks('One\ntwo\n\nthree'), [
        {
          type: 'text',
          text: 'One\ntwo\n\nthree'
        }
      ]);
      assert.deepEqual(splitBlocks(''), []);
    });

    it('leaves typed HTML and Markdown as text', function () {
      const typed = '<b>bold</b> **not bold** <script>alert(1)</script>\n# Not a heading';
      assert.deepEqual(splitBlocks(typed), [
        {
          type: 'text',
          text: typed
        }
      ]);
    });

    it('takes a code block between two fences, as typed, the text around it apart', function () {
      assert.deepEqual(splitBlocks('Before\n\n```js\nconst a = 1;\n\n  > not a quote\n```\nAfter'), [
        {
          type: 'text',
          text: 'Before'
        },
        {
          type: 'code',
          text: 'const a = 1;\n\n  > not a quote'
        },
        {
          type: 'text',
          text: 'After'
        }
      ]);
    });

    it('runs an unclosed code block to the end', function () {
      assert.deepEqual(splitBlocks('Look:\n```\nline one\nline two'), [
        {
          type: 'text',
          text: 'Look:'
        },
        {
          type: 'code',
          text: 'line one\nline two'
        }
      ]);
      assert.deepEqual(splitBlocks('```'), [
        {
          type: 'code',
          text: ''
        }
      ]);
    });

    it('takes consecutive lines starting with > as one quote, a fence inside it as text', function () {
      assert.deepEqual(splitBlocks('> First\n>second\n> ```\nThen me'), [
        {
          type: 'quote',
          text: 'First\nsecond\n```'
        },
        {
          type: 'text',
          text: 'Then me'
        }
      ]);
    });

    it('keeps mention tokens in text and quotes, for the panel to show as chips', function () {
      const mention = mentionToken({
        id: 'p1',
        title: 'Pricing [new]',
        kind: 'page'
      });
      const [ quote, code ] = splitBlocks(`> See ${mention}\n\`\`\`\n${mention}\n\`\`\``);
      assert.deepEqual(parseMentions(quote.text), [
        { text: 'See ' },
        {
          mention: {
            id: 'p1',
            title: 'Pricing [new]',
            kind: 'page'
          }
        }
      ]);
      assert.equal(getPlainMessage(code.text), '@Pricing [new]');
    });
  });

  describe('the first title', function () {
    it('is the plain text, mentions as their titles, cut to 60 characters at a word', function () {
      const mention = mentionToken({
        id: 'p1',
        title: 'Pricing',
        kind: 'page'
      });
      assert.equal(getFirstTitle(`  Fix   ${mention}\n now `), 'Fix @Pricing now');
      const long = 'Rewrite the introduction of every case study so that it reads better';
      assert.equal(getFirstTitle(long), 'Rewrite the introduction of every case study so that it…');
      assert.equal(getFirstTitle('x'.repeat(70)), `${'x'.repeat(59)}…`);
      assert.equal(getFirstTitle(' \n '), '');
    });
  });
});

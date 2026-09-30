const assert = require('assert').strict;
const getFormatChanges = require('../modules/@apostrophecms/document-versions/lib/rich-text-format.js');

const image = (id, {
  alt = 'A fox', style = 'image-float-left', href
} = {}) => {
  const img = `<img src="/api/v1/@apostrophecms/image/${id}/src?aposLocale=en&aposMode=draft" alt="${alt}">`;
  return `<figure class="${style}">` +
    (href ? `<a href="${href}">${img}</a>` : img) +
    '<figcaption></figcaption></figure>';
};
const table = (rows, width = 'min-width: 100px') => {
  const cols = rows[0].map(() => `<col style="${width}">`).join('');
  const body = rows.map(row => {
    const cells = row.map(cell => `<td colspan="1" rowspan="1"><p>${cell}</p></td>`);
    return `<tr>${cells.join('')}</tr>`;
  });
  return '<div class="tableWrapper"><table class="apos-rich-text-table">' +
    `<colgroup>${cols}</colgroup><tbody>${body.join('')}</tbody></table></div>`;
};

describe('Document Versions rich text format changes', function () {
  describe('links and anchors', function () {
    it('should report a link address that changed, with both', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read <a href="/one">the guide</a> now.</p>',
          '<p>Read <a href="/two">the guide</a> now.</p>'
        ),
        [ {
          kind: 'link',
          text: 'the guide',
          old: { href: '/one' },
          new: { href: '/two' }
        } ]
      );
    });

    it('should report a link target that changed', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read <a href="/one">the guide</a> now.</p>',
          '<p>Read <a href="/one" target="_blank">the guide</a> now.</p>'
        ),
        [ {
          kind: 'link',
          text: 'the guide',
          old: { href: '/one' },
          new: {
            href: '/one',
            target: '_blank'
          }
        } ]
      );
    });

    it('should report a link added around words, and one removed', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read the guide now.</p>',
          '<p>Read <a href="/one">the guide</a> now.</p>'
        ),
        [ {
          kind: 'linkAdded',
          text: 'the guide',
          new: '/one'
        } ]
      );
      assert.deepEqual(
        getFormatChanges(
          '<p>Read <a href="/one">the guide</a> now.</p>',
          '<p>Read the guide now.</p>'
        ),
        [ {
          kind: 'linkRemoved',
          text: 'the guide',
          old: '/one'
        } ]
      );
    });

    it('should report an anchor renamed, added and removed', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p><span id="top">Title</span></p>',
          '<p><span id="start">Title</span></p>'
        ),
        [ {
          kind: 'anchor',
          text: 'Title',
          old: 'top',
          new: 'start'
        } ]
      );
      assert.deepEqual(
        getFormatChanges('<p>Title</p>', '<p><span id="top">Title</span></p>'),
        [ {
          kind: 'anchor',
          text: 'Title',
          new: 'top'
        } ]
      );
      assert.deepEqual(
        getFormatChanges('<p><span id="top">Title</span></p>', '<p>Title</p>'),
        [ {
          kind: 'anchor',
          text: 'Title',
          old: 'top'
        } ]
      );
    });
  });

  describe('marks', function () {
    it('should report marks added, those of one run of words together', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read the guide now.</p>',
          '<p>Read <strong><em>the guide</em></strong> now.</p>'
        ),
        [ {
          kind: 'marksAdded',
          text: 'the guide',
          new: [ { name: 'bold' }, { name: 'italic' } ]
        } ]
      );
    });

    it('should report marks removed', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read <s>the</s> <sup>guide</sup> now.</p>',
          '<p>Read the guide now.</p>'
        ),
        [
          {
            kind: 'marksRemoved',
            text: 'the',
            old: [ { name: 'strike' } ]
          },
          {
            kind: 'marksRemoved',
            text: 'guide',
            old: [ { name: 'superscript' } ]
          }
        ]
      );
    });

    it('should report a colour and an inline style, added and changed', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read the guide.</p>',
          '<p>Read <span style="color: #ff0000">the guide</span>.</p>'
        ),
        [ {
          kind: 'marksAdded',
          text: 'the guide',
          new: [ {
            name: 'color',
            value: '#ff0000'
          } ]
        } ]
      );
      assert.deepEqual(
        getFormatChanges(
          '<p>Read <span style="color: #ff0000">the guide</span>.</p>',
          '<p>Read <span style="color: #0000ff">the guide</span>.</p>'
        ),
        [ {
          kind: 'mark',
          text: 'the guide',
          old: {
            name: 'color',
            value: '#ff0000'
          },
          new: {
            name: 'color',
            value: '#0000ff'
          }
        } ]
      );
      assert.deepEqual(
        getFormatChanges(
          '<p>Read <span class="small">the guide</span>.</p>',
          '<p>Read <span class="large">the guide</span>.</p>'
        ),
        [ {
          kind: 'mark',
          text: 'the guide',
          old: {
            name: 'style',
            tag: 'span',
            class: 'small'
          },
          new: {
            name: 'style',
            tag: 'span',
            class: 'large'
          }
        } ]
      );
    });

    it('should not take the code of a code block for a mark', function () {
      assert.deepEqual(
        getFormatChanges('<p>let a;</p>', '<pre><code>let a;</code></pre>'),
        [ {
          kind: 'block',
          text: 'let a;',
          old: { tag: 'p' },
          new: { tag: 'pre' }
        } ]
      );
    });
  });

  describe('blocks', function () {
    it('should report alignment', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read the guide.</p>',
          '<p style="text-align: center">Read the guide.</p>'
        ),
        [ {
          kind: 'align',
          text: 'Read the guide.',
          new: 'center'
        } ]
      );
    });

    it('should report a style class', function () {
      assert.deepEqual(
        getFormatChanges('<p>Read the guide.</p>', '<p class="lead">Read the guide.</p>'),
        [ {
          kind: 'style',
          text: 'Read the guide.',
          old: { tag: 'p' },
          new: {
            tag: 'p',
            class: 'lead'
          }
        } ]
      );
    });

    it('should report a paragraph that became a heading, not the one after it', function () {
      assert.deepEqual(
        getFormatChanges('<p>Our mission</p><p>Body.</p>', '<h2>Our mission</h2><p>Body.</p>'),
        [ {
          kind: 'block',
          text: 'Our mission',
          old: { tag: 'p' },
          new: { tag: 'h2' }
        } ]
      );
    });

    it('should report a list that changed kind once, as the list', function () {
      const items = '<li><p>One</p></li><li><p>Two</p></li>';
      assert.deepEqual(
        getFormatChanges(`<ul>${items}</ul>`, `<ol>${items}</ol>`),
        [ {
          kind: 'block',
          text: 'One Two',
          old: { tag: 'ul' },
          new: { tag: 'ol' }
        } ]
      );
      assert.deepEqual(
        getFormatChanges(`<ul>${items}</ul>`, '<p>One</p><p>Two</p>'),
        [ {
          kind: 'block',
          text: 'One Two',
          old: { tag: 'ul' },
          new: { tag: 'p' }
        } ]
      );
    });

    it('should report the innermost block that changed inside one that did not', function () {
      assert.deepEqual(
        getFormatChanges(
          '<blockquote><p>Our mission</p></blockquote>',
          '<blockquote><h3>Our mission</h3></blockquote>'
        ),
        [ {
          kind: 'block',
          text: 'Our mission',
          old: { tag: 'p' },
          new: { tag: 'h3' }
        } ]
      );
    });

    it('should report paragraphs merged and split, from the seam', function () {
      assert.deepEqual(
        getFormatChanges('<p>One.</p><p>Two. Three.</p>', '<p>One. Two. Three.</p>'),
        [ {
          kind: 'merged',
          text: 'Two. Three.'
        } ]
      );
      assert.deepEqual(
        getFormatChanges('<p>One. Two. Three.</p>', '<p>One.</p><p>Two. Three.</p>'),
        [ {
          kind: 'split',
          text: 'Two. Three.'
        } ]
      );
    });

    it('should keep one record across added words and apart across unchanged ones', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read the guide now or later.</p>',
          '<p>Read <strong>the new guide</strong> now <strong>or</strong> later.</p>'
        ),
        [
          {
            kind: 'marksAdded',
            text: 'the new guide',
            new: [ { name: 'bold' } ]
          },
          {
            kind: 'marksAdded',
            text: 'or',
            new: [ { name: 'bold' } ]
          }
        ]
      );
    });
  });

  describe('images, rules and breaks', function () {
    it('should report an image added, removed and replaced, by id', function () {
      assert.deepEqual(
        getFormatChanges('<p>Text.</p>', `<p>Text.</p>${image('aaa')}`),
        [ {
          kind: 'imageAdded',
          text: 'A fox',
          id: 'aaa'
        } ]
      );
      assert.deepEqual(
        getFormatChanges(`<p>Text.</p>${image('aaa')}`, '<p>Text.</p>'),
        [ {
          kind: 'imageRemoved',
          text: 'A fox',
          id: 'aaa'
        } ]
      );
      assert.deepEqual(
        getFormatChanges(
          `<p>Text.</p>${image('aaa')}`,
          `<p>Text.</p>${image('bbb', { alt: 'A hen' })}`
        ),
        [ {
          kind: 'imageReplaced',
          text: 'A hen',
          id: 'bbb',
          old: {
            id: 'aaa',
            alt: 'A fox'
          },
          new: {
            id: 'bbb',
            alt: 'A hen'
          }
        } ]
      );
    });

    it('should pair replaced images one for one, the rest come or go', function () {
      assert.deepEqual(
        getFormatChanges(
          `<p>Text.</p>${image('aaa')}${image('bbb')}`,
          `<p>Text.</p>${image('ccc')}`
        ).map(found => [ found.kind, found.old?.id, found.id ]),
        [
          [ 'imageRemoved', undefined, 'bbb' ],
          [ 'imageReplaced', 'aaa', 'ccc' ]
        ]
      );
      assert.deepEqual(
        getFormatChanges(
          `${image('aaa')}<p>Text.</p>`,
          `<p>Text.</p>${image('bbb')}`
        ).map(found => found.kind),
        [ 'imageRemoved', 'imageAdded' ]
      );
    });

    it('should report what changed of an image that stayed', function () {
      assert.deepEqual(
        getFormatChanges(
          image('aaa'),
          image('aaa', {
            alt: 'A red fox',
            style: 'image-float-right',
            href: '/foxes'
          })
        ),
        [ {
          kind: 'image',
          text: 'A red fox',
          id: 'aaa',
          old: {
            alt: 'A fox',
            style: 'image-float-left'
          },
          new: {
            alt: 'A red fox',
            style: 'image-float-right',
            href: '/foxes'
          }
        } ]
      );
    });

    it('should not report an image whose address differs by its query only', function () {
      assert.deepEqual(
        getFormatChanges(image('aaa'), image('aaa').replace('aposMode=draft', 'aposMode=published')),
        []
      );
    });

    it('should report a rule and a line break', function () {
      assert.deepEqual(
        getFormatChanges('<p>One</p><p>Two</p>', '<p>One</p><hr><p>Two</p>'),
        [ { kind: 'ruleAdded' } ]
      );
      assert.deepEqual(
        getFormatChanges('<p>One</p><hr><p>Two</p>', '<p>One</p><p>Two</p>'),
        [ { kind: 'ruleRemoved' } ]
      );
      assert.deepEqual(
        getFormatChanges('<p>One two</p>', '<p>One<br>two</p>'),
        [ { kind: 'breakAdded' } ]
      );
      assert.deepEqual(
        getFormatChanges('<p>One<br>two</p>', '<p>One two</p>'),
        [ { kind: 'breakRemoved' } ]
      );
    });
  });

  describe('tables', function () {
    it('should fold every structural difference into one record', function () {
      const older = table([ [ 'A', 'B' ], [ 'C', 'D' ] ]);
      for (const newer of [
        table([ [ 'A', 'B' ], [ 'C', 'D' ], [ '', '' ] ]),
        table([ [ 'A', 'B' ] ]),
        table([ [ 'A' ], [ 'C' ] ]),
        table([ [ 'A', 'B' ], [ 'C', 'D' ] ], 'width: 340px'),
        older.replace('<td colspan="1" rowspan="1"><p>A', '<th colspan="1" rowspan="1"><p>A')
      ]) {
        assert.deepEqual(getFormatChanges(older, newer), [ { kind: 'table' } ]);
      }
    });

    it('should report it once for several tables, after the rest', function () {
      assert.deepEqual(
        getFormatChanges(
          `${table([ [ 'A' ] ])}<p>Between</p>${table([ [ 'B' ] ])}`,
          `${table([ [ 'A' ], [ '' ] ])}<h2>Between</h2>${table([ [ 'B' ], [ '' ] ])}`
        ),
        [
          {
            kind: 'block',
            text: 'Between',
            old: { tag: 'p' },
            new: { tag: 'h2' }
          },
          { kind: 'table' }
        ]
      );
    });

    it('should report an empty table that came, not one that came with words', function () {
      assert.deepEqual(
        getFormatChanges('<p>Text.</p>', `<p>Text.</p>${table([ [ '', '' ] ])}`),
        [ { kind: 'table' } ]
      );
      assert.deepEqual(
        getFormatChanges('<p>Text.</p>', `<p>Text.</p>${table([ [ 'A', 'B' ] ])}`),
        []
      );
    });
  });

  describe('words and formatting together', function () {
    it('should report the link beside a changed word', function () {
      assert.deepEqual(
        getFormatChanges(
          '<p>Read <a href="/one">the guide</a> now.</p>',
          '<p>Read <a href="/two">the guide</a> today.</p>'
        ),
        [ {
          kind: 'link',
          text: 'the guide',
          old: { href: '/one' },
          new: { href: '/two' }
        } ]
      );
    });

    it('should report the image beside a rewritten paragraph', function () {
      assert.deepEqual(
        getFormatChanges('<p>Old text.</p>', `<p>New text.</p>${image('aaa')}`),
        [ {
          kind: 'imageAdded',
          text: 'A fox',
          id: 'aaa'
        } ]
      );
    });
  });

  describe('silences', function () {
    it('should report nothing for words alone, whatever their formatting', function () {
      assert.deepEqual(
        getFormatChanges('<p>The quick fox.</p>', '<p>The <strong>slow</strong> fox.</p>'),
        []
      );
      assert.deepEqual(
        getFormatChanges(
          '<p>One</p>',
          '<p>One</p><h2>New <a href="/x">heading</a></h2><p>Line<br>two</p>'
        ),
        []
      );
      assert.deepEqual(
        getFormatChanges(table([ [ 'A', 'B' ], [ 'C', 'D' ] ]), table([ [ 'A', 'B' ], [ 'C', 'Delta' ] ])),
        []
      );
    });

    it('should report nothing for a block that came, went or moved with its words', function () {
      assert.deepEqual(
        getFormatChanges(
          '<ul><li><p>One</p></li><li><p>Two</p></li><li><p>Three</p></li></ul>',
          '<ul><li><p>One</p></li><li><p>Three</p></li></ul>'
        ),
        []
      );
      assert.deepEqual(
        getFormatChanges(
          '<p>Alpha one.</p><p>Beta two.</p><p>Gamma three.</p>',
          '<p>Gamma three.</p><p>Alpha one.</p><p>Beta two.</p>'
        ),
        []
      );
    });

    it('should report nothing for white space, identical and empty markup', function () {
      assert.deepEqual(getFormatChanges('<p>One  two</p>', '<p>One two</p>'), []);
      assert.deepEqual(getFormatChanges('<p>One</p>', '<p>One</p>'), []);
      assert.deepEqual(getFormatChanges('', '<p><strong>New</strong></p>'), []);
      assert.deepEqual(getFormatChanges(undefined, null), []);
    });

    it('should give up where the word marks do, past a rewrite at length', function () {
      const words = prefix => Array.from({ length: 1100 }, (value, at) => `${prefix}${at}`);
      assert.deepEqual(
        getFormatChanges(
          `<p>Lead ${words('a').join(' ')}</p>`,
          `<h2>Lead ${words('b').join(' ')}</h2>`
        ),
        []
      );
    });
  });
});

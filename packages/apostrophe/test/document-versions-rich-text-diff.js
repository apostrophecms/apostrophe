const assert = require('assert').strict;
const { diffRichText, getTextParts } = require('../modules/@apostrophecms/document-versions/lib/rich-text-diff.js');

const DEL = '<del data-apos-version-change="removed">';
const INS = '<ins data-apos-version-change="added">';

describe('Document Versions rich text diff', function () {
  describe('marks', function () {
    it('should mark a replaced word where it stands', function () {
      assert.equal(
        diffRichText('<p>The quick brown fox</p>', '<p>The quick red fox</p>'),
        `<p>The quick ${DEL}brown</del>${INS}red</ins> fox</p>`
      );
    });

    it('should mark a rewritten phrase once, not word by word', function () {
      assert.equal(
        diffRichText('<p>The quick brown fox jumps</p>', '<p>The slow red dog jumps</p>'),
        `<p>The ${DEL}quick brown fox</del>${INS}slow red dog</ins> jumps</p>`
      );
    });

    it('should open each mark with its hidden label', function () {
      assert.equal(
        diffRichText('<p>Old text</p>', '<p>New text</p>', {
          labels: {
            removed: 'Removed',
            added: 'Added <now>'
          }
        }),
        `<p>${DEL}<span class="apos-sr-only">Removed </span>Old</del>` +
        `${INS}<span class="apos-sr-only">Added &lt;now&gt; </span>New</ins> text</p>`
      );
    });

    it('should keep marks inside the inline elements of the newer markup', function () {
      assert.equal(
        diffRichText(
          '<p>See <a href="/one"><strong>this page</strong></a> now</p>',
          '<p>See <a href="/one"><strong>that page</strong></a> now</p>'
        ),
        `<p>See <a href="/one"><strong>${DEL}this</del>${INS}that</ins> page</strong></a> now</p>`
      );
    });

    it('should escape text and attributes as it found them', function () {
      assert.equal(
        diffRichText(
          '<p title="a &quot;b&quot; &amp; c">1 &lt; 2 &amp; x</p>',
          '<p title="a &quot;b&quot; &amp; c">1 &lt; 2 &amp; &lt;y&gt;</p>'
        ),
        `<p title="a &quot;b&quot; &amp; c">1 &lt; 2 &amp; ${DEL}x</del>${INS}&lt;y&gt;</ins></p>`
      );
    });

    it('should mark all of the text of new markup, and of markup that went', function () {
      assert.equal(diffRichText('', '<p>New</p>'), `<p>${INS}New</ins></p>`);
      assert.equal(diffRichText(undefined, '<p>New</p>'), `<p>${INS}New</ins></p>`);
      assert.equal(diffRichText('<p>Old</p>', ''), `<p>${DEL}Old</del></p>`);
    });
  });

  describe('elements', function () {
    it('should mark the text of an added paragraph inside it', function () {
      assert.equal(
        diffRichText('<p>One</p><p>Three</p>', '<p>One</p><p>Two</p><p>Three</p>'),
        `<p>One</p><p>${INS}Two</ins></p><p>Three</p>`
      );
    });

    it('should bring a removed paragraph back where it was', function () {
      assert.equal(
        diffRichText('<p>One</p><p>Two</p><p>Three</p>', '<p>One</p><p>Three</p>'),
        `<p>One</p><p>${DEL}Two</del></p><p>Three</p>`
      );
    });

    it('should bring a removed list item back, in the middle and at the end', function () {
      assert.equal(
        diffRichText(
          '<ul><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ul>',
          '<ul><li><p>a</p></li><li><p>c</p></li></ul>'
        ),
        `<ul><li><p>a</p></li><li><p>${DEL}b</del></p></li><li><p>c</p></li></ul>`
      );
      assert.equal(
        diffRichText(
          '<ul><li><p>a</p></li><li><p>b</p></li></ul>',
          '<ul><li><p>a</p></li></ul>'
        ),
        `<ul><li><p>a</p></li><li><p>${DEL}b</del></p></li></ul>`
      );
    });

    it('should bring a removed table cell and a removed table back', function () {
      assert.equal(
        diffRichText(
          '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
          '<table><tbody><tr><td><p>a</p></td></tr></tbody></table>'
        ),
        `<table><tbody><tr><td><p>a</p></td><td><p>${DEL}b</del></p></td></tr></tbody></table>`
      );
      assert.equal(
        diffRichText(
          '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table><p>z</p>',
          '<p>z</p>'
        ),
        `<table><tbody><tr><td>${DEL}a</del></td><td>${DEL}b</del></td></tr></tbody></table><p>z</p>`
      );
    });

    it('should bring a removed inline element back around its text', function () {
      assert.equal(
        diffRichText('<p>a <strong>big</strong> dog</p>', '<p>a dog</p>'),
        `<p>a <strong>${DEL}big</del></strong> dog</p>`
      );
    });

    it('should bring a removed figure back with its image when it has a caption', function () {
      assert.equal(
        diffRichText(
          '<p>a</p><figure><img src="/x.jpg" alt="x"><figcaption>Caption</figcaption></figure>',
          '<p>a</p>'
        ),
        `<p>a</p><figure><img src="/x.jpg" alt="x"><figcaption>${DEL}Caption</del></figcaption></figure>`
      );
    });

    it('should show a paragraph that became a heading as one that went and one that came', function () {
      assert.equal(
        diffRichText('<p>a b</p>', '<h2>c d</h2>'),
        `<p>${DEL}a b</del></p><h2>${INS}c d</ins></h2>`
      );
    });

    it('should show a list that changed kind as one that went and one that came', function () {
      assert.equal(
        diffRichText('<ul><li>x</li><li>y</li></ul>', '<ol><li>x</li><li>q</li></ol>'),
        `<ul><li>${DEL}x</del></li><li>${DEL}y</del></li></ul>` +
        `<ol><li>${INS}x</ins></li><li>${INS}q</ins></li></ol>`
      );
    });

    it('should show paragraphs merged with words removed as the ones that went and the one that came', function () {
      assert.equal(
        diffRichText('<p>One two</p><p>three four</p>', '<p>One four</p>'),
        `<p>${DEL}One two</del></p><p>${DEL}three four</del></p><p>${INS}One four</ins></p>`
      );
    });

    it('should keep the newer markup as it is around the marks', function () {
      const newer = '<h2 class="big">Title</h2><p style="text-align: center">' +
        'a<br>b <em>c</em></p><hr><p></p>';
      assert.equal(
        diffRichText(newer.replace('Title', 'Titles'), newer),
        newer.replace('Title', `${DEL}Titles</del>${INS}Title</ins>`)
      );
    });
  });

  describe('form', function () {
    it('should show words that turned bold as they were and as they are', function () {
      assert.equal(
        diffRichText('<p>The quick brown fox</p>', '<p>The <strong>quick brown</strong> fox</p>'),
        `<p>The ${DEL}quick brown</del><strong>${INS}quick brown</ins></strong> fox</p>`
      );
      assert.equal(
        diffRichText('<p>The <b>quick</b> fox</p>', '<p>The quick fox</p>'),
        `<p>The <b>${DEL}quick</del></b>${INS}quick</ins> fox</p>`
      );
    });

    it('should show a word that turned italic inside bold', function () {
      assert.equal(
        diffRichText('<p><strong>a b c</strong></p>', '<p><strong>a <em>b</em> c</strong></p>'),
        `<p><strong>a ${DEL}b</del><em>${INS}b</ins></em> c</strong></p>`
      );
    });

    it('should show a paragraph that became a heading as it was, then as it is', function () {
      assert.equal(
        diffRichText('<p>Title</p><p>Body</p>', '<h2>Title</h2><p>Body</p>'),
        `<p>${DEL}Title</del></p><h2>${INS}Title</ins></h2><p>Body</p>`
      );
    });

    it('should show a paragraph that took a style as it was, then as it is', function () {
      assert.equal(
        diffRichText('<p>A lead.</p>', '<p class="lead">A lead.</p>'),
        `<p>${DEL}A lead.</del></p><p class="lead">${INS}A lead.</ins></p>`
      );
    });

    it('should show a list that became a paragraph as it was, then as it is', function () {
      assert.equal(
        diffRichText('<ul><li>x</li></ul>', '<p>x</p>'),
        `<ul><li>${DEL}x</del></li></ul><p>${INS}x</ins></p>`
      );
    });

    it('should show a split paragraph whole, then the paragraphs it became', function () {
      assert.equal(
        diffRichText(
          '<p>Intro</p><p>One two. Three four.</p><p>End</p>',
          '<p>Intro</p><p>One two.</p><p>Three four.</p><p>End</p>'
        ),
        `<p>Intro</p><p>${DEL}One two. Three four.</del></p>` +
        `<p>${INS}One two.</ins></p><p>${INS}Three four.</ins></p><p>End</p>`
      );
      assert.equal(
        diffRichText('<ul><li><p>a b</p></li></ul>', '<ul><li><p>a</p></li><li><p>b</p></li></ul>'),
        `<ul><li><p>${DEL}a b</del></p><p>${INS}a</ins></p></li><li><p>${INS}b</ins></p></li></ul>`
      );
    });

    it('should show merged paragraphs whole, then the paragraph they became', function () {
      assert.equal(
        diffRichText('<p>One two.</p><p>Three four.</p>', '<p>One two. Three four.</p>'),
        `<p>${DEL}One two.</del></p><p>${DEL}Three four.</del></p>` +
        `<p>${INS}One two. Three four.</ins></p>`
      );
    });

    it('should show a paragraph split into a heading, with its words and bold changed', function () {
      assert.equal(
        diffRichText(
          '<p>Welcome here. We make <strong>small</strong> things.</p><p>Tail</p>',
          '<h2>Welcome here.</h2><p>We make small <strong>growing</strong> things.</p><p>Tail</p>'
        ),
        `<p>${DEL}Welcome here. We make </del><strong>${DEL}small</del></strong>` +
        `${DEL} things.</del></p><h2>${INS}Welcome here.</ins></h2>` +
        `<p>${INS}We make small </ins><strong>${INS}growing</ins></strong>` +
        `${INS} things.</ins></p><p>Tail</p>`
      );
    });
  });

  describe('text parts', function () {
    it('should list the words of a change in reading order', function () {
      assert.deepEqual(getTextParts('<p>The quick brown fox</p>', '<p>The quick red fox</p>'), [
        {
          text: 'The quick ',
          change: 'same'
        },
        {
          text: 'brown',
          change: 'removed'
        },
        {
          text: 'red',
          change: 'added'
        },
        {
          text: ' fox',
          change: 'same'
        }
      ]);
    });

    it('should say which words are bold or italic', function () {
      assert.deepEqual(
        getTextParts('<p>a <em>b</em> c</p>', '<p>a <em>b</em> <strong>c</strong></p>'),
        [
          {
            text: 'a ',
            change: 'same'
          },
          {
            text: 'b ',
            change: 'same',
            marks: [ 'italic' ]
          },
          {
            text: 'c',
            change: 'removed'
          },
          {
            text: 'c',
            change: 'added',
            marks: [ 'bold' ]
          }
        ]
      );
    });

    it('should break the line wherever a block starts or ends, once, and never at the ends', function () {
      assert.deepEqual(
        getTextParts(
          '<p>Intro</p>\n  <p>One two. Three four.</p><ul><li><p>End</p></li></ul>',
          '<p>Intro</p>\n  <p>One two.</p><p>Three four.</p><ul><li><p>End</p></li></ul>'
        ),
        [
          {
            text: 'Intro\n',
            change: 'same'
          },
          {
            text: 'One two. Three four.',
            change: 'removed'
          },
          {
            text: '\n',
            change: 'same'
          },
          {
            text: 'One two.',
            change: 'added'
          },
          {
            text: '\n',
            change: 'same'
          },
          {
            text: 'Three four.',
            change: 'added'
          },
          {
            text: '\nEnd',
            change: 'same'
          }
        ]
      );
    });

    it('should list a block that changed kind as its words removed, then added', function () {
      assert.deepEqual(getTextParts('<p>A lead.</p>', '<p class="lead">A lead.</p>'), [
        {
          text: 'A lead.',
          change: 'removed'
        },
        {
          text: '\n',
          change: 'same'
        },
        {
          text: 'A lead.',
          change: 'added'
        }
      ]);
    });

    it('should return null where no text changed', function () {
      assert.equal(
        getTextParts('<p><a href="/a">link</a></p>', '<p><a href="/b">link</a></p>'),
        null
      );
      assert.equal(getTextParts('<p>x</p>', '<p style="text-align: right">x</p>'), null);
      assert.equal(getTextParts('<p>a b</p>', '<p>a  b</p>'), null);
    });
  });

  describe('fallback', function () {
    it('should return null when nothing changed', function () {
      assert.equal(diffRichText('<p>x</p>', '<p>x</p>'), null);
      assert.equal(diffRichText('', ''), null);
    });

    it('should return null when only an attribute changed', function () {
      assert.equal(
        diffRichText('<p><a href="/a">link</a></p>', '<p><a href="/b">link</a></p>'),
        null
      );
      assert.equal(
        diffRichText('<p>x</p>', '<p style="text-align: right">x</p>'),
        null
      );
    });

    it('should return null when only marks other than bold and italic changed', function () {
      assert.equal(
        diffRichText('<p>make this plain</p>', '<p>make <u>this</u> <s>plain</s></p>'),
        null
      );
      assert.equal(
        diffRichText('<p>a <span style="color: red">b</span></p>', '<p>a b</p>'),
        null
      );
    });

    it('should return null when only an image changed', function () {
      assert.equal(
        diffRichText(
          '<p>a</p><figure><img src="/x.jpg"></figure>',
          '<p>a</p><figure><img src="/y.jpg"></figure>'
        ),
        null
      );
      assert.equal(diffRichText('<p>a</p><figure><img src="/x.jpg"></figure>', '<p>a</p>'), null);
    });

    it('should return null when only white space changed', function () {
      assert.equal(diffRichText('<p>a b</p>', '<p>a  b</p>'), null);
    });

    it('should return null when removed text has no place to stand', function () {
      assert.equal(
        diffRichText('<ul><li>b a</li></ul>', '<ul><li class="x">a</li></ul>'),
        null
      );
    });

    it('should return null, and soon, when the text was rewritten at length', function () {
      const words = prefix => Array.from({ length: 5000 }, (word, index) => {
        return `${prefix}${(index * 31) % 977}`;
      }).join(' ');
      const start = Date.now();
      assert.equal(diffRichText(`<p>${words('a')}</p>`, `<p>${words('b')}</p>`), null);
      assert(Date.now() - start < 2000);
    });

    it('should still mark a small change in long text', function () {
      const words = Array.from({ length: 5000 }, (word, index) => `w${index}`).join(' ');
      const result = diffRichText(`<p>${words}</p>`, `<p>${words.replace('w2500 ', 'changed ')}</p>`);
      assert.match(result, /w2499 <del [^>]+>w2500<\/del><ins [^>]+>changed<\/ins> w2501/);
    });
  });
});

const assert = require('assert').strict;
const diffRichText = require('../modules/@apostrophecms/document-versions/lib/rich-text-diff.js');

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

    it('should leave the text of an element that changed around it on its own', function () {
      assert.equal(
        diffRichText('<ul><li>x</li><li>y</li></ul>', '<ol><li>x</li><li>q</li></ol>'),
        `<ol><li>x</li><li>${DEL}y</del>${INS}q</ins></li></ol>`
      );
    });

    it('should keep the removed text of paragraphs that went partly apart', function () {
      assert.equal(
        diffRichText('<p>One two</p><p>three four</p>', '<p>One four</p>'),
        `<p>One ${DEL}two</del> ${DEL}three </del>four</p>`
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

    it('should return null when only marks changed', function () {
      assert.equal(
        diffRichText('<p>make this bold</p>', '<p>make <strong>this</strong> bold</p>'),
        null
      );
    });

    it('should return null when only the structure changed', function () {
      assert.equal(diffRichText('<ul><li>x</li></ul>', '<p>x</p>'), null);
      assert.equal(diffRichText('<p>One</p><p>Two</p>', '<p>One Two</p>'), null);
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

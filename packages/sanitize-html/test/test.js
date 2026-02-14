const assert = require('assert');
const sinon = require('sinon');

describe('sanitizeHtml', function() {
  let sanitizeHtml;
  it('should be successfully initialized', function() {
    sanitizeHtml = require('../index.js');
  });
  it('should escape self closing tags', () => {
    assert.equal(sanitizeHtml('before <img src="test.png" /> after', {
      disallowedTagsMode: 'escape',
      allowedTags: [],
      allowedAttributes: false
    }), 'before &lt;img src="test.png" /&gt; after');
  });
  it('should handle numbers as strings', () => {
    assert.equal(sanitizeHtml(5, {
      allowedTags: [ 'b', 'em', 'i', 's', 'small', 'strong', 'sub', 'sup', 'time', 'u' ],
      allowedAttributes: {},
      disallowedTagsMode: 'recursiveEscape'
    }), '5');
  });
  it('should pass through simple, well-formed markup', function() {
    assert.equal(sanitizeHtml('<div><p>Hello <b>there</b></p></div>'), '<div><p>Hello <b>there</b></p></div>');
  });
  it('should not pass through any text outside html tag boundary since html tag is found and option is ON', function() {
    assert.equal(sanitizeHtml('Text before html tag<html><div><p>Hello <b>there</b></p></div></html>Text after html tag!P�X��[<p>paragraph after closing html</p>', {
      enforceHtmlBoundary: true
    }
    ), '<div><p>Hello <b>there</b></p></div>');
  });
  it('should pass through text outside html tag boundary since option is OFF', function() {
    assert.equal(sanitizeHtml('Text before html tag<html><div><p>Hello <b>there</b></p></div></html>Text after html tag!P�X��[<p>paragraph after closing html</p>', {
      enforceHtmlBoundary: false
    }
    ), 'Text before html tag<div><p>Hello <b>there</b></p></div>Text after html tag!P�X��[<p>paragraph after closing html</p>');
  });
  it('should pass through text outside html tag boundary since option is ON but html tag is not found', function() {
    assert.equal(sanitizeHtml('Text before div tag<div><p>Hello <b>there</b></p></div>Text after div tag!P�X��[<p>paragraph after closing div</p>', {
      enforceHtmlBoundary: true
    }
    ), 'Text before div tag<div><p>Hello <b>there</b></p></div>Text after div tag!P�X��[<p>paragraph after closing div</p>');
  });
  it('should pass through all markup if allowedTags and allowedAttributes are set to false', function() {
    assert.equal(sanitizeHtml('<div><wiggly worms="ewww">hello</wiggly></div>', {
      allowedTags: false,
      allowedAttributes: false
    }), '<div><wiggly worms="ewww">hello</wiggly></div>');
  });
  it('should not pass through any markup if allowedTags is set to undefined (falsy but not exactly false)', function() {
    assert.equal(sanitizeHtml('<div><wiggly worms="ewww">hello</wiggly></div>', {
      allowedTags: undefined
    }), 'hello');
  });
  it('should not pass through any markup if allowedTags is set to 0 (falsy but not exactly false)', function() {
    assert.equal(sanitizeHtml('<div><wiggly worms="ewww">hello</wiggly></div>', {
      allowedTags: 0
    }), 'hello');
  });
  it('should not pass through any markup if allowedTags is set to null (falsy but not exactly false)', function() {
    assert.equal(sanitizeHtml('<div><wiggly worms="ewww">hello</wiggly></div>', {
      allowedTags: null
    }), 'hello');
  });
  it('should not pass through any markup if allowedTags is set to empty string (falsy but not exactly false)', function() {
    assert.equal(sanitizeHtml('<div><wiggly worms="ewww">hello</wiggly></div>', {
      allowedTags: ''
    }), 'hello');
  });
  it('should respect text nodes at top level', function() {
    assert.equal(sanitizeHtml('Blah blah blah<p>Whee!</p>'), 'Blah blah blah<p>Whee!</p>');
  });
  it('should return an empty string when input is explicit "undefined"', function() {
    assert.equal(sanitizeHtml(undefined), '');
  });
  it('should return an empty string when input is explicit "null"', function() {
    assert.equal(sanitizeHtml(null), '');
  });
  it('should return an empty string when input is not provided', function() {
    assert.equal(sanitizeHtml(), '');
  });
  it('should return an empty string when input is an empty string', function() {
    assert.equal(sanitizeHtml(''), '');
  });
  it('should reject markup not allowlisted without destroying its text', function() {
    assert.equal(sanitizeHtml('<div><wiggly>Hello</wiggly></div>'), '<div>Hello</div>');
  });
  it('should escape markup not allowlisted', function() {
    assert.equal(sanitizeHtml('<div><wiggly>Hello</wiggly></div>', { disallowedTagsMode: 'escape' }), '<div>&lt;wiggly&gt;Hello&lt;/wiggly&gt;</div>');
  });
  it('should accept a custom list of allowed tags', function() {
    assert.equal(sanitizeHtml('<blue><red><green>Cheese</green></red></blue>', { allowedTags: [ 'blue', 'green' ] }), '<blue><green>Cheese</green></blue>');
  });
  it('should reject attributes not allowlisted', function() {
    assert.equal(sanitizeHtml('<a href="foo.html" whizbang="whangle">foo</a>'), '<a href="foo.html">foo</a>');
  });
  it('should accept a custom list of allowed attributes per element', function() {
    assert.equal(sanitizeHtml('<a href="foo.html" whizbang="whangle">foo</a>', { allowedAttributes: { a: [ 'href', 'whizbang' ] } }), '<a href="foo.html" whizbang="whangle">foo</a>');
  });
  it('should clean up unclosed img tags and p tags', function() {
    assert.equal(sanitizeHtml('<img src="foo.jpg"><p>Whee<p>Again<p>Wow<b>cool</b>', {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ])
    }), '<img src="foo.jpg" /><p>Whee</p><p>Again</p><p>Wow<b>cool</b></p>');
  });
  it('should reject hrefs that are not relative, ftp, http, https or mailto', function() {
    assert.equal(sanitizeHtml('<a href="http://google.com">google</a><a href="https://google.com">https google</a><a href="ftp://example.com">ftp</a><a href="mailto:test@test.com">mailto</a><a href="/relative.html">relative</a><a href="javascript:alert(0)">javascript</a>'), '<a href="http://google.com">google</a><a href="https://google.com">https google</a><a href="ftp://example.com">ftp</a><a href="mailto:test@test.com">mailto</a><a href="/relative.html">relative</a><a>javascript</a>');
  });
  it('should cope identically with capitalized attributes and tags and should tolerate capitalized schemes', function() {
    assert.equal(sanitizeHtml('<A HREF="http://google.com">google</a><a href="HTTPS://google.com">https google</a><a href="ftp://example.com">ftp</a><a href="mailto:test@test.com">mailto</a><a href="/relative.html">relative</a><a href="javascript:alert(0)">javascript</a>'), '<a href="http://google.com">google</a><a href="HTTPS://google.com">https google</a><a href="ftp://example.com">ftp</a><a href="mailto:test@test.com">mailto</a><a href="/relative.html">relative</a><a>javascript</a>');
  });
  it('should drop the content of script elements', function() {
    assert.equal(sanitizeHtml('<script>alert("ruhroh!");</script><p>Paragraph</p>'), '<p>Paragraph</p>');
  });
  it('should drop the content of style elements', function() {
    assert.equal(sanitizeHtml('<style>.foo { color: blue; }</style><p>Paragraph</p>'), '<p>Paragraph</p>');
  });
  it('should drop the content of textarea elements', function() {
    assert.equal(sanitizeHtml('<textarea>Nifty</textarea><p>Paragraph</p>'), '<p>Paragraph</p>');
  });
  it('should drop the content of option elements', function() {
    assert.equal(sanitizeHtml('<select><option>one</option><option>two</option></select><p>Paragraph</p>'), '<p>Paragraph</p>');
  });
  it('should drop the content of textarea elements but keep the closing parent tag, when nested', function() {
    assert.equal(sanitizeHtml('<p>Paragraph<textarea>Nifty</textarea></p>'), '<p>Paragraph</p>');
  });
  it('should retain the content of fibble elements by default', function() {
    assert.equal(sanitizeHtml('<fibble>Nifty</fibble><p>Paragraph</p>'), 'Nifty<p>Paragraph</p>');
  });
  it('should discard the content of fibble elements if specified for nonTextTags', function() {
    assert.equal(sanitizeHtml('<fibble>Nifty</fibble><p>Paragraph</p>', { nonTextTags: [ 'fibble' ] }), '<p>Paragraph</p>');
  });
  it('should retain allowed tags within a fibble element if fibble is not specified for nonTextTags', function() {
    assert.equal(sanitizeHtml('<fibble>Ni<em>f</em>ty</fibble><p>Paragraph</p>', {}), 'Ni<em>f</em>ty<p>Paragraph</p>');
  });
  it('should discard allowed tags within a fibble element if fibble is specified for nonTextTags', function() {
    assert.equal(sanitizeHtml('<fibble>Ni<em>f</em>ty</fibble><p>Paragraph</p>', { nonTextTags: [ 'fibble' ] }), '<p>Paragraph</p>');
  });
  it('should preserve textarea content if textareas are allowed', function() {
    assert.equal(sanitizeHtml('<textarea>Nifty</textarea><p>Paragraph</p>', {
      allowedTags: [ 'textarea', 'p' ]
    }), '<textarea>Nifty</textarea><p>Paragraph</p>');
  });
  it('should preserve entities as such', function() {
    assert.equal(sanitizeHtml('<a name="&lt;silly&gt;">&lt;Kapow!&gt;</a>'), '<a name="&lt;silly&gt;">&lt;Kapow!&gt;</a>');
  });
  it('should dump closing tags which do not have any opening tags.', function() {
    assert.equal(sanitizeHtml('<b><div/', {
      allowedTags: [ 'b' ]
    }), '<b>/</b>');

    assert.equal(sanitizeHtml('<b><b<<div/', {
      allowedTags: [ 'b' ]
    }), '<b>/</b>');
  });
  it('should tolerate not closed p tags', function() {
    assert.equal(sanitizeHtml('<div><p>inner text 1<p>inner text 2<p>inner text 3</div>'), '<div><p>inner text 1</p><p>inner text 2</p><p>inner text 3</p></div>');
  });
  it('should escape not closed p tags, if not in allowedTags array', function() {
    assert.equal(sanitizeHtml('<div><p>inner text 1<p>inner text 2<p>inner text 3</div>', {
      allowedTags: [ 'div' ]
    }), '<div>inner text 1inner text 2inner text 3</div>');
  });
  it('should dump comments', function() {
    assert.equal(sanitizeHtml('<p><!-- Blah blah -->Whee</p>'), '<p>Whee</p>');
  });
  it('should dump a sneaky encoded javascript url', function() {
    assert.equal(sanitizeHtml('<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;">Hax</a>'), '<a>Hax</a>');
  });
  it('should dump an uppercase javascript url', function() {
    assert.equal(sanitizeHtml('<a href="JAVASCRIPT:alert(\'foo\')">Hax</a>'), '<a>Hax</a>');
  });
  it('should dump a javascript URL with a comment in the middle (probably only respected by browsers in XML data islands, but just in case someone enables those)', function() {
    assert.equal(sanitizeHtml('<a href="java<!-- -->script:alert(\'foo\')">Hax</a>'), '<a>Hax</a>');
  });
  it('should not mess up a hashcode with a : in it', function() {
    assert.equal(sanitizeHtml('<a href="awesome.html#this:stuff">Hi</a>'), '<a href="awesome.html#this:stuff">Hi</a>');
  });
  it('should dump character codes 1-32 before testing scheme', function() {
    assert.equal(sanitizeHtml('<a href="java\0&#14;\t\r\n script:alert(\'foo\')">Hax</a>'), '<a>Hax</a>');
  });
  it('should dump character codes 1-32 even when escaped with padding rather than trailing ;', function() {
    assert.equal(sanitizeHtml('<a href="java&#0000001script:alert(\'foo\')">Hax</a>'), '<a href="java&amp;#0000001script:alert(\'foo\')">Hax</a>');
    // This one is weird, but the browser does not interpret it
    // as a scheme, so we're OK. That character is 65535, not null. I
    // think it's a limitation of the entities module
    assert.equal(sanitizeHtml('<a href="java&#0000000script:alert(\'foo\')">Hax</a>'), '<a href="java&amp;#0000000script:alert(\'foo\')">Hax</a>');
  });
  it('should still like nice schemes', function() {
    assert.equal(sanitizeHtml('<a href="http://google.com/">Hi</a>'), '<a href="http://google.com/">Hi</a>');
  });
  it('should still like nice relative URLs', function() {
    assert.equal(sanitizeHtml('<a href="hello.html">Hi</a>'), '<a href="hello.html">Hi</a>');
  });
  it('should replace ol to ul', function() {
    assert.equal(sanitizeHtml('<ol><li>Hello world</li></ol>', { transformTags: { ol: 'ul' } }), '<ul><li>Hello world</li></ul>');
  });
  it('should replace ol to ul and add class attribute with foo value', function() {
    assert.equal(sanitizeHtml('<ol><li>Hello world</li></ol>', {
      transformTags: { ol: sanitizeHtml.simpleTransform('ul', { class: 'foo' }) },
      allowedAttributes: { ul: [ 'class' ] }
    }), '<ul class="foo"><li>Hello world</li></ul>');
  });
  it('should replace ol to ul, left attributes foo and bar untouched, remove baz attribute and add class attributte with foo value', function() {
    assert.equal(sanitizeHtml('<ol foo="foo" bar="bar" baz="baz"><li>Hello world</li></ol>', {
      transformTags: { ol: sanitizeHtml.simpleTransform('ul', { class: 'foo' }) },
      allowedAttributes: { ul: [ 'foo', 'bar', 'class' ] }
    }), '<ul foo="foo" bar="bar" class="foo"><li>Hello world</li></ul>');
  });
  it('should replace ol to ul and replace all attributes to class attribute with foo value', function() {
    assert.equal(sanitizeHtml('<ol foo="foo" bar="bar" baz="baz"><li>Hello world</li></ol>', {
      transformTags: { ol: sanitizeHtml.simpleTransform('ul', { class: 'foo' }, false) },
      allowedAttributes: { ul: [ 'foo', 'bar', 'class' ] }
    }), '<ul class="foo"><li>Hello world</li></ul>');
  });
  it('should replace ol to ul and add attribute class with foo value and attribute bar with bar value', function() {
    assert.equal(sanitizeHtml('<ol><li>Hello world</li></ol>', {
      transformTags: {
        ol: function(tagName, attribs) {
          attribs.class = 'foo';
          attribs.bar = 'bar';
          return {
            tagName: 'ul',
            attribs
          };
        }
      },
      allowedAttributes: { ul: [ 'bar', 'class' ] }
    }), '<ul class="foo" bar="bar"><li>Hello world</li></ul>');
  });

  it('should replace text and attributes when they are changed by transforming function', function () {
    assert.equal(sanitizeHtml('<a href="http://somelink">some text</a>', {
      transformTags: {
        a: function (tagName, attribs) {
          return {
            tagName,
            attribs,
            text: ''
          };
        }
      }
    }), '<a href="http://somelink"></a>');
  });
  it('should replace text and attributes when they are changed by transforming function and textFilter is set', function () {
    assert.equal(sanitizeHtml('<a href="http://somelink">some text</a>', {
      transformTags: {
        a: function (tagName, attribs) {
          return {
            tagName,
            attribs,
            text: 'some text need"to<be>filtered'
          };
        }
      },
      textFilter: function (text, tagName) {
        return text.replace(/\s/g, '_');
      }
    }), '<a href="http://somelink">some_text_need"to&lt;be&gt;filtered</a>');
  });

  it('should replace text and attributes when they are changed by transforming function and textFilter is not set', function () {
    assert.equal(sanitizeHtml('<a href="http://somelink">some text</a>', {
      transformTags: {
        a: function (tagName, attribs) {
          return {
            tagName,
            attribs,
            text: 'some good text'
          };
        }
      }
    }), '<a href="http://somelink">some good text</a>');
  });

  it('should preserve trailing text when replacing the tagName and adding new text via transforming function', function () {
    assert.equal(sanitizeHtml('<p>text before <br> text after</p>', {
      transformTags: {
        br: function (_tagName, _attribs) {
          return {
            tagName: 'span',
            text: ' '
          };
        }
      }
    }), '<p>text before <span> </span> text after</p>');
  });

  it('should add new text when not initially set and replace attributes when they are changed by transforming function', function () {
    assert.equal(sanitizeHtml('<a href="http://somelink"></a>', {
      transformTags: {
        a: function (tagName, attribs) {
          return {
            tagName,
            attribs,
            text: 'some new text'
          };
        }
      }
    }), '<a href="http://somelink">some new text</a>');
  });

  it('should preserve text when initially set and replace attributes when they are changed by transforming function', function () {
    assert.equal(sanitizeHtml('<a href="http://somelink">some initial text</a>', {
      transformTags: {
        a: function (tagName, attribs) {
          return {
            tagName,
            attribs
          };
        }
      }
    }), '<a href="http://somelink">some initial text</a>');
  });

  it('should skip an empty link', function() {
    assert.strictEqual(
      sanitizeHtml('<p>This is <a href="http://www.linux.org"></a><br/>Linux</p>', {
        exclusiveFilter: function (frame) {
          return frame.tag === 'a' && !frame.text.trim();
        }
      }),
      '<p>This is <br />Linux</p>'
    );
  });

  it('Should expose a node\'s inner text and inner HTML to the filter', function() {
    assert.strictEqual(
      sanitizeHtml('<p>12<a href="http://www.linux.org"><br/>3<br></a><audio>4</audio></p>', {
        exclusiveFilter: function(frame) {
          if (frame.tag === 'p') {
            assert.strictEqual(frame.text, '124');
          } else if (frame.tag === 'a') {
            assert.strictEqual(frame.text, '3');
            return true;
          } else if (frame.tag === 'br') {
            assert.strictEqual(frame.text, '');
          } else {
            assert.fail('p, a, br', frame.tag);
          }
          return false;
        }
      }),
      '<p>124</p>'
    );
  });

  it('Should collapse nested empty elements', function() {
    assert.strictEqual(
      sanitizeHtml('<p><a href="http://www.linux.org"><br/></a></p>', {
        exclusiveFilter: function(frame) {
          return (frame.tag === 'a' || frame.tag === 'p') && !frame.text.trim();
        }
      }),
      ''
    );
  });

  it('Should find child media elements that are in allowedTags', function() {
    const markup = '<a href="http://www.linux.org"><img /><video></video></a>';
    const sansVideo = '<a href="http://www.linux.org"><img /></a>';
    const sanitizedMarkup = sanitizeHtml(markup, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
      exclusiveFilter: function(frame) {
        if (frame.tag === 'a') {

          assert(frame.mediaChildren.length === 1);
        }

        return (frame.tag === 'a') && !frame.text.trim() && !frame.mediaChildren.length;
      }
    });

    assert.strictEqual(sanitizedMarkup, sansVideo);
  });

  it('Exclusive filter should not affect elements which do not match the filter condition', function () {
    assert.strictEqual(
      sanitizeHtml('I love <a href="www.linux.org" target="_hplink">Linux</a> OS',
        {
          exclusiveFilter: function (frame) {
            return (frame.tag === 'a') && !frame.text.trim();
          }
        }),
      'I love <a href="www.linux.org" target="_hplink">Linux</a> OS'
    );
  });

  it('Exclusive filter should not run for discarded tags', function () {
    assert.strictEqual(
      sanitizeHtml('this tag is <wiggly>discarded</wiggly>',
        {
          exclusiveFilter: function () {
            throw Error('this should not run');
          }
        }),
      'this tag is discarded'
    );
  });

  it('should keep inner text when exclusiveFilter returns "excludeTag"', function() {
    assert.strictEqual(
      sanitizeHtml('<p>These links <a href="javascript:alert(123)">hack</a> <a href="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">more hack</a> have disallowed href protocols</p>', {
        exclusiveFilter: function (frame) {
          return frame.tag === 'a' && !frame.attribs.src ? 'excludeTag' : false;
        }
      }),
      '<p>These links hack more hack have disallowed href protocols</p>'
    );
  });

  it('should keep inner tags when exclusiveFilter returns "excludeTag"', function() {
    assert.strictEqual(
      sanitizeHtml('This div is bad <div class="bad">but its <strong>content</strong><p>should be kept <em>as-is</em></p></div>.', {
        exclusiveFilter: function (frame) {
          return frame.tag === 'div' && frame.attribs.class && /\bbad\b/.test(frame.attribs.class) ? 'excludeTag' : false;
        }
      }),
      'This div is bad but its <strong>content</strong><p>should be kept <em>as-is</em></p>.'
    );
  });

  it('should work with escaped tags when exclusiveFilter returns "excludeTag"', function () {
    assert.strictEqual(
      sanitizeHtml('<strong>hello</strong> <wiggly>there. <em>General Kenobi</em></wiggly>!', {
        disallowedTagsMode: 'escape',
        exclusiveFilter: function (frame) {
          return frame.tag === 'wiggly' ? 'excludeTag' : false;
        }
      }),
      '<strong>hello</strong> there. <em>General Kenobi</em>!'
    );
  });

  it('should disallow data URLs with default allowedSchemes', function() {
    assert.equal(
      sanitizeHtml(
        // teeny-tiny valid transparent GIF in a data URL
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />',
        {
          allowedTags: [ 'img' ]
        }
      ),
      '<img />'
    );
  });
  it('should allow data URLs with custom allowedSchemes', function() {
    assert.equal(
      sanitizeHtml(
        // teeny-tiny valid transparent GIF in a data URL
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />',
        {
          allowedTags: [ 'img', 'p' ],
          allowedSchemes: [ 'data', 'http' ]
        }
      ),
      '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />'
    );
  });
  it('should allow specific classes when allowlisted with allowedClasses for a single tag', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="nifty simple dippy">whee</p>',
        {
          allowedTags: [ 'p' ],
          allowedClasses: {
            p: [ 'nifty' ]
          }
        }
      ),
      '<p class="nifty">whee</p>'
    );
  });
  it('should allow specific classes when allowlisted with allowedClasses for all tags', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="nifty simple dippy">whee</p><div class="dippy nifty simple"></div>',
        {
          allowedTags: [ 'p', 'div' ],
          allowedClasses: {
            '*': [ 'nifty' ]
          }
        }
      ),
      '<p class="nifty">whee</p><div class="nifty"></div>'
    );
  });
  it('should allow all classes that are allowlisted for a single tag or all tags', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="nifty simple dippy">whee</p><div class="simple dippy nifty"></div>',
        {
          allowedTags: [ 'p', 'div' ],
          allowedClasses: {
            '*': [ 'simple' ],
            p: [ 'nifty' ],
            div: [ 'dippy' ]
          }
        }
      ),
      '<p class="nifty simple">whee</p><div class="simple dippy"></div>'
    );
  });
  it('should allow classes that match wildcards for a single tag or all tags', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="nifty- nifty-a simple dippy dippy-a-simple">whee</p>',
        {
          allowedTags: [ 'p' ],
          allowedClasses: {
            '*': [ 'dippy-*-simple' ],
            p: [ 'nifty-*' ]
          }
        }
      ),
      '<p class="nifty- nifty-a dippy-a-simple">whee</p>'
    );
  });
  it('should allow all classes if `allowedClasses` contains a single `*`', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="nifty simple dippy">whee</p>',
        {
          allowedTags: [ 'p' ],
          allowedClasses: {
            '*': [ '*' ]
          }
        }
      ),
      '<p class="nifty simple dippy">whee</p>'
    );
  });
  it('should allow all classes for a single tag if `allowedClasses` for the tag is false', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="nifty simple dippy">whee</p>',
        {
          allowedTags: [ 'p' ],
          allowedClasses: {
            p: false
          }
        }
      ),
      '<p class="nifty simple dippy">whee</p>'
    );
  });
  it('should allow only classes that matches `allowedClasses` regex', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="nifty33 nifty2 dippy">whee</p>',
        {
          allowedTags: [ 'p' ],
          allowedClasses: {
            p: [ /^nifty\d{2}$/, /^d\w{4}$/ ]
          }
        }
      ),
      '<p class="nifty33 dippy">whee</p>'
    );
  });
  it('should allow classes that match `allowedClasses` regex for all tags', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="nifty33 nifty2 dippy">whee</p>',
        {
          allowedClasses: {
            '*': [ /^nifty\d{2}$/, /^d\w{4}$/ ]
          }
        }
      ),
      '<p class="nifty33 dippy">whee</p>'
    );
  });
  it('should allow defining schemes on a per-tag basis', function() {
    assert.equal(
      sanitizeHtml(
        // teeny-tiny valid transparent GIF in a data URL
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" /><a href="https://www.example.com"></a>',
        {
          allowedTags: [ 'img', 'a' ],
          allowedSchemes: [ 'http' ],
          allowedSchemesByTag: {
            img: [ 'data' ],
            a: [ 'https' ]
          }
        }
      ),
      '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" /><a href="https://www.example.com"></a>'
    );
    assert.equal(
      sanitizeHtml(
        // teeny-tiny valid transparent GIF in a data URL
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" /><a href="https://www.example.com"></a>',
        {
          allowedTags: [ 'img', 'a' ],
          allowedSchemes: [ 'http' ],
          allowedSchemesByTag: {
            img: [],
            a: [ 'https' ]
          }
        }
      ),
      '<img /><a href="https://www.example.com"></a>'
    );
  });
  it('should not act weird when the class attribute is empty', function() {
    assert.equal(
      sanitizeHtml(
        '<p class="">whee</p>',
        {
          allowedTags: [ 'p' ],
          allowedClasses: {
            p: [ 'nifty' ]
          }
        }
      ),
      '<p>whee</p>'
    );
  });
  it('should not crash on bad markup', function() {
    assert.equal(
      sanitizeHtml(
        '<p a'
      ),
      ''
    );
  });
  it('should not allow a naked = sign followed by an unrelated attribute to result in one merged attribute with unescaped double quote marks', function() {
    assert.equal(
      sanitizeHtml(
        '<IMG SRC= onmouseover="alert(\'XSS\');">',
        {
          allowedTags: [ 'img' ],
          allowedAttributes: {
            img: [ 'src' ]
          }
        }
      ),
      // This is weird but not dangerous. Without the &quot there
      // would probably be some way to make it come out as a
      // separate attribute
      '<img src="onmouseover=&quot;alert(\'XSS\');&quot;" />'
    );
  });

  it('should deliver a warning if using vulnerable tags', function() {
    const spy = sinon.spy(console, 'warn');
    const message = '\n\n⚠️ Your `allowedTags` option includes, `style`, which is inherently\nvulnerable to XSS attacks. Please remove it from `allowedTags`.\nOr, to disable this warning, add the `allowVulnerableTags` option\nand ensure you are accounting for this risk.\n\n';

    sanitizeHtml(
      '<style></style>',
      {
        allowedTags: [ 'style' ]
      }
    );

    assert(spy.calledWith(message));
    // Restore the spied-upon method
    /* eslint-disable-next-line no-console */
    console.warn.restore();
  });

  it('should not deliver a warning if using the allowVulnerableTags option', function() {
    const spy = sinon.spy(console, 'warn');

    sanitizeHtml(
      '<style></style>',
      {
        allowVulnerableTags: true,
        allowedTags: [ 'style' ]
      }
    );

    assert(spy.notCalled);
    // Restore the spied-upon method
    /* eslint-disable-next-line no-console */
    console.warn.restore();
  });

  it('should allow only approved attributes, but to any tags, if tag is declared as  "*"', function() {
    assert.equal(
      sanitizeHtml(
        '<table bgcolor="1" align="left" notlisted="0"><img src="1.gif" align="center" alt="not listed too"/></table>',
        {
          allowedTags: [ 'table', 'img' ],
          allowedAttributes: {
            '*': [ 'bgcolor', 'align', 'src' ]
          }
        }
      ),
      '<table bgcolor="1" align="left"><img src="1.gif" align="center" /></table>'
    );
  });
  it('should not filter if exclusive filter does not match after transforming tags', function() {
    assert.equal(
      sanitizeHtml(
        '<a href="test.html">test</a>',
        {
          allowedTags: [ 'a' ],
          allowedAttributes: { a: [ 'href', 'target' ] },
          transformTags: {
            a: function (tagName, attribs) {
              if (!attribs.href) {
                return false;
              }
              return {
                tagName,
                attribs: {
                  target: '_blank',
                  href: attribs.href
                }
              };
            }
          },
          exclusiveFilter: function(frame) {
            return frame.tag === 'a' && frame.text.trim() === 'blah';
          }
        }
      ),
      '<a target="_blank" href="test.html">test</a>'
    );
  });
  it('should filter if exclusive filter does match after transforming tags', function() {
    assert.equal(
      sanitizeHtml(
        '<a href="test.html">blah</a>',
        {
          allowedTags: [ 'a' ],
          allowedAttributes: { a: [ 'href', 'target' ] },
          transformTags: {
            a: function (tagName, attribs) {
              if (!attribs.href) {
                return false;
              }
              return {
                tagName,
                attribs: {
                  target: '_blank',
                  href: attribs.href
                }
              };
            }
          },
          exclusiveFilter: function(frame) {
            return frame.tag === 'a' && frame.text.trim() === 'blah';
          }
        }
      ),
      ''
    );
  });
  it('should allow transform on all tags using \'*\'', function () {
    assert.equal(
      sanitizeHtml(
        '<p>Text</p>',
        {
          allowedTags: [ 'p' ],
          allowedAttributes: { p: [ 'style' ] },
          transformTags: {
            '*': function (tagName, attribs) {
              return {
                tagName,
                attribs: {
                  style: 'text-align: center'
                }
              };
            }
          }
        }
      ),
      '<p style="text-align:center">Text</p>'
    );
  });
  it('should not be faked out by double <', function() {
    assert.equal(
      sanitizeHtml('<<img src="javascript:evil"/>img src="javascript:evil"/>'
      ),
      '&lt;img src="javascript:evil"/&gt;'
    );
    assert.equal(
      sanitizeHtml('<<a href="javascript:evil"/>a href="javascript:evil"/>'
      ),
      '&lt;<a>a href="javascript:evil"/&gt;</a>'
    );
  });
  it('should allow attributes to be specified as globs', function() {
    assert.equal(
      sanitizeHtml('<a data-target="#test" data-foo="hello">click me</a>', {
        allowedTags: [ 'a' ],
        allowedAttributes: { a: [ 'data-*' ] }
      }), '<a data-target="#test" data-foo="hello">click me</a>'
    );
    assert.equal(
      sanitizeHtml('<a data-target="#test" data-my-foo="hello">click me</a>', {
        allowedTags: [ 'a' ],
        allowedAttributes: { a: [ 'data-*-foo' ] }
      }), '<a data-my-foo="hello">click me</a>'
    );
  });
  it('should quote regex chars in attributes specified as globs', function() {
    assert.equal(
      sanitizeHtml('<a data-b.c="#test" data-bcc="remove this">click me</a>', {
        allowedTags: [ 'a' ],
        allowedAttributes: { a: [ 'data-b.*' ] }
      }), '<a data-b.c="#test">click me</a>'
    );
  });
  it('should not escape inner content of script and style tags (when allowed)', function() {
    assert.equal(
      sanitizeHtml('<div>"normal text"</div><script>"this is code"</script>', {
        allowedTags: [ 'script' ]
      }), '"normal text"<script>"this is code"</script>'
    );
    assert.equal(
      sanitizeHtml('<div>"normal text"</div><style>body { background-image: url("image.test"); }</style>', {
        allowedTags: [ 'style' ]
      }), '"normal text"<style>body { background-image: url("image.test"); }</style>'
    );
  });
  it('should not unescape escapes found inside script tags', function() {
    assert.equal(
      sanitizeHtml('<script>alert("&quot;This is cool but just ironically so I quoted it&quot;")</script>',
        {
          allowedTags: [ 'script' ]
        }
      ),
      '<script>alert("&quot;This is cool but just ironically so I quoted it&quot;")</script>'
    );
  });
  it('should process text nodes with provided function', function() {
    assert.equal(
      sanitizeHtml('"normal text this should be removed"', {
        textFilter: function(text, tagName) {
          return text.replace(' this should be removed', '');
        }
      }), '"normal text"'
    );
  });
  it('should skip text nodes based on tagName', function() {
    assert.equal(
      sanitizeHtml('<a>normal text this should be removed</a><b>normal text this should be removed</b>', {
        textFilter: function(text, tagName) {
          if (tagName === 'a') {
            return text;
          };
          return text.replace(' this should be removed', '');
        }
      }), '<a>normal text this should be removed</a><b>normal text</b>'
    );
  });
  it('should respect htmlparser2 options when passed in', function() {
    assert.equal(
      sanitizeHtml('<Archer><Sterling>I am</Sterling></Archer>', {
        allowedTags: false,
        allowedAttributes: false
      }),
      '<archer><sterling>I am</sterling></archer>'
    );
    assert.equal(
      sanitizeHtml('<Archer><Sterling>I am</Sterling></Archer>', {
        allowedTags: false,
        allowedAttributes: false,
        parser: {
          lowerCaseTags: false
        }
      }),
      '<Archer><Sterling>I am</Sterling></Archer>'
    );
  });
  it('should not crash due to tag names that are properties of the universal Object prototype', function() {
    assert.equal(
      sanitizeHtml('!<__proto__>!'),
      '!&lt;__proto__&gt;!');
  });
  it('should correctly maintain escaping when allowing a nonTextTags tag other than script or style', function() {
    assert.equal(
      sanitizeHtml('!<textarea>&lt;/textarea&gt;&lt;svg/onload=prompt`xs`&gt;</textarea>!',
        { allowedTags: [ 'textarea' ] }
      ), '!<textarea>&lt;/textarea&gt;&lt;svg/onload=prompt`xs`&gt;</textarea>!'
    );
  });
  it('should allow protocol relative links by default', function() {
    assert.equal(
      sanitizeHtml('<a href="//cnn.com/example">test</a>'),
      '<a href="//cnn.com/example">test</a>'
    );
  });
  it('should not allow protocol relative links when allowProtocolRelative is false', function() {
    assert.equal(
      sanitizeHtml('<a href="//cnn.com/example">test</a>', { allowProtocolRelative: false }),
      '<a>test</a>'
    );
    assert.equal(
      sanitizeHtml('<a href="/\\cnn.com/example">test</a>', { allowProtocolRelative: false }),
      '<a>test</a>'
    );
    assert.equal(
      sanitizeHtml('<a href="\\\\cnn.com/example">test</a>', { allowProtocolRelative: false }),
      '<a>test</a>'
    );
    assert.equal(
      sanitizeHtml('<a href="\\/cnn.com/example">test</a>', { allowProtocolRelative: false }),
      '<a>test</a>'
    );
  });
  it('should still allow regular relative URLs when allowProtocolRelative is false', function() {
    assert.equal(
      sanitizeHtml('<a href="/welcome">test</a>', { allowProtocolRelative: false }),
      '<a href="/welcome">test</a>'
    );
  });
  it('should discard srcset by default', function() {
    assert.equal(
      sanitizeHtml('<img src="fallback.jpg" srcset="foo.jpg 100w 2x, bar.jpg 200w 1x" />', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ])
      }),
      '<img src="fallback.jpg" />'
    );
  });
  it('should accept srcset if allowed', function() {
    assert.equal(
      sanitizeHtml('<img src="fallback.jpg" srcset="foo.jpg 100w, bar.jpg 200w" />', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
        allowedAttributes: { img: [ 'src', 'srcset' ] }
      }),
      '<img src="fallback.jpg" srcset="foo.jpg 100w, bar.jpg 200w" />'
    );
    assert.equal(
      sanitizeHtml('<img src="fallback.jpg" srcset="foo.jpg 2x, bar.jpg 1x" />', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
        allowedAttributes: { img: [ 'src', 'srcset' ] }
      }),
      '<img src="fallback.jpg" srcset="foo.jpg 2x, bar.jpg 1x" />'
    );
  });
  it('should drop bogus srcset', function() {
    assert.equal(
      sanitizeHtml('<img src="fallback.jpg" srcset="foo.jpg 100w, bar.jpg 200w, javascript:alert(1) 100w" />', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
        allowedAttributes: { img: [ 'src', 'srcset' ] }
      }),
      '<img src="fallback.jpg" srcset="foo.jpg 100w, bar.jpg 200w" />'
    );
  });
  it('should accept srcset with urls containing commas', function() {
    assert.equal(
      sanitizeHtml('<img src="fallback.jpg" srcset="/upload/f_auto,q_auto:eco,c_fit,w_1460,h_2191/abc.jpg 1460w, /upload/f_auto,q_auto:eco,c_fit,w_1360,h_2041/abc.jpg" />', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
        allowedAttributes: { img: [ 'src', 'srcset' ] }
      }),
      '<img src="fallback.jpg" srcset="/upload/f_auto,q_auto:eco,c_fit,w_1460,h_2191/abc.jpg 1460w, /upload/f_auto,q_auto:eco,c_fit,w_1360,h_2041/abc.jpg" />'
    );
  });

  it('text from transformTags should not specify tags', function() {
    const input = '<input value="&lt;script&gt;alert(1)&lt;/script&gt;">';
    const want = '<u class="inlined-input">&lt;script&gt;alert(1)&lt;/script&gt;</u>';
    // Runs the sanitizer with a policy that turns an attribute into
    // text.  A policy like this might be used to turn inputs into
    // inline elements that look like the original but which do not
    // affect form submissions.
    const got = sanitizeHtml(
      input,
      {
        allowedTags: [ 'u' ],
        allowedAttributes: { '*': [ 'class' ] },
        transformTags: {
          input: function (tagName, attribs) {
            return {
              tagName: 'u',
              attribs: { class: 'inlined-input' },
              text: attribs.value
            };
          }
        }
      });
    assert.equal(got, want);
  });
  it('drop attribute names with meta-characters', function() {
    assert.equal(
      sanitizeHtml('<span data-<script>alert(1)//>', {
        allowedTags: [ 'span' ],
        allowedAttributes: { span: [ 'data-*' ] }
      }),
      '<span>alert(1)//&gt;</span>'
    );
  });
  it('should sanitize styles correctly', function() {
    const sanitizeString = '<p dir="ltr"><strong>beste</strong><em>testestes</em><s>testestset</s><u>testestest</u></p><ul dir="ltr"> <li><u>test</u></li></ul><blockquote dir="ltr"> <ol> <li><u>test</u></li><li><u>test</u></li><li style="text-align: right"><u>test</u></li><li style="text-align: justify"><u>test</u></li></ol> <p><u><span style="color:#00FF00">test</span></u></p><p><span style="color:#00FF00"><span style="font-size:36px">TESTETESTESTES</span></span></p></blockquote>';
    const expected = '<p dir="ltr"><strong>beste</strong><em>testestes</em><s>testestset</s><u>testestest</u></p><ul dir="ltr"> <li><u>test</u></li></ul><blockquote dir="ltr"> <ol> <li><u>test</u></li><li><u>test</u></li><li style="text-align: right"><u>test</u></li><li style="text-align: justify"><u>test</u></li></ol> <p><u><span style="color:#00FF00">test</span></u></p><p><span style="color:#00FF00"><span style="font-size:36px">TESTETESTESTES</span></span></p></blockquote>';
    assert.equal(
      sanitizeHtml(sanitizeString, {
        allowedTags: false,
        allowedAttributes: {
          '*': [ 'dir' ],
          p: [ 'dir', 'style' ],
          li: [ 'style' ],
          span: [ 'style' ]
        },
        allowedStyles: {
          '*': {
            // Matches hex
            color: [ /#(0x)?[0-9a-f]+/i ],
            'text-align': [ /left/, /right/, /center/, /justify/, /initial/, /inherit/ ],
            'font-size': [ /36px/ ]
          }
        }
      }).replace(/ /g, ''), expected.replace(/ /g, '')
    );
  });
  it('Should remove empty style tags', function() {
    assert.equal(
      sanitizeHtml('<span style=\'\'></span>', {
        allowedTags: false,
        allowedAttributes: false
      }),
      '<span></span>'
    );
  });
  it('Should remove invalid styles', function() {
    assert.equal(
      sanitizeHtml('<span style=\'color: blue; text-align: justify\'></span>', {
        allowedTags: false,
        allowedAttributes: {
          span: [ 'style' ]
        },
        allowedStyles: {
          span: {
            color: [ /blue/ ],
            'text-align': [ /left/ ]
          }
        }
      }), '<span style="color:blue"></span>'
    );
  });
  it('Should ignore styles when options.parseStyleAttributes is false', function() {
    assert.equal(
      sanitizeHtml('<span style=\'color: blue; text-align: justify\'></span>', {
        allowedTags: false,
        allowedAttributes: {
          span: [ 'style' ]
        },
        parseStyleAttributes: false
      }), '<span style="color: blue; text-align: justify"></span>'
    );
  });
  it('Should throw an error if both allowedStyles is set and  && parseStyleAttributes is set to false', function() {
    try {
      sanitizeHtml('<span style=\'color: blue; text-align: justify\'></span>', {
        allowedTags: false,
        allowedAttributes: {
          span: [ 'style' ]
        },
        allowedStyles: {
          p: {
            'text-align': [ /^justify$/ ]
          }
        },
        parseStyleAttributes: false
      });
      assert(false);
    } catch (err) {
      assert.equal(err.message, 'allowedStyles option cannot be used together with parseStyleAttributes: false.');
    }
  });
  it('Should support !important styles', function() {
    assert.equal(
      sanitizeHtml('<span style=\'color: blue !important\'></span>', {
        allowedTags: false,
        allowedAttributes: {
          span: [ 'style' ]
        },
        allowedStyles: {
          span: {
            color: [ /blue/ ]
          }
        }
      }), '<span style="color:blue !important"></span>'
    );
  });
  it('Should allow a specific style from global', function() {
    assert.equal(
      sanitizeHtml('<span style=\'color: yellow; text-align: center; font-family: helvetica\'></span>', {
        allowedTags: false,
        allowedAttributes: {
          span: [ 'style' ]
        },
        allowedStyles: {
          '*': {
            color: [ /yellow/ ],
            'text-align': [ /center/ ]
          },
          span: {
            color: [ /green/ ],
            'font-family': [ /helvetica/ ]
          }
        }
      }), '<span style="color:yellow;text-align:center;font-family:helvetica"></span>'
    );
  });
  it('should delete the script tag', function() {
    assert.equal(sanitizeHtml('<script src="https://www.unauthorized.com/lib.js"></script>', {
      allowedTags: [ 'script' ],
      allowVulnerableTags: true,
      allowedAttributes: {
        script: [ 'src' ]
      },
      allowedScriptHostnames: [ 'www.authorized.com' ]
    }), '<script></script>');
  });
  it('should delete the script tag since src is not a valid URL', function() {
    assert.equal(sanitizeHtml('<script src="not-a-valid-url"></script>', {
      allowedTags: [ 'script' ],
      allowVulnerableTags: true,
      allowedAttributes: {
        script: [ 'src' ]
      },
      allowedScriptHostnames: [ 'www.unauthorized.com' ]
    }), '<script></script>');
  });
  it('Should allow domains in a script that are in allowedScriptDomains', function() {
    assert.equal(
      sanitizeHtml('<script src="https://www.safe.authorized.com/lib.js"></script>', {
        allowedTags: [ 'script' ],
        allowedAttributes: {
          script: [ 'src' ]
        },
        allowedScriptDomains: [ 'authorized.com' ]
      }), '<script src="https://www.safe.authorized.com/lib.js"></script>'
    );
  });
  it('should delete the script tag content', function() {
    assert.equal(sanitizeHtml('<script src="https://www.authorized.com/lib.js"> alert("evil") </script>', {
      allowedTags: [ 'script' ],
      allowVulnerableTags: true,
      allowedAttributes: {
        script: [ 'src' ]
      },
      allowedScriptHostnames: [ 'www.authorized.com' ]
    }), '<script src="https://www.authorized.com/lib.js"></script>');
  });
  it('should delete the script tag content from script tags with no src when allowedScriptHostnames is present', function() {
    assert.equal(sanitizeHtml('<script>alert("evil")</script>', {
      allowedTags: [ 'script' ],
      allowVulnerableTags: true,
      allowedAttributes: {
        script: [ 'src' ]
      },
      allowedScriptHostnames: [ 'www.authorized.com' ]
    }), '<script></script>');
  });
  it('should delete the script tag content from script tags with no src when allowedScriptDomains is present', function() {
    assert.equal(sanitizeHtml('<script>alert("evil")</script>', {
      allowedTags: [ 'script' ],
      allowVulnerableTags: true,
      allowedAttributes: {
        script: [ 'src' ]
      },
      allowedScriptDomains: [ 'www.authorized.com' ]
    }), '<script></script>');
  });
  it('Should allow hostnames in a script that are in allowedScriptHostnames', function() {
    assert.equal(sanitizeHtml('<script src="https://www.authorized.com/lib.js"></script>', {
      allowedTags: [ 'script' ],
      allowVulnerableTags: true,
      allowedAttributes: {
        script: [ 'src' ]
      },
      allowedScriptHostnames: [ 'www.authorized.com' ]
    }), '<script src="https://www.authorized.com/lib.js"></script>');
  });
  it('Should allow hostnames in an iframe that are in allowedIframeHostnames', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.youtube.com/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com', 'player.vimeo.com' ]
      }), '<iframe src="https://www.youtube.com/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should remove iframe src urls that are not included in allowedIframeHostnames', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.embed.vevo.com/USUV71704255"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com', 'player.vimeo.com' ]
      }), '<iframe></iframe>'
    );
  });
  it('Should not allow iframe urls that do not have proper hostname', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.vimeo.com/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com', 'player.vimeo.com' ]
      }), '<iframe></iframe>'
    );
  });
  it('Should allow iframe through if no hostname option is set', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.vimeo.com/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        }
      }), '<iframe src="https://www.vimeo.com/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should allow domains in an iframe that are in allowedIframeDomains', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.foo.us02web.zoom.us/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeDomains: [ 'zoom.us' ]
      }), '<iframe src="https://www.foo.us02web.zoom.us/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should allow second-level domains in an iframe that are in allowedIframeDomains', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://zoom.us/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeDomains: [ 'zoom.us' ]
      }), '<iframe src="https://zoom.us/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should remove iframe src urls that are not included in allowedIframeDomains', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.prefix.us02web.zoom.us/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeDomains: [ 'vimeo.com' ]
      }), '<iframe></iframe>'
    );
  });
  it('Should remove iframe src urls with host that ends as allowed domains but not preceded with a dot', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.zoomzoom.us/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeDomains: [ 'zoom.us' ]
      }), '<iframe></iframe>'
    );
  });
  it('Should allow hostnames in an iframe that are in allowedIframeHostnames and are not in allowedIframeDomains', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.youtube.com/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com', 'player.vimeo.com' ],
        allowedIframeDomains: [ 'zoom.us' ]
      }), '<iframe src="https://www.youtube.com/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should allow hostnames in an iframe that are not in allowedIframeHostnames ' +
     'and are allowlisted in allowedIframeDomains', function() {
    assert.equal(
      sanitizeHtml('<iframe src="https://www.us02web.zoom.us/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com', 'player.vimeo.com' ],
        allowedIframeDomains: [ 'zoom.us' ]
      }), '<iframe src="https://www.us02web.zoom.us/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should allow relative URLs for iframes by default', function() {
    assert.equal(
      sanitizeHtml('<iframe src="/foo"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        }
      }), '<iframe src="/foo"></iframe>'
    );
  });
  it('Should allow relative URLs for iframes', function() {
    assert.equal(
      sanitizeHtml('<iframe src="/foo"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowIframeRelativeUrls: true
      }), '<iframe src="/foo"></iframe>'
    );
  });
  it('Should remove relative URLs for iframes', function() {
    assert.equal(
      sanitizeHtml('<iframe src="/foo"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowIframeRelativeUrls: false
      }), '<iframe></iframe>'
    );
  });
  it('Should remove relative URLs for iframes when other hostnames are specified in allowedIframeHostnames', function() {
    assert.equal(
      sanitizeHtml('<iframe src="/foo"></iframe><iframe src="https://www.youtube.com/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com' ]
      }), '<iframe></iframe><iframe src="https://www.youtube.com/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should allow relative and allowlisted hostname URLs for iframes', function() {
    assert.equal(
      sanitizeHtml('<iframe src="/foo"></iframe><iframe src="https://www.youtube.com/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowIframeRelativeUrls: true,
        allowedIframeHostnames: [ 'www.youtube.com' ]
      }), '<iframe src="/foo"></iframe><iframe src="https://www.youtube.com/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should allow protocol-relative URLs for the right domain for iframes', function() {
    assert.equal(
      sanitizeHtml('<iframe src="//www.youtube.com/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com', 'player.vimeo.com' ]
      }), '<iframe src="//www.youtube.com/embed/c2IlcS7AHxM"></iframe>'
    );
  });
  it('Should not allow protocol-relative iframe urls that do not have proper hostname', function() {
    assert.equal(
      sanitizeHtml('<iframe src="//www.vimeo.com/embed/c2IlcS7AHxM"></iframe>', {
        allowedTags: [ 'p', 'iframe', 'a', 'img', 'i' ],
        allowedAttributes: {
          iframe: [ 'src', 'href' ],
          a: [ 'src', 'href' ],
          img: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com', 'player.vimeo.com' ]
      }), '<iframe></iframe>'
    );
  });
  it('Should only allow attributes to have any combination of specific values', function() {
    assert.equal(
      sanitizeHtml('<iframe name="IFRAME" allowfullscreen="true" sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation"></iframe>', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'iframe' ]),
        allowedAttributes: {
          iframe: [
            {
              name: 'sandbox',
              multiple: true,
              values: [ 'allow-popups', 'allow-same-origin', 'allow-scripts' ]
            },
            'allowfullscreen'
          ]
        }
      }), '<iframe allowfullscreen="true" sandbox="allow-popups allow-same-origin allow-scripts"></iframe>');
  });
  it('Should only allow attributes that match a specific value', function() {
    assert.equal(
      sanitizeHtml('<iframe sandbox="allow-popups allow-modals"></iframe><iframe sandbox="allow-popups"></iframe><iframe sandbox="allow-scripts"></iframe>', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'iframe' ]),
        allowedAttributes: {
          iframe: [
            {
              name: 'sandbox',
              multiple: false,
              values: [ 'allow-popups', 'allow-same-origin', 'allow-scripts' ]
            }
          ]
        }
      }), '<iframe sandbox></iframe><iframe sandbox="allow-popups"></iframe><iframe sandbox="allow-scripts"></iframe>');
  }
  );
  it('Should not allow cite urls that do not have an allowed scheme', function() {
    assert.equal(
      sanitizeHtml('<q cite="http://www.google.com">HTTP</q><q cite="https://www.google.com">HTTPS</q><q cite="mailto://www.google.com">MAILTO</q><q cite="tel://www.google.com">TEL</q><q cite="ms-calculator:">ms-calculator</q><q cite="ftp://www.google.com">FTP</q><q cite="data://www.google.com">DATA</q><q cite="ldap://www.google.com">LDAP</q><q cite="acrobat://www.google.com">ACROBAT</q><q cite="vbscript://www.google.com">VBSCRIPT</q><q cite="file://www.google.com">FILE</q><q cite="rlogin://www.google.com">RLOGIN</q><q cite="webcal://www.google.com">WEBCAL</q><q cite="javascript://www.google.com">JAVASCRIPT</q><q cite="mms://www.google.com">MMS</q>', {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'q' ]),
        allowedAttributes: { q: [ 'cite' ] },
        allowedSchemes: sanitizeHtml.defaults.allowedSchemes.concat([ 'tel' ])
      }), '<q cite="http://www.google.com">HTTP</q><q cite="https://www.google.com">HTTPS</q><q cite="mailto://www.google.com">MAILTO</q><q cite="tel://www.google.com">TEL</q><q>ms-calculator</q><q cite="ftp://www.google.com">FTP</q><q>DATA</q><q>LDAP</q><q>ACROBAT</q><q>VBSCRIPT</q><q>FILE</q><q>RLOGIN</q><q>WEBCAL</q><q>JAVASCRIPT</q><q>MMS</q>');
  });
  it('Should encode &, <, > and where necessary, "', function() {
    assert.equal(sanitizeHtml('"< & >" <span class="&#34;test&#34;">cool</span>', {
      allowedTags: [ 'span' ],
      allowedAttributes: {
        span: [ 'class' ]
      }
    }), '"&lt; &amp; &gt;" <span class="&quot;test&quot;">cool</span>');
  });
  it('Should not pass through &0; unescaped if decodeEntities is true (the default)', function() {
    assert.equal(sanitizeHtml('<img src="<0&0;0.2&" />', { allowedTags: [ 'img' ] }), '<img src="&lt;0&amp;0;0.2&amp;" />');
  });
  it('Should not double encode ampersands on HTML entities if decodeEntities is false (TODO more tests, this is too loose to rely upon)', function() {
    const textIn = 'This &amp; & that &reg; &#x0000A; &#10; &plusmn; OK?';
    const expectedResult = 'This &amp; &amp; that &reg; &#x0000A; &#10; &plusmn; OK?';
    const sanitizeHtmlOptions = {
      parser: {
        decodeEntities: false
      }
    };
    assert.equal(sanitizeHtml(textIn, sanitizeHtmlOptions), expectedResult);
  });
  // TODO: make this test and similar tests for entities that are not
  // strictly valid pass, at which point decodeEntities: false is safe
  // to use.
  //
  // it('Should not pass through &0;
  // (a bogus entity) unescaped if decodeEntities is false', function() {
  //   assert.equal(sanitizeHtml(
  //     '<img src="<0&0;0.2&" />', {
  //       allowedTags: ['img'],
  //       parser: {
  //         decodeEntities: false
  //       }
  //     }), '<img src="&lt;0&amp;0;0.2&amp;" />');
  // });
  it('should escape markup not allowlisted and all its children in recursive mode', function() {
    assert.equal(
      sanitizeHtml('<div><wiggly>Hello<p>World</p></wiggly></div>', { disallowedTagsMode: 'recursiveEscape' }),
      '<div>&lt;wiggly&gt;Hello&lt;p&gt;World&lt;/p&gt;&lt;/wiggly&gt;</div>'
    );
  });
  it('should escape markup not allowlisted and but not its children', function() {
    assert.equal(
      sanitizeHtml('<div><wiggly>Hello<p>World</p></wiggly></div>', { disallowedTagsMode: 'escape' }),
      '<div>&lt;wiggly&gt;Hello<p>World</p>&lt;/wiggly&gt;</div>'
    );
  });
  it('should escape markup even when decodeEntities is false', function() {
    assert.equal(
      sanitizeHtml('<wiggly>Hello</wiggly>', {
        disallowedTagsMode: 'escape',
        parser: { decodeEntities: false }
      }),
      '&lt;wiggly&gt;Hello&lt;/wiggly&gt;'
    );
  });
  it('should escape markup not allowlisted even within allowed markup', function() {
    assert.equal(
      sanitizeHtml('<div><wiggly>Hello<p>World</p><tiggly>JS</tiggly></wiggly></div>', { disallowedTagsMode: 'recursiveEscape' }),
      '<div>&lt;wiggly&gt;Hello&lt;p&gt;World&lt;/p&gt;&lt;tiggly&gt;JS&lt;/tiggly&gt;&lt;/wiggly&gt;</div>'
    );
  });
  it('should escape markup not allowlisted even within allowed markup, but not the allowed markup itself', function() {
    assert.equal(
      sanitizeHtml('<div><wiggly>Hello<p>World</p><tiggly>JS</tiggly></wiggly></div>', { disallowedTagsMode: 'escape' }),
      '<div>&lt;wiggly&gt;Hello<p>World</p>&lt;tiggly&gt;JS&lt;/tiggly&gt;&lt;/wiggly&gt;</div>'
    );
  });
  it('allows markup of depth 6 with a nestingLimit of depth 6', function() {
    assert.equal(
      sanitizeHtml('<div><div><div><div><div><div></div></div></div></div></div></div>', { nestingLimit: 6 }),
      '<div><div><div><div><div><div></div></div></div></div></div></div>'
    );
  });
  it('disallows markup of depth 7 with a nestingLimit of depth 6', function() {
    assert.equal(
      // 7 divs here
      sanitizeHtml('<div><div><div><div><div><div><div>nested text</div></div></div></div></div></div></div>', { nestingLimit: 6 }),
      // only 6 kept
      '<div><div><div><div><div><div>nested text</div></div></div></div></div></div>'
    );
  });
  it('should not allow simple append attacks on iframe hostname validation', function() {
    assert.equal(
      sanitizeHtml('<iframe src=//www.youtube.comissocool>', {
        allowedTags: [ 'iframe' ],
        allowedAttributes: {
          iframe: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com' ]
      }),
      '<iframe></iframe>'
    );
  });
  it('should not allow IDNA (Internationalized Domain Name) iframe validation bypass attacks', function() {
    assert.equal(
      sanitizeHtml('<iframe src=//www.youtube.com%C3%9E.93.184.216.34.nip.io>', {
        allowedTags: [ 'iframe' ],
        allowedAttributes: {
          iframe: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com' ]
      }),
      '<iframe></iframe>'
    );
  });
  it('should parse path-rooted relative URLs sensibly', function() {
    assert.equal(
      sanitizeHtml('<a href="/foo"></a>'),
      '<a href="/foo"></a>'
    );
  });
  it('should parse bare relative URLs sensibly', function() {
    assert.equal(
      sanitizeHtml('<a href="foo"></a>'),
      '<a href="foo"></a>'
    );
  });
  it('should parse ../ relative URLs sensibly', function() {
    assert.equal(
      sanitizeHtml('<a href="../../foo"></a>'),
      '<a href="../../foo"></a>'
    );
  });
  it('should parse protocol relative URLs sensibly', function() {
    assert.equal(
      sanitizeHtml('<a href="//foo.com/foo"></a>'),
      '<a href="//foo.com/foo"></a>'
    );
  });
  it('should reject attempts to hack our use of a relative: protocol in our test base URL', function() {
    assert.equal(
      sanitizeHtml('<iframe src="relative://relative-test/aha">', {
        allowedTags: [ 'iframe' ],
        allowedAttributes: {
          iframe: [ 'src' ]
        }
      }),
      '<iframe></iframe>'
    );
  });
  it('Should prevent hostname bypass using protocol-relative src', function () {
    assert.strictEqual(
      sanitizeHtml('<iframe src="/\\example.com"></iframe>', {
        allowedTags: [ 'iframe' ],
        allowedAttributes: {
          iframe: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com' ],
        allowIframeRelativeUrls: true
      }), '<iframe></iframe>'
    );
    assert.strictEqual(
      sanitizeHtml('<iframe src="\\/example.com"></iframe>', {
        allowedTags: [ 'iframe' ],
        allowedAttributes: {
          iframe: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com' ],
        allowIframeRelativeUrls: true
      }), '<iframe></iframe>'
    );
    const linefeed = decodeURIComponent('%0A');
    assert.strictEqual(
      sanitizeHtml('<iframe src="/' + linefeed + '\\example.com"></iframe>', {
        allowedTags: [ 'iframe' ],
        allowedAttributes: {
          iframe: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com' ],
        allowIframeRelativeUrls: true
      }), '<iframe></iframe>'
    );
    const creturn = decodeURIComponent('%0D');
    assert.strictEqual(
      sanitizeHtml('<iframe src="/' + creturn + '\\example.com"></iframe>', {
        allowedTags: [ 'iframe' ],
        allowedAttributes: {
          iframe: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com' ],
        allowIframeRelativeUrls: true
      }), '<iframe></iframe>'
    );
    const tab = decodeURIComponent('%09');
    assert.strictEqual(
      sanitizeHtml('<iframe src="/' + tab + '\\example.com"></iframe>', {
        allowedTags: [ 'iframe' ],
        allowedAttributes: {
          iframe: [ 'src' ]
        },
        allowedIframeHostnames: [ 'www.youtube.com' ],
        allowIframeRelativeUrls: true
      }), '<iframe></iframe>'
    );
  });
  it('Should allow protocol-relative URLs for script tag', function() {
    assert.equal(
      sanitizeHtml('<script src="//example.com/script.js"></script>', {
        allowedTags: [ 'script' ],
        allowedAttributes: {
          script: [ 'src' ]

        }
      }), '<script src="//example.com/script.js"></script>'
    );
  });
  it('should not automatically attach close tag for escaped tags in escape mode', function() {
    assert.equal(sanitizeHtml('<test>Hello', {
      disallowedTagsMode: 'escape'
    }), '&lt;test&gt;Hello');
  });
  it('should not automatically attach close tag for escaped tags in recursiveEscape mode', function() {
    assert.equal(sanitizeHtml('<test><test><test><test><test>Hello', {
      disallowedTagsMode: 'recursiveEscape'
    }), '&lt;test&gt;&lt;test&gt;&lt;test&gt;&lt;test&gt;&lt;test&gt;Hello');
  });
  it('should discard unclosed disallowed tags', function() {
    assert.equal(sanitizeHtml('<test>Hello', {
      disallowedTagsMode: 'discard'
    }), 'Hello');
  });
  it('should escape unclosed tags without closing bracket in escape mode', function() {
    assert.equal(sanitizeHtml('<hello', {
      disallowedTagsMode: 'escape'
    }), '&lt;hello');
  });
  it('should escape unclosed tags without closing bracket in recursiveEscape mode', function() {
    assert.equal(sanitizeHtml('<hello', {
      disallowedTagsMode: 'recursiveEscape'
    }), '&lt;hello');
  });
  it('should escape unclosed tags with attributes but no closing bracket in escape mode', function() {
    assert.equal(sanitizeHtml('<hello you', {
      disallowedTagsMode: 'escape'
    }), '&lt;hello you');
  });
  it('should escape unclosed tags with attributes but no closing bracket in recursiveEscape mode', function() {
    assert.equal(sanitizeHtml('<hello you', {
      disallowedTagsMode: 'recursiveEscape'
    }), '&lt;hello you');
  });
  it('should discard unclosed tags without closing bracket in discard mode', function() {
    assert.equal(sanitizeHtml('<hello', {
      disallowedTagsMode: 'discard'
    }), '');
  });
  it('should escape text followed by unclosed tag in escape mode', function() {
    assert.equal(sanitizeHtml('Hello <world', {
      disallowedTagsMode: 'escape'
    }), 'Hello &lt;world');
  });
  it('should escape text followed by unclosed tag in recursiveEscape mode', function() {
    assert.equal(sanitizeHtml('Hello <world', {
      disallowedTagsMode: 'recursiveEscape'
    }), 'Hello &lt;world');
  });
  it('should remove non-boolean attributes that are empty', function() {
    assert.equal(sanitizeHtml('<a href target="_blank">hello</a>', {
    }), '<a target="_blank">hello</a>');
  });
  it('should not remove non-boolean attributes that are empty when disabled', function() {
    assert.equal(sanitizeHtml('<a href target="_blank">hello</a>', {
      nonBooleanAttributes: []
    }), '<a href target="_blank">hello</a>');
  });
  it('should not remove boolean attributes that are empty', function() {
    assert.equal(sanitizeHtml('<input checked form type="checkbox" />', {
      allowedTags: 'input',
      allowedAttributes: {
        input: [ 'checked', 'form', 'type' ]
      }
    }), '<input checked type="checkbox" />');
  });
  it('should remove boolean attributes that are empty when wildcard * passed in', function() {
    assert.equal(sanitizeHtml('<input checked form type="checkbox" />', {
      allowedTags: 'input',
      allowedAttributes: {
        input: [ 'checked', 'form', 'type' ]
      },
      nonBooleanAttributes: [ '*' ]
    }), '<input type="checkbox" />');
  });
  it('should not remove empty alt attribute value by default', function() {
    assert.equal(sanitizeHtml('<img alt="" src="https://example.com/" />', {
      allowedAttributes: { img: [ 'alt', 'src' ] },
      allowedTags: [ 'img' ]
    }), '<img alt="" src="https://example.com/" />');
  });
  it('should convert the implicit empty alt attribute value to be an empty string by default', function() {
    assert.equal(sanitizeHtml('<img alt src="https://example.com/" />', {
      allowedAttributes: { img: [ 'alt', 'src' ] },
      allowedTags: [ 'img' ]
    }), '<img alt="" src="https://example.com/" />');
  });
  it('should not remove empty alt attribute value by default when an empty nonBooleanAttributes option passed in', function() {
    assert.equal(sanitizeHtml('<img alt="" src="https://example.com/" />', {
      allowedAttributes: { img: [ 'alt', 'src' ] },
      allowedTags: [ 'img' ],
      nonBooleanAttributes: []
    }), '<img alt="" src="https://example.com/" />');
  });
  it('should not remove the empty attributes specified in allowedEmptyAttributes option', function() {
    assert.equal(sanitizeHtml('<img alt="" src="" />', {
      allowedAttributes: { img: [ 'alt', 'src' ] },
      allowedTags: [ 'img' ],
      allowedEmptyAttributes: [ 'alt', 'src' ]
    }), '<img alt="" src="" />');
  });
  it('should remove all the empty attributes when an empty allowedEmptyAttributes option passed in', function() {
    assert.equal(sanitizeHtml('<img alt="" src="https://example.com/" target="" />', {
      allowedAttributes: { img: [ 'alt', 'src' ] },
      allowedTags: [ 'img' ],
      allowedEmptyAttributes: []
    }), '<img src="https://example.com/" />');
  });
  it('should support SVG tags', () => {
    assert.equal(sanitizeHtml('<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="myGradient" gradientTransform="rotate(90)"><stop offset="5%" stop-color="gold"></stop><stop offset="95%" stop-color="red"></stop></linearGradient></defs><circle cx="5" cy="5" r="4" fill="url(\'#myGradient\')"></circle></svg>', {
      allowedTags: [ 'svg', 'g', 'defs', 'linearGradient', 'stop', 'circle' ],
      allowedAttributes: false,
      parser: {
        lowerCaseTags: false,
        lowerCaseAttributeNames: false
      }
    }), '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="myGradient" gradientTransform="rotate(90)"><stop offset="5%" stop-color="gold"></stop><stop offset="95%" stop-color="red"></stop></linearGradient></defs><circle cx="5" cy="5" r="4" fill="url(\'#myGradient\')"></circle></svg>');
  });
  it('should not process style sourceMappingURL with postCSS', () => {
    assert.equal(sanitizeHtml('<a style=\'background-image: url("/*# sourceMappingURL=../index.js */");\'></a>', {
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        a: [ 'style' ]
      }
    }), '<a style="background-image:url(&quot;/*# sourceMappingURL=../index.js */&quot;)"></a>');
  });
  it('should completely remove disallowed tags with nested content', () => {
    const inputHtml = '<div>Some Text<p>Allowed content</p><script>var x = "Disallowed script";</script><span>More allowed content</span> Another Text</div>';
    const expectedOutput = '<p>Allowed content</p><span>More allowed content</span>';
    const sanitizedHtml = sanitizeHtml(inputHtml, {
      allowedTags: [ 'p', 'span' ],
      disallowedTagsMode: 'completelyDiscard'
    });
    assert.equal(sanitizedHtml, expectedOutput);
  });
  it('should remove top level tag\'s content', () => {
    const inputHtml = 'Some Text<p>paragraph content</p> content';
    const expectedOutput = '<p>paragraph content</p>';
    const sanitizedHtml = sanitizeHtml(inputHtml, {
      allowedTags: [ 'p' ],
      disallowedTagsMode: 'completelyDiscard'
    });
    assert.equal(sanitizedHtml, expectedOutput);
  });
  it('should completely remove disallowed tag with unclosed tag', () => {
    const inputHtml = '<div>Some Text<p>paragraph content</p>some text';
    const expectedOutput = '<p>paragraph content</p>';
    const sanitizedHtml = sanitizeHtml(inputHtml, {
      allowedTags: [ 'p' ],
      disallowedTagsMode: 'completelyDiscard'
    });

    assert.equal(sanitizedHtml, expectedOutput);
  });
  it('should transform text content of tags even if they originally had none', () => {
    const inputHtml = '<div></div>';
    const expectedOutput = 'new content';
    const sanitizedHtml = sanitizeHtml(inputHtml, {
      allowedTags: [],
      transformTags: {
        div: () => ({ text: 'new content' })
      }
    });

    assert.equal(sanitizedHtml, expectedOutput);
  });
  it('should call onOpenTag and onCloseTag callbacks', () => {
    const onOpenTag = sinon.spy();
    const onCloseTag = sinon.spy();
    const inputHtml = '<div id="one">Some Text<p id="two">paragraph content</p><p id="three">some text</div>';
    sanitizeHtml(inputHtml, {
      allowedTags: [ 'p' ],
      onOpenTag,
      onCloseTag
    });
    assert.equal(onOpenTag.callCount, 3);
    assert.equal(onOpenTag.getCall(0).calledWith('div', { id: 'one' }), true);
    assert.equal(onOpenTag.getCall(1).calledWith('p', { id: 'two' }), true);
    assert.equal(onOpenTag.getCall(2).calledWith('p', { id: 'three' }), true);
    assert.equal(onCloseTag.callCount, 3);
    assert.equal(onCloseTag.getCall(0).calledWith('p', false), true);
    assert.equal(onCloseTag.getCall(1).calledWith('p', true), true);
    assert.equal(onCloseTag.getCall(2).calledWith('div', false), true);
  });
  it('should insert spaces between removed tags whose content we keep', () => {
    const inputHtml = 'Text&#39;s here<div>it&#39;s here</div><div><p>it&#39;s there</p></div>and <b>also</b> here';
    const expectedOutput = 'Text\'s here it\'s here it\'s there and <b>also</b> here';
    const allowedTags = [ 'b' ];
    let addSpace = false;
    const sanitizedHtml = sanitizeHtml(
      inputHtml,
      {
        allowedTags,
        onOpenTag: (tag) => {
          addSpace = !allowedTags.includes(tag);
        },
        onCloseTag: (tag) => {
          addSpace = !allowedTags.includes(tag);
        },
        textFilter: (text) => {
          if (addSpace) {
            addSpace = false;
            return ' ' + text;
          }
          return text;
        }
      }
    );
    assert.equal(sanitizedHtml, expectedOutput);
  });
  it('should not preserve attributes on escaped disallowed tags when `preserveEscapedAttributes` is false', () => {
    const inputHtml = '<div class="foo">Some Text</div>';
    const expectedOutput = '&lt;div&gt;Some Text&lt;/div&gt;';
    const sanitizedHtml = sanitizeHtml(inputHtml, {
      allowedTags: [],
      disallowedTagsMode: 'escape',
      preserveEscapedAttributes: false
    });

    assert.equal(sanitizedHtml, expectedOutput);
  });
  it('should preserve attributes on escaped disallowed tags when `preserveEscapedAttributes` is true', () => {
    const inputHtml = '<div class="foo">Some Text</div>';
    const expectedOutput = '&lt;div class="foo"&gt;Some Text&lt;/div&gt;';
    const sanitizedHtml = sanitizeHtml(inputHtml, {
      allowedTags: [],
      disallowedTagsMode: 'escape',
      preserveEscapedAttributes: true
    });

    assert.equal(sanitizedHtml, expectedOutput);
  });
  it('should ignore the `preserveEscapedAttributes` option when discarding diallowed tags (rather than escaping)', () => {
    const inputHtml = '<div class="foo">Some Text</div>';
    const sanitizedHtmlPreservedAttrsTrue = sanitizeHtml(inputHtml, {
      allowedTags: [],
      disallowedTagsMode: 'discard',
      preserveEscapedAttributes: true
    });
    const sanitizedHtmlPreservedAttrsFalse = sanitizeHtml(inputHtml, {
      allowedTags: [],
      disallowedTagsMode: 'discard',
      preserveEscapedAttributes: false
    });

    assert.equal(sanitizedHtmlPreservedAttrsTrue, sanitizedHtmlPreservedAttrsFalse);
  });
});

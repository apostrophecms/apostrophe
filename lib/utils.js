var _ = require('lodash');
var he = require('he');
var extend = require('extend');
_.str = require('underscore.string');
var XRegExp = require('xregexp').XRegExp;

/**
 * utils
 * @augments Augments the apos object with short methods providing constantly used
 * functionality when developing Apostrophe, such as escaping HTML, doing global replaces of strings,
 * converting a string to a slug, converting a string to a regular expression that searches
 * for it, converting a mixed case name to a hyphenated ("CSS") name, etc. Anything more complex
 * and/or less frequently needed should be moved out to a separate file. Busting these
 * out to separate npm modules in future is a good idea.
 */

module.exports = function(self) {
  // Globally replace a string with another string.
  // Regular `String.replace` does NOT offer global replace, except
  // when using regular expressions, which are great (and fast) but
  // sometimes problematic when UTF8 characters may be present.

  self.globalReplace = function(haystack, needle, replacement) {
    var result = '';
    while (true) {
      if (!haystack.length) {
        return result;
      }
      var index = haystack.indexOf(needle);
      if (index === -1) {
        result += haystack;
        return result;
      }
      result += haystack.substr(0, index);
      result += replacement;
      haystack = haystack.substr(index + needle.length);
    }
  };

  /**
   * Truncate a plaintext string at the specified number of
   * characters without breaking words if possible, see
   * underscore.string's prune function, of which this is
   * a copy of (only replacing RegExp with XRegExp for
   * better UTF-8 support)
   */
  self.truncatePlaintext = function(str, length, pruneStr){
    if (str == null) return '';

    str = String(str); length = ~~length;
    pruneStr = pruneStr != null ? String(pruneStr) : '...';

    if (str.length <= length) return str;

    var r = '.(?=\W*\w*$)';
    var regex = new XRegExp(r, 'g');

    var tmpl = function(c){ return c.toUpperCase() !== c.toLowerCase() ? 'A' : ' '; },
      template = str.slice(0, length+1);
      template = XRegExp.replace(template, regex, tmpl); // 'Hello, world' -> 'HellAA AAAAA'

    if (template.slice(template.length-2).match(/\w\w/))
      template = template.replace(/\s*\S+$/, '');
    else
      template = _.str.rtrim(template.slice(0, template.length-1));

    return (template+pruneStr).length > str.length ? str : str.slice(0, template.length)+pruneStr;
  };

  // Escape a plaintext string correctly for use in HTML. If pretty is true,
  // newlines become br tags, and URLs become links to those URLs. Otherwise
  // we just do basic escaping.

  self.escapeHtml = function(s, pretty) {
    if (s === 'undefined') {
      s = '';
    }
    if (typeof(s) !== 'string') {
      s = s + '';
    }
    s = s.replace(/\&/g, '&amp;').replace(/</g, '&lt;').replace(/\>/g, '&gt;').replace(/\"/g, '&quot;');
    if (pretty) {
      s = s.replace(/\r?\n/g, "<br />");
      // URLs to links. Careful, newlines are already <br /> at this point
      s = s.replace(/https?\:[^\s\<]+/g, function(match) {
        match = match.trim();
        return '<a href="' + self.escapeHtml(match) + '">' + match + '</a>';
      });
    }
    return s;
  };

  // Convert HTML to true plaintext, with all entities decoded
  self.htmlToPlaintext = function(html) {
    // The awesomest HTML renderer ever (look out webkit):
    // block element opening tags = newlines, closing tags and non-container tags just gone
    html = html.replace(/<\/.*?\>/g, '');
    html = html.replace(/<(h1|h2|h3|h4|h5|h6|p|br|blockquote|li|article|address|footer|pre|header|table|tr|td|th|tfoot|thead|div|dl|dt|dd).*?\>/gi, '\n');
    html = html.replace(/<.*?\>/g, '');
    return he.decode(html);
  };

  /**
   * Capitalize the first letter of a string
   */
  self.capitalizeFirst = function(s) {
    return s.charAt(0).toUpperCase() + s.substr(1);
  };

  // Convert other name formats such as underscore and camelCase to a hyphenated css-style
  // name. KEEP IN SYNC WITH BROWSER SIDE VERSION in content.js
  self.cssName = function(camel) {
    // Keep in sync with client side version
    var i;
    var css = '';
    var dash = false;
    for (i = 0; (i < camel.length); i++) {
      var c = camel.charAt(i);
      var lower = ((c >= 'a') && (c <= 'z'));
      var upper = ((c >= 'A') && (c <= 'Z'));
      var digit = ((c >= '0') && (c <= '9'));
      if (!(lower || upper || digit)) {
        dash = true;
        continue;
      }
      if (upper) {
        if (i > 0) {
          dash = true;
        }
        c = c.toLowerCase();
      }
      if (dash) {
        css += '-';
        dash = false;
      }
      css += c;
    }
    return css;
  };

  // Accepts a camel-case type name such as blog and returns a browser-side
  // constructor function name such as AposBlog

  self.constructorName = function(camel) {
    return 'Apos' + camel.charAt(0).toUpperCase() + camel.substring(1);
  };

  // Convert a name to camel case.
  //
  // Useful in converting CSV with friendly headings into sensible property names.
  //
  // Only digits and ASCII letters remain.
  //
  // Anything that isn't a digit or an ASCII letter prompts the next character
  // to be uppercase. Existing uppercase letters also trigger uppercase, unless
  // they are the first character; this preserves existing camelCase names.

  self.camelName = function(s) {
    // Keep in sync with client side version
    var i;
    var n = '';
    var nextUp = false;
    for (i = 0; (i < s.length); i++) {
      var c = s.charAt(i);
      // If the next character is already uppercase, preserve that, unless
      // it is the first character
      if ((i > 0) && c.match(/[A-Z]/)) {
        nextUp = true;
      }
      if (c.match(/[A-Za-z0-9]/)) {
        if (nextUp) {
          n += c.toUpperCase();
          nextUp = false;
        } else {
          n += c.toLowerCase();
        }
      } else {
        nextUp = true;
      }
    }
    return n;
  };

  // Add a slash to a path, but only if it does not already end in a slash
  self.addSlashIfNeeded = function(path) {
    path += '/';
    path = path.replace(/\/\/$/, '/');
    return path;
  };
};

  // self.$style = self.$el.find('[data-style]');
  // self.$style.change(function() {
  //   self.$editable.focus();
  //   document.execCommand("formatBlock", false, '<' + self.$style.val() + '>');
  //   return false;
  // });

  // // Don't steal the focus from the rich text editor
  // self.$style.mouseup(function() {
  //   self.$editable.focus();
  //   return false;
  // });

  // self.$editable.keypress(function(e) {
  //   if (e.which === 13) {
  //     e.preventDefault();
  //     var tag = self.$style.val();
  //     var html = '<' + tag + '></' + tag + '>';
  //     insertHtmlAtCursor(html);
  //     return false;
  //   }
  //   return true;
  // });

  // Code to select on click. Unfortunately
  // this all ends in tears in Firefox, in which 
  // the selection happens (and copy and paste works)
  // but delete, cut, typeover, etc. do NOT work.
  // var sel = window.getSelection();
  // sel.removeAllRanges();
  // var range = document.createRange();
  // selectElement(this);
  // // Make sure the image looks selected. This is
  // // a workaround for a bug in Firefox
  // $(this).css('background-color: blue');
  // $(this).css('opacity', 0.5);
  // $(this).data('selection-workaround', true);
  // sel.addRange(range);
  // return false;

    // Maintaining the left and right float marks turns out to
    // be quite difficult. If users don't want them, just let
    // them go.
    //
    // self.$editable.find('.left').each(function() {
    //   $el = $(this);
    //   var $prev = $el.prev();
    //   if (!$prev.hasClass('jb-left-before')) {
    //     $el.before('<div class="jb-left-before">&laquo;</div>');
    //   }
    //   var $next = $el.next();
    //   if (!$next.hasClass('jb-left-after')) {
    //     $el.after('<div class="jb-left-after">&raquo;</div>');
    //   }
    // });

  // http://stackoverflow.com/questions/4652734/return-html-from-a-user-selection/4652824#4652824
  // function getSelectionHtml() {
  //     var html = "";
  //     if (typeof window.getSelection != "undefined") {
  //         var sel = window.getSelection();
  //         if (sel.rangeCount) {
  //             var container = document.createElement("div");
  //             for (var i = 0, len = sel.rangeCount; i < len; ++i) {
  //                 container.appendChild(sel.getRangeAt(i).cloneContents());
  //             }
  //             html = container.innerHTML;
  //         }
  //     } else if (typeof document.selection != "undefined") {
  //         if (document.selection.type == "Text") {
  //             html = rangy.createRange().htmlText;
  //         }
  //     }
  //     return html;
  // }

  // Split the text in half at the current cursor position. Each half
  // will be valid markup with balanced tags.
  function splitAtCursor() {
    // Strategy: insert a special span, then go looking for it in the markup.
    // Since different browsers generate slightly different expansions of the markup,
    // we then have to look for the opening < and closing </span> to locate the
    // text before and after the insertion point. We then determine the tags that
    // are open at the insertion point and make sure we close them in the
    // 'before' segment and re-open them at the start of the 'after' segment so
    // both are valid markup.
    var pivot = '<span data-split-awoiehjfjawivjweoivjiowfjajoiwij></span>';
    insertHtmlAtCursor(pivot);
    var html = self.html();
    var offset = html.indexOf('awoiehjfjawivjweoivjiowfjajoiwij');
    if (offset === -1)
    {
      before = html;
      after = '';
    }
    else
    {
      var before = html.substr(0, offset);
      var after = html.substr(offset);
      var open = before.lastIndexOf('<');
      before = before.substr(0, open);
      var openTags = getOpenTags(before);
      before += closeOpenTags(openTags);
      var close = after.indexOf('</span>');
      after = openTags.join('') + after.substr(close + '</span>'.length);
    }
    return { before: before, after: after };
  }

  // This assumes well-behaved HTML, but that's what
  // contentEditable produces in modern browsers.
  function getOpenTags(html) {
    var openTags = [];
    var passes = 0;
    while (html.length) {
      passes++;
      var open = html.indexOf('<');
      if (open === -1) {
        return openTags;
      }
      if (html[open + 1] && (html[open + 1] === '/')) {
        openTags.pop();
        html = html.substr(open + 2);
        var close = html.indexOf('>');
        if (close === -1) {
          // That should not happen, but...
          return openTags;
        }
        html = html.substr(close + 1);
      }
      else
      {
        var close = html.indexOf('>');
        if (close === -1) {
          // That should not happen, but...
          return openTags;
        }
        if (close > 0) {
          var slash = html[close - 1];
          if (slash === '/') {
            html = html.substr(close + 1);
            continue;
          }
        }
        // Modern editors still insert <br> rather than <br />, chrome anyway ):
        var tag = html.substr(open, close - open + 1);
        if (tag !== '<br>') {
          openTags.push(tag);
        }
        html = html.substr(close + 1);
      }
    }
    return openTags;
  }

  function closeOpenTags(openTags) {
    var i;
    var s = '';
    for (i = 0; (i < openTags.length); i++) {
      var tag = openTags[i];
      var matches = tag.match(/^<(\w+)/);
      if (matches) {
        s += '</' + matches[1] + '>';
      }
    }
    return s;
  }

  // Unit test of the above
  // var openTags = getOpenTags('<p class="foo"><b><img src="whatever.jpg" />Woo.');
  // var openTags = getOpenTags('This is some <b>sample&nbsp;</b><div><b><br></b></div><div><b>');

  // var blocks = [ 'p', 'pre', 'h4' ];

  // function openAnother(block) {
  //   var sel = rangy.getSelection();
  //   if (!sel.rangeCount) {
  //     return;
  //   }
  //   var range = sel.getRangeAt(0);
  //   var current = range.startContainer;
  //   while (true) {
  //     if (_.has(blocks, current)) {
  //       break;
  //     }
  //     current = current.parentNode;
  //   }
  //   if (!current) {
  //     insertHtmlAtCursor('<' + block + '></' + block + '>');
  //   }
  // }


// executing editor commands programmatically is no fun

      // Doing this programmatically is a monster

      // var node = rangy.getSelection().getRangeAt(0).startContainer;
      // if (node.nodeType === 3) {
      //   node = 
      // }
      // while (node) {
      //   console.log(node);
      //   console.log(rangy.getSelection().getRangeAt(0).startOffset);
      //   if (node.nodeName.toLowerCase() === 'div') {
      //     console.log('switching to h4');
      //     var html = $(node).html();
      //     var h4 = $('<h4></h4>');
      //     $(node).replaceWith(h4);
      //     h4.html(html);
      //     return;
      //   } else if (node.nodeName.toLowerCase() === 'h4') {
      //     console.log('switching to div');
      //     var html = $(node).html();
      //     var div = $('<div></div>');
      //     $(node).replaceWith(div);
      //     div.html(html);
      //     return;
      //   }
      //   node = node.parentNode;
      // }
      // // ?
      // return;


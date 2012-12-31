# Jot

Jot is a rich content editor. In addition to rich text, jot allows you to add rich media to documents. 

Jot introduces "widgets," separate editors for rich media items like photos, videos, pullquotes and code samples. Jot's widgets handle these items much better than a rich text editor on its own.

Jot also supports floating content properly, including wrapping text around images and video. Unlike other rich text editors, Jot addresses the usability problems that go with floating content. Jot users can see exactly where to add text above the floated element and where to add text after it so that it wraps around. Jot users can also easily select, cut, copy and paste rich content widgets exactly as if they were part of the text, without breaking them. You can even copy a video widget from one page of a site to another.

To sum up: Jot's rich media widgets are independently edited, but they are also part of the flow of a rich text document, with robust support for floating them if desired and displaying them at various well-chosen sizes. This is the major advantage of Jot over other rich text editors.

## Requirements

Jot is intended to work in all major browsers from IE7 up, with best results in modern browsers such as recent versions of Firefox and Chrome. Of course the content you create with Jot could work with any browser.

Jot's server-side components are built in Node. Although in principle browser-side components of Jot could talk to other languages, right now a close partnership with Node code on the server is driving the flow of development (in other words, I like it).

Jot's server-side code uses uploadfs to store media files. uploadfs allows you to decide whether to keep them in a local filesystem, Amazon S3 or a custom backend.

Jot currently requires Twitter Bootstrap and FontAwesome. That will probably change, because Bootstrap is a big requirement for a rich content editor to force on an entire project. Jot definitely requires Underscore, jQuery and Rangy. Rangy makes working with contentEditable something a sane person would even consider.

## Coding With Jot


## Conclusion and Contact Information

That's it! That should be all you need. If not, open an issue on github and we'll talk.

Tom Boutell

[http://github.com/boutell/jot](http://github.com/boutell/jot)

[justjs.com](http://justjs.com)

[@boutell](http://twitter.com/boutell)

[tom@punkave.com](mailto:tom@punkave.com)

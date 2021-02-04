module.exports = function(self, options) {
  return {
    parse(parser, nodes, lexer) {
      const start = parser.tokens.index;
      const symbolToken = parser.nextToken();
      const args = parser.parseSignature(null, true);

      // We need to capture the body source code, not parse it. For that
      // we borrow this technique:
      // https://github.com/allmarkedup/nunjucks-with/blob/master/index.js

      const current = parser.tokens.index;
      // fast backup to where we started
      parser.tokens.backN(current - start);
      // slow backup to before block open
      while (parser.tokens.current() !== '{') {
        parser.tokens.back();
      }
      // clear saved peek
      parser.peeked = null;
      // peek up to block end
      let peek;
      while ((peek = parser.peekToken())) {
        if (peek.type === lexer.TOKEN_BLOCK_END) {
          break;
        }
        parser.nextToken();
      }
      // the length of the block end
      parser.tokens.backN(2);
      // fake symboltok to fool advanceAfterBlockEnd name detection in parseRaw
      parser.peeked = symbolToken;
      // we are right up to the edge of end-block, so we are "in_code"
      parser.tokens.in_code = true;
      // get the raw body!
      const body = parser.parseRaw('program');
      // TODO prepend body somehow
      return {
        args,
        blocks: [ body ]
      };
    },
    run(context, ...rest) {
      const req = context.env.opts.req;
      const body = rest[rest.length - 1];
      const [ name, ...args ] = rest.slice(0, rest.length - 1);
      req.aposPrograms = req.aposPrograms || {};
      req.aposPrograms[name] = {
        body,
        args
      };
      return '';
    }
  };
};

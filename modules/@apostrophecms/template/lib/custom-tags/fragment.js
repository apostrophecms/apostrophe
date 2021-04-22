module.exports = function(self) {
  return {
    parse(parser, nodes, lexer) {
      try {
        const start = parser.tokens.index;
        const symbolToken = parser.nextToken();
        const primary = parser.parsePrimary(true);
        const args = parser.parseSignature();
        args.addChild(primary);
        args.children = args.children.map(child => {
          const node = new nodes.Literal(child.lineno, child.colno, child.value);
          return node;
        });
        parser.advanceAfterBlockEnd(symbolToken.value);
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
        const body = parser.parseRaw('fragment');
        // TODO prepend body somehow
        return {
          args,
          blocks: [ body ]
        };
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    run(context, ...rest) {
      try {
        const body = rest.pop();
        const name = rest.pop();
        context.setVariable(name, (...args) => {
          return {
            body,
            args,
            params: rest,
            context
          };
        });
        if (name.charAt(0) !== '_') {
          context.addExport(name);
        }
        return '';
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
  };
};

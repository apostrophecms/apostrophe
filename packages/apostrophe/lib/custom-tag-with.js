// The parser shared by the custom tags that accept two arguments followed by
// an optional `with` clause, i.e.
//
// {% area data.page, 'areaName' with { ... } %}
// {% field data.page, 'fieldName' with { ... } %}
//
// `usage` is a function that accepts a message and returns an error explaining
// the correct syntax for the tag in question. `noun` names what the tag
// renders, for the benefit of error messages.

module.exports = function(usage, noun) {
  return function parse(parser, nodes, lexer) {
    // get the tag token
    const token = parser.nextToken();

    const args = new nodes.NodeList(token.lineno, token.colno);
    let argsCount = 0;

    while (true) {
      // get the arguments before "with"
      const object = parser.parseExpression();

      if (argsCount < 2) {
        args.addChild(object);
        argsCount++;
      } else {
        const argList = args.children;
        if (
          argList && argList[1] &&
          typeof argList[1].value === 'string'
        ) {
          throw usage(`Too many arguments were passed to the "${argList[1].value}" ${noun} before the "with" keyword.`);
        } else {
          throw usage(`Too many arguments were passed to a${(noun === 'area') ? 'n' : ''} ${noun} before the "with" keyword.`);
        }
      }

      const w = parser.peekToken();
      if (!(w.type === 'comma')) {
        break;
      }
      parser.nextToken();
    }

    const w = parser.peekToken();
    if ((w.type === 'symbol') && (w.value === 'with')) {
      parser.nextToken();
      const _with = parser.parseExpression();
      args.addChild(_with);
    }
    parser.advanceAfterBlockEnd(token.value);
    return { args };
  };
};

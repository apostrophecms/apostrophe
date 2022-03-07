// Can't make this work
// const utils = require('@vue/component-compiler-utils');
const parser = require('node-html-parser');
const compiler = require('vue-template-compiler');
// Without this the render functions contain with(), which breaks
// strict mode. That's why vue-loader also uses it
const strictifier = require('vue-template-es2015-compiler');
const sass = require('sass');

module.exports = function(source) {
  const parsed = parser.parse(source);
  let child = parsed.firstChild;
  let output = '';
  // console.log(this._module);
  while (child) {
    if (child.tagName === 'TEMPLATE') {
      console.log('>> template');
      const rawCode = compiler.compile(child.innerHTML).render;
      console.log(rawCode);
      output += strictifier(
        `var render = function (h) {${rawCode}};`
      );
    } else if (child.tagName === 'SCRIPT') {
      console.log('>> script');
      output += child.textContent;
    } else if (child.tagName === 'STYLE') {
      console.log('>> style');
      output += sassLoader(child.textContent);
    } else if (child.tagName) {
      console.log(`==> ${child.tagName}`);
    } else {
      console.log(child);
    }
    child = child.nextElementSibling;
    console.log(!!child);
  }
  // console.log('>>>', output);
  return output;

  return '';
  // const templateContent = parsed.template.content;
  // const templateOutput = utils.compileTemplate({ source: templateContent, compiler });
  // console.log('###', templateOutput);

  // const output = utils.compileTemplate({ source: parsed.template.content, compiler }).code + '\n' +
  //   ((utils.script && utils.script.content) || '') + '\n' +
  //   parsed.styles.map(style => utils.compileStyle({ source: style.content }).code).join('\n');

  // console.log('===>');
  // console.log(output);
  // return output;
}

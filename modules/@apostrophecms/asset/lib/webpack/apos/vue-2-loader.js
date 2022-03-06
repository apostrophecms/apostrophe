// Can't make this work
// const utils = require('@vue/component-compiler-utils');
const parser = require('node-html-parser');
const compiler = require('vue-template-compiler');
const sass = require('sass');

module.exports = function(source) {

  let parsed;
  try {
    parsed = utils.parse({
      source,
      compiler
    });
    console.log('OOOOO:', !!parsed.template, !!parsed.script);
  } catch (e) {
    console.error('XXXXX', e);
    return '';
  }

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

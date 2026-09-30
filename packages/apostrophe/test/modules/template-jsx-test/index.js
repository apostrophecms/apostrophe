module.exports = {
  options: {
    templateData: {
      age: 30,
      multiline: 'first line\nsecond line\n<a href="javascript:alert(\'oh no\')">CSRF attempt</a>',
      multilineSafe: 'first line\nsecond line\n<a href="http://niceurl.com">This is okay</a>'
    }
  }
};

module.exports = {
  html: '<h4>[test string] Resetting your [ another test string ] password on localhost</h4>\n' +
    '<p>Hello cy_admin,</p>\n' +
    '<p>You are receiving this email because a request to reset your password was made on localhost.</p>\n' +
    '<p>If that is your wish, please follow this link to complete the password reset process:</p>\n' +
    '<p><a href="http://localhost:3000/login?reset=clh0f780t0009ezh97wtu03d0&amp;email=admin%40example.com">http://localhost:3000/login?reset=clh0f780t0009ezh97wtu03d0&amp;email=admin%40example.com</a></p>\n' +
    '<p>\n' +
    '  If you did not request to reset your password, please delete and ignore this email. Someone else may have entered\n' +
    '  your email address in error.\n' +
    '</p>\n',
  text: '[test string] RESETTING YOUR [ another test string ] PASSWORD ON LOCALHOST\n' +
    '\n' +
    'Hello cy_admin,\n' +
    '\n' +
    'You are receiving this email because a request to reset your password was made\n' +
    'on localhost.\n' +
    '\n' +
    'If that is your wish, please follow this link to complete the password reset\n' +
    'process:\n' +
    '\n' +
    'http://localhost:3000/login?reset=clh0f780t0009ezh97wtu03d0&email=admin%40example.com\n' +
    // Improved link formatting via hideLinkHrefIfSameAsText option
    // '[http://localhost:3000/login?reset=clh0f780t0009ezh97wtu03d0&email=admin%40example.com]\n' +
    '\n' +
    'If you did not request to reset your password, please delete and ignore this\n' +
    'email. Someone else may have entered your email address in error.',
  from: 'noreply@example.com',
  to: 'admin@example.com',
  subject: 'Your request to reset your password on localhost'
};

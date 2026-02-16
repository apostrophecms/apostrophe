const config = {};

module.exports = config;

config.SHELL_DEPENDS = [ 'git' ];

const REPO_ROOT = 'https://github.com/apostrophecms';
config.BOILERPLATE = `${REPO_ROOT}/public-demo.git`;
config.A2_BOILERPLATE = `${REPO_ROOT}/apostrophe-boilerplate.git`;

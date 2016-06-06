var _ = require('lodash');

function anonReq(apos) {
  return {
    res: {
      __: function(x) { return x; }
    },
    browserCall: apos.app.request.browserCall,
    getBrowserCalls: apos.app.request.getBrowserCalls,
    query: {},
    url: '/'
  };
}

function adminReq(apos) {
  return _.merge(anonReq(apos), {
    user: {
      _id: 'testuser',
      _permissions: {
        admin: true
      }
    }
  });
}

module.exports = {
  req: { anon: anonReq, admin: adminReq }
};

var _ = require('lodash');

module.exports = function(self) {
  self.app.request.traceIn = function(label) {
    if (!process.env.TRACE) {
      return;
    }
    if (!this.traceDepth) {
      this.traceStack = [];
      this.traceDepth = 0;
    }
    var s = '';
    for (var i = 0; (i < this.traceDepth); i++) {
      s += '  ';
    }
    s += label + ' {';
    console.log(s);
    this.traceDepth++;
    this.traceStack.push({ start: Date.now(), label: label });
  };

  self.app.request.traceOut = function() {
    if (!process.env.TRACE) {
      return;
    }
    var frame = this.traceStack.pop();
    if (!this.traceCumulative) {
      this.traceCumulative = {};
    }
    this.traceDepth--;
    var s = '';
    for (var i = 0; (i < this.traceDepth); i++) {
      s += '  ';
    }
    var t = Date.now() - frame.start;
    if (!this.traceCumulative) {
      this.traceCumulative = {};
    }
    if (!this.traceCumulative[frame.label]) {
      this.traceCumulative[frame.label] = 0;
    }
    this.traceCumulative[frame.label] += t;
    s += '} ' + t + ' (' + this.traceCumulative[frame.label] + ')';
    console.log(s);
  };

  self.traceReport = function(req) {
    if (!process.env.TRACE) {
      return;
    }
    var keys = _.keys(req.traceCumulative);
    keys.sort(function(a, b) {
      if (req.traceCumulative[a] > req.traceCumulative[b]) {
        return 1;
      } else if (req.traceCumulative[a] < req.traceCumulative[b]) {
        return -1;
      } else {
        return 0;
      }
    });
    console.log('CUMULATIVE RUNTIME');
    _.each(keys, function(key) {
      console.log(key + ': ' + req.traceCumulative[key]);
    });
    console.log('CUMULATIVE QUERY TIME');
    var queries = req.traceQueries;
    queries.sort(function(a, b) {
      if (a.time > b.time) {
        return 1;
      } else if (b.time > a.time) {
        return -1;
      } else {
        return 0;
      }
    });
    var total = 0;
    _.each(queries, function(query) {
      console.log(query.criteria + ', ' + query.projection + ': ' + query.time + (query.hint ? (' hint: ' + JSON.stringify(query.hint)) : '') + (query.sort ? (' sort: ' + JSON.stringify(query.sort)) : ''));
      total += query.time;
    });
    console.log('TOTAL QUERY TIME: ' + total);
  };
};

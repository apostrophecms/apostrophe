function jotWiki() {
  var self = this;
  self.log = function(s) {
    if (console && console.log) {
      console.log(s);
    }
  };
};

window.jotWiki = new jotWiki();

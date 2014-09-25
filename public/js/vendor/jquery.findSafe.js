// Thanks to Kate Miháliková for this much simpler implementation!

jQuery.fn.findSafe = function(selector, ignore) {
  return this.find(selector).not(this.find(ignore).find(selector));
};

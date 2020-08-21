
(function() {
  var apos = window.apos;

  apos.notify = async function(message, options) {
    var strings = [];
    var i = 1;
    var index = 0;
    while (true) {
      index = message.indexOf('%s', index);
      if (index === -1) {
        break;
      }
      // Don't match the same one over and over
      index += 2;
      if ((i >= arguments.length) || ((typeof (arguments[i]) === 'object'))) {
        throw new Error('Bad notification call: number of %s placeholders does not match number of string arguments after message');
      }
      strings.push(arguments[i++]);
    }
    if ((i === (arguments.length - 1)) && (typeof (arguments[i]) === 'object')) {
      options = arguments[i++];
    } else {
      options = {};
    }

    if (i !== arguments.length) {
      throw new Error('Bad notification call: number of %s placeholders does not match number of string arguments after message');
    }

    if (options.dismiss === true) {
      options.dismiss = 5;
    }

    // Send it to the server, which will send it back to us via
    // the same long polling mechanism that allows it to reach
    // other tabs, and allows server-sent notifications to
    // reach us

    await apos.http.post(apos.notification.action, {
      body: {
        message,
        strings,
        type: options.type,
        dismiss: options.dismiss,
        pulse: options.pulse,
        id: options.id
      }
    });
  };
})();

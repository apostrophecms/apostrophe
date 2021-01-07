// Global event listener that will emit bus events from anywhere via click
// To use: Create some UI with the below data attributes
// data-apos-bus-event='{"name": "EVENT-NAME", "data": {"FOO": TRUE}}'
// Also accepts a simplified name-only string data-apos-bus-event="NAME"
// `data` parameter is optional, if present will be passed through the emitted event

export default function() {
  document.body.addEventListener('click', (e) => {
    if (e.target.getAttribute('data-apos-bus-event')) {
      const event = e.target.getAttribute('data-apos-bus-event');
      let name;
      let json = {};
      try {
        json = JSON.parse(event);
        name = json.name || false;
      } catch (e) {
        name = event;
      }
      if (name) {
        apos.bus.$emit(name, json.data || null);
      } else {
        console.error('Apostrophe bus events require a name');
        apos.notify('Something went wrong', { type: 'error' });
      }
    }
  }, false);
};

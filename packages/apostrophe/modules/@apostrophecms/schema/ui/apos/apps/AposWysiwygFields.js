import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import getFieldById from 'Modules/@apostrophecms/schema/lib/getFieldById';
import { nextTick } from 'vue';

// Mounts an editor on every field rendered in place by the `{% field %}`
// custom tag, in the same manner as `AposAreas` does for areas.
//
// Areas are excluded: the `{% field %}` tag renders those with the `{% area %}`
// tag, so `AposAreas` has already claimed them.

export default function() {
  const mountedApps = new Map();

  createFieldApps();

  apos.bus.$on('refreshed', function() {
    createFieldApps();
  });

  // A field of a widget is rendered by the area editor, not by us, and it
  // arrives well after the page does. Take our turn each time
  apos.bus.$on('widget-rendered', function({ edit = true, el = null } = {}) {
    if (edit) {
      createFieldApps(el);
    }
  });

  function createFieldApps(el) {
    const els = (el || document).querySelectorAll('[data-apos-wysiwyg-field-newly-editable]');
    for (const el of els) {
      // Widgets in an editable area belong to the area editor: it lifts their
      // markup out of the page, so anything we mounted in it would be lost.
      // We'll get our chance when it emits `widget-rendered`
      if (el.closest('[data-apos-widget], [data-apos-area-newly-editable]')) {
        continue;
      }
      createFieldApp(el);
    }
    nextTick(() => {
      cleanupOrphanedApps();
    });
  }

  function createFieldApp(el) {
    // The definition is not in the markup: the page already carries the
    // schema of every doc type and widget type on it, so the field is named
    // by its id and looked up there
    const fieldId = el.getAttribute('data-field-id');
    const field = getFieldById(fieldId);
    const value = JSON.parse(el.getAttribute('data-value'));
    const options = JSON.parse(el.getAttribute('data-options') || '{}') || {};
    const docId = el.getAttribute('data-doc-id');
    const patchKey = el.getAttribute('data-patch-key');
    const componentName = el.getAttribute('data-component');
    // `undefined` rather than null, so that the wrapper's own default applies
    const icon = el.getAttribute('data-icon') || undefined;

    // Just like an area, a field of a document other than the one being
    // edited on this page is displayed but not editable here. Edit it on
    // its own page, or in a modal.
    //
    // Which document that is can change without this element being
    // re-rendered: the context bar restores the draft mode it remembers for
    // the tab after the page has already been rendered in the other mode, so
    // a pass that lands in between compares against a context id that is
    // about to change. Leave the element eligible rather than consuming it,
    // so the next pass can reconsider — an area recomputes `foreign` for the
    // same reason instead of settling it once and for all
    if (!docId || (docId !== apos.adminBar?.contextId)) {
      el.setAttribute('data-apos-wysiwyg-field-foreign', true);
      return;
    }
    el.removeAttribute('data-apos-wysiwyg-field-foreign');

    // Nothing below here can start answering differently on its own, so this
    // element is ours whatever happens next
    el.removeAttribute('data-apos-wysiwyg-field-newly-editable');

    // The schema in the browser is the schema this user is allowed to see,
    // so a field `allowedSchema` held back simply isn't in it. The value the
    // page rendered stays where it is, read only, as it would be for anyone
    // who cannot edit it
    if (!field) {
      el.setAttribute('data-apos-wysiwyg-field-foreign', true);
      return;
    }

    const component = apos.vueComponents[componentName];
    if (!component) {
      // eslint-disable-next-line no-console
      console.error(`There is no ${componentName} component, so the ${field.name} field cannot be edited in place.`);
      return;
    }

    el.setAttribute('data-apos-wysiwyg-field-editable', true);

    let created = false;
    let observer;

    const rect = el.getBoundingClientRect();
    const isInViewport = rect.bottom >= 0 && rect.top <= window.innerHeight;

    if (isInViewport) {
      mountApp();
    } else {
      // Editors are expensive, especially rich text. Wait until the user
      // is near the field, exactly as areas do
      observer = new IntersectionObserver(observed, {
        rootMargin: '600px'
      });
      observer.observe(el);
    }

    function observed(entries) {
      if (!entries[0].isIntersecting) {
        return;
      }
      if (!created) {
        mountApp();
      }
      observer.disconnect();
    }

    function mountApp() {
      // A field the page rendered inline, e.g. `with { tag: 'span' }`, has to
      // be edited inline: a block box here would drop the value onto a line
      // of its own, taking everything after it along. Asked now rather than
      // at render time, since only the browser knows what the site's own CSS
      // made of the tag
      const inline = window.getComputedStyle(el).display === 'inline';

      // The editor is wrapped, never mounted on its own: the wrapper is what
      // gives every field on the page the breadcrumb trail that says what it
      // is, and the outline that says it can be edited at all
      const app = createApp(apos.vueComponents.AposWysiwygField, {
        component: componentName,
        icon,
        inline,
        field,
        modelValue: value,
        docId,
        patchKey,
        options
      });
      app.mount(el);
      mountedApps.set(el, app);
      created = true;
    }
  }

  function cleanupOrphanedApps() {
    for (const el of mountedApps.keys()) {
      if (!document.body.contains(el)) {
        unmountApp(el);
      }
    }
  }

  function unmountApp(el) {
    const app = mountedApps.get(el);
    if (app) {
      try {
        app.unmount();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error unmounting Vue app:', error);
      }
      mountedApps.delete(el);
    }
  }
}

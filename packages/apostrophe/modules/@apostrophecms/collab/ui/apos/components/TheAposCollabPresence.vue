<template>
  <div
    v-if="people.length"
    class="apos-collab-presence"
    data-apos-test="collabPresence"
  >
    <button
      v-for="person in people"
      :key="person.tabId"
      type="button"
      class="apos-collab-presence__person"
      :style="{ '--apos-collab-color': person.color }"
      :title="person.title"
      :aria-label="person.title"
      @click="show(person)"
    >
      {{ person.initials }}
    </button>
  </div>
</template>

<script>
// Who else is editing the document on this page, as a row of initials in
// the context bar, in each person's color. Clicking someone shows what they
// last did.
//
// Also points out, on the page itself, what each person does as they do it
// (a marker that fades away, see `_collab.scss`), and which widget or field
// each person is working in right now.
import { mapState } from 'pinia';
import { useCollabStore } from 'Modules/@apostrophecms/collab/stores/collab.js';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';

export default {
  name: 'TheAposCollabPresence',
  data() {
    return {
      // Tab ids to the element marked as where that person is working
      focused: {}
    };
  },
  computed: {
    ...mapState(useCollabStore, [ 'collaborators' ]),
    // One each, however many tabs they have open, and not ourselves: the
    // markers still show what each tab does
    people() {
      const me = apos.login?.user?._id;
      const people = new Map();
      for (const person of Object.values(this.collaborators)) {
        if (person.userId === me) {
          continue;
        }
        const existing = people.get(person.userId);
        const latest = person.lastAction?.at || 0;
        if (!existing || (latest > (existing.lastAction?.at || 0))) {
          people.set(person.userId, person);
        }
      }
      return [ ...people.values() ].sort((a, b) => a.title.localeCompare(b.title));
    }
  },
  watch: {
    collaborators: {
      handler(next, previous = {}) {
        for (const person of Object.values(next)) {
          const before = previous[person.tabId];
          if (person.lastAction && (person.lastAction.at !== before?.lastAction?.at)) {
            if (!person.lastAction.quiet) {
              this.mark(person, person.lastAction);
            }
          }
        }
        this.updateFocus();
      },
      deep: true
    }
  },
  mounted() {
    apos.bus.$on('widget-rendered', this.updateFocus);
    apos.bus.$on('refreshed', this.updateFocus);
  },
  beforeUnmount() {
    apos.bus.$off('widget-rendered', this.updateFocus);
    apos.bus.$off('refreshed', this.updateFocus);
    for (const el of Object.values(this.focused)) {
      this.unfocus(el);
    }
  },
  methods: {
    // The element on the page `target` refers to: a field edited in place,
    // a widget, or failing that the widget next to where one was
    find(target) {
      if (!target) {
        return null;
      }
      const selectors = [];
      if (target.patchKey) {
        selectors.push(`[data-apos-wysiwyg-field-editable][data-patch-key="${CSS.escape(target.patchKey)}"]`);
      }
      for (const id of [ target.widgetId, target.anchorId ]) {
        if (id) {
          selectors.push(`[data-apos-widget-id="${CSS.escape(id)}"]`);
        }
      }
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          return el;
        }
      }
      return null;
    },
    decorate(el, person) {
      el.style.setProperty('--apos-collab-color', person.color);
      el.setAttribute('data-apos-collab-name', person.title);
      if (window.getComputedStyle(el).position === 'static') {
        el.classList.add('apos-collab-positioned');
      }
    },
    // Point out what someone just did. The marker fades away by itself
    mark(person, target) {
      const el = this.find(target);
      if (!el) {
        return;
      }
      this.decorate(el, person);
      el.classList.remove('apos-collab-marker');
      // Reading the layout restarts the animation if it is running
      el.getBoundingClientRect();
      el.classList.add('apos-collab-marker');
      clearTimeout(el.aposCollabMarkerTimeout);
      el.aposCollabMarkerTimeout = setTimeout(() => {
        el.classList.remove('apos-collab-marker');
        if (!el.classList.contains('apos-collab-focus')) {
          el.classList.remove('apos-collab-positioned');
        }
      }, 5000);
    },
    // Outline where each person is working, taking the outline off where
    // they no longer are
    updateFocus() {
      const next = {};
      for (const person of Object.values(this.collaborators)) {
        const awareness = person.awareness;
        const el = awareness && this.find({
          patchKey: awareness.key,
          widgetId: awareness.widgetId
        });
        if (el) {
          next[person.tabId] = el;
          this.decorate(el, person);
          el.classList.add('apos-collab-focus');
        }
      }
      for (const [ tabId, el ] of Object.entries(this.focused)) {
        if (next[tabId] !== el && !Object.values(next).includes(el)) {
          this.unfocus(el);
        }
      }
      this.focused = next;
    },
    unfocus(el) {
      el.classList.remove('apos-collab-focus');
      if (!el.classList.contains('apos-collab-marker')) {
        el.classList.remove('apos-collab-positioned');
      }
    },
    // Scroll to what someone last did and point it out again
    show(person) {
      const target = person.lastAction || (person.awareness && {
        patchKey: person.awareness.key,
        widgetId: person.awareness.widgetId
      });
      const el = this.find(target);
      if (!el) {
        return;
      }
      const widgetStore = useWidgetStore();
      if (!widgetStore.isElementInView(el)) {
        widgetStore.scrollToElement(el);
      }
      this.mark(person, target);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-collab-presence {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    margin-right: $spacing-base;
  }

  .apos-collab-presence__person {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-left: -4px;
    padding: 0;
    border: 2px solid var(--a-background-primary);
    border-radius: 50%;
    background-color: var(--apos-collab-color);
    color: #fff;
    font-size: var(--a-type-small);
    font-weight: var(--a-weight-bold);
    cursor: pointer;

    &:first-child {
      margin-left: 0;
    }

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: 1px;
    }
  }
</style>

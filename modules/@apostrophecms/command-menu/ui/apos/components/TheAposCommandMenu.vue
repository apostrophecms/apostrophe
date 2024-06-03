<template>
  <div
    class="apos-command-menu"
    :class="themeClass"
  >
    <!-- nothing for the moment -->
  </div>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

export default {
  name: 'TheAposCommandMenu',
  mixins: [ AposThemeMixin ],
  props: {
    modals: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  data() {
    return {
      previousKey: '',
      modal: 'default'
    };
  },
  computed: {
    ...mapState(useModalStore, [ 'stack' ]),
    shortcuts() {
      const modals = Object.values(this.modals[this.modal] || {});

      return Object.fromEntries(
        modals
          .flatMap(group => {
            return Object.values(group.commands)
              .filter(command => command.shortcut)
              .flatMap(command => {
                return command.shortcut
                  .split(' ')
                  .map(shortcut => [ shortcut.toUpperCase(), command.action ]);
              });
          })
      );
    }
  },
  watch: {
    stack(newStack) {
      this.modal = this.getFirstNonShortcutModal();
    }
  },
  mounted() {
    apos.bus.$on('@apostrophecms/command-menu:open-modal', async state => {
      await apos.modal.execute(state.name, state.props);
    });

    document.addEventListener('keydown', this.keyboardShortcutListener.bind(this));
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.keyboardShortcutListener);
  },
  methods: {
    ...mapActions(useModalStore, [ 'getAt', 'getProperties' ]),
    delay(resolve, ms) {
      return new Promise(() => {
        setTimeout(resolve, ms);
      });
    },
    getModal() {
      return this.modal;
    },
    getFirstNonShortcutModal(index = -1) {
      const modal = this.getAt(index);
      const properties = this.getProperties(modal.id);

      return properties.itemName === '@apostrophecms/command-menu:shortcut'
        ? this.getFirstNonShortcutModal(index + -1)
        : properties.itemName || 'default';
    },
    keyboardShortcutListener(event) {
      if (event.target.nodeName !== 'INPUT' && event.target.nodeName !== 'TEXTAREA' && document.activeElement.contentEditable !== 'true') {
        const key = [
          [ 'ALT', event.altKey ],
          [ 'CTRL', event.ctrlKey ],
          [ 'META', event.metaKey ],
          [ 'SHIFT', event.shiftKey ],
          [ 'KEY', event.key.toUpperCase() ]
        ]
          .filter(([ , value ]) => value)
          .map(([ key, value ]) => key === 'KEY' ? value : key)
          .join('+');

        const keys = this.previousKey
          ? `${this.previousKey},${key}`
          : key;

        const action = this.shortcuts[keys] ||
          this.shortcuts[keys.startsWith('SHIFT+')
            ? keys.slice('SHIFT+'.length)
            : keys];
        if (action) {
          event.preventDefault();
          apos.bus.$emit(action.type, action.payload);
          return;
        }

        if (event.key.length === 1) {
          this.previousKey = event.key.toUpperCase();
          this.delay(() => {
            this.previousKey = '';
          }, 1000);
        }
      }
    }
  }
};
</script>

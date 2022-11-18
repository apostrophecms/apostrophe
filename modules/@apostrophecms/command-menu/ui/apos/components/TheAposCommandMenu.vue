<template>
  <div
    class="apos-command-menu"
    :class="themeClass"
  >
    <!-- <AposCommandMenuShortcut /> -->
  </div>
</template>

<script>
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';
export default {
  name: 'TheAposCommandMenu',
  mixins: [ AposThemeMixin ],
  props: {
    groups: {
      type: Object,
      default() {
        return {};
      }
    }
    // shortcuts: {
    //   type: Object,
    //   default() {
    //     return {
    //       [[ 'Shift', 'K' ].join('+')]: { type: 'command-menu-shortcut-list', payload: null },
    //       [[ 'Alt', 'K' ].join('+')]: { type: 'combination', payload: { value: 'this is a combination' } },
    //       [[ 'G', 'K' ].join(',')]: { type: 'sequence', payload: { value: 'this is a sequence' } }
    //     };
    //   }
    // }
  },
  data() {
    return {
      previousKey: '',
      keyboardShortcutListener() {},
      delay(resolve, ms) {
        return new Promise(() => {
          setTimeout(resolve, ms);
        });
      }
    };
  },
  computed: {
    shortcuts() {
      return Object.fromEntries(
        Object.values(this.groups)
          .flatMap(group => {
            return Object.values(group.fields)
              .filter(field => field.shortcut)
              .map(field => {
                return [ field.shortcut, field.action ];
              });
          })
      );
    }
  },
  mounted() {
    apos.bus.$on('open-modal', async state => {
      await apos.modal.execute(state.name, state.payload);
      // 'AposCommandMenuShortcut', { moduleName: '@apostrophecms/command-menu' });
    });
    apos.bus.$on('command-menu-shortcut-list', async state => {
      await apos.modal.execute('AposCommandMenuShortcut', { moduleName: '@apostrophecms/command-menu' });
    });
    apos.bus.$on('combination', state => {
      console.log({ event: 'combination', state });
    });
    apos.bus.$on('sequence', state => {
      console.log({ event: 'sequence', state });
    });

    this.keyboardShortcutListener = (event) => {
      const key = // Object.fromEntries(
        [
          [ 'Alt', event.altKey ],
          [ 'Ctrl', event.ctrlKey ],
          [ 'Meta', event.metaKey ],
          [ 'Shift', event.shiftKey ],
          [ 'key', event.key.length === 1 ? [ this.previousKey, event.key.toUpperCase() ].filter(value =>
            value).join(',') : event.key.toUpperCase() ]
        ]
          .filter(([ , value ]) => value)
          .map(([ key, value ]) => key === 'key' ? value : key)
          .join('+');
      // );
      const action = this.shortcuts[key] || this.shortcuts[key.startsWith('Shift+') ? key.slice('Shift+'.length) : key];
      if (action) {
        console.log({ key, event });
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
      console.log({ key, event });
    };

    document.addEventListener('keydown', this.keyboardShortcutListener.bind(this));
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.keyboardShortcutListener);
  },
  methods: {
  }
};
</script>

<style lang="scss" scoped>
</style>

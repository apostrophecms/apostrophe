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
              .flatMap(field => {
                return field.shortcut
                  .split(' ')
                  .map(shortcut => [ shortcut, field.action ]);
              });
          })
      );
    }
  },
  mounted() {
    apos.bus.$on('open-modal', async state => {
      await apos.modal.execute(state.name, state.props);
    });

    this.keyboardShortcutListener = (event) => {
      const key = [
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

      const action = this.shortcuts[key] || this.shortcuts[key.startsWith('Shift+') ? key.slice('Shift+'.length) : key];
      console.log({ action, key }); // TODO remove
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
    };

    document.addEventListener('keydown', this.keyboardShortcutListener.bind(this));
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.keyboardShortcutListener);
  }
};
</script>

<style lang="scss" scoped>
</style>

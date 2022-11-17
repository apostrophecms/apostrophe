<template>
  <div
    class="apos-command-menu"
    :class="themeClass"
    :tabindex="-1"
    @keydown.prevent.arrow-up="test(10)"
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
    shortcuts: {
      type: Object,
      default() {
        return {
          [[ 'Shift', 'K' ].join('+')]: { type: 'custom-event', payload: { value: 'test' } },
          [[ 'G', 'K' ].join(',')]: { type: 'sequence', payload: { value: 'this is a sequence' } }
        };
      }
    }
  },
  data() {
    return {
      keyboardShortcutListener() {},
      previousKey: '',
      async delay(resolve, ms) {
        return new Promise(() => {
          setTimeout(resolve, ms);
        });
      }
    };
  },
  mounted() {
    apos.bus.$on('custom-event', state => {
      console.log({ event: 'custom-event', state });
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
      const action = this.shortcuts[key];
      if (action) {
        event.preventDefault();
        apos.bus.$emit(action.type, action.payload);
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
  },
  methods: {
    test(event) {
      console.log(event.key);
    }
  }
};
</script>

<style lang="scss" scoped>
</style>

<template>
  <div class="apos-command-menu-keys">
    <AposCommandMenuKey
      v-for="key in keys"
      :key="key.icon || key.label"
      :label="key.label"
      :icon="key.icon"
    />
  </div>
</template>

<script>
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin'; // TODO keep?

export default {
  name: 'AposCommandMenuKeyList',
  mixins: [ AposThemeMixin ], // TODO keep?
  props: {
    shortcut: {
      type: String,
      default: ''
    }
  },
  computed: {
    keys() {
      const [ shortcut ] = this.shortcut.split(' ');
      const iconMapping = {
        meta: 'apple-keyboard-command',
        command: 'apple-keyboard-command',
        cmd: 'apple-keyboard-command',
        caps: 'apple-keyboard-caps',
        capslock: 'apple-keyboard-caps',
        control: 'apple-keyboard-control',
        ctrl: 'apple-keyboard-control',
        option: 'apple-keyboard-option',
        alt: 'apple-keyboard-option',
        shift: 'apple-keyboard-shift',
        backspace: 'keyboard-backspace',
        escape: 'keyboard-esc',
        esc: 'keyboard-esc',
        enter: 'keyboard-return',
        return: 'keyboard-return',
        ' ': 'keyboard-space',
        space: 'keyboard-space',
        tab: 'keyboard-tab',
        f1: 'keyboard-f1',
        f10: 'keyboard-f10',
        f11: 'keyboard-f11',
        f12: 'keyboard-f12',
        f2: 'keyboard-f2',
        f3: 'keyboard-f3',
        f4: 'keyboard-f4',
        f5: 'keyboard-f5',
        f6: 'keyboard-f6',
        f7: 'keyboard-f7',
        f8: 'keyboard-f8',
        f9: 'keyboard-f9',
        arrowdown: '',
        arrowleft: '',
        arrowright: '',
        arrowup: ''
      };
      const keyMapping = {
        delete: 'del',
        pagedown: 'pgdn',
        pageup: 'pgup'
      };

      return shortcut
        .split('+')
        .map(key => {
          const icon = iconMapping[key.toLowerCase()];

          return {
            icon,
            label: icon
              ? null
              : (keyMapping[key.toLowerCase()] || key).toLowerCase()
          };
        });
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-command-menu-keys {
  display: inline-flex;
}

</style>

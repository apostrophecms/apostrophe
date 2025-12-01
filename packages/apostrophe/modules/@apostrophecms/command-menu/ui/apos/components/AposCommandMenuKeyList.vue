<template>
  <div class="apos-command-menu-keys">
    <AposCommandMenuKey
      v-for="(key, index) in keys"
      :key="index"
      :label="key.label"
      :icon="key.icon"
      :text-only="key.textOnly"
    />
  </div>
</template>

<script>
export default {
  name: 'AposCommandMenuKeyList',
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
        ' ': 'keyboard-space',
        alt: 'apple-keyboard-option',
        arrowdown: 'arrow-down-icon',
        arrowleft: 'arrow-left-icon',
        arrowright: 'arrow-right-icon',
        arrowup: 'arrow-up-icon',
        backspace: 'keyboard-backspace',
        caps: 'apple-keyboard-caps',
        capslock: 'apple-keyboard-caps',
        cmd: 'apple-keyboard-command',
        command: 'apple-keyboard-command',
        control: 'apple-keyboard-control',
        ctrl: 'apple-keyboard-control',
        enter: 'keyboard-return',
        esc: 'keyboard-esc',
        escape: 'keyboard-esc',
        f10: 'keyboard-f10',
        f11: 'keyboard-f11',
        f12: 'keyboard-f12',
        f1: 'keyboard-f1',
        f2: 'keyboard-f2',
        f3: 'keyboard-f3',
        f4: 'keyboard-f4',
        f5: 'keyboard-f5',
        f6: 'keyboard-f6',
        f7: 'keyboard-f7',
        f8: 'keyboard-f8',
        f9: 'keyboard-f9',
        meta: 'apple-keyboard-command',
        option: 'apple-keyboard-option',
        return: 'keyboard-return',
        shift: 'apple-keyboard-shift',
        space: 'keyboard-space',
        tab: 'keyboard-tab'
      };
      const keyMapping = {
        delete: 'del',
        pagedown: 'pgdn',
        pageup: 'pgup'
      };

      return shortcut
        .split('+')
        .flatMap(this.then)
        .map(key => {
          if (key === 'then') {
            return {
              icon: null,
              label: 'apostrophe:commandMenuKeyThen',
              textOnly: true
            };
          }

          const icon = iconMapping[key.toLowerCase()];

          return {
            icon,
            label: icon
              ? null
              : (keyMapping[key.toLowerCase()] || key).toLowerCase()
          };
        });
    }
  },
  methods: {
    then(keys) {
      return keys.includes(',')
        ? keys.split(',').flatMap(key => [ key, 'then' ]).slice(0, -1)
        : keys;
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-command-menu-keys {
  display: inline-flex;
}

</style>

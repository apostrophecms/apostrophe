<template>
  <div class="apos-context-menu">
    <slot name="prebutton" />
    <v-popover
      @hide="hide"
      @show="show"
      :offset="menuOffset"
      trigger="manual"
      :placement="menuPlacement"
      :open="isOpen"
      :delay="{ show: 0, hide: 0 }"
      :popover-class="popoverClass"
      popover-wrapper-class="apos-popover__wrapper"
      popover-inner-class="apos-popover__inner"
    >
      <!-- TODO refactor buttons to take a single config obj -->
      <AposButton
        class="apos-context-menu__btn"
        @click="buttonClicked($event)"
        v-bind="button"
        :state="buttonState"
        ref="button"
        :disabled="disabled"
      />
      <template #popover class="apos-popover__slot">
        <AposContextMenuDialog
          :menu-placement="menuPlacement"
          :class-list="classList"
          :menu="menu"
          @item-clicked="menuItemClicked"
        >
          <slot />
        </AposContextMenuDialog>
      </template>
    </v-popover>
  </div>
</template>

<script>
import {
  VPopover
} from 'v-tooltip';
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';

export default {
  name: 'AposContextMenu',
  components: {
    'v-popover': VPopover
  },
  mixins: [ AposThemeMixin ],
  props: {
    menu: {
      type: Array,
      default: null
    },
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    },
    button: {
      type: Object,
      default() {
        return {
          label: 'Context Menu Label',
          iconOnly: true,
          icon: 'label-icon',
          type: 'outline'
        };
      }
    },
    menuPlacement: {
      type: String,
      default: 'bottom'
    },
    menuOffset: {
      type: [ Number, String ],
      default: 15
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'open', 'close', 'item-clicked' ],
  data() {
    return {
      isOpen: false,
      position: '',
      event: null
    };
  },
  computed: {
    popoverClass() {
      return [ 'apos-popover' ].concat(this.themeClass);
    },
    classList() {
      const classes = [];
      const baseClass = 'apos-context-menu__popup';
      classes.push(`${baseClass}--tip-alignment-${this.menuPlacement}`);
      if (this.modifiers) {
        this.modifiers.forEach((m) => {
          classes.push(`${baseClass}--${m}`);
        });
      }
      if (this.menu) {
        classes.push(`${baseClass}--unpadded`);
      }
      return classes.join(' ');
    },
    buttonState() {
      return this.open ? [ 'active' ] : null;
    }
  },
  watch: {
    isOpen(newVal, oldVal) {
      if (newVal) {
        this.$emit('open', this.event);
      } else {
        this.$emit('close', this.event);
      }
    }
  },
  methods: {
    show() {
      this.isOpen = true;
    },
    hide() {
      this.isOpen = false;
    },
    buttonClicked(e) {
      this.isOpen = !this.isOpen;
      this.event = e;
    },
    menuItemClicked(name) {
      this.$emit('item-clicked', name);
      this.hide();
    }
  }
};
</script>

<style lang="scss">

.apos-context-menu {
  position: relative;
}

.apos-context-menu__popup--unpadded .apos-context-menu__pane  {
  padding: 0;
}

.apos-context-menu__popup--tb-padded .apos-context-menu__pane{
  padding-top: 20px;
  padding-bottom: 20px;
}

.apos-context-menu__popup {
  display: inline-block;
  color: var(--a-text-primary);
  transition: scale 0.15s ease, translatey 0.15s ease;
}

.apos-context-menu__inner {
  border-radius: var(--a-border-radius);
  box-shadow: var(--a-box-shadow);
  background-color: var(--a-background-primary);
  border: 1px solid var(--a-base-8);
}

.apos-context-menu__pane {
  @include type-base;
  padding: 20px;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
  box-shadow: var(--a-box-shadow);
  background-color: var(--a-background-primary);
  &:focus {
    outline: none;
  }
}

.apos-context-menu__items {
  @include apos-list-reset();
  display: inline-block;
  list-style-type: none;
  width: max-content;
  margin: none;
  margin-block-start: 0;
  margin-block-end: 0;
  padding: 10px 0;
}

.apos-context-menu {
  & /deep/ .apos-popover__wrapper,
  & /deep/ div:not([class]),
  & /deep/ .apos-context-menu__dialog,
  & /deep/ .apos-popover,
  & /deep/ .apos-popover__inner {
    &:focus {
      outline: none;
    }
  }
}

.apos-popover {
  z-index: $z-index-modal;
  display: block;

  .tooltip-arrow {
    display: none;
  }

  &[x-placement^='top'] {
    margin-bottom: 5px;
  }

  &[x-placement^='bottom'] {
    margin-top: 5px;
  }

  &[x-placement$='end'] {
    margin-right: -15px;
  }

  &[x-placement$='start'] {
    margin-left: -15px;
  }

  &[aria-hidden='true'] {
    visibility: hidden;
    opacity: 0;
  }

  &[aria-hidden='false'] {
    visibility: visible;
    opacity: 1;
  }
}

</style>

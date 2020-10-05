<template>
  <div class="apos-context-menu">
    <slot name="prebutton" />
    <v-popover
      @hide="hide"
      @show="show"
      :offset="menuOffset"
      :placement="menuPlacement"
      trigger="manual"
      :open="isOpen"
      :delay="{ show: 0, hide: 0 }"
      popover-class="apos-popover"
    >
      <!-- TODO refactor buttons to take a single config obj -->
      <AposButton
        class="apos-context-menu__btn"
        @click="buttonClicked($event)"
        v-bind="button"
        :state="buttonState"
        ref="button"
      />
      <template #popover>
        <div
          class="apos-primary-scrollbar apos-context-menu__popup"
          :class="classList"
          ref="popup"
          role="dialog"
        >
          <AposContextMenuTip
            :align="tipAlignment"
            :origin="menuOrigin"
          />
          <div class="apos-context-menu__pane">
            <slot>
              <ul class="apos-context-menu__items" v-if="menu">
                <AposContextMenuItem
                  v-for="item in menu"
                  :key="item.action"
                  :menu-item="item"
                  @clicked="menuItemClicked"
                  :open="isOpen"
                />
              </ul>
            </slot>
          </div>
        </div>
      </template>
    </v-popover>
  </div>
</template>

<script>
import {
  VPopover
} from 'v-tooltip';

export default {
  name: 'AposContextMenu',
  components: {
    'v-popover': VPopover
  },
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
      type: Number,
      default: 15
    }
  },
  emits: [ 'open', 'close', 'item-clicked' ],
  data() {
    return {
      isOpen: false,
      position: ''
    };
  },
  computed: {
    menuPositions () {
      return this.menuPlacement.split('-');
    },
    menuOrigin() {
      return this.menuPositions[0];
    },
    tipAlignment() {
      if (!this.menuPositions[1]) {
        return 'center';
      } else {
        return this.menuPositions[1];
      }
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
      if (this.autoPosition) {
        classes.push(`${baseClass}--fixed`);
      }
      return classes.join(' ');
    },
    buttonState() {
      return this.open ? [ 'active' ] : null;
    }
  },
  methods: {
    show() {
      this.isOpen = true;
    },
    hide() {
      this.isOpen = false;
    },
    buttonClicked() {
      this.isOpen = !this.isOpen;
    },
    menuItemClicked(action) {
      this.$emit('item-clicked', action);
      this.hide();
    }
  }
};
</script>

<style lang="scss">

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
  padding: 20px;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
  box-shadow: var(--a-box-shadow);
  background-color: var(--a-background-primary);
  font-size: map-get($font-sizes, default);
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

.apos-popover {
  z-index: $z-index-modal-inner;
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
    margin-right: 15px;
  }

  &[x-placement$='start'] {
    margin-left: 15px;
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

<template>
  <div
    class="apos-context-menu"
    :class="classList"
    stu='hi'
    ref="component"
  >
    <slot name="prebutton" />
    <!-- TODO refactor buttons to take a single config obj -->
    <v-popover
      ref="popover"
      @show="show"
      @hide="$emit('close')"
      offset="16"
      :placement="menuPlacement"
    >
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
          ref="popup"
          :aria-hidden="open ? 'false' : 'true'"
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
                  :open="open"
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
import Vue from 'apostrophe/vue';
import {
  VTooltip,
  VPopover
} from 'v-tooltip';
Vue.directive('tooltip', VTooltip);
Vue.component('v-popover', VPopover);

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
      default: 'bottom-start'
    }
  },
  emits: [ 'open', 'close', 'item-clicked' ],
  data() {
    return {
      open: false,
      position: '',
      arrow: `
        <svg class="apos-context-menu__tip" width="27px" height="13px" viewBox="0 0 27 13" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
            <g transform="translate(-0.375000, 1.312500)">
              <path class="apos-context-menu__tip-outline" d="M17.2842712,1.46446609 L25.748,9.928 L1.749,9.928 L10.2132034,1.46446609 C12.1658249,-0.488155365 15.3316498,-0.488155365 17.2842712,1.46446609 Z" stroke="var(--a-base-8)" />
              <path class="apos-context-menu__tip-background" d="M17.0029602,1.84623992 C15.3903198,0.179595947 12.5749711,0.0148310371 10.7918701,1.61499023 C9.60313614,2.68176303 9.52086075,2.75884626 10.5450439,1.84623992 L0.815307617,11.4361572 L26.6676025,11.4361572 L17.0029602,1.84623992 Z" fill="var(--a-background-primary)" fill-rule="nonzero" />
            </g>
          </g>
        </svg>
      `
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
      // classes.push(`apos-context-menu--origin-${this.origin}`);
      // classes.push(`apos-context-menu--tip-alignment-${this.tipAlignment}`);
      classes.push(`apos-context-menu--tip-alignment-${this.menuPlacement}`);
      if (this.modifiers) {
        this.modifiers.forEach((m) => {
          classes.push(`apos-context-menu--${m}`);
        });
      }
      if (this.menu) {
        classes.push('apos-context-menu--unpadded');
      }
      if (this.autoPosition) {
        classes.push('apos-context-menu--fixed');
      }
      return classes.join(' ');
    },
    buttonState() {
      return this.open ? [ 'active' ] : null;
    }
  },
  // watch: {
  //   open(newVal, oldVal) {
  //     if (newVal) {
  //       // this.positionPopup();
  //       this.$emit('open');
  //     } else {
  //       this.$emit('close');
  //     }
  //   }
  // },
  methods: {
    resize($event) {
      console.log('hi resize');
      console.log($event);
    },
    show() {
      console.log('hello');
      console.log(this.$refs.popover);
    },
    close() {
      this.open = false;
    },
    bind() {
      // document.addEventListener('click', this.clicks);
      // document.addEventListener('keydown', this.keyboard);
      // window.addEventListener('resize', this.positionPopup);
    },
    unbind() {
      // document.removeEventListener('click', this.clicks);
      // document.removeEventListener('keydown', this.keyboard);
      // window.removeEventListener('resize', this.positionPopup);
    },
    keyboard(event) {
      // if user hits esc, close menu
      if (event.keyCode === 27) {
        this.close();
        this.unbind();
      }
    },
    clicks (event) {
      // if user clicks outside menu component, close menu
      if (!this.$el.contains(event.target)) {
        this.close();
        this.unbind();
      }
    },
    buttonClicked() {
      // this.open = !this.open;
      // if (this.open) {
      //   this.bind();
      // } else {
      //   this.unbind();
      // }
    },
    menuItemClicked(action) {
      this.$emit('item-clicked', action);
      this.close();
    }
  }
};
</script>

<style lang="scss">
.apos-context-menu {
  // position: relative;
  // display: inline;
}

.apos-context-menu--unpadded .apos-context-menu__pane  {
  padding: 0;
}

.apos-context-menu__popup {
  // z-index: $z-index-model-popup;
  // position: absolute;
  display: inline-block;
  color: var(--a-text-primary);
  // opacity: 0;
  // pointer-events: none;
  // transform: scale(0.98) translateY(-8px);
  // transform-origin: top left;
  transition: scale 0.15s ease, translatey 0.15s ease;
}

.apos-context-menu--fixed .apos-context-menu__popup {
  // position: fixed;
}

.apos-context-menu__popup.is-visible {
  // opacity: 1;
  // transform: scale(1) translateY(0);
  // pointer-events: auto;
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

// tooltip
.tooltip {
  z-index: $z-index-modal-inner;
  display: block;

  .tooltip-arrow {
    // display: none;
  }

  &[x-placement^='top'] {
    margin-bottom: 5px;
  }

  &[x-placement^='bottom'] {
    margin-top: 5px;
  }

  &[x-placement^='bottom'] {
    margin-top: 5px;
  }

  &[aria-hidden='true'] {
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.15s, visibility 0.15s;
  }

  &[aria-hidden='false'] {
    visibility: visible;
    opacity: 1;
    transition: opacity 0.15s;
  }
}

</style>

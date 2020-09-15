<template>
  <div
    class="apos-context-menu"
    :class="classList"
    ref="component"
  >
    <slot name="prebutton" />
    <!-- TODO refactor buttons to take a single config obj -->
    <AposButton
      class="apos-context-menu__btn"
      @click="buttonClicked" :label="button.label"
      :type="button.type" :icon="button.icon"
      :icon-only="button.iconOnly" :state="buttonState"
      :icon-size="button.iconSize"
      ref="button"
      :modifiers="button.modifiers"
    />
    <div
      class="apos-primary-scrollbar apos-context-menu__popup"
      :class="{'is-visible': open}" ref="popup"
      :aria-hidden="open ? 'false' : 'true'"
      role="dialog" :style="position"
    >
      <AposContextMenuTip
        :align="tipAlignment"
        :origin="origin"
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
              :item-props="itemProps"
            />
          </ul>
        </slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposContextMenu',
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
    tipAlignment: {
      type: String,
      default: 'left'
    },
    origin: {
      type: String,
      default: 'below'
    },
    itemProps: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'open', 'item-clicked' ],
  data() {
    return {
      open: false,
      position: ''
    };
  },
  computed: {
    classList() {
      const classes = [];
      classes.push(`apos-context-menu--origin-${this.origin}`);
      classes.push(`apos-context-menu--tip-alignment-${this.tipAlignment}`);
      if (this.modifiers) {
        this.modifiers.forEach((m) => {
          classes.push(`apos-context-menu--${m}`);
        });
      }
      if (this.menu) {
        classes.push('apos-context-menu--unpadded');
      }
      return classes.join(' ');
    },
    buttonState() {
      return this.open ? [ 'active' ] : null;
    }
  },
  watch: {
    open(newVal, oldVal) {
      if (newVal) {
        this.position = this.calculatePosition();
      }
      this.$emit('open', newVal);
    }
  },
  methods: {
    close() {
      this.open = false;
    },
    bind() {
      document.addEventListener('click', this.clicks);
      document.addEventListener('keydown', this.keyboard);
      window.addEventListener('resize', this.positionPopup);
    },
    unbind() {
      document.removeEventListener('click', this.clicks);
      document.removeEventListener('keydown', this.keyboard);
      window.removeEventListener('resize', this.positionPopup);
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
      this.open = !this.open;
      if (this.open) {
        this.bind();
      } else {
        this.unbind();
      }
    },
    menuItemClicked(action) {
      this.$emit('item-clicked', action);
      this.close();
    },
    positionPopup() {
      this.position = this.calculatePosition();
    },
    // TODO this is proving a difficult way to handle positioning.
    // Ideally we'd be using absolute positioning to anchor to the button and float above or below
    // to display the menu pane. Initial attempts at this proved difficult for z-index and overflow clipping reasons.
    calculatePosition() {
      const button = this.$refs.button.$el;
      const popup = this.$refs.popup;
      const rect = button.getBoundingClientRect();
      const buttonHeight = button.offsetHeight;
      // getBoundingClientRect gives us the true x,y,etc of an el from the viewport but
      // position:fixed inside position:fixed is positioned relatively to the first, account for it
      let contextRect = {
        top: 0,
        left: 0
      };
      if (button.closest('[data-apos-modal-inner]')) {
        contextRect = button.closest('[data-apos-modal-inner]').getBoundingClientRect();
      }
      let top, left;

      if (this.origin === 'above') {
        // above
        top = rect.top - contextRect.top - popup.offsetHeight - 15;
      } else {
        // below
        top = rect.top - contextRect.top + buttonHeight + 15;
      }

      if (this.tipAlignment === 'center') {
        // center
        const buttonCenter = rect.left - contextRect.left + (button.offsetWidth / 2);
        left = buttonCenter - (popup.offsetWidth / 2);

      } else if (this.tipAlignment === 'right') {
        // right
        left = rect.left - contextRect.left + button.offsetWidth - popup.offsetWidth + 15;
      } else {
        // left
        left = rect.left - contextRect.left - 15;
      }

      return `top: ${top}px; left: ${left}px`;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-context-menu {
    position: relative;
    display: inline;
  }

  .apos-context-menu--unpadded .apos-context-menu__pane  {
    padding: 0;
  }

  .apos-context-menu__popup {
    z-index: $z-index-model-popup;
    position: fixed;
    display: inline-block;
    color: var(--a-text-primary);
    opacity: 0;
    pointer-events: none;
    transform: scale(0.98) translateY(-8px);
    transform-origin: top left;
    transition: scale 0.15s ease, translatey 0.15s ease;
  }

  .apos-context-menu__popup.is-visible {
    opacity: 1;
    transform: scale(1) translateY(0);
    pointer-events: auto;
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
</style>

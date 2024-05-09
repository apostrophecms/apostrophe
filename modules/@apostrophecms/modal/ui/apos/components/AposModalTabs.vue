<template>
  <div class="apos-modal-tabs" :class="{ 'apos-modal-tabs--horizontal': orientation === 'horizontal' }">
    <ul class="apos-modal-tabs__tabs">
      <li
        v-for="tab in visibleTabs"
        v-show="tab.isVisible !== false"
        :key="tab.name"
        class="apos-modal-tabs__tab"
      >
        <button
          :id="tab.name"
          class="apos-modal-tabs__btn"
          :aria-selected="tab.name === current ? true : false"
          @click="selectTab"
        >
          {{ $t(tab.label) }}
          <span
            v-if="tabErrors[tab.name] && tabErrors[tab.name].length"
            class="apos-modal-tabs__label apos-modal-tabs__label--error"
          >
            {{ tabErrors[tab.name].length }} {{ generateErrorLabel(tabErrors[tab.name].length) }}
          </span>
        </button>
      </li>
      <li
        v-if="hiddenTabs.length"
        key="placeholder-for-hidden-tabs"
        class="apos-modal-tabs__tab apos-modal-tabs__tab--small"
      />
    </ul>
    <AposContextMenu
      v-if="hiddenTabs.length"
      :menu="hiddenTabs"
      menu-placement="bottom-end"
      :button="moreMenuButton"
      @item-clicked="moreMenuHandler($event)"
    />
  </div>
</template>

<script>
export default {
  name: 'AposModalTabs',
  props: {
    tabs: {
      required: true,
      type: Array
    },
    current: {
      type: String,
      default: ''
    },
    errors: {
      type: Object,
      default() {
        return {};
      }
    },
    orientation: {
      type: String,
      default: 'vertical'
    }
  },
  emits: [ 'select-tab' ],
  data() {
    const visibleTabs = [];
    const hiddenTabs = [];

    for (let i = 0; i < this.tabs.length; i++) {
      // Shallow clone is sufficient to make mutating
      // a top-level property safe
      const tab = { ...this.tabs[i] };
      tab.action = tab.name;
      if (i < 5) {
        visibleTabs.push(tab);
      } else {
        hiddenTabs.push(tab);
      }
    }

    return {
      visibleTabs,
      hiddenTabs,
      moreMenuButton: {
        icon: 'dots-vertical-icon',
        iconOnly: true,
        type: 'subtle'
      }
    };
  },
  computed: {
    tabErrors() {
      const errors = {};
      for (const key in this.errors) {
        errors[key] = [];
        for (const errorKey in this.errors[key]) {
          if (this.errors[key][errorKey]) {
            errors[key].push(key);
          }
        }
      }
      return errors;
    }
  },
  methods: {
    generateErrorLabel(errorCount) {
      let label = 'Error';
      if (errorCount > 1) {
        label += 's';
      }
      return label;
    },
    selectTab: function (e) {
      const tab = e.target;
      const id = tab.id;
      this.$emit('select-tab', id);
    },
    moreMenuHandler(item) {
      const lastVisibleTab = this.visibleTabs[this.visibleTabs.length - 1];
      const selectedItem = this.hiddenTabs.find((tab) => tab.name === item);

      this.hiddenTabs.splice(this.hiddenTabs.indexOf(selectedItem), 1, lastVisibleTab);
      this.visibleTabs.splice(this.visibleTabs.length - 1, 1, selectedItem);

      this.$emit('select-tab', item);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-modal-tabs {
  display: flex;
  height: 100%;
}

:deep(.apos-context-menu) {
  position: absolute;
  top: 10px;
  right: 0;

  svg {
    width: 20px;
    height: 20px;
    color: var(--a-base-1);
  }

  .apos-button--subtle:hover {
    background-color: initial;
  }
}

.apos-modal-tabs--horizontal {
  position: relative;

  .apos-modal-tabs__tabs {
    flex-direction: row;
    border-top: 1px solid var(--a-base-7);
    border-bottom: 1px solid var(--a-base-7);
  }

  .apos-modal-tabs__tab {
    display: flex;
    width: 100%;
  }

  .apos-modal-tabs__tab--small {
    width: 50%;
    color: var(--a-base-1);
    background-color: var(--a-base-10);
    border-bottom: 1px solid var(--a-base-7);
  }

  .apos-modal-tabs__btn {
    justify-content: center;
    color: var(--a-base-1);
    background-color: var(--a-base-10);
    text-align: center;

    &:hover, &:focus {
      color: var(--a-primary-light-40);
      background-color: var(--a-base-10);
    }

    &[aria-selected='true'], &[aria-selected='true']:hover, &[aria-selected='true']:focus {
      color: var(--a-primary);
      background-color: var(--a-base-10);
      border-bottom: 3px solid var(--a-primary);
    }
  }

  .apos-modal-tabs__btn::before {
    content: none;
  }
}

.apos-modal-tabs__tabs {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  padding: 0;
  background-color: var(--a-base-9);
}

.apos-modal-tabs__tab {
  display: block;
}

.apos-modal-tabs__label {
  display: inline-block;
  padding: 3px;
  border: 1px solid var(--a-base-0);
  font-size: var(--a-type-tiny);
  border-radius: 4px 3px;
  text-transform: uppercase;
  letter-spacing: 1px;
  pointer-events: none;
}

.apos-modal-tabs__label--error {
  border: 1px solid var(--a-danger);
}

.apos-modal-tabs__btn {
  @include apos-button-reset();
  @include type-base;
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 60px;
  padding: 25px 10px;
  border-bottom: 1px solid var(--a-base-7);
  color: var(--a-text-primary);
  background-color: var(--a-base-9);
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.2s ease;

  @include media-up(lap) {
    padding: 25px 10px 25px 20px;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 0;
    background-color: var(--a-primary);
    transition: width 0.25s cubic-bezier(0, 1.61, 1, 1.23);
  }

  &[aria-selected='true'],
  &[aria-selected='true']:hover,
  &[aria-selected='true']:focus {
    padding-left: 15px;
    background-color: var(--a-background-primary);
    &::before {
      background-color: var(--a-primary);
    }
  }

  &:hover,
  &:focus {
    background-color: var(--a-base-10);
    &::before {
      width: 3px;
      background-color: var(--a-base-5);
    }
  }

  &[aria-selected='true'] {
    &::before {
      width: 6px;
    }
  }
}
</style>

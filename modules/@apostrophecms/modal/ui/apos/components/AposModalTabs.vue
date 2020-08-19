<template>
  <div class="apos-modal-tabs">
    <ul class="apos-modal-tabs__tabs">
      <li
        class="apos-modal-tabs__tab" v-for="tab in tabs"
        :key="tab.name"
      >
        <button
          :id="tab.name" class="apos-modal-tabs__btn"
          :aria-selected="tab.name === currentTab ? true : false"
          @click="selectTab"
        >
          {{ tab.label }}
        </button>
      </li>
    </ul>
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
    }
  },
  emits: [ 'select-tab' ],
  computed: {
    currentTab() {
      return this.current || this.tabs[0].name;
    }
  },
  methods: {
    selectTab: function (e) {
      const tab = e.target;
      const id = tab.id;
      this.$emit('select-tab', id);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-modal-tabs {
  display: flex;
  height: 100%;
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

.apos-modal-tabs__btn {
  position: relative;
  width: 100%;
  margin: 0;
  padding: 25px 20px;
  border-width: 0;
  border-bottom: 1px solid var(--a-base-4);
  border-radius: 0;
  color: var(--a-text-primary);
  background-color: var(--a-base-9);
  font-size: map-get($font-sizes, modal);
  letter-spacing: 0.5px;
  text-align: left;
  cursor: pointer;

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

<template>
  <AposContextMenu
    :button="button"
    menu-placement="bottom"
  >
    <div class="apos-filters-menu">
      <div
        v-for="(set, key) in filterSets" :key="key"
        class="apos-filters-menu__set"
      >
        <component
          :is="map[set.field.type]" :field="set.field"
          :value="set.value" :status="set.status"
          :icon="set.field.type === 'select' ? 'unfold-more-horizontal-icon' : ''"
          @input="input($event, key)"
        />
      </div>
    </div>
  </AposContextMenu>
</template>

<script>
import AposHelpers from '../mixins/AposHelpersMixin';

export default {
  mixins: [ AposHelpers ],
  props: {
    filters: {
      type: Array,
      required: true
    },
    button: {
      type: Object,
      default() {
        return {
          label: 'Filter',
          icon: 'chevron-down-icon',
          modifiers: [ 'icon-right' ],
          type: 'outline'
        };
      }
    }
  },
  emits: [ 'input' ],
  data() {
    return {
      map: {
        radio: 'AposInputRadio',
        checkbox: 'AposInputCheckboxes',
        select: 'AposInputSelect'
      }
    };
  },
  computed: {
    filterSets() {
      const sets = {};

      this.filters.forEach(filter => {
        sets[filter.name] = {
          field: {
            name: filter.name,
            type: filter.inputType || 'radio',
            label: filter.label || filter.name,
            choices: filter.choices
          },
          value: {
            data: filter.def
          },
          status: {}
        };
      });
      return sets;
    }
  },
  methods: {
    input(value, filterName) {
      this.$emit('input', filterName, value);
    }
  }
};

</script>

<style lang="scss" scoped>
  .apos-filters-menu {
    min-width: 140px;

    /deep/ .apos-input--select {
      padding-top: 10px;
      padding-bottom: 10px;
      background-color: var(--a-base-10);
      font-style: italic;
    }
  }

  .apos-filters-menu /deep/ .apos-field-label {
    display: block;
    width: 100%;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--a-base-9);
    color: var(--a-base-3);
    font-weight: 400;
    margin-bottom: 10px;
  }

  .apos-filters-menu__set {
    margin-bottom: 30px;
    &:last-child {
      margin-bottom: 0;
    }
  }
</style>

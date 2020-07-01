<template>
  <AposContextMenu
    :origin="origin" :tip-alignment="tipAlignment"
    :button="button"
  >
    <div class="apos-filters-menu">
      <div
        v-for="(set, key) in menu" :key="key"
        class="apos-filters-menu__set"
      >
        <component
          :is="map[set.field.type]" :field="set.field"
          :value="set.value" :status="set.status"
          @input="input($event, key)"
        />
      </div>
    </div>
  </AposContextMenu>
</template>

<script>
import AposHelpers from '../mixins/AposHelpersMixin';

export default {
  mixins: [AposHelpers],
  props: {
    menu: {
      type: Object,
      required: true
    },
    button: {
      type: Object,
      default() {
        return {
          label: 'Filter',
          icon: 'chevron-down-icon',
          modifiers: ['icon-right'],
          type: 'outline'
        };
      }
    },
    tipAlignment: {
      type: String,
      default: 'center'
    },
    origin: {
      type: String,
      default: 'below'
    }
  },
  data() {
    return {
      map: {
        radio: 'AposRadioInput',
        checkbox: 'AposCheckboxInput'
      }
    };
  },
  methods: {
    input(value, name) {
      this.$emit('input', name, value);
    }
  }
};

</script>

<style lang="scss" scoped>
  .apos-filters-menu {
    min-width: 140px;
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

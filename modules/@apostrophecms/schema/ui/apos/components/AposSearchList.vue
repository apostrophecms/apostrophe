<tmplate>
  <ul class="apos-primary-scrollbar apos-search">
    <li
      v-if="label && list.length"
      :class="getClasses({ suggestion: true })"
    >
      <div class="apos-search__item__title">
        {{ $t(label, interpolate) }}
      </div>
      <div v-if="help" class="apos-search__item__field">
        {{ $t(help, interpolate) }} -
        {{ help }}
      </div>
    </li>
    <li
      v-for="item in list"
      :key="item._id"
      :class="getClasses(item)"
      v-apos-tooltip="item.disabled ? disabledTooltip : null"
      @click="select(item, $event)"
    >
      <AposIndicator
        v-if="icon"
        :icon="icon"
        :icon-size="iconSize"
        class="apos-button__icon"
        fill-color="currentColor"
      />
      <div class="apos-search__item__title">
        {{ item.title }}
      </div>
      <div
        v-for="field in fields"
        :key="field"
        class="apos-search__item__field"
      >
        {{ item[field] }}
      </div>
    </li>
  </ul>
</template>

<script>

export default {
  name: 'AposSearchList',
  props: {
    interpolate: {
      type: Object,
      default() {
        return {};
      }
    },
    list: {
      type: Array,
      default() {
        return [];
      }
    },
    selectedItems: {
      type: Array,
      default() {
        return [];
      }
    },
    disabledTooltip: {
      type: String,
      default: null
    },
    label: {
      type: String,
      default: ''
    },
    help: {
      type: [ String, Object ],
      default: ''
    },
    icon: {
      type: String,
      default: 'text-box-icon'
    },
    iconSize: {
      type: Number,
      default: 20
    },
    fields: {
      type: Array,
      default() {
        return [ 'slug' ];
      }
    }
  },
  emits: [ 'select' ],
  methods: {
    select(item, $event) {
      if (item.disabled) {
        $event.stopPropagation();
        return;
      }
      const selectedItems = this.selectedItems;
      if (!selectedItems.some(selectedItem => selectedItem._id === item._id)) {
        // Never modify a prop
        this.$emit('select', [ ...selectedItems, item ]);
      }
    },
    getClasses(item) {
      const classes = {
        'apos-search__item': true
      };
      if (item.suggestion) {
        classes['apos-search__item--suggestion'] = true;
      }
      if (item.disabled) {
        classes['apos-search__item--disabled'] = true;
      }
      return classes;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-search {
  z-index: $z-index-default;
  position: relative;
  top: -4px;
  overflow: auto;
  width: 100%;
  list-style: none;
  box-shadow: var(--a-box-shadow);
  box-sizing: border-box;
  max-height: 300px;
  padding: 0;
  margin: 0;
  border-bottom-left-radius: var(--a-border-radius);
  border-bottom-right-radius: var(--a-border-radius);
  border: 1px solid var(--a-base-8);
  background: var(--a-background-primary);

  &:empty {
    display: none;
  }
}

@mixin disabled {
  padding: 10px 20px;
  border: none;
  background-color: var(--a-background-primary);
  cursor: auto;
  .apos-search__item__title {
    color: $input-color-disabled;
  }
  .apos-search__item__field {
    color: $input-color-disabled;
  }
}

@mixin suggestion {
  padding: 10px 20px;
  border: none;
  background-color: var(--a-background-inverted);
  cursor: auto;
  .apos_search__item__title {
    color: var(--a-text-inverted);
  }
  .apos_search__item__field {
    color: var(--a-base-8);
  }
}

.apos-search__item {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 10px 20px;
  border-top: 1px solid var(--a-base-5);
  box-sizing: border-box;
  transition: background-color 0.3s ease;
  & * {
    pointer-events: none;
  }

  &:hover.apos-search__item {
    background-color: var(--a-base-10);
    cursor: pointer;
    &.apos-search__item--disabled {
      @include disabled;
    }
    &.apos-search__item--suggestion {
      @include suggestion;
    }
  }

  &__title {
    @include type-base;
    color: var(--a-text-primary);
  }

  &__field {
    @include type-base;
    color: var(--a-base-2);
  }

  &.apos-search__item--disabled {
    @include disabled;
  }

  &.apos-search__item--suggestion {
    @include suggestion;
  }
}
</style>

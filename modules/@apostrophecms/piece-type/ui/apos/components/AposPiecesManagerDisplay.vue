<template>
  <table class="apos-table">
    <tbody>
      <tr>
        <th
          class="apos-table__header"
          v-if="!options.hideCheckboxes"
        />
        <th
          v-for="header in headers" scope="col"
          class="apos-table__header" :key="header.label"
        >
          <component
            :is="getEl(header)"
            class="apos-table__header-label"
          >
            <component
              v-if="header.labelIcon"
              :is="icons[header.labelIcon]"
              :size="iconSize(header)"
              class="apos-table__header-icon"
            />
            {{ header.label }}
          </component>
        </th>
      </tr>
      <tr
        class="apos-table__row"
        v-for="item in items"
        :key="item._id"
        :class="{'is-selected': false }"
      >
        <td
          class="apos-table__cell"
          v-if="!options.hideCheckboxes"
        >
          <AposCheckbox
            v-if="item._id"
            :field="{
              name: item._id,
              hideLabel: true,
              label: `Toggle selection of ${item.title}`,
              disabled: options.disableUnchecked && !checkProxy.includes(item._id)
            }"
            :choice="{ value: item._id }"
            v-model="checkProxy"
            @updated="emitUpdated(item._id)"
          />
        </td>
        <td
          class="apos-table__cell apos-table__cell--pointer" v-for="header in headers"
          :key="item[header.name]"
          @click="$emit('open',item._id)"
        >
          <a
            v-if="header.name === '_url' && item[header.name]"
            class="apos-table__link"
            :href="item[header.name]"
            @click.stop
          >
            <link-icon :size="14" />
          </a>
          <button
            v-else-if="header.name === 'title'"
            @click.stop="$emit('open',item._id)"
            class="apos-table__cell-field"
            :class="`apos-table__cell-field--${header.name}`"
          >
            {{ item[header.name] }}
          </button>
          <p
            v-else class="apos-table__cell-field"
            :class="`apos-table__cell-field--${header.name}`"
          >
            {{ item[header.name] }}
          </p>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script>
export default {
  model: {
    prop: 'checked',
    event: 'change'
  },
  props: {
    headers: {
      type: Array,
      required: true
    },
    items: {
      type: Array,
      required: true
    },
    checked: {
      type: Array,
      default() {
        return [];
      }
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [
    'open',
    'change',
    'updated'
  ],
  computed: {
    checkProxy: {
      get() {
        return this.checked;
      },
      set(val) {
        this.$emit('change', val);
      }
    }
  },
  methods: {
    getEl(header) {
      if (header.action) {
        return 'button';
      } else {
        return 'span';
      }
    },
    // TODO: Factor this out to relationship manager.
    emitUpdated($event) {
      this.$emit('updated', $event);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-table__cell--pointer {
    cursor: pointer;
  }
</style>

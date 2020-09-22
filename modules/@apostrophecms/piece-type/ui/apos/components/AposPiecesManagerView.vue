<template>
  <table class="apos-table">
    <tbody>
      <tr>
        <th class="apos-table__header" />
        <th
          v-for="header in headers" scope="col"
          class="apos-table__header" :key="header.label"
        >
          <component
            :is="getEl(header)" @click="sort(header.action)"
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
        <td class="apos-table__cell">
          <AposCheckbox
            v-if="item._id"
            :field="{
              name: item._id,
              hideLabel: true,
              label: `Toggle selection of ${item.title}`,
              // TODO: Refactor this.field out to relationship manager.
              disabled: field.max && checked.length >= field.max &&
                !checked.includes(item._id)
            }"
            :choice="{ value: item._id }"
            v-model="checkProxy"
            @updated="emitUpdated(item._id)"
          />
        </td>
        <td
          class="apos-table__cell" v-for="header in headers"
          :key="item[header.name]"
        >
          <a
            v-if="header.name === 'url'" class="apos-table__link"
            :href="item[header.name]"
          >
            <LinkIcon :size="12" />
          </a>
          <button
            v-else-if="header.name === 'title'"
            @click="$emit('open',item._id)"
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
    field: {
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

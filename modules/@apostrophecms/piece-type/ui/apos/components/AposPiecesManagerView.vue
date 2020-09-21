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
        v-for="row in rows"
        :key="row._id"
        :class="{'is-selected': false }"
      >
        <td class="apos-table__cell">
          <AposCheckbox
            v-if="checkboxes[row._id]"
            :field="checkboxes[row._id].field"
            :value="checkboxes[row._id].value.data"
            :status="checkboxes[row._id].status"
            :choice="checkboxes[row._id].choice"
            :id="row._id"
            v-model="checkProxy"
            @updated="emitUpdated"
          />
        </td>
        <td
          class="apos-table__cell" v-for="header in headers"
          :key="row[header.name]"
        >
          <a
            v-if="header.name === 'url'" class="apos-table__link"
            :href="row[header.name]"
          >
            <LinkIcon :size="12" />
          </a>
          <button
            v-else-if="header.name === 'title'"
            @click="$emit('open',row._id)"
            class="apos-table__cell-field"
            :class="`apos-table__cell-field--${header.name}`"
          >
            {{ row[header.name] }}
          </button>
          <p
            v-else class="apos-table__cell-field"
            :class="`apos-table__cell-field--${header.name}`"
          >
            {{ row[header.name] }}
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
    checkboxes: {
      type: Object,
      required: true
    },
    headers: {
      type: Array,
      required: true
    },
    rows: {
      type: Array,
      required: true
    },
    checked: {
      type: Array,
      default() {
        return [];
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

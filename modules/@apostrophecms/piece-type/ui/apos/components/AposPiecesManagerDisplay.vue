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
        <th class="apos-table__header" key="contextMenu">
          <component
            :is="getEl({})"
            class="apos-table__header-label"
          >
            More Operations
          </component>
        </th>
      </tr>
      <tr
        class="apos-table__row"
        v-for="item in items"
        :key="item._id"
        :class="{'is-selected': false }"
        @mouseover="over(item._id)" @mouseout="out(item._id)"
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
              readOnly:
                (options.disableUnchecked && !checkProxy.includes(item._id)) ||
                (options.disableUnpublished && !item.lastPublishedAt)
            }"
            v-tooltip="options.disableUnpublished && !item.lastPublishedAt ? 'Publish this content before using it in a relationship' : null"
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
          <component
            v-if="header.component" :is="header.component"
            :header="header" :item="item"
            :state="state[item._id]"
          />
          <AposCellLink
            v-else-if="header.name === '_url' && item[header.name]"
            :header="header" :item="item"
          />
          <AposCellBasic
            v-else
            :header="header" :item="item"
          />
        </td>
        <!-- append context menu -->
        <td class="apos-table__cell apos-table__cell--context-menu">
          <AposCellContextMenu
            :state="{}" :menu="contextMenus[item._id]"
            @edit="$emit('open', item._id)"
            @preview="$emit('preview', item._id)"
          />
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
    contextMenus: {
      type: Object,
      required: true
    },
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
    'updated',
    'preview'
  ],
  data() {
    const state = {};
    this.items.forEach(item => {
      state[item._id] = { hover: false };
    });
    return {
      state
    };
  },
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
    over(id) {
      this.state[id].hover = true;
    },
    out(id) {
      this.state[id].hover = false;
    },
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

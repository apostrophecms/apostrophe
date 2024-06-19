<template>
  <table class="apos-table">
    <tbody>
      <tr>
        <th
          class="apos-table__header"
        />
        <th
          v-for="header in headers"
          :key="header.label"
          scope="col"
          class="apos-table__header"
          :class="`apos-table__header--${header.name}`"
        >
          <component
            :is="getEl(header)"
            class="apos-table__header-label"
          >
            <component
              :is="icons[header.labelIcon]"
              v-if="header.labelIcon"
              :size="iconSize(header)"
              class="apos-table__header-icon"
            />
            {{ $t(header.label) }}
          </component>
        </th>
        <th key="contextMenu" class="apos-table__header">
          <component
            :is="getEl({})"
            class="apos-table__header-label apos-is-hidden"
          >
            {{ $t('apostrophe:moreOperations') }}
          </component>
        </th>
      </tr>
      <tr
        v-for="item in items"
        :key="item._id"
        class="apos-table__row"
        :class="{'apos-is-selected': false }"
        @mouseover="over(item._id)"
        @mouseout="out(item._id)"
      >
        <td
          class="apos-table__cell"
        >
          <AposCheckbox
            v-if="item._id"
            v-model="checkProxy"
            v-apos-tooltip="options.disableUnpublished && !item.lastPublishedAt ? 'apostrophe:publishBeforeUsingTooltip' : null"
            :field="{
              name: item._id,
              hideLabel: true,
              label: $t({
                key: 'apostrophe:toggleSelectionOf',
                title: item.title
              }),
              readOnly:
                (options.disableUnchecked && !checkProxy.includes(item._id)) ||
                (options.disableUnpublished && !item.lastPublishedAt)
            }"
            :choice="{ value: item._id }"
            @updated="emitUpdated(item._id)"
          />
        </td>
        <td
          v-for="header in headers"
          :key="header.name"
          class="apos-table__cell apos-table__cell--pointer"
          :class="`apos-table__cell--${header.name}`"
          @click="canEdit(item) && $emit('open', item)"
        >
          <component
            :is="header.component"
            v-if="header.component"
            :header="header"
            :item="item._publishedDoc || item"
            :draft="item"
            :published="item._publishedDoc"
            :manually-published="options.manuallyPublished"
          />
          <AposCellBasic
            v-else
            :header="header"
            :draft="item"
            :published="item._publishedDoc"
          />
        </td>
        <!-- append the context menu -->
        <td class="apos-table__cell apos-table__cell--context-menu">
          <AposCellContextMenu
            :state="state[item._id]"
            :item="item"
            :draft="item"
            :published="item._publishedDoc"
            :header="{
              columnHeader: '',
              property: 'contextMenu',
              component: 'AposCellContextMenu'
            }"
            :options="contextMenuOptions"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script>
import { klona } from 'klona';
export default {
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
    'update:checked',
    'open',
    'updated'
  ],
  data() {
    const state = {
      _template: {
        hover: false
      }
    };
    this.items.forEach(item => {
      state[item._id] = klona(state._template);
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
        this.$emit('update:checked', val);
      }
    },
    contextMenuOptions() {
      return this.options;
    }
  },
  watch: {
    items() {
      this.refreshState();
    }
  },
  methods: {
    canEdit(item) {
      if (item._id) {
        return item._edit || this.options.canLocalize;
      }

      return this.options.canEdit || this.options.canLocalize;
    },
    over(id) {
      this.state[id].hover = true;
    },
    out(id) {
      this.state[id].hover = false;
    },
    refreshState() {
      const template = klona(this.state._template);
      const state = {};
      this.items.forEach(item => {
        state[item._id] = klona(template);
      });
      state._template = template;
      this.state = state;
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

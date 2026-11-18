<template>
  <table class="apos-table">
    <tbody>
      <tr>
        <th
          v-if="hasBatchOperations"
          scope="col"
          class="apos-table__header"
        >
          <span class="apos-sr-only">{{ $t('apostrophe:selectAll') }}</span>
        </th>
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
            :class="{ 'apos-sr-only': header.labelSrOnly }"
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
        <th
          key="contextMenu"
          scope="col"
          class="apos-table__header"
        >
          <component
            :is="getEl({})"
            class="apos-table__header-label apos-sr-only"
          >
            {{ $t('apostrophe:moreOperations') }}
          </component>
        </th>
      </tr>
      <tr
        v-for="item in items"
        :key="item._id"
        class="apos-table__row"
        :class="{
          'apos-is-selected': false,
          'apos-is-busy': outsideStates[item._id]?.busy
        }"
        :aria-busy="outsideStates[item._id]?.busy ? 'true' : null"
        :data-apos-outside="getOutsideState(item._id)"
        @mouseover="over(item._id)"
        @mouseout="out(item._id)"
      >
        <td
          v-if="hasBatchOperations"
          class="apos-table__cell"
        >
          <AposCheckbox
            v-if="item._id"
            v-model="checkProxy"
            v-apos-tooltip="options.disableUnpublished && !item.lastPublishedAt
              ? 'apostrophe:publishBeforeUsingTooltip'
              : null"
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
          v-for="(header, index) in headers"
          :key="header.name"
          class="apos-table__cell apos-table__cell--pointer"
          :class="`apos-table__cell--${header.name}`"
          @click="canEdit(item) && $emit('open', item)"
        >
          <div
            class="apos-table__cell-content"
            :class="{ 'apos-table__cell-content--first': index === 0 }"
          >
            <transition name="apos-table__ai-mark">
              <AposAiMark
                v-if="index === 0 && outsideStates[item._id]"
                class="apos-table__ai-mark"
                :busy="!!outsideStates[item._id].busy"
              />
            </transition>
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
          </div>
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
    },
    // Rows written from outside, such as by the assistant, by `_id`:
    // `{ busy, edited }`
    outsideStates: {
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
    },
    hasBatchOperations() {
      return this.options.batchOperations?.length > 0 || this.options.isRelationship;
    }
  },
  watch: {
    items() {
      this.refreshState();
    }
  },
  methods: {
    getOutsideState(_id) {
      const state = this.outsideStates[_id];
      if (!state) {
        return null;
      }
      return state.busy ? 'busy' : 'edited';
    },
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

  // Only the first column has room for what was written from outside: the
  // other cells lay out as if the wrapper weren't there
  .apos-table__cell-content {
    display: contents;
  }

  .apos-table__cell-content--first {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .apos-table__row.apos-is-busy .apos-table__cell {
    background-color: color-mix(in srgb, var(--a-primary) 10%, var(--a-background-primary));
  }

  .apos-table__ai-mark-enter-active,
  .apos-table__ai-mark-leave-active {
    transition: opacity 220ms ease-out, transform 220ms ease-out;
  }

  .apos-table__ai-mark-enter-from,
  .apos-table__ai-mark-leave-to {
    opacity: 0;
    transform: scale(0.5);
  }

  /* stylelint-disable-next-line media-feature-name-allowed-list */
  @media (prefers-reduced-motion: reduce) {
    .apos-table__ai-mark-enter-active,
    .apos-table__ai-mark-leave-active {
      transition: none;
    }
  }
</style>

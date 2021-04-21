<template>
  <div class="apos-media-manager-selections">
    <div v-if="items.length">
      <div class="apos-media-manager-selections__heading">
        {{ items.length }} items selected
        <AposButton
          label="Clear"
          type="quiet"
          @click="clear"
          :modifiers="['no-motion']"
        />
      </div>
      <ol class="apos-media-manager-selections__items">
        <li
          v-for="item in items"
          :key="item._id" class="apos-media-manager-selections__item"
        >
          <div
            v-if="item.attachment && item.attachment._urls"
            class="apos-media-manager-selections__item-thumb-container"
          >
            <img
              :src="item.attachment._urls['one-sixth']"
              :alt="item.description || item.title"
              class="apos-media-manager-selections__item-thumb"
            >
          </div>
          <div class="apos-media-manager-selections__item-info">
            <div class="apos-media-manager-selections__item-title">
              {{ item.title }}
            </div>
            <AposButton
              v-if="canEdit"
              label="Edit"
              type="quiet"
              :modifiers="['no-motion']"
              @click="edit(item._id)"
            />
          </div>
        </li>
      </ol>
    </div>
    <div v-else class="apos-media-manager-selection__empty">
      <AposEmptyState :empty-state="emptyState" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    canEdit: {
      type: Boolean,
      default: false
    },
    items: {
      type: Array,
      required: true
    }
  },
  emits: [ 'edit', 'clear' ],

  data() {
    return {
      emptyState: {
        message: 'No items selected'
      },
      clearButton: {
        label: 'Clear Selection',
        type: 'quiet',
        modifiers: [ 'no-motion' ]
      }
    };
  },
  methods: {
    edit(id) {
      this.$emit('edit', id);
    },
    clear() {
      this.$emit('clear');
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-media-manager-selections {
  @include type-base;
  height: 100%;
  padding: 20px;
}

.apos-media-manager-selections__heading {
  @include type-base;
  margin-bottom: $spacing-double;
}

.apos-media-manager-selections__heading /deep/ .apos-button {
  margin-left: $spacing-base;
}

.apos-media-manager-selections__items {
  @include apos-list-reset();
}

.apos-media-manager-selections__item {
  display: flex;
  margin-bottom: 20px;
}

.apos-media-manager-selections__item-thumb-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-basis: 50px;
  width: 50px;
  height: 50px;
  min-width: 50px;
  background-color: var(--a-primary-background);
  border: 1px solid var(--a-base-7);
}

.apos-media-manager-selections__item-thumb {
  max-width: 100%;
  max-height: 100%;
}

.apos-media-manager-selections__item-info {
  margin-left: 10px;
}

.apos-media-manager-selections__item-title {
  @include type-base;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 5px;
}

.apos-media-manager-selection__empty {
  display: flex;
  height: 100%;
  justify-content: center;
  align-items: center;
}
</style>

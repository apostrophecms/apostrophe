<template>
  <div class="apos-media-manager-selections">
    <div v-if="items.length">
      <div class="apos-media-manager-selections__heading">
        {{ items.length }} items selected
        <AposButton
          label="apostrophe:clear"
          type="quiet"
          :modifiers="['no-motion']"
          @click="clear"
        />
      </div>
      <ol class="apos-media-manager-selections__items">
        <li
          v-for="item in items"
          :key="item._id"
          class="apos-media-manager-selections__item"
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
              v-if="item._edit"
              label="apostrophe:edit"
              type="quiet"
              :modifiers="['no-motion']"
              @click="edit(item._id)"
            />
          </div>
        </li>
      </ol>
    </div>
    <div
      v-else
      class="apos-media-manager-selection__empty"
    >
      <AposEmptyState :empty-state="emptyState" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    items: {
      type: Array,
      required: true
    }
  },
  emits: [ 'edit', 'clear' ],

  data() {
    return {
      emptyState: {
        message: 'apostrophe:noItemsSelected'
      },
      clearButton: {
        label: 'apostrophe:clearSelection',
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

  & {
    box-sizing: border-box;
    height: 100%;
    padding: 20px;
  }
}

.apos-media-manager-selections__heading {
  @include type-base;

  & {
    margin-bottom: $spacing-double;
  }
}

.apos-media-manager-selections__heading :deep(.apos-button) {
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
  flex-basis: 50px;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border: 1px solid var(--a-base-7);
  min-width: 50px;
  background-color: var(--a-primary-background);
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

  & {
    max-width: 150px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 5px;
  }
}

.apos-media-manager-selection__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>

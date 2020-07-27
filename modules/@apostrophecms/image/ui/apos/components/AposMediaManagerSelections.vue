<template>
  <div class="apos-media-manager-selections">
    <div v-if="items.length">
      <p class="apos-media-manager-selections__heading">
        {{ items.length }} items selected
        <AposButton
          label="Clear" type="quiet"
          @click="clear"
        />
      </p>
      <ol class="apos-media-manager-selections__items">
        <li
          v-for="item in items"
          :key="item.id" class="apos-media-manager-selections__item"
        >
          <div class="apos-media-manager-selections__item-thumb-container">
            <img
              :src="item.path" alt=""
              class="apos-media-manager-selections__item-thumb"
            >
          </div>
          <div class="apos-media-manager-selections__item-info">
            <div class="apos-media-manager-selections__item-title">
              {{ item.title }}
            </div>
            <AposButton
              label="Edit" type="quiet"
              @click="edit(item.id)"
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
        type: 'quiet'
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
  height: 100%;
  padding: 20px;
  font-size: map-get($font-sizes, default);
}

.apos-media-manager-selections__heading {
  @include apos-p-reset();
  margin-bottom: 20px;
}

.apos-media-manager-selections__heading /deep/ .apos-button {
  margin-left: 10px;
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
  @include apos-p-reset();
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

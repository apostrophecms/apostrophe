<template>
  <div class="apos-tag-list">
    <div v-if="tags && tags.length" class="apos-tag-list__inner">
      <h3 class="apos-tag-list__title">{{ title }}</h3>
      <ul class="apos-tag-list__items">
        <AposTagListItem
          v-for="tag in tags"
          :key="tag.slug"
          :active-tags="active"
          :tag="tag"
          @click="toggleTag"
        />
      </ul>
    </div>
    <div v-else class="apos-tag-list__empty">
      <AposEmptyState :empty-state="emptyState" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    tags: {
      type: Array,
      default() {
        return [];
      }
    },
    title: {
      default: 'Filter by Tag',
      type: String
    }
  },
  emits: [ 'update' ],
  data() {
    return {
      active: [],
      emptyState: {
        message: 'Tag your images to make searching and filtering the media manager easier'
      }
    };
  },
  watch: {
    active (newValue) {
      this.$emit('update', newValue);
    }
  },
  methods: {
    toggleTag(id) {
      if (this.active.includes(id)) {
        this.active = this.active.filter(val => {
          return val !== id;
        });
      } else {
        this.active.push(id);
      }
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-tag-list {
  display: flex;
  width: 100%;
  height: 100%;
}
.apos-tag-list__inner {
  margin: 30px 0 0 30px;
}
.apos-tag-list__title {
  margin-bottom: 15px;
  color: var(--a-base-3);
  font-weight: 700;
  font-size: map-get($font-sizes, default);
}
.apos-tag-list__items {
  @include apos-list-reset();
}

.apos-tag-list__empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  margin: 0 1rem;
}

.apos-tag-list__empty-text {
  text-align: center;
}

</style>

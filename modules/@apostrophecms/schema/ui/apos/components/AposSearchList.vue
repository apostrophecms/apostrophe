<template>
  <ul class="apos-primary-scrollbar apos-search">
    <li
      v-for="item in list"
      :key="item._id"
      :class="getClasses(item)"
      v-apos-tooltip="getTooltip(item)"
      @click="select(item, $event)"
    >
      <img
        v-if="item?.attachment?._urls?.['one-sixth']"
        :src="item.attachment._urls['one-sixth']"
        class="apos-search-image"
      >
      <AposIndicator
        v-else-if="getIcon(item).icon"
        :icon="getIcon(item).icon"
        :icon-size="getIcon(item).iconSize"
        class="apos-button__icon"
        fill-color="currentColor"
      />
      <div class="apos-search__item__title">
        {{ item.title }}
      </div>
      <div
        v-for="field in fields"
        :key="field"
        class="apos-search__item__field"
      >
        {{ item[field] }}
      </div>
      <div
        v-for="field in item.customFields"
        :key="field"
        class="apos-search__item__field"
      >
        {{ item[field] }}
      </div>
    </li>
  </ul>
</template>

<script>
import AposSearchListLogic from '../logic/AposSearchList';
export default {
  name: 'AposSearchList',
  mixins: [ AposSearchListLogic ]
};
</script>

<style lang="scss" scoped>
.apos-search {
  z-index: $z-index-default;
  position: absolute;
  overflow: auto;
  width: 100%;
  list-style: none;
  box-shadow: var(--a-box-shadow);
  box-sizing: border-box;
  min-width: 320px;
  max-height: 300px;
  margin: 0;
  padding: 0;
  border-bottom-left-radius: var(--a-border-radius);
  border-bottom-right-radius: var(--a-border-radius);
  border: 1px solid var(--a-base-8);
  background: var(--a-background-primary);

  &:empty {
    display: none;
  }
}

@mixin disabled {
  padding: 10px 20px;
  border: none;
  background-color: var(--a-background-primary);
  cursor: auto;
  .apos-search__item__title {
    color: $input-color-disabled;
  }
  .apos-search__item__field {
    color: $input-color-disabled;
  }
}

@mixin suggestion {
  padding-top: 14px;
  background-color: var(--a-background-inverted);
  .apos-search__item__title {
    color: var(--a-text-inverted);
  }
  .apos-search__item__field {
    color: var(--a-base-8);
  }
}

@mixin hint {
  flex-direction: column;
  gap: 4px;
  border-top: 1px solid var(--a-base-5);
  .apos-search__item__title {
    color: var(--a-base-2);
  }
  .apos-search__item__field {
    color: var(--a-text-primary);
  }
}

.apos-search__item {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 10px 20px;
  border-top: 1px solid var(--a-base-5);
  box-sizing: border-box;
  transition: background-color 0.3s ease;
  & * {
    pointer-events: none;
  }

  &:hover.apos-search__item {
    background-color: var(--a-base-10);
    cursor: pointer;
    &.apos-search__item--disabled {
      @include disabled;
    }
    &.apos-search__item--suggestion {
      @include suggestion;
    }
    &.apos-search__item--hint {
      @include hint;
    }
  }

  &__title {
    @include type-base;
    color: var(--a-text-primary);
  }

  &__field {
    @include type-base;
    color: var(--a-base-2);
  }

  &.apos-search__item--disabled {
    @include disabled;
  }

  &.apos-search__item--suggestion {
    @include suggestion;
  }

  &.apos-search__item--hint {
    @include hint;
  }

  .apos-search-image {
    flex-basis: 0;
    flex-grow: 0;
    max-width: 32px;
    max-height: 32px;
    object-fit: cover;
  }
}
</style>

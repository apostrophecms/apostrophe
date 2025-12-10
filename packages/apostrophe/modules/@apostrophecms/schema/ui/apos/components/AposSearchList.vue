<template>
  <ul
    v-show="list.length"
    :id="ariaId"
    :aria-hidden="!list.length"
    role="listbox"
    class="apos-primary-scrollbar apos-search"
  >
    <li
      v-if="suggestion"
      :class="getClasses(suggestion)"
    >
      <div
        v-if="suggestion.title"
        class="apos-search__item__title"
      >
        {{ suggestion.title }}
      </div>
      <div
        v-if="suggestion.help"
        class="apos-search__item__field"
      >
        {{ suggestion.help }}
      </div>
    </li>
    <li
      v-for="(item, index) in list"
      :key="item._id"
      v-apos-tooltip="getTooltip(item)"
      aria-selected="false"
      :class="getClasses(item, index)"
      @click="select(item)"
    >
      <div
        v-if="item?.attachment?._urls?.['one-sixth']"
        class="apos-search-image"
      >
        <img :src="item.attachment._urls['one-sixth']">
      </div>
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
    <li
      v-if="hint"
      :class="getClasses(hint)"
    >
      <AposIndicator
        v-if="hint.icon"
        :icon="getIcon(hint).icon"
        :icon-size="getIcon(hint).iconSize"
        class="apos-button__icon"
        fill-color="currentColor"
      />
      <div
        v-if="hint.title"
        class="apos-search__item__title"
      >
        {{ hint.title }}
      </div>
      <div
        v-if="hint.help"
        class="apos-search__item__field"
      >
        {{ hint.help }}
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
  z-index: calc(#{$z-index-widget-focused-controls} + 1);
  position: absolute;
  overflow: auto;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 1px solid var(--a-base-8);
  background: var(--a-background-primary);
  list-style: none;
  box-shadow: var(--a-box-shadow);
  min-width: 320px;
  max-height: 300px;
  border-bottom-left-radius: var(--a-border-radius);
  border-bottom-right-radius: var(--a-border-radius);

  &:empty {
    display: none;
  }
}

.apos-search__item {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: flex-start;
  margin: 0;
  padding: 10px 20px;
  border-top: 1px solid var(--a-base-5);
  transition: background-color 300ms ease;
  gap: 10px;

  & * {
    pointer-events: none;
  }

  &--disabled {
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

  &--suggestion {
    padding-top: 14px;
    background-color: var(--a-background-inverted);

    .apos-search__item__title {
      color: var(--a-text-inverted);
    }

    .apos-search__item__field {
      color: var(--a-base-8);
    }
  }

  &--hint {
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

  &--is-focused {
    background-color: var(--a-base-9);
  }

  /* stylelint-disable-next-line selector-not-notation */
  &:hover:not(.apos-search__item--disabled):not(.apos-search__item--hint) {
    background-color: var(--a-base-9);
    cursor: pointer;
  }

  &__title {
    @include type-base;

    & {
      color: var(--a-text-primary);
    }
  }

  &__field {
    @include type-base;

    & {
      color: var(--a-base-2);
    }
  }

  .apos-search-image {
    display: flex;
    flex-basis: 32px;
    flex-grow: 0;

    & img {
      max-width: 32px;
      max-height: 32px;
      object-fit: cover;
      margin: 0 auto;
    }
  }

  &--attachment {
    .apos-search-image {
      flex-basis: 50px;
    }

    .apos-search-image img {
      max-width: 50px;
      max-height: 50px;
    }

    .apos-search__item__title {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
  }
}
</style>

<template>
  <span
    class="apos-recently-edited__cell-title"
    data-apos-test="recently-edited-cell-title"
  >
    <button
      class="apos-table__cell-field"
      :class="`apos-table__cell-field--${header.name}`"
      type="button"
    >
      {{ get(header.name) }}
    </button>
    <a
      v-if="item._url"
      :href="item._url"
      class="apos-recently-edited__cell-link"
      data-apos-test="recently-edited-cell-link"
      @click.stop
    >
      <AposIndicator
        icon="arrow-top-right-icon"
        :icon-size="14"
        decorative
      />
    </a>
  </span>
</template>

<script>
import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellTitle',
  mixins: [ AposCellMixin ]
};
</script>

<style scoped>
.apos-recently-edited__cell-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.apos-recently-edited__cell-link {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--a-base-5);
}

.apos-recently-edited__cell-link:hover {
  color: var(--a-primary);
}
</style>

<template>
  <nav :class="['apos-breadcrumb', classObj]" aria-label="breadcrumb">
    <ol class="apos-breadcrumb__items">
      <li
        v-for="(item, index) in items" :key="index"
        :class="`apos-breadcrumb__item ${modifier}`"
      >
        <component
          :is="item.target ? 'button' : 'span'" :data-apos-target="item.target"
          :type="item.target ? 'button' : null"
          :aria-label="item.target ? `Return to ${item.label}` : null"
          @click="item.target ? $emit('return-to', item.target) : null"
        >
          {{ item.label }}
        </component>
        <ChevronRightIcon
          class="apos-breadcrumb__chevron" :size="13"
          v-if="index !== last"
        />
      </li>
    </ol>
  </nav>
</template>

<script>
import ChevronRightIcon from 'vue-material-design-icons/ChevronRight.vue';

export default {
  name: 'AposModalBreadcrumbs',
  components: {
    ChevronRightIcon
  },
  props: {
    label: {
      default: 'Set a label',
      type: String
    },
    modifier: {
      default: '',
      type: String
    },
    items: {
      default() {
        return [];
      },
      type: Array
    },
    variant: {
      type: String,
      default: null
    }
  },
  emits: ['return-to'],
  computed: {
    last() {
      return Object.keys(this.items).length - 1;
    },
    classObj: function () {
      return {
        'apos-breadcrumb--dark': this.variant === 'dark'
      };
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-breadcrumb {
    border-bottom: 1px solid var(--a-base-4);

    &--dark {
      background-color: var(--a-background-dark);
      color: var(--a-white);
    }
  }
  .apos-breadcrumb__items {
    display: inline-block;
    margin: $spacing-base $spacing-double;
    padding-left: 0;
  }
  .apos-breadcrumb__item {
    @include type-small;
    display: inline-flex;
    align-items: center;
    color: var(--a-text-primary);

    button {
      @include apos-button-reset();
      @include link-primary;
      text-decoration: none;

      .apos-breadcrumb--dark & {
        color: inherit;
      }
    }

    a:focus {
      text-decoration: underline;
    }
  }
  .apos-breadcrumb__chevron {
    display: flex;
    margin: 0 4px;
    color: var(--a-base-2);
  }
</style>

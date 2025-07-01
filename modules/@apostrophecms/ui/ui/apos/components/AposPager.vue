<template>
  <nav class="apos-pager">
    <AposButton
      :disabled="currentPage == 1"
      class="apos-pager__btn"
      type="outline"
      icon="chevron-left-icon"
      :modifiers="['small']"
      :icon-only="true"
      :label="prevButtonLabel"
      @click="incrementPage(-1)"
    />
    <div class="apos-input-wrapper">
      <select
        v-model="selectedPage"
        class="apos-pager__page-select apos-input apos-input--select"
        :disabled="totalPages <= 1"
        :aria-label="$t('apostrophe:selectPage')"
      >
        <option
          v-for="num in totalPages"
          :key="num"
          :value="num"
        >
          {{ $t('apostrophe:pageNumber', { number: num }) }}
        </option>
      </select>
      <menu-swap-icon
        :size="18"
        class="apos-input-icon"
      />
    </div>
    <AposButton
      :disabled="currentPage >= totalPages"
      type="outline"
      class="apos-pager__btn"
      icon="chevron-right-icon"
      :modifiers="['small']"
      :icon-only="true"
      :label="nextButtonLabel"
      @click="incrementPage(1)"
    />
  </nav>
</template>

<script>
import MenuSwap from '@apostrophecms/vue-material-design-icons/MenuSwap.vue';

export default {
  name: 'AposPager',
  components: {
    'menu-swap-icon': MenuSwap
  },
  props: {
    currentPage: {
      type: Number,
      default: 1
    },
    totalPages: {
      type: Number,
      required: true
    }
  },
  emits: [ 'change', 'click' ],
  computed: {
    prevButtonLabel () {
      return {
        key: this.currentPage > 1 ? 'apostrophe:goToPage' : 'apostrophe:previousPage',
        page: this.currentPage - 1
      };
    },
    nextButtonLabel () {
      return {
        key: this.currentPage < this.totalPages ? 'apostrophe:goToPage' : 'apostrophe:nextPage',
        page: this.currentPage + 1
      };
    },
    selectedPage: {
      get() {
        return this.currentPage;
      },
      set(val) {
        this.$emit('change', val);
      }
    }
  },
  methods: {
    incrementPage(num) {
      let newPage = this.currentPage + num;
      if (newPage > this.totalPages) {
        newPage = this.totalPages;
      } else if (newPage < 1) {
        newPage = 1;
      }
      this.$emit('click', newPage);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-pager {
    @include type-base;

    & {
      display: inline-flex;
      align-items: center;
    }
  }

  .apos-input--select {
    background-color: transparent;
    line-height: normal;
    height: 32px;
    padding: 0 $spacing-double 0 $spacing-base;
  }

  .apos-input-icon {
    right: math.div($spacing-base, 4);
  }

  .apos-pager__btn {
    &:first-child {
      margin-right: 5px;
    }

    &:last-child {
      margin-left: 5px;
    }
  }
</style>

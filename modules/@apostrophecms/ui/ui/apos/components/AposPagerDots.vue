<template>
  <ul class="apos-pager-dots">
    <li
      class="apos-pager-dots__item" v-for="i in dots"
      :key="i"
    >
      <button
        role="button"
        :class="{'is-active': i === index }"
        class="apos-pager-dots__button"
        @click="click(i)"
      >
        <span class="apos-sr-only">
          Activate item {{ i }}
        </span>
      </button>
    </li>
  </ul>
</template>

<script>
export default {
  name: 'AposPagerDots',
  props: {
    dots: {
      type: Number,
      required: true
    },
    activeIndex: {
      type: Number,
      default: 1
    }
  },
  emits: ['click'],
  data() {
    return {
      index: this.activeIndex
    };
  },
  methods: {
    click(index) {
      this.$emit('click', index);
      this.index = index;
    }
  }
};
</script>

<style lang="scss">
  .apos-pager-dots {
    display: flex;
    list-style-type: none;
  }
  .apos-pager-dots__button {
    @include apos-button-reset();
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--a-primary-button-disabled);
    margin-right: 20px;
    transition: all 0.3s ease;
  }

  .apos-pager-dots__button.is-active {
    background-color: var(--a-primary);
  }

  .apos-pager-dots__button:hover {
    background-color: var(--a-primary-button-hover);
  }

  .apos-pager-dots__button:active {
    background-color: var(--a-primary-button-active);
  }
</style>

<template>
  <li class="apos-tag-list__item">
    <button
      :class="{'is-active' : active}" class="apos-tag-list__button"
      @click="click(tag)"
    >
      <AposIndicator
        :icon="active ? 'close-icon' : 'label-icon'"
        fill-color="var(--a-primary)"
        :class="`apos-tag-list__icon`"
        :icon-size="12"
      />
      <span class="apos-tag-list__label">
        {{ tag.label }}
      </span>
    </button>
  </li>
</template>

<script>
export default {
  props: {
    activeTag: {
      type: String,
      default: null
    },
    tag: {
      required: true,
      type: Object
    }
  },
  emits: [ 'click' ],
  computed: {
    active () {
      return this.activeTag === this.tag.value;
    }
  },
  methods: {
    click(tag) {
      this.$emit('click', tag.value);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-tag-list__item {
  position: relative;
  display: block;
  margin-bottom: 7.5px;
}
.apos-tag-list__button {
  @include apos-button-reset();
  display: flex;
  align-items: center;
  padding: 2px 0;
  border-radius: 5px;
  background: transparent;
  @include apos-transition(all, 0.1s, ease-in-out);
  &.is-active {
    color: var(--a-primary);
    .apos-tag-list__icon {
      opacity: 1;
    }
  }
  &:hover,
  &:focus {
    color: var(--a-primary);
    .apos-tag-list__icon {
      color: var(--a-primary);
      opacity: 1;
    }
  }
  &:hover.is-active,
  &:focus.is-active {
    color: var(--a-primary);
  }
  &:focus {
    outline: none;
    color: var(--a-primary-button-active);
  }
}

.apos-tag-list__icon--remove {
  position: relative;
  top: 3px;
}

.apos-tag-list__icon--tag {
  color: var(--a-base-6);
}

.apos-tag-list__icon {
  position: absolute;
  left: -20px;
  display: inline-flex;
  opacity: 0;
}

.apos-tag-list__label {
  @include type-base;
}

</style>

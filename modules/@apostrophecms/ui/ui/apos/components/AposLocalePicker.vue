<template>
  <div
    class="apos-locales-picker"
    data-apos-test="localePicker"
  >
    <div class="apos-input-wrapper">
      <input
        v-model="search"
        type="text"
        class="apos-locales-picker__filter"
        :placeholder="$t('apostrophe:searchLocalesPlaceholder')"
      >
    </div>
    <ul class="apos-locales-picker__list">
      <li
        v-for="locale in filteredLocales"
        :key="locale.name"
        :class="localeClasses(locale)"
        class="apos-locale-picker__item"
        data-apos-test="localeItem"
        @click="switchLocale(locale)"
      >
        <span class="apos-locale-picker__locale-display">
          <AposIndicator
            v-if="isActive(locale)"
            icon="check-bold-icon"
            fill-color="var(--a-primary)"
            class="apos-locale-picker__check"
            :icon-size="12"
            :title="$t('apostrophe:currentLocale')"
          />
          {{ locale.label }}
          <span class="apos-locale-picker__name">
            ({{ locale.name }})
          </span>
          <span
            class="apos-locale-picker__localized"
            :class="{ 'apos-state-is-localized': isLocalized(locale) }"
          />
        </span>
      </li>
    </ul>
    <div class="apos-locales-picker__available">
      <p class="apos-locales-picker__available-desc">
        {{ $t('apostrophe:documentExistsInLocales') }}
      </p>
      <AposButton
        v-for="locale in availableLocales"
        :key="locale.name"
        class="apos-locales-picker__available-locale"
        :label="locale.label"
        type="quiet"
        :modifiers="['no-motion']"
        @click="switchLocale(locale)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const emit = defineEmits([ 'switch-locale' ]);
const props = defineProps({
  currentLocale: {
    type: String,
    required: true
  },
  localized: {
    type: Object,
    required: true
  }
});

const search = ref('');
const locales = ref(Object.entries(window.apos.i18n.locales).map(
  ([ locale, options ]) => {
    return {
      name: locale,
      label: options.label || locale
    };
  }
));

const filteredLocales = computed(() => {
  return locales.value.filter(({ name, label }) => {
    const matches = term =>
      term.toLowerCase().includes(search.value.toLowerCase());
    return matches(name) || matches(label);
  });
});

const availableLocales = computed(() => {
  return locales.value.filter(locale => isLocalized(locale));
});

function isLocalized(locale) {
  return Boolean(props.localized[locale.name]);
}

function isActive(locale) {
  return props.currentLocale === locale.name;
}

function switchLocale(locale) {
  emit('switch-locale', locale);
}

function localeClasses(locale) {
  const classes = {};
  if (isActive(locale)) {
    classes['apos-active'] = true;
  }
  classes['apos-exists'] = isLocalized(locale);
  return classes;
}
</script>

<style lang="scss" scoped>
.apos-locales-picker {
  width: 315px;
}

.apos-locales-picker__filter {
  @include type-large;

  box-sizing: border-box;
  width: 100%;
  padding: 20px 45px 20px 20px;
  border-top: 0;
  border-right: 0;
  border-bottom: 1px solid var(--a-base-9);
  border-left: 0;
  border-top-right-radius: var(--a-border-radius);
  border-top-left-radius: var(--a-border-radius);

  &::placeholder {
    color: var(--a-base-4);
    font-style: italic;
  }

  &:focus {
    outline: none;
    background-color: var(--a-base-10);
  }
}

.apos-locales-picker__list {
  margin: $spacing-base 0;
  padding-left: 0;
  list-style-type: none;
  max-height: 350px;
  overflow-y: scroll;
  font-weight: var(--a-weight-base);
}

.apos-locale-picker__item {
  position: relative;
  padding: 12px 35px;
  line-height: 1;
  cursor: pointer;

  .state {
    opacity: 0;
  }

  &:hover {
    background-color: var(--a-base-10);
  }

  .apos-locale-picker__check {
    position: absolute;
    top: 50%;
    left: 18px;
    transform: translateY(-50%);
    color: var(--a-primary);
    stroke: var(--a-primary);
  }

  .apos-locale-picker__localized {
    position: relative;
    top: -1px;
    left: 5px;
    display: inline-block;
    width: 3px;
    height: 3px;
    border: 1px solid var(--a-base-5);
    border-radius: 50%;

    &.apos-state-is-localized {
      background-color: var(--a-success);
      border-color: var(--a-success);
    }
  }
}

.apos-locales-picker__name {
  text-transform: uppercase;
}

.apos-locales-picker__available {
  padding: $spacing-double;
  border-top: 1px solid var(--a-base-9);
}

.apos-locales-picker__available-locale {
  display: inline-block;
  color: var(--a-primary);
  font-size: var(--a-type-small);

  &:not(:last-of-type) {
    margin-right: 10px;
    margin-bottom: 5px;
  }
}

.apos-locales-picker__available-desc {
  margin-top: 0;
}
</style>
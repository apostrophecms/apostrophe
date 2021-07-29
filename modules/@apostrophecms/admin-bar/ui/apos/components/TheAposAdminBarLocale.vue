<template>
  <AposContextMenu
    class="apos-admin-locales"
    :button="button"
    menu-placement="bottom-end"
  >
    <ul class="apos-locales">
      <li
        v-for="locale in locales"
        :key="locale.name"
        :class="localeClasses(locale)"
        @click="switchLocale(locale)"
      >
        <span class="state">
          ✓
        </span>
        <span class="label">
          {{ locale.label }}
        </span>
      </li>
    </ul>
  </AposContextMenu>
</template>

<script>

export default {
  name: 'TheAposAdminBarUser',
  data() {
    return {
      locales: Object.entries(window.apos.i18n.locales).map(([ locale, options ]) => {
        return {
          name: locale,
          label: options.label || locale
        };
      })
    };
  },
  computed: {
    button() {
      return {
        label: window.apos.i18n.locale,
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'quiet'
      };
    }
  },
  methods: {
    localeClasses(locale) {
      if (window.apos.i18n.locale === locale.name) {
        return {
          'apos-active': true
        };
      } else {
        return {};
      }
    },
    switchLocale(locale) {
      console.log('Switch to', locale);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-locales {
    li {
      cursor: pointer;
      .state {
        opacity: 0;
      }
      &.apos-active {
        background-color: gray;
        .active {
          opacity: 1.0;
        }
      }
    }
  }
</style>

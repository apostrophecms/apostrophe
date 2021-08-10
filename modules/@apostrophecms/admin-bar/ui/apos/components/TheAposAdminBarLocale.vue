<template>
  <AposContextMenu
    class="apos-admin-locales"
    :button="button"
    menu-placement="bottom-end"
  >
    <ul v-if="localized" class="apos-locales">
      <li
        v-for="locale in locales"
        :key="locale.name"
        :class="localeClasses(locale)"
        @click="switchLocale(locale)"
      >
        <span class="label">
          {{ locale.label }}
        </span>
      </li>
    </ul>
    <div v-else class="apos-locales">
      Loading...
    </div>
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
      }),
      localized: null
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
    },
    action() {
      return apos.modules[apos.adminBar.context.type].action;
    },
  },
  async mounted() {
    const docs = await apos.http.get(`${this.action}/${apos.adminBar.context._id}/locales`, {
      busy: true
    });
    this.localized = Object.fromEntries(
      docs.results
        .filter(doc => doc.aposLocale.endsWith(':draft'))
        .map(doc => [ doc.aposLocale.split(':')[0], doc ])
    );
  },
  methods: {
    localeClasses(locale) {
      const classes = {};
      if (window.apos.i18n.locale === locale.name) {
        classes['apos-active'] = true;
      }
      classes['apos-exists'] = this.localized[locale.name];
      return classes;
    },
    async switchLocale(locale) {
      const { name } = locale;
      const result = await apos.http.post(`${apos.i18n.action}/locale`, {
        body: {
          contextDocId: apos.adminBar.context && apos.adminBar.context._id,
          locale: name
        }
      });
      if (result.redirectTo) {
        window.location.assign(result.redirectTo);
      } else {
        window.location.reload();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-locales {
    li {
      cursor: pointer;
      &.apos-active {
        background-color: gray;
      }
      &:after {
        content: '◯'
      }
      &.apos-exists {
        &:after {
          content: '⬤'
        }
      }
    }
  }
</style>

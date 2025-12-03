<template>
  <AposContextMenu
    ref="menu"
    class="apos-admin-locales"
    identifier="localePickerTrigger"
    :button="button"
    :unpadded="true"
    :center-on-icon="true"
    menu-placement="bottom-end"
    @open="open"
    @close="isOpen = false"
  >
    <AposLocalePicker
      :current-locale="locale"
      :localized="localized"
      :is-open="isOpen"
      @switch-locale="switchLocale"
    />
  </AposContextMenu>
</template>

<script>
export default {
  name: 'TheAposAdminBarLocale',
  data() {
    return {
      search: '',
      locales: Object.entries(window.apos.i18n.locales).map(
        ([ locale, options ]) => {
          return {
            name: locale,
            label: options.label || locale
          };
        }
      ),
      localized: {},
      isOpen: false
    };
  },
  computed: {
    locale() {
      return window.apos.i18n.locale;
    },
    button() {
      return {
        label: {
          key: apos.i18n.locale,
          localize: false
        },
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion', 'uppercase' ],
        type: 'quiet'
      };
    },
    action() {
      return apos.modules[apos.adminBar.context.type]?.action;
    }
  },
  methods: {
    close() {
      this.isOpen = false;
    },
    async open() {
      if (apos.adminBar.context) {
        const docs = await apos.http.get(
          `${this.action}/${apos.adminBar.context._id}/locales`,
          {
            busy: true
          }
        );
        this.localized = Object.fromEntries(
          docs.results
            .filter(doc => doc.aposLocale.endsWith(':draft'))
            .map(doc => [ doc.aposLocale.split(':')[0], doc ])
        );
      }
      this.isOpen = true;
    },
    isActive(locale) {
      return window.apos.i18n.locale === locale.name;
    },
    isLocalized(locale) {
      return Boolean(this.localized[locale.name]);
    },
    async switchLocale(locale) {
      const { name } = locale;
      const result = await apos.http.post(`${apos.i18n.action}/locale`, {
        body: {
          contextDocId: apos.adminBar.context && apos.adminBar.context._id,
          locale: name,
          clipboard: localStorage.getItem('aposWidgetClipboard')
        }
      });

      if (this.isLocalized(locale)) {
        if (result.redirectTo) {
          window.location.assign(result.redirectTo);
        } else {
          window.location.reload();
        }
      } else {
        const currentLocale = apos.i18n.locales[apos.locale];
        this.$refs.menu.hide();
        const toLocalize = await apos.confirm(
          {
            icon: false,
            heading: 'apostrophe:switchLocalesAndLocalizePage',
            description: 'apostrophe:notInLocale',
            negativeLabel: 'apostrophe:noJustSwitchLocales',
            affirmativeLabel: 'apostrophe:yesLocalizeAndSwitchLocales'
          },
          {
            interpolate: {
              label: locale.label,
              currentLocale: currentLocale.label
            }
          }
        );

        if (toLocalize) {
          this.$refs.menu.hide();
          apos.bus.$emit('admin-menu-click', {
            itemName: '@apostrophecms/i18n:localize',
            props: {
              doc: apos.adminBar.context,
              locale
            }
          });
        } else {
          window.location.assign(result.redirectTo);
        }
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-admin-locales {
  position: relative;
  margin-right: $spacing-base;
  padding-right: $spacing-base;
  padding-left: $spacing-base;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: -18px;
    bottom: -18px;
    width: 1px;
    background-color: var(--a-base-9);
  }

  &::before {
    left: 0;
  }

  &::after {
    right: 0;
  }

  &:deep(.apos-button__label) {
    @include type-small;

    & {
      color: var(--a-primary);
      font-weight: var(--a-weight-bold);
      letter-spacing: 1px;
    }
  }
}
</style>

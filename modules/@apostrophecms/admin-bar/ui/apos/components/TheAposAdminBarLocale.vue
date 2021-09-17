<template>
  <AposContextMenu
    ref="menu"
    class="apos-admin-locales"
    :button="button"
    :unpadded="true"
    menu-placement="bottom-end"
    @open="open"
  >
    <div class="apos-locales-picker">
      <div class="apos-input-wrapper">
        <input
          v-model="search"
          type="text"
          class="apos-locales-filter"
          :placeholder="$t('apostrophe:searchLocalesPlaceholder')"
        >
      </div>
      <ul class="apos-locales">
        <li
          v-for="locale in filteredLocales"
          :key="locale.name"
          class="apos-locale-item"
          :class="localeClasses(locale)"
          @click="switchLocale(locale)"
        >
          <span class="apos-locale">
            <AposIndicator
              v-if="isActive(locale)"
              icon="check-bold-icon"
              fill-color="var(--a-primary)"
              class="apos-check"
              :icon-size="12"
              :title="$t('apostrophe:currentLocale')"
            />
            {{ locale.label }}
            <span class="apos-locale-name">
              ({{ locale.name }})
            </span>
            <span
              class="apos-locale-localized"
              :class="{ 'apos-state-is-localized': isLocalized(locale) }"
            />
          </span>
        </li>
      </ul>
      <div class="apos-available-locales">
        <p class="apos-available-description">
          {{ $t('apostrophe:documentExistsInLocales') }}
        </p>
        <AposButton
          v-for="locale in availableLocales"
          :key="locale.name"
          class="apos-available-locale"
          :label="locale.label"
          type="quiet"
          :modifiers="['no-motion']"
          @click="switchLocale(locale)"
        />
      </div>
    </div>
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
      localized: {}
    };
  },
  computed: {
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
    filteredLocales(input) {
      return this.locales.filter(({ name, label }) => {
        const matches = term =>
          term.toLowerCase().includes(this.search.toLowerCase());
        return matches(name) || matches(label);
      });
    },
    availableLocales() {
      return this.locales.filter(locale => !!this.localized[locale.name]);
    },
    action() {
      return apos.modules[apos.adminBar.context.type]?.action;
    }
  },
  methods: {
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
    },
    isActive(locale) {
      return window.apos.i18n.locale === locale.name;
    },
    isLocalized(locale) {
      return !!this.localized[locale.name];
    },
    localeClasses(locale) {
      const classes = {};
      if (this.isActive(locale)) {
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
  padding-left: $spacing-base;
  padding-right: $spacing-base;
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

  &::v-deep .apos-button__label {
    @include type-small;
    color: var(--a-primary);
    font-weight: var(--a-weight-bold);
    letter-spacing: 1px;
  }
}

.apos-locales-picker {
  width: 315px;
}

.apos-locales-filter {
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

.apos-locales {
  list-style-type: none;
  max-height: 350px;
  overflow-y: scroll;
  padding-left: 0;
  margin: $spacing-base 0;
  font-weight: var(--a-weight-base);
}

.apos-locale-item {
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

  .apos-check {
    position: absolute;
    top: 50%;
    left: 18px;
    transform: translateY(-50%);
    color: var(--a-primary);
    stroke: var(--a-primary);
  }

  &.apos-active {
    .active {
      opacity: 1;
    }
  }

  .apos-locale-localized {
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

.apos-available-locales {
  padding: $spacing-double;
  border-top: 1px solid var(--a-base-9);
}

.apos-available-locale {
  display: inline-block;
  font-size: 10px;
  color: var(--a-primary);
}

.apos-available-locale:not(:last-of-type) {
  margin-right: 10px;
  margin-bottom: 5px;
}

.apos-available-description {
  margin-top: 0;
}

.apos-locale-name {
  text-transform: uppercase;
}

</style>

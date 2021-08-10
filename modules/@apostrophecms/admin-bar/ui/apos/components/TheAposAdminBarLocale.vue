<template>
  <AposContextMenu
    class="apos-admin-locales"
    :button="button"
    :unpadded="true"
    menu-placement="bottom-end"
  >
    <div class="apos-input-wrapper">
      <input
        v-model="search"
        type="text"
        class="apos-locales-filter"
        placeholder="Search locales..."
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
          <CheckIcon
            v-if="isActive(locale)"
            class="apos-check"
            title="Currently selected locale"
            :size="12"
          />
          {{ locale.label }}
          <span
            class="apos-locale-localized"
            :class="{ 'apos-state-is-localized': isLocalized(locale) }"
          />
        </span>
      </li>
    </ul>
    <div class="apos-available-locales">
      <p class="apos-available-description">
        {{ $t('apostrophe:thisDocumentExistsIn') }}
      </p>
      <span
        v-for="locale in availableLocales"
        :key="locale"
        class="apos-available-locale"
      >
        {{ locale }}
      </span>
    </div>
  </AposContextMenu>
</template>

<script>
import CheckIcon from 'vue-material-design-icons/Check.vue';

export default {
  name: 'TheAposAdminBarLocale',
  components: { CheckIcon },
  data() {
    return {
      search: '',
      // TODO: Need to get this somehow
      availableLocales: [
        'English',
        'Austria',
        'Germany',
        'Netherlands',
        'Canada (EN)'
      ],
      locales: Object.entries(window.apos.i18n.locales).map(
        ([ locale, options ]) => {
          return {
            name: locale,
            label: options.label || locale
          };
        }
      )
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
    filteredLocales(input) {
      return this.locales.filter(({ name, label }) => {
        const matches = term =>
          term
            .toLowerCase()
            .includes(this.wizard.sections[1].filter.toLowerCase());
        return matches(name) || matches(label);
      });
    }
  },
  methods: {
    isActive(locale) {
      return window.apos.i18n.locale === locale.name;
    },
    isLocalized(locale) {
      // TODO: Not sure we have the proper data to make this work properly yet.
      return (
        (window.apos.page &&
          window.apos.page.page &&
          window.apos.page.page.aposLocale.includes(locale.name)) ||
        false
      );
    },
    localeClasses(locale) {
      if (this.isActive(locale)) {
        return {
          'apos-active': true
        };
      } else {
        return {};
      }
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

<style lang="scss">
.apos-context-menu__pane {
  width: 315px;
}

.apos-locales-filter {
  box-sizing: border-box;
  width: 100%;
  padding: 25px 45px 20px 20px;
  font-size: 14px;
  border-top: 0;
  border-right: 0;
  border-bottom: 1px solid var(--a-base-9);
  border-left: 0;
  color: var(--a-text-primary);
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
  margin-top: 0;
  margin-bottom: 0;
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
    left: 20px;
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
    display: inline-block;
    height: 5px;
    width: 5px;
    border: 1px solid var(--a-base-5);
    border-radius: 3px;

    &.apos-state-is-localized {
      background-color: var(--a-success);
      border-color: var(--a-success);
    }
  }
}

.apos-available-locales {
  padding: 20px;
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
</style>

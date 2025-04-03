<template>
  <div class="apos-doc-locales">
    <span class="apos-doc-locales__label">
      {{ $t('apostrophe:locale') }}:
    </span>
    <AposContextMenu
      ref="menu"
      class="apos-doc-locales__switcher"
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
        :forbidden="forbidden"
        :forbidden-tooltip="forbiddenTooltip"
        :is-open="isOpen"
        @switch-locale="switchLocale"
      />
    </AposContextMenu>
  </div>
</template>

<script setup>
import {
  ref, inject, computed
} from 'vue';

const emit = defineEmits([ 'save-doc', 'switch-locale' ]);
const props = defineProps({
  locale: {
    type: String,
    required: true
  },
  docId: {
    type: String,
    default: null
  },
  moduleOptions: {
    type: Object,
    default: () => ({
      action: '',
      label: ''
    })
  },
  isModified: {
    type: Boolean,
    required: true
  }
});

const $t = inject('i18n');
const i18nAction = apos.modules['@apostrophecms/i18n'].action;
const forbiddenTooltip = $t('apostrophe:localeSwitcherPermissionToCreate', {
  docType: props.moduleOptions.label.toLowerCase()
});
const menu = ref(null);
const localized = ref({});
const forbidden = ref([]);
const isOpen = ref(false);
const button = computed(() => {
  const label = apos.i18n.locales[props.locale]?.label;
  const key = label ? `${label} (${props.locale})` : props.locale;
  return {
    label: {
      key,
      localize: false
    },
    icon: 'chevron-down-icon',
    modifiers: [ 'icon-right', 'no-motion' ],
    type: 'quiet'
  };
});

async function open() {
  isOpen.value = true;
  if (!props.docId) {
    return;
  }
  try {
    const docs = await apos.http.get(
    `${props.moduleOptions.action}/${props.docId}/locales`, { busy: true }
    );
    localized.value = Object.fromEntries(
      docs.results
        .filter(doc => doc.aposLocale.endsWith(':draft'))
        .map(doc => [ doc.aposLocale.split(':')[0], doc ])
    );

    await checkCreatePermission();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.err(err);
  }
};

async function checkCreatePermission() {
  const localesWithNoDocs = Object.keys(apos.i18n.locales)
    .filter((locale) => !localized.value[locale]);

  const allowed = await apos.http.get(`${i18nAction}/locales-permissions`, {
    qs: {
      type: props.moduleOptions.name,
      locales: localesWithNoDocs,
      action: 'create',
      aposMode: 'draft'
    }
  });

  forbidden.value = localesWithNoDocs
    .filter((locale) => !allowed.includes(locale));
}

async function switchLocale(locale) {
  if (forbidden.value.includes(locale.name)) {
    return;
  };

  menu.value.hide();
  if (locale.name === props.locale) {
    return;
  }

  const save = props.isModified
    ? await apos.confirm({
      heading: 'apostrophe:unsavedChanges',
      description: $t(
        'apostrophe:localeSwitcherDiscardChangesPrompt',
        { docType: props.moduleOptions.label.toLowerCase() }
      ),
      negativeLabel: 'apostrophe:localeSwitcherDiscardChangesNegative',
      affirmativeLabel: 'apostrophe:localeSwitcherDiscardChangesAffirmative',
      icon: false
    }, {
      hasCloseButton: true,
      tiny: true
    })
    : false;

  if (save === null) {
    return;
  }

  emit('switch-locale', {
    locale: locale.name,
    localized: localized.value[locale.name],
    save
  });
}
</script>

<style lang="scss" scoped>
.apos-doc-locales {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

}

.apos-doc-locales__label {
  @include type-base;

  & {
    margin-right: 0.3rem;
    font-weight: var(--a-weight-bold);
  }
}

.apos-doc-locales__switcher :deep(.apos-button__label) {
  @include type-base;

  & {
    color: var(--a-primary);
    font-weight: var(--a-weight-bold);
    letter-spacing: 1px;
  }
}
</style>

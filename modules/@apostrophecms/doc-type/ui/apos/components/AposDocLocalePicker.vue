<template>
  <div class="apos-doc-locales">
    <span class="apos-doc-locales__label">
      {{ $t('apostrophe:locale') }}:
    </span>
    <AposContextMenu
      ref="menu"
      class="apos-doc-locales__switcher"
      :button="button"
      :unpadded="true"
      :disabled="hasErrors || hasContextLocale"
      menu-placement="bottom-end"
      @open="open"
    >
      <AposLocalePicker
        :current-locale="locale"
        :localized="localized"
        @switch-locale="switchLocale"
      />
    </AposContextMenu>
  </div>
</template>

<script setup>
import {
  ref, inject, nextTick, computed
} from 'vue';

const emit = defineEmits([ 'save-doc', 'switch-locale' ]);
const props = defineProps({
  locale: {
    type: String,
    required: true
  },
  docId: {
    type: String,
    required: true
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
  },
  hasErrors: {
    type: Boolean,
    required: true
  },
  hasContextLocale: {
    type: Boolean,
    required: true
  }
});

const $t = inject('i18n');
const menu = ref(null);
const localized = ref({});
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
  const docs = await apos.http.get(
    `${props.moduleOptions.action}/${props.docId}/locales`, { busy: true }
  );
  localized.value = Object.fromEntries(
    docs.results
      .filter(doc => doc.aposLocale.endsWith(':draft'))
      .map(doc => [ doc.aposLocale.split(':')[0], doc ])
  );
};

async function switchLocale(locale) {
  menu.value.hide();

  if (locale.name === props.locale) {
    return;
  }

  if (props.isModified) {
    const saveAndSwitch = await apos.confirm({
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
    });

    if (saveAndSwitch) {
      emit('save-doc', locale);
      await nextTick();
      if (props.hasErrors) {
        return;
      }
    }
  }

  emit('switch-locale', locale.name, localized.value[locale.name]);
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

  margin-right: 0.3rem;
  font-weight: var(--a-weight-bold);
}

.apos-doc-locales__switcher :deep(.apos-button__label) {
  @include type-base;

  color: var(--a-primary);
  font-weight: var(--a-weight-bold);
  letter-spacing: 1px;
}
</style>

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
import { ref, inject } from 'vue';

const emit = defineEmits([ 'save-doc' ]);
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
  }
});

const $t = inject('i18n');
const menu = ref(null);
const localized = ref({});
const button = {
  label: {
    key: apos.i18n.locale,
    localize: false
  },
  icon: 'chevron-down-icon',
  modifiers: [ 'icon-right', 'no-motion', 'uppercase' ],
  type: 'quiet'
};

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

async function switchLocale() {
  menu.value.hide();
  if (props.isModified) {
    const saveAndSwitch = await apos.confirm({
      heading: 'apostrophe:unsavedChanges',
      description: $t(
        'apostrophe:localeSwitcherDiscardChangesPrompt',
        { docType: props.moduleOptions.label.toLowerCase() }
      ),
      negativeLabel: 'apostrophe:localeSwitcherDiscardChangesNegative',
      affirmativeLabel: 'apostrophe:localeSwitcherDiscardChangesAffirmative'
    });

    if (saveAndSwitch) {
      emit('save-doc');
      // TODO: If error during save we do not want to switch locale
    }

    // TODO: switch locale
  }
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
  margin-right: 0.3rem;
}

.apos-doc-locales__switcher :deep(.apos-button__label) {
  @include type-small;

  color: var(--a-primary);
  font-weight: var(--a-weight-bold);
  letter-spacing: 1px;
}
</style>

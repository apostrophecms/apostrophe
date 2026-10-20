<template>
  <div
    ref="root"
    class="apos-see-changes-editor"
    role="group"
    tabindex="-1"
    :aria-label="$t(label)"
    data-apos-test="see-changes-editor"
    @keyup.esc.stop="$emit('cancel')"
  >
    <div
      ref="input"
      class="apos-see-changes-editor__field"
    >
      <AposLoading
        v-if="!value"
        class="apos-see-changes-editor__loading"
      />
      <div
        v-else-if="widgetType"
        class="apos-see-changes-editor__widget"
      >
        <!--
          No `doc-id`, as for an area in a modal: a contextual editor takes it
          to edit the page in context, and the window saves only on its button
        -->
        <component
          :is="widgetEditor"
          :type="widgetType"
          :options="widgetOptions"
          :model-value="value.data"
          :focused="true"
          @update="value.data = $event"
        />
      </div>
      <AposSchema
        v-else
        :schema="schema"
        :model-value="value"
        :doc-id="docId"
        :conditional-fields="conditionalFields"
        :trigger-validation="triggerValidation"
        :modifiers="[ 'micro', 'margin-none' ]"
        @update:model-value="value = $event"
      />
    </div>
    <p
      v-if="invalid"
      class="apos-see-changes-editor__invalid"
      role="alert"
      data-apos-test="see-changes-editor-invalid"
    >
      {{ $t('apostrophe:seeChangesInvalid') }}
    </p>
    <div class="apos-see-changes-editor__controls">
      <AposButton
        class="apos-see-changes-editor__cancel"
        type="quiet"
        label="apostrophe:cancel"
        :attrs="{ 'data-apos-test': 'see-changes-editor-cancel' }"
        @click="$emit('cancel')"
      />
      <AposButton
        type="primary"
        label="apostrophe:seeChangesUpdateDraft"
        :modifiers="[ 'small' ]"
        :busy="busy"
        :disabled="busy || !value"
        :attrs="{ 'data-apos-test': 'see-changes-editor-save' }"
        @click="save"
      />
    </div>
  </div>
</template>

<script setup>
// One field of the draft, edited on its own: its editor shows the value the
// draft has now, without its label, conditions or the rest of the document.
// An array item is edited as its fields, labelled, their conditions on one
// another evaluated as the array editor does; a condition on a field outside
// the item has no value to read here and is not met. `save` carries the patch
// that sets the edited value and its inverse; an unchanged value closes it
// as Cancel and Escape do. A contextual widget is edited whole by its own
// editor, as on the page
import {
  computed, inject, nextTick, onMounted, provide, ref
} from 'vue';
import { klona } from 'klona';
import {
  evaluateExternalConditions,
  getConditionalFields,
  getConditionTypesObject
} from 'Modules/@apostrophecms/schema/lib/conditionalFields.js';
import draftValue from '../lib/draft-value.js';

const props = defineProps({
  // The schema field the value is of: for an array item, the array
  field: {
    type: Object,
    default: null
  },
  // In place of `field`, the type of the contextual widget the value is, and
  // the options its area gives it
  widgetType: {
    type: String,
    default: null
  },
  widgetOptions: {
    type: Object,
    default: () => ({})
  },
  // Where a PATCH of the draft sets the value
  patchKey: {
    type: String,
    required: true
  },
  // Whether the value is an array item, edited as its fields
  item: {
    type: Boolean,
    default: false
  },
  // The draft's `_id`
  docId: {
    type: String,
    required: true
  },
  // Whether the edit is being saved
  busy: {
    type: Boolean,
    default: false
  },
  // Whether the server refused the value as invalid
  invalid: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([ 'cancel', 'save' ]);
const $t = inject('i18n');

// The draft's `docId` serves the fields' data, but nothing here edits the
// page in context: the value is saved by Update Draft only
provide('aposInContext', false);

const root = ref(null);
const input = ref(null);
// `{ data, hasErrors }` as `AposSchema` emits it, once the draft is loaded
const value = ref(null);
const triggerValidation = ref(false);
const externalConditions = ref(getConditionTypesObject());
let original;

const widgetModule = computed(() => props.widgetType &&
  apos.modules[apos.area.widgetManagers[props.widgetType]]);
const widgetEditor = computed(() => props.widgetType &&
  apos.area.components.widgetEditors[props.widgetType]);
const label = computed(() => (props.field
  ? (props.field.label || props.field.name)
  : widgetModule.value?.label));

const schema = computed(() => (props.item
  ? props.field.schema
  : [ {
    ...props.field,
    hideLabel: true
  } ]));

// Read from the item as a save stores it: a field its conditions hide keeps
// its value
const conditionalFields = computed(() => (props.item && value.value
  ? getConditionalFields(schema.value, {
    ...original,
    ...value.value.data
  }, externalConditions.value)
  : getConditionTypesObject()));

onMounted(async () => {
  try {
    [ original, externalConditions.value ] = await Promise.all([
      draftValue.load(props.docId, props.patchKey),
      props.item
        ? evaluateExternalConditions(schema.value, props.docId, $t)
        : externalConditions.value
    ]);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    apos.notify('apostrophe:error', {
      type: 'error',
      icon: 'alert-circle-icon'
    });
    emit('cancel');
    return;
  }
  value.value = {
    data: getData(),
    hasErrors: false
  };
  await nextTick();
  focus();
});

// The widget as it is, else as `AposSchema` takes it
function getData() {
  if (props.widgetType) {
    return klona(original);
  }
  return props.item ? klona(original) : { [props.field.name]: klona(original) };
}

// The input when it is there, the editor while the draft loads
function focus() {
  const el = input.value?.querySelector(
    'input:not([type="hidden"]), textarea, select, [contenteditable="true"], button'
  );
  (el || root.value)?.focus();
}

async function save() {
  triggerValidation.value = true;
  await nextTick();
  triggerValidation.value = false;
  if (value.value.hasErrors) {
    return;
  }
  const edited = getEdited();
  if (JSON.stringify(edited) === JSON.stringify(original)) {
    emit('cancel');
    return;
  }
  const { patchKey } = props;
  emit('save', {
    patch: { [patchKey]: edited },
    inverse: { [patchKey]: original },
    patchKey
  });
}

function getEdited() {
  const { data } = value.value;
  if (props.widgetType) {
    return data;
  }
  return props.item
    ? {
      ...original,
      ...data
    }
    : data[props.field.name];
}

defineExpose({
  focus
});
</script>

<style lang="scss" scoped>
$pad-x: $spacing-base + $spacing-half;

// Inset as the entry's detail is. Nothing clipped: an editor's menus, such
// as the rich text toolbar, overflow it
.apos-see-changes-editor {
  margin: $spacing-one-quarter $pad-x $spacing-base;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
  background-color: var(--a-background-primary);

  &:focus-visible {
    outline: 2px solid var(--a-primary);
    outline-offset: 1px;
  }

  &__field {
    padding: $spacing-base;
  }

  // Boxed as a rich text field is
  &__widget {
    padding: 0 $spacing-base;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
    background-color: var(--a-background-primary);

    &:focus-within {
      border-color: var(--a-base-2);
    }
  }

  &__loading {
    margin: 0 auto;
  }

  &__invalid {
    margin: 0 $spacing-base $spacing-base;
    color: var(--a-danger);
    font-size: var(--a-type-smaller);
    line-height: var(--a-line-tall);
  }

  &__controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $spacing-base;
    padding: $spacing-half $spacing-base;
    border-top: 1px solid var(--a-base-8);
  }

  &__cancel :deep(.apos-button) {
    color: var(--a-base-2);
    font-size: var(--a-type-smaller);
  }
}
</style>

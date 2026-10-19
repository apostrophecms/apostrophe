<template>
  <div
    ref="root"
    class="apos-see-changes-editor"
    role="group"
    tabindex="-1"
    :aria-label="$t(field.label || field.name)"
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
      <AposSchema
        v-else
        :schema="schema"
        :model-value="value"
        :doc-id="docId"
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
      {{ $t('apostrophe:seeChangesEditInvalid') }}
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
// `save` carries the patch that sets the edited value and its inverse; an
// unchanged value closes it as Cancel and Escape do
import {
  computed, nextTick, onMounted, ref
} from 'vue';
import { klona } from 'klona';

const props = defineProps({
  // An entry of `change-groups.js` with a `patchKey`
  entry: {
    type: Object,
    required: true
  },
  // The schema field at the entry's `fieldId`
  field: {
    type: Object,
    required: true
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

const root = ref(null);
const input = ref(null);
// `{ data, hasErrors }` as `AposSchema` emits it, once the draft is loaded
const value = ref(null);
const triggerValidation = ref(false);
let original;

const schema = computed(() => [ {
  ...props.field,
  hideLabel: true
} ]);

onMounted(async () => {
  let doc;
  try {
    doc = await apos.http.get(
      `${apos.modules['@apostrophecms/doc'].action}/${props.docId}`,
      { draft: true }
    );
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
  original = getValueAt(doc, props.entry.row.patchKey);
  value.value = {
    data: { [props.field.name]: klona(original) },
    hasErrors: false
  };
  await nextTick();
  focus();
});

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
  const edited = value.value.data[props.field.name];
  if (JSON.stringify(edited) === JSON.stringify(original)) {
    emit('cancel');
    return;
  }
  const { patchKey } = props.entry.row;
  emit('save', {
    patch: { [patchKey]: edited },
    inverse: { [patchKey]: original }
  });
}

// The value a patch key names: the field names, dotted, from the top level
// or from the object whose `_id` follows `@`. Related documents loaded
// with the draft are not looked into
function getValueAt(doc, patchKey) {
  const names = patchKey.split('.');
  let node = names[0].startsWith('@')
    ? findById(doc, names.shift().substring(1))
    : doc;
  for (const name of names) {
    node = node?.[name];
  }
  return node;

  function findById(node, id) {
    if (!node || (typeof node !== 'object')) {
      return null;
    }
    if (node._id === id) {
      return node;
    }
    const children = Array.isArray(node)
      ? node
      : Object.entries(node)
        .filter(([ key ]) => !key.startsWith('_'))
        .map(([ , child ]) => child);
    for (const child of children) {
      const found = findById(child, id);
      if (found) {
        return found;
      }
    }
    return null;
  }
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

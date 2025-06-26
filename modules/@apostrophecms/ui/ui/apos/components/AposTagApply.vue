<template>
  <AposContextMenu
    :menu-placement
    :button
    :disabled="isDisabled"
    class="apos-apply-tag-menu"
    @open="isOpen = $event"
    @close="clearSearch"
  >
    <div class="apos-apply-tag-menu__inner">
      <AposInputString
        ref="textInput"
        v-model="searchValue"
        :field="searchField"
        @return="checkOrCreate"
      />
      <div class="apos-apply-tag-menu__create">
        <AposButton
          :label="createBtnLabel"
          :disabled="!createUi && isTagFound"
          :disable-focus="!isOpen"
          type="quiet"
          @click="createOrManage"
        />
      </div>
    </div>
    <div
      v-if="!createUi"
      class="apos-apply-tag-menu__search-body"
    >
      <ol
        v-if="searchTags.length"
        class="apos-apply-tag-menu__tags"
      >
        <li
          v-for="tag in searchTags"
          :key="tag.slug"
          class="apos-apply-tag-menu__tag"
        >
          <AposCheckbox
            v-if="checkboxes[tag.slug]"
            v-model="checkboxes[tag.slug].model.value"
            :field="checkboxes[tag.slug].field"
            :choice="checkboxes[tag.slug].choice"
            :disable-focus="!isOpen"
            @updated="$event => updateTag($event.target.name)"
          />
        </li>
      </ol>
      <div
        v-if="(!searchTags.length && tags.length)"
        class="apos-apply-tag-menu__empty"
      >
        <p class="apos-apply-tag-menu__empty-message">
          {{ $t('apostrophe:tagNoTagsFoundPerhaps') }}
          <AposButton
            :label="{
              key: 'apostrophe:tagNoTagsFoundCreateOne',
              tag: searchValue.data
            }"
            type="quiet"
            :disabled="isTagFound"
            :disable-focus="!isOpen"
            @click="create"
          />
        </p>
        <span class="apos-apply-tag-menu__empty-icon">
          🌾
        </span>
      </div>
    </div>
    <div
      v-else
      class="apos-apply-tag-menu__create-btns"
    >
      <AposButton
        class="apos-apply-tag-menu__btn"
        type="secondary"
        label="apostrophe:cancel"
        @click.stop="clearSearch"
      />
      <AposButton
        class="apos-apply-tag-menu__btn"
        type="primary"
        label="apostrophe:tagCreateNewTag"
        :disabled="!searchValue.data.length || isTagFound"
        :tooltip="isTagFound && 'apostrophe:tagExist'"
        @click.stop="create"
      />
    </div>
  </AposContextMenu>
</template>

<script setup>
import {
  computed, inject, ref, useTemplateRef
} from 'vue';

const $t = inject('i18n');

const props = defineProps({
  primaryAction: {
    type: Object,
    default() {
      return {
        label: 'apostrophe:tagAddTag',
        action: 'add-tag'
      };
    }
  },
  tags: {
    type: Array,
    required: true
  },
  applyTo: {
    type: Object,
    required: true
  },
  menuPlacement: {
    type: String,
    default: 'bottom-start'
  },
  button: {
    type: Object,
    default: () => ({
      label: 'apostrophe:tag',
      iconOnly: false,
      icon: 'label-icon',
      modifiers: [ 'small' ],
      type: 'outline'
    })
  }
});

const emit = defineEmits([ 'added', 'checked', 'unchecked' ]);

const textInputEl = useTemplateRef('textInput');

const isOpen = ref(false);
const searchValue = ref({ data: '' });
const createUi = ref(false);

const applyToIds = computed(() => {
  return Object.keys(props.applyTo);
});

const searchText = computed(() => {
  return searchValue.value.data.toLowerCase();
});

// Returns true if a tag already exists for what you entered,
// so you can't create a new tag.
const isTagFound = computed(() => {
  return props.tags.some((tag) => tag.searchText === searchText.value);
});

// Sort checked first
// then indeterminate
// and finally unchecked alphabetically
const sortedTags = computed(() => {
  if (!applyToIds.value.length) {
    return props.tags;
  }

  const checked = props.tags.filter(tag =>
    checkboxes.value[tag.slug].model.value === true &&
    checkboxes.value[tag.slug].choice.indeterminate !== true
  );
  const indeterminate = props.tags.filter(tag =>
    checkboxes.value[tag.slug].model.value === true &&
    checkboxes.value[tag.slug].choice.indeterminate === true
  );
  const unchecked = props.tags.filter(tag =>
    checkboxes.value[tag.slug].model.value !== true
  );

  return [].concat(checked, indeterminate, unchecked);
});

// Unless we're in the middle of creating a new tag,
// search the tags that match the search input
const searchTags = computed(() => {
  if (searchText.value.length) {
    return sortedTags.value.filter((tag) => tag.searchText.includes(searchText.value));
  }

  return sortedTags.value;
});

const isDisabled = computed(() => {
  return applyToIds.value.length === 0;
});

const createBtnLabel = computed(() => {
  if (createUi.value) {
    return 'apostrophe:tagManage';
  }
  if (searchValue.value.data.length) {
    return {
      key: 'apostrophe:tagCreateTagName',
      tag: searchValue.value.data
    };
  }

  return 'apostrophe:tagCreateTag';
});

// Generate the field object for the search field.
const searchField = computed(() => {
  return {
    name: 'tagSearch',
    label: createUi.value ? 'apostrophe:tagCreateNewTag' : 'apostrophe:tagSearchApplyTags',
    placeholder: 'apostrophe:tagSearchPlaceholder',
    help: createUi.value ? 'apostrophe:tagCreateHelp' : 'apostrophe:findOrAddTag',
    icon: createUi.value ? '' : 'magnify-icon',
    disableFocus: !isOpen.value
  };
});

const checkboxes = computed(() => {
  const state = {};
  props.tags.forEach(tag => {
    state[tag.slug] = getCheckbox(tag, props.applyTo);
  });

  return state;
});

// methods
function clearSearch() {
  searchValue.value.data = '';
  closeCreateUi();
}

function checkOrCreate() {
  if (searchValue.value.data.length && searchTags.value.length) {
    const tag = searchTags.value.at(0);
    const { model } = checkboxes.value[tag.slug];

    checkboxes.value[tag.slug].model.value = !model.value;
    updateTag(tag.slug);

    return;
  }

  create();
};

function createOrManage() {
  if (!createUi.value && searchValue.value.data) {
    return create();
  }

  toggleCreateUi();
  textInputEl.value.$el.querySelector('input').focus();
}

// Create a new tag, or set up the input with "New Tag" if  empty.
function create() {
  // The string input's `return` event still submits duplicates, so prevent
  // them here.
  if (isTagFound.value) {
    return;
  }

  emit('added', searchValue.value.data);

  clearSearch();
}

function toggleCreateUi() {
  createUi.value = !createUi.value;
}

function closeCreateUi() {
  createUi.value = false;
}

function updateTag(name) {
  const { model } = checkboxes.value[name];

  if (model.value) {
    emit('checked', name);
    return;
  }

  delete checkboxes.value[name].choice.indeterminate;
  emit('unchecked', name);
}

function getCheckbox(tag, applyTo) {
  const checkbox = {
    field: {
      type: 'checkbox',
      name: tag.slug
    },
    choice: {
      label: tag.label,
      value: true,
      triggerIndeterminateEvent: true
    },
    model: ref(false)
  };

  const state = getCheckedState(tag);
  if (state === 'checked') {
    checkbox.model.value = true;
  }
  if (state === 'indeterminate') {
    checkbox.model.value = true;
    checkbox.choice.indeterminate = true;
  }

  return checkbox;
}

function getCheckedState(tag) {
  if (applyToIds.value.every(id => props.applyTo[id]?.includes(tag.aposDocId))) {
    return 'checked';
  }

  if (applyToIds.value.some(id => props.applyTo[id]?.includes(tag.aposDocId))) {
    return 'indeterminate';
  }

  return 'unchecked';
}
</script>

<style lang="scss" scoped>
.apos-apply-tag-menu :deep(.apos-context-menu__pane) {
  display: flex;
  flex-direction: column;
  width: 400px;
  padding: 0;
}

.apos-apply-tag-menu__inner,
.apos-apply-tag-menu__tags,
.apos-apply-tag-menu__empty {
  min-width: 280px;
  padding: $spacing-double;
}

.apos-apply-tag-menu__primary-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.apos-apply-tag-menu__inner {
  position: relative;
  padding-bottom: 12px;
}

.apos-apply-tag-menu__create {
  position: absolute;
  top: $spacing-double;
  right: $spacing-double;
  display: flex;
  justify-content: flex-end;
}

.apos-apply-tag-menu__tags {
  @include apos-list-reset();

  & {
    max-height: 315px;
    overflow-y: auto;
  }
}

.apos-apply-tag-menu__tag {
  padding: $spacing-base $spacing-double;
  border-top: 1px solid var(--a-base-9);
}

.apos-apply-tag-menu__search-body {
  flex: 1;
}

.apos-apply-tag-menu__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-quadruple $spacing-double;
}

.apos-apply-tag-menu__empty-message {
  @include type-base;

  & {
    margin-bottom: 20px;
    max-width: 240px;
    text-align: center;
  }
}

.apos-apply-tag-menu__empty-icon {
  color: var(--a-base-5);
}

.apos-apply-tag-menu__empty-icon {
  // Variable sizes are less important for icons.
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  @include type-title;

  & {
    margin: 0;
  }
}

.fade-enter-active, .fade-leave-active {
  transition: all 500ms;
}

.fade-enter, .fade-leave-to {
  position: absolute;
  width: 100%;
  opacity: 0;
  transform: translateY(-5px);
}

.apos-apply-tag-menu__create-btns {
  display: flex;
  flex-direction: row;
  justify-content: stretch;
  padding: 10px 20px 20px;
}

.apos-apply-tag-menu__btn {
  flex: 1;

  &:first-child {
    margin-right: 10px;
  }

  :deep(.apos-button) {
    box-sizing: border-box;
    width: 100%;
  }
}
</style>

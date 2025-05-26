<template>
  <AposContextMenu
    :menu-placement
    :button
    :disabled="isDisabled"
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
      <div class="apos-apply-tag__create">
        <AposButton
          :label="createLabel"
          :disabled="isTagFound"
          :disable-focus="!isOpen"
          type="quiet"
          @click="create"
        />
      </div>
      <div>
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
    </div>
  </AposContextMenu>
</template>

<script setup>
import {
  computed, inject, reactive, ref, useTemplateRef
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

const textInput = useTemplateRef('textInput');

// data
const isOpen = ref(false);
const searchValue = ref({ data: '' });

// computed
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

// Unless we're in the middle of creating a new tag,
// search the tags that match the search input
const searchTags = computed(() => {
  if (searchText.value.length) {
    return props.tags.filter((tag) => tag.searchText.includes(searchText.value));
  }

  return props.tags;
});

const isDisabled = computed(() => {
  return applyToIds.value.length === 0;
});

// Generate the button label.
const createLabel = computed(() => {
  if (searchValue.value.data.length) {
    return {
      key: 'apostrophe:tagCreateTag',
      tag: searchValue.value.data
    };
  }

  return 'apostrophe:tagCreateNewTag';
});

// Generate the field object for the search field.
const searchField = computed(() => {
  return {
    name: 'tagSearch',
    label: 'apostrophe:tagSearchApplyTags',
    placeholder: 'apostrophe:tagSearchPlaceholder',
    help: 'apostrophe:findOrAddTag',
    icon: !searchTags.value.length ? 'pencil-icon' : 'magnify-icon',
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

// Create a new tag, or set up the input with "New Tag" if  empty.
function create() {
  if (!searchValue.value.data.length) {
    textInput.$el.querySelector('input').focus();

    return;
  }

  // The string input's `return` event still submits duplicates, so prevent
  // them here.
  if (isTagFound.value) {
    return;
  }

  emit('added', searchValue.value.data);
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
  .apos-apply-tag-menu__inner {
    min-width: 280px;
  }

  .apos-apply-tag-menu__primary-action {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .apos-apply-tag__create {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .apos-apply-tag-menu__tags {
    @include apos-list-reset();

    & {
      max-height: 160px;
      overflow-y: auto;
      margin-top: 15px;
      // Negative margin/padding below is for the checkbox focus state.
      margin-left: -10px;
      padding-left: 10px;
    }
  }

  .apos-apply-tag-menu__tag {
    margin-top: 10px;
  }

  .apos-apply-tag-menu__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 0 20px;
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

</style>

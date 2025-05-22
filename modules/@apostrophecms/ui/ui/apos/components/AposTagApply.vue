<!--
// input
* tags
* applyTo
* checked
// output
* added
* checked
* unchecked
// method
* search
---
-->
<template>
  <AposContextMenu
    :menu-placement
    :button
    :disabled="isDisabled"
    @open="isOpen = $event"
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
          v-if="searchTags.length && !isCreating"
          class="apos-apply-tag-menu__tags"
        >
          <li
            v-for="tag in searchTags"
            :key="tag.slug"
            class="apos-apply-tag-menu__tag"
          >
            <AposCheckbox
              v-if="checkboxes[tag.slug]"
              v-model="checkboxes[tag.slug].model"
              :field="checkboxes[tag.slug].field"
              :choice="checkboxes[tag.slug].choice"
              :disable-focus="!isOpen"
            />
            <!-- @updated="updateTag" -->
          </li>
        </ol>
        <div
          v-if="(!searchTags.length && tags.length) && !isCreating"
          class="apos-apply-tag-menu__empty"
        >
          <p class="apos-apply-tag-menu__empty-message">
            {{ $t('apostrophe:tagNoTagsFoundPerhaps') }}
            <AposButton
              :label="{
                key: 'apostrophe:tagNoTagsFoundCreateOne',
                tag: searchText
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
  computed, inject, nextTick, reactive, ref, useTemplateRef
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

const emit = defineEmits([ 'created', 'checked', 'unchecked' ]);

const textInput = useTemplateRef('textInput');

// data
const isOpen = ref(false);
const isCreating = ref(false);
const searchValue = reactive({ data: '' });

// computed
const applyToIds = computed(() => {
  return Object.keys(props.applyTo);
});

const searchText = computed(() => {
  return searchValue.data.toLowerCase();
});

// Returns true if a tag already exists for what you entered,
// so you can't create a new tag.
const isTagFound = computed(() => {
  return props.tags.some((tag) => tag.searchText === searchText.value);
});

// Unless we're in the middle of creating a new tag,
// search the tags that match the search input (as long as above 2 characters).
const searchTags = computed(() => {
  if (searchText.value.length > 2) {
    return props.tags.filter((tag) => tag.searchText.includes(searchText.value));
  }

  return props.tags;
});

const isDisabled = computed(() => {
  return applyToIds.value.length === 0;
});

// Generate the button label.
const createLabel = computed(() => {
  if (searchText.value.length) {
    return {
      key: 'apostrophe:tagCreateTag',
      tag: searchText.value
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

function checkOrCreate() {
  // if (!searchText.value.length > 2 && searchTags.value.length) {
  //   // TODO: toggle and emit
  //   emit('checked', searchTags.value.at(0));
  //   emit('unchecked', searchTags.value.at(0));
  //   return;
  // }

  create();
};

// Create a new tag, or set up the input with "New Tag" if  empty.
function create() {
  // The string input's `return` event still submits duplicates, so prevent
  // them here.
  // if (isTagFound.value) {
  //   return;
  // }
  //
  // if (!searchText.value || !searchText.value.length) {
  //   isCreating.value = true;
  //   searchValue.data = $t('apostrophe:tagNewTag');
  //   textInput.$el.querySelector('input').focus();
  //   nextTick(() => {
  //     textInput.$el.querySelector('input').select();
  //   });
  // } else {
  //   // TODO: No current sign of `create-tag` usage. Delete if unused.
  //   emit('create-tag', searchText.value);
  //
  //   const tag = {
  //     label: searchText.value,
  //     // TODO: incorrect slug, handle outside the component
  //     slug: searchText.value,
  //     match: props.applyTo
  //   };
  //   checkboxes[tag.slug] = createCheckbox(tag, props.applyTo);
  //   // TODO: remove
  //   // props.tags.unshift(tag);
  //   isCreating.value = false;
  //   emit('update', props.tags);
  // }
}

// `checked` will track all that are checked, but `updateTag` also
// updates indeterminate state and `match` arrays for the updated tag.
// function updateTag($event) {
//   const slug = $event.target.value.toLowerCase();
//   // Find the matching tag.
//   const tag = props.tags.find(tag => tag.searchText === slug);
//   // Find the matching checkbox.
//   const box = checkboxes[slug];
//   if (!box) {
//     // This should never happen. You updated a checkbox to trigger this.
//     return;
//   }
//
//   if (!tag.match) {
//     // If the tag has no `match` values, assign all the `applyTo` IDs to it.
//     tag.match = props.applyTo;
//   } else {
//     if (tag.match.length === props.applyTo.length) {
//       // If the tag has existings matches
//       // previously full check, unapply to all
//       delete tag.match;
//     } else {
//       // Previously indeterminate. Set it's matches to all of `applyTo`.
//       tag.match = props.applyTo;
//
//       delete box.choice.indeterminate;
//     }
//   }
//   // Force refresh the checkboxes.
//   // keyPrefix.value = `key-${createId()}`;
//
//   // TODO: This should probably have an "Apply" or "Save" button to confirm
//   // before running emitting the updates.
//   emit('update', props.tags);
// }

function getCheckbox(tag, applyTo) {
  const checkbox = {
    field: {
      type: 'checkbox',
      name: tag.slug
    },
    choice: {
      label: tag.label,
      value: true
    },
    model: false
  };

  const state = getCheckedState(tag);
  if (state === 'checked') {
    checkbox.model = true;
  }
  if (state === 'indeterminate') {
    checkbox.model = true;
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

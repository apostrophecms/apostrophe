<template>
  <AposContextMenu
    @open="open = $event"
    menu-placement="bottom-end"
  >
    <div class="apos-apply-tag-menu__inner">
      <AposInputString
        @input="updateSearchInput"
        @return="create"
        :field="searchField" :value="searchValue"
        :status="searchStatus" ref="textInput"
      />
      <div class="apos-apply-tag__create">
        <AposButton
          @click="create"
          :label="createLabel"
          type="quiet"
          :disabled="disabledCreate"
          :disable-focus="!open"
        />
      </div>
      <transition name="fade">
        <ol v-if="searchTags.length && !creating" class="apos-apply-tag-menu__tags">
          <li
            class="apos-apply-tag-menu__tag" v-for="tag in searchTags"
            :key="`${keyPrefix}-${tag.slug}`"
          >
            <AposCheckbox
              v-if="checkboxes[tag.slug]"
              :field="checkboxes[tag.slug].field"
              :status="checkboxes[tag.slug].status"
              :choice="checkboxes[tag.slug].choice"
              v-model="checked"
              @updated="updateTag"
              :disable-focus="!open"
            />
          </li>
        </ol>
        <div v-if="(!searchTags.length && myTags.length) && !creating" class="apos-apply-tag-menu__empty">
          <p class="apos-apply-tag-menu__empty-message">
            We couldn't find any matching tags. Perhaps
            <AposButton
              @click="create"
              :label="`create ${searchInputValue} ?`"
              type="quiet"
              :disabled="disabledCreate"
              :disable-focus="!open"
            />
          </p>
          <span class="apos-apply-tag-menu__empty-icon">
            🌾
          </span>
        </div>
      </transition>
    </div>
  </AposContextMenu>
</template>

<script>
import AposHelpers from '../mixins/AposHelpersMixin';

export default {
  mixins: [ AposHelpers ],
  props: {
    primaryAction: {
      type: Object,
      default() {
        return {
          label: 'Add Tag',
          action: 'add-tag'
        };
      }
    },
    tags: {
      type: Array,
      default() {
        return [];
      }
    },
    applyTo: {
      type: Array,
      required: true
    },
    tipAlignment: {
      type: String,
      default: 'left'
    }
  },
  emits: [ 'create-tag', 'update' ],
  data() {
    return {
      creating: false,
      searchValue: { data: '' },
      searchStatus: {},
      checkboxes: {},
      // `myTags` will be the canonical array of tags and matching doc IDs that
      // we will emit.
      myTags: [ ...this.tags ],
      checked: [],
      searchInputValue: '',
      keyPrefix: this.generateId('key'), // used to keep checkboxes in sync w state
      origin: 'below',
      open: false,
      button: {
        label: 'Context Menu Label',
        iconOnly: true,
        icon: 'Label',
        type: 'outline'
      }
    };
  },
  computed: {
    // Returns true if a tag slug already exists for what you entered, so you
    // can't create a new tag.
    disabledCreate() {
      const matches = this.myTags.filter((tag) => {
        return tag.slug === this.searchInputValue;
      });
      if (matches.length) {
        return true;
      } else {
        return false;
      }
    },
    // Unless we're in the middle of creating a new tag, search the tags that
    // match the search input (as long as above 2 characters).
    searchTags() {
      if (this.creating) {
        return [];
      }
      if (this.searchInputValue.length > 2) {
        return this.myTags.filter((tag) => {
          return tag.slug.includes(this.searchInputValue);
        });
      } else {
        return this.myTags;
      }
    },
    // Generate the button label.
    createLabel() {
      if (this.searchInputValue.length) {
        return `Create tag "${this.searchInputValue}"`;
      } else {
        return 'Create new tag';
      }
    },
    // Generate the field object for the search field.
    searchField() {
      return {
        name: 'tagSearch',
        label: 'Apply Tags',
        placeholder: 'Tags...',
        help: 'Find an existing tag or add a new one',
        icon: (!this.searchTags || !this.searchTags.length) ? 'pencil-icon' : 'magnify-icon',
        disableFocus: !this.open
      };
    }
  },
  mounted () {
    const checkboxes = {};
    this.tags.forEach((tag) => {
      checkboxes[tag.slug] = this.createCheckbox(tag, this.applyTo);
    });
    this.checkboxes = checkboxes;
  },
  methods: {
    // Create a new tag, or set up the input with "New Tag" if  empty.
    create() {
      // The string input's `return` event still submits duplicates, so prevent
      // them here.
      if (this.disabledCreate) {
        return;
      }

      if (!this.searchInputValue || !this.searchInputValue.length) {
        this.creating = true;
        this.searchValue.data = 'New Tag';
        this.$refs.textInput.$el.querySelector('input').focus();
        this.$nextTick(() => {
          this.$refs.textInput.$el.querySelector('input').select();
        });
      } else {
        // TODO: No current sign of `create-tag` usage. Delete if unused.
        this.$emit('create-tag', this.searchInputValue);

        const tag = {
          label: this.searchInputValue,
          slug: this.searchInputValue,
          match: this.applyTo
        };
        this.checkboxes[tag.slug] = this.createCheckbox(tag, this.applyTo);
        this.myTags.unshift(tag);
        this.creating = false;
        this.emitState();
      }
    },
    // `checked` will track all that are checked, but `updateTag` also
    // updates indeterminate state and `match` arrays for the updated tag.
    updateTag($event) {
      const slug = $event.target.value;
      // Find the matching tag.
      const tag = this.myTags.find(tag => tag.slug === slug);
      // Find the matching checkbox.
      const box = this.checkboxes[slug];
      if (!box) {
        // This should never happen. You updated a checkbox to trigger this.
        return;
      }

      if (!tag.match) {
        // If the tag has no `match` values, assign all the `applyTo` IDs to it.
        tag.match = this.applyTo;
      } else {
        if (tag.match.length === this.applyTo.length) {
          // If the tag has existings matches
          // previously full check, unapply to all
          delete tag.match;
        } else {
          // Previously indeterminate. Set it's matches to all of `applyTo`.
          tag.match = this.applyTo;

          delete box.status.indeterminate;
          delete box.choice.indeterminate;
        }
      }
      // Force refresh the checkboxes.
      this.keyPrefix = this.generateId('key');

      // TODO: This should probably have an "Apply" or "Save" button to confirm
      // before running emitting the updates.
      this.emitState();
    },
    emitState() {
      this.$emit('update', this.myTags);
    },
    // Take the string field value and get a lower case version.
    updateSearchInput(value) {
      this.searchInputValue = value.data.toLowerCase();
      if (!this.searchInputValue) {
        this.creating = false;
      }
    },
    createCheckbox(tag, applyTo) {
      const checkbox = {
        field: {
          type: 'checkbox',
          name: tag.slug
        },
        // TODO: status and value are not needed.
        status: {},
        value: { data: [] },
        choice: {
          label: tag.label,
          value: tag.slug
        }
      };

      const state = this.getCheckedState(tag);

      // If so, add those slugs to the `checked` array.
      if (state !== 'unchecked') {
        this.checked.push(tag.slug);
      }

      // If only some of `applyTo` matches, use the indeterminate state.
      if (state === 'indeterminate') {
        checkbox.choice.indeterminate = true;
        checkbox.status.indeterminate = true;
      }
      return checkbox;
    },
    getCheckedState (tag) {
      if (!tag.match) {
        return 'unchecked';
      }
      // Go over the docs, checking how well they match the tag.
      if (this.applyTo.every(id => tag.match.includes(id))) {
        return 'checked';
      } else if (this.applyTo.some(id => tag.match.includes(id))) {
        return 'indeterminate';
      }

      return 'unchecked';
    }
  }
};

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
    max-height: 160px;
    overflow-y: auto;
    margin-top: 15px;
    // Negative margin/padding below is for the checkbox focus state.
    margin-left: -10px;
    padding-left: 10px;
  }

  .apos-apply-tag-menu__tag {
    margin-top: 10px;
  }

  .apos-apply-tag-menu__empty {
    display: flex;
    align-items: center;
    flex-direction: column;
    padding: 40px 0 20px;
  }

  .apos-apply-tag-menu__empty-message {
    margin-bottom: 20px;
    max-width: 240px;
    font-size: map-get($font-sizes, default);
    text-align: center;
  }

  .apos-apply-tag-menu__empty-icon {
    color: var(--a-base-5);
  }

  .apos-apply-tag-menu__empty-icon {
    // Variable sizes are less important for icons.
    /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
    font-size: 32px;
  }

  .fade-enter-active, .fade-leave-active {
    transition: all 0.5s;
  }

  .fade-enter, .fade-leave-to {
    // position: absolute;
    // width: 100%;
    // opacity: 0;
    // transform: translateY(-5px);
  }

</style>

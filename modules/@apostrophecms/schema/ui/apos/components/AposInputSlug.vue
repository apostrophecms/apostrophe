<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div :class="wrapperClasses">
        <span
          class="apos-input__slug-locale-prefix"
          v-if="localePrefix"
          @click="passFocus"
          v-apos-tooltip="'apostrophe:cannotChangeSlugPrefix'"
        >
          {{ localePrefix }}
        </span>
        <input
          :class="classes"
          v-model="next" :type="type"
          :placeholder="$t(field.placeholder)"
          @keydown.enter="$emit('return')"
          :disabled="field.readOnly" :required="field.required"
          :id="uid" :tabindex="tabindex"
          ref="input"
        >
        <component
          v-if="icon"
          :size="iconSize"
          class="apos-input-icon"
          :is="icon"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
// NOTE: This is a temporary component, copying AposInputString. Base modules
// already have `type: 'slug'` fields, so this is needed to avoid distracting
// errors.
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import sluggo from 'sluggo';
import debounce from 'debounce-async';
import { klona } from 'klona';

export default {
  name: 'AposInputSlug',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  data() {
    return {
      conflict: false,
      isArchived: null
    };
  },
  computed: {
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    },
    type () {
      if (this.field.type) {
        return this.field.type;
      } else {
        return 'text';
      }
    },
    classes () {
      return [ 'apos-input', 'apos-input--text', 'apos-input--slug' ];
    },
    wrapperClasses () {
      return [ 'apos-input-wrapper' ].concat(this.localePrefix ? [ 'apos-input-wrapper--with-prefix' ] : []);
    },
    icon () {
      if (this.error) {
        return 'circle-medium-icon';
      } else if (this.field.type === 'date') {
        return 'calendar-icon';
      } else if (this.field.type === 'time') {
        return 'clock-icon';
      } else if (this.field.icon) {
        return this.field.icon;
      } else {
        return null;
      }
    },
    prefix () {
      return this.field.prefix || '';
    },
    localePrefix() {
      return this.field.page && apos.i18n.locales[apos.i18n.locale].prefix;
    }
  },
  watch: {
    followingValues: {
      // We are usually interested in followingValue.title, but a
      // secondary slug field could be configured to watch
      // one or more other fields
      deep: true,
      handler(newValue, oldValue) {
        const newClone = klona(newValue);
        const oldClone = klona(oldValue);

        // Track whether the slug is archived for prefixing.
        this.isArchived = newValue.archived;
        // We only want the string properties to build the slug itself.
        delete newClone.archived;
        delete oldClone.archived;

        oldValue = Object.values(oldClone).join(' ');
        newValue = Object.values(newClone).join(' ');

        if (this.compatible(oldValue, this.next) && !newValue.archived) {
          // If this is a page slug, we only replace the last section of the slug.
          if (this.field.page) {
            let parts = this.next.split('/');
            parts = parts.filter(part => part.length > 0);
            if (parts.length) {
              // Remove last path component so we can replace it
              parts.pop();
            }
            parts.push(this.slugify(newValue, { componentOnly: true }));
            // TODO: handle page archives.
            this.next = `/${parts.join('/')}`;
          } else {
            this.next = this.slugify(newValue);
          }
        }
      }
    }
  },
  async mounted() {
    this.debouncedCheckConflict = debounce(() => this.checkConflict(), 250);
    if (this.next.length) {
      await this.debouncedCheckConflict();
    }
  },
  methods: {
    async watchNext() {
      this.next = this.slugify(this.next);
      this.validateAndEmit();
      try {
        await this.debouncedCheckConflict();
      } catch (e) {
        if (e === 'canceled') {
          // That's fine
        } else {
          throw e;
        }
      }
    },
    validate(value) {
      if (this.conflict) {
        return {
          name: 'conflict',
          message: 'apostrophe:slugInUse'
        };
      }
      if (this.field.required) {
        if (!value.length) {
          return 'required';
        }
      }
      if (this.field.min) {
        if (value.length && (value.length < this.field.min)) {
          return 'min';
        }
      }
      if (this.field.max) {
        if (value.length && (value.length > this.field.max)) {
          return 'max';
        }
      }
      return false;
    },
    compatible(title, slug) {
      if ((typeof title) !== 'string') {
        title = '';
      }
      if (this.field.page) {
        const matches = slug.match(/[^/]+$/);
        slug = (matches && matches[0]) || '';
      }
      return ((title === '') && (slug === `${this.prefix}`)) ||
        this.slugify(title) === this.slugify(slug);
    },
    // if componentOnly is true, we are slugifying just one component of
    // a slug as part of following the title field, and so we do *not*
    // want to allow slashes (when editing a page) or set a prefix.
    slugify(s, { componentOnly = false } = {}) {
      const options = {
        def: ''
      };
      if (this.field.page && !componentOnly) {
        options.allow = '/';
      }
      let preserveDash = false;
      // When you are typing a slug it feels wrong for hyphens you typed
      // to disappear as you go, so if the last character is not valid in a slug,
      // restore it after we call sluggo for the full string
      if (this.focus && s.length && (sluggo(s.charAt(s.length - 1), options) === '')) {
        preserveDash = true;
      }
      s = sluggo(s, options);
      if (preserveDash) {
        s += '-';
      }
      if (this.field.page && !componentOnly) {
        if (!s.charAt(0) !== '/') {
          s = `/${s}`;
        }
        s = s.replace(/\/+/g, '/');
        if (s !== '/') {
          s = s.replace(/\/$/, '');
        }
      }
      if (!componentOnly) {
        s = this.setPrefix(s);
      }

      return s;
    },
    setPrefix (slug) {
      // Get a fresh clone of the slug.
      let updated = slug;
      const archivedRegexp = new RegExp(`^deduplicate-[a-z0-9]+-${this.prefix}`);

      // Prefix if the slug doesn't start with the prefix OR if its archived
      // and it doesn't start with the dedupe+prefix pattern.
      if (
        !updated.startsWith(this.prefix) ||
        (this.isArchived && !updated.match(archivedRegexp))
      ) {
        let archivePrefix = '';
        // If archived, remove the dedupe pattern to add again later.
        if (this.isArchived) {
          archivePrefix = updated.match(/^deduplicate-[a-z0-9]+-/);
          updated = updated.replace(archivePrefix, '');
        }

        if (this.prefix.startsWith(updated)) {
          // If they delete the `-`, and the prefix is `recipe-`,
          // we want to restore `recipe-`, not set it to `recipe-recipe`
          updated = this.prefix;
        } else {
          // Make sure we're not double prefixing archived slugs.
          updated = updated.startsWith(this.prefix) ? updated : this.prefix + updated;
        }
        // Reapply the dedupe pattern if archived. If being restored from the
        // doc editor modal it will momentarily be tracked as archived but
        // without not have the archive prefix, so check that too.
        updated = this.isArchived && archivePrefix ? `${archivePrefix}${updated}` : updated;
      }
      return updated;
    },
    async checkConflict() {
      let slug;
      try {
        slug = this.next;
        await apos.http.post(`${apos.doc.action}/slug-taken`, {
          body: {
            slug,
            _id: this.docId
          },
          draft: true
        });
        // Still relevant?
        if (slug === this.next) {
          this.conflict = false;
          this.validateAndEmit();
        } else {
          // Can ignore it, another request
          // probably already in-flight
        }
      } catch (e) {
        // 409: Conflict (slug in use)
        if (e.status === 409) {
          // Still relevant?
          if (slug === this.next) {
            this.conflict = true;
            this.validateAndEmit();
          } else {
            // Can ignore it, another request
            // probably already in-flight
          }
        } else {
          throw e;
        }
      }
    },
    passFocus() {
      this.$refs.input.focus();
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-wrapper--with-prefix {
    @include apos-input();
    display: flex;
    align-items: center;
    color: var(--a-base-4);
    .apos-input {
      border: none;
      padding-left: 0;
      &:hover,
      &:focus {
        border: none;
        box-shadow: none;
      }
    }
  }
  .apos-input__slug-locale-prefix {
    display: inline-block;
    padding-left: 20px;
  }
  .apos-field--inverted .apos-input-wrapper--with-prefix {
    background-color: var(--a-background-primary);
  }
</style>

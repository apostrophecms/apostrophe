// NOTE: This is a temporary component, copying AposInputString. Base modules
// already have `type: 'slug'` fields, so this is needed to avoid distracting
// errors.
import { klona } from 'klona';
import sluggo from 'sluggo';
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';

export default {
  name: 'AposInputSlug',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  data() {
    return {
      conflict: false,
      isArchived: null,
      originalParentSlug: ''
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
      handler(newValue, oldValue) {
        if (this.field.followingIgnore === true) {
          return;
        }
        let newClone = klona(newValue);
        let oldClone = klona(oldValue);
        if (Array.isArray(this.field.followingIgnore)) {
          newClone = Object.fromEntries(
            Object.entries(newValue).filter(([ key ]) => {
              return !this.field.followingIgnore.includes(key);
            })
          );
          oldClone = Object.fromEntries(
            Object.entries(oldValue).filter(([ key ]) => {
              return !this.field.followingIgnore.includes(key);
            })
          );
        }

        // Track whether the slug is archived for prefixing.
        this.isArchived = newValue.archived;
        // We only want the string properties to build the slug itself.
        delete newClone.archived;
        delete oldClone.archived;

        // TODO: Do we really need to rely on all following values?
        const oldVal = Object
          .values(oldClone)
          .join(' ')
          .replace(/\//g, ' ');

        const value = Object
          .values(newClone)
          .join(' ')
          .replace(/\//g, ' ');

        if (oldVal === value) {
          return;
        }

        const isCompat = this.compatible(oldVal, this.next);
        if (!isCompat || newValue.archived) {
          return;
        }

        if (!this.field.page) {
          this.next = this.slugify(value);
          return;
        }

        // If this is a page slug, the parent slug hasn't been changed
        // and the title matches the slug we only replace its last section.
        const parentSlug = this.getParentSlug(this.next);
        if (this.originalParentSlug === parentSlug) {
          // TODO: handle page archives.
          const slug = this.slugify(value, { componentOnly: true });
          this.next = `${parentSlug}/${slug}`;
        }
      }
    }
  },
  async mounted() {
    this.debouncedCheckConflict = debounceAsync(this.requestCheckConflict, 250, {
      onSuccess: this.setConflict
    });
    if (this.next.length) {
      await this.debouncedCheckConflict.skipDelay();
    }
    this.originalParentSlug = this.getParentSlug(this.next);
  },
  onBeforeUnmount() {
    this.debouncedCheckConflict.cancel();
  },
  methods: {
    getParentSlug(slug = '') {
      return slug.slice(-1) === '/'
        ? slug.substring(0, slug.length - 1)
        : slug.split('/').slice(0, -1).join('/');
    },
    async watchNext() {
      this.next = this.slugify(this.next);
      this.validateAndEmit();
      await this.debouncedCheckConflict();
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
    compatible(title = '', slug) {
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
      // to disappear as you go, so if the last character is not valid in a
      // slug, restore it after we call sluggo for the full string
      if (this.focus && s.length && (sluggo(s.charAt(s.length - 1), options) === '')) {
        preserveDash = true;
      }

      let slug = sluggo(s, options);
      if (preserveDash) {
        slug += '-';
      }

      if (this.field.page && !componentOnly) {
        if (!slug.charAt(0) !== '/') {
          slug = `/${slug}`;
        }
        slug = slug.replace(/\/+/g, '/');
      }

      if (!componentOnly) {
        slug = this.setPrefix(slug);
      }

      return slug;
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
    async requestCheckConflict() {
      let slug;
      try {
        slug = this.next;
        if (slug.length) {
          await apos.http.post(`${apos.doc.action}/slug-taken`, {
            body: {
              slug,
              _id: this.docId
            },
            draft: true
          });

          // Still relevant?
          if (slug === this.next) {
            return false;
          }
          // Should not happen, another request
          // already in-flight shouldn't be possible now.
          return null;
        }
      } catch (e) {
        // 409: Conflict (slug in use)
        if (e.status === 409) {
          // Still relevant?
          if (slug === this.next) {
            return true;
          }
          // Should not happen, another request
          // already in-flight shouldn't be possible now.
          return null;
        } else {
          throw e;
        }
      }
    },
    async setConflict(result) {
      if (result === null) {
        return;
      }
      this.conflict = result;
      this.validateAndEmit();
    },
    passFocus() {
      this.$refs.input.focus();
    },
    emitReturn() {
      this.$emit('return');
    }
  }
};

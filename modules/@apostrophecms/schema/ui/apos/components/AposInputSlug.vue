<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <input
          :class="classes"
          v-model="next" :type="type"
          :placeholder="field.placeholder"
          @keydown.enter="$emit('return')"
          :disabled="field.readOnly" :required="field.required"
          :id="uid" :tabindex="tabindex"
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

export default {
  name: 'AposInputSlug',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  data() {
    return {
      conflict: false
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
      return [ 'apos-input', 'apos-input--text' ];
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
    }
  },
  watch: {
    followingValues: {
      // We are usually interested in followingValue.title, but a
      // secondary slug field could be configured to watch
      // one or more other fields
      deep: true,
      handler(newValue, oldValue) {
        oldValue = Object.values(oldValue).join(' ');
        newValue = Object.values(newValue).join(' ');
        if (this.compatible(oldValue, this.next)) {
          // If this is a page slug, we only replace the last section of the slug.
          if (this.field.page) {
            let parts = this.next.split('/');
            parts = parts.filter(part => part.length > 0);
            if (parts.length) {
              // Remove last path component so we can replace it
              parts.pop();
            }
            parts.push(this.slugify(newValue, { componentOnly: true }));
            this.next = `/${parts.join('/')}`;
          } else {
            this.next = this.slugify(newValue);
          }
        }
      }
    }
  },
  mounted() {
    this.debouncedCheckConflict = debounce(() => this.checkConflict(), 250);
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
          message: 'Slug already in use'
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
      return ((title === '') && (slug === `${this.prefix}none`)) || this.slugify(title) === this.slugify(slug);
    },
    // if componentOnly is true, we are slugifying just one component of
    // a slug as part of following the title field, and so we do *not*
    // want to allow slashes (when editing a page) or set a prefix.
    slugify(s, { componentOnly = false } = {}) {
      const options = {};
      if (this.field.page && !componentOnly) {
        options.allow = '/';
      }
      let preserveSlash = false;
      // When you are typing a slug it feels wrong for hyphens you typed
      // to disappear as you go, so if the last character is not valid in a slug,
      // restore it after we call sluggo for the full string
      if (this.focus && s.length && (sluggo(s.charAt(s.length - 1), options) === 'none')) {
        preserveSlash = true;
      }
      s = sluggo(s, options);
      if (preserveSlash) {
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
      if (!s.length) {
        s = 'none';
      }
      if (!componentOnly) {
        if (!s.startsWith(this.prefix)) {
          if (this.prefix.startsWith(s)) {
            // If they delete the `-`, and the prefix is `recipe-`,
            // we want to restore `recipe-`, not set it to `recipe-recipe`
            s = this.prefix;
          } else {
            s = this.prefix + s;
          }
        }
      }
      return s;
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
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input--date,
  .apos-input--time {
    // lame magic number ..
    // height of date/time input is slightly larger than others due to the browser spinner ui
    height: 46px;
  }
  .apos-input--date {
    // padding is lessend to overlap with calendar UI
    padding-right: $input-padding * 1.4;
    &::-webkit-calendar-picker-indicator { opacity: 0; }
    &::-webkit-clear-button {
      position: relative;
      right: 5px;
    }
  }
  .apos-input--time {
    padding-right: $input-padding * 2.5;
  }

  .apos-field--small .apos-input--date,
  .apos-field--small .apos-input--time {
    height: 33px;
  }
</style>

<template>
  <ApostropheFieldset :field="field" :error="error">
    <template slot="body">
      <input @focus="focus=true" @blur="focus=false" ref="input" v-model="next" />
    </template>
  </ApostropheFieldset>
</template>

<script>

import ApostropheFieldMixin from '../mixins/ApostropheFieldMixin.js';
import slugify from 'sluggo';

export default {
  mixins: [ ApostropheFieldMixin ],
  name: 'ApostropheSlugField',
  data() {
    const data = {
      focus: false
    };
    if (this.field.slugifies) {
      data.compatible = slugCompatible(data.next, this.context[this.field.slugifies]);
    }
    return data;
  },
  created() {
    if (this.field.slugifies) {
      const that = this;
      this.$watch(`context.${this.field.slugifies}`, function() {
        that.slugifiesUpdated();
      });
    }
  },
  computed: {
    slugifies() {
      return this.context[this.field.slugifies];
    }
  },
  watch: {
    next(value) {
      if (!this.enforce()) {
        this.compatible = slugCompatible(this.next, this.slugifies);
        this.watchNext();
      }
    },
    focus(value) {
      if (!value) {
        // If we just lost the focus, enforce slug rules again,
        // this time disallowing trailing hyphens
        this.enforce();
      }
    }
  },
  methods: {
    slugifiesUpdated() {
      if (this.compatible) {
        this.next = slugify(this.slugifies);
      }
      this.compatible = slugCompatible(this.next, this.slugifies);
    },
    // returns true if changes were necessary to enforce the slug format
    enforce() {
      const hyphenEnd = this.next.match(/-$/);
      let slugified = slugify(this.next);
      // Allow hyphens at the end if we still have the focus
      if (this.focus) {
        slugified += hyphenEnd ? '-' : '';
      }
      if (slugified !== this.next) {
        let pos = this.focus ? this.$refs.input.selectionStart : 0;
        pos -= (slugified.length - this.next.length);
        if (pos < 0) {
          pos = 0;
        }
        this.next = slugified;
        if (this.focus) {
          this.$nextTick(() => {
            this.$refs.input.selectionEnd = pos;
          });
        }
        return true;
      }
    },
    validate() {
      const value = this.next;
      if (this.field.required) {
        if (!value.length) {
          return 'required';
        }
      }
      return false;
    }
  }
};

function slugCompatible(slug, slugifies) {
  if (slug === undefined) {
    return true;
  } else if (slugify(slugifies) === slug) {
    return true;
  } else {
    return false;
  }  
}

</script>

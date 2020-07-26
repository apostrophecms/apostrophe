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
import debounce from 'debounce-async';

export default {
  mixins: [ ApostropheFieldMixin ],
  name: 'ApostropheSlugField',
  data() {
    const data = {
      focus: false,
      taken: false
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
      if (!this.focus) {
        // change came from field we slugify, so it is
        // appropriate to fix our suggestions as we go
        this.deduplicate();
      } else {
        this.checkTaken();
      }
    },
    focus(value) {
      if (!value) {
        // If we just lost the focus, enforce slug rules again,
        // this time disallowing trailing hyphens
        this.enforce();
      }
    },
    taken(value) {
      this.validateAndEmit();
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
    async deduplicate() {
      if (!this.debouncedDeduplicate) {
        this.debouncedDeduplicate = debounce(body, 250);
      }
      // No await here because we want this to happen
      // in the background, we can use catch() old-school
      // to prevent an uncaught rejection error
      try {
        await this.debouncedDeduplicate();
      } catch (e) {
        if (e === 'canceled') {
          // debouncer canceled it, no worries
          return;
        }
        console.error(e);
      }

      async function body() {
        const result = await apos.http.post(
          `${window.apos.docs.action}/deduplicate-slug`,
          {
            busy: true,
            body: {
              slug: this.next,
              _id: this.context._id
            }
          }
        );
        if (result.slug !== this.next) {
          this.next = result.slug;
        }
      }
    },
    checkTaken() {
      if (!this.debouncedTaken) {
        this.debouncedTaken = debounce(body, 250);
      }
      // No await here because we want this to happen
      // in the background, we can use catch() old-school
      // to prevent an uncaught rejection error
      this.debouncedTaken().catch(function(e) {
        if (e === 'canceled') {
          // debouncer canceled it, no worries
          return;
        }
        console.error(e);
      });
      async function body() {
        const was = this.next;
        try {
          const result = await apos.http.post(
            `${apos.docs.action}/slug-taken`, {
              busy: true,
              body: {
                slug: this.next,
                _id: this.context._id
              }
            }
          );
          if (this.next === was) {
            this.taken = false;
          } else {
            this.checkTaken();
          }
        } catch (e) {
          if (e.status === 409) {
            if (this.next === was) {
              this.taken = true;
            } else {
              this.checkTaken();
            }
          } else {
            console.error(e);
          }
        }
      }
    },
    validate() {
      const value = this.next;
      if (this.field.required) {
        if (!value.length) {
          return 'required';
        }
      }
      if (this.taken) {
        return 'taken';
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

<style>
/* TODO: scoping, i18n, parameters for min and max */
.apos-field-error label {
  color: var(--a-danger);
}
.apos-field-taken-error label::after {
  content: ' (already taken)';
}
.apos-required-error label::after {
  content: ' (required)';
}
.apos-min-error label::after {
  content: ' (too low)';
}
.apos-max-error label::after {
  content: ' (too high)';
}
</style>

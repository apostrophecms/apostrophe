<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="error" :uid="uid"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <input
          type="text"
          class="apos-input apos-input--text"
          v-model="next"
          :disabled="field.disabled"
          :required="field.required"
          :id="uid" :tabindex="tabindex"
          @keydown.enter="$emit('return')"
        >
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin';
import slugify from 'sluggo';
import debounce from 'debounce-async';

export default {
  name: 'AposInputSlug',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  computed: {
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    }
  },
  watch: {
    next(value) {
      this.checkTaken();
    },
    followsValue(oldVal, newVal) {
      this.next = newVal ? slugify(newVal) : '';
    }
  },
  methods: {
    validate(value) {
      if (this.field.required) {
        if (!value.length) {
          return 'required';
        }
      }
      return false;
    },
    async checkTaken() {
      if (!this.debouncedTaken) {
        this.debouncedTaken = debounce(() => apos.http.post(
          `${apos.doc.action}/slug-taken`, {
            busy: true,
            body: {
              slug: this.next,
              _id: this.docId
            }
          }
        ), 250);
      }

      const result = await this.debouncedTaken().catch(e => {
        if (e === 'canceled') { // debouncer canceled it, no worries
          return;
        }
        console.error(e);
      });

      if (result && result.status === 'taken') {
        await this.deduplicate();
      }
    },
    async deduplicate() {
      if (!this.debouncedDeduplicate) {
        this.debouncedDeduplicate = debounce(() => apos.http.post(
          `${apos.doc.action}/deduplicate-slug`, {
            busy: true,
            body: {
              slug: this.next,
              _id: this.docId
            }
          }
        ), 250);
      }

      const result = await this.debouncedDeduplicate().catch(e => {
        if (e === 'canceled') { // debouncer canceled it, no worries
          return;
        }
        console.error(e);
      });

      if (result && result.status === 'ok') {
        this.next = result.slug;
      }
    }
  }
};
</script>

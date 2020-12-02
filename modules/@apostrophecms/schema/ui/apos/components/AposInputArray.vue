<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid" :items="next"
  >
    <template #additional>
      <AposMinMaxCount
        :field="field"
        :value="next"
      />
    </template>
    <template #body>
      <div class="apos-input-array">
        <label
          class="apos-input-wrapper"
          :class="{
            'is-disabled': field.disabled
          }"
        >
          <AposButton
            :label="editLabel"
            @click="edit"
          />
        </label>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';

export default {
  name: 'AposInputArray',
  mixins: [ AposInputMixin ],
  data () {
    return {
      // Next should consistently be an array.
      next: (this.value && Array.isArray(this.value.data))
        ? this.value.data : (this.field.def || [])
    };
  },
  computed: {
    editLabel () {
      return `Edit ${this.field.label}`;
    }
  },
  methods: {
    validate (value) {
      if (this.field.required && !value.length) {
        return 'required';
      }
      if (this.field.min && value.length < this.field.min) {
        return 'min';
      }
      if (this.field.max && value.length > this.field.max) {
        return 'max';
      }
      return false;
    },
    update (items) {
      this.next = items;
    },
    async edit () {
      const result = await apos.modal.execute('AposArrayEditor', {
        field: this.field,
        items: this.next,
        serverError: this.serverError
      });
      if (result) {
        this.next = result;
      }
    }
  }
};
</script>

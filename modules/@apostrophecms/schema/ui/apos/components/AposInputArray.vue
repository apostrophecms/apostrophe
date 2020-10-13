<template>
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid"
  >
    <template #body>
      <div class="apos-attachment">
        <label
          class="apos-input-wrapper"
          :class="{
            'is-disabled': field.disabled
          }"
        >
          <p class="apos-array-count">
            {{ next.length }} Items
          </p>
          <button
            @click="editing = true"
            :disabled="field.disabled"
          >Edit {{ field.label }}</button>
        </label>
        <AposArrayEditor
          v-if="editing"
          :field="field"
          :items="next"
          @update="update"
          @safe-close="safeClose"
        />
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
      editing: false,
      // Next should consistently be an array.
      next: (this.value && Array.isArray(this.value.data))
        ? this.value.data : (this.field.def || [])
    };
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
    safeClose () {
      this.editing = false;
    }
  }
};
</script>

<style lang="scss" scoped>
</style>

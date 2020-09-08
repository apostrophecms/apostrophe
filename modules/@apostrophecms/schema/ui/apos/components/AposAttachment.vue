<template>
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid"
  >
    <template #body>
      <div class="apos-attachment">
        <!-- TODO need a file drop library/whatever here -->
        <button :disabled="disabled" class="apos-input-wrapper apos-attachment-dropzone">
          <p class="apos-attachment-instructions" v-html="message" />
        </button>
        <div v-if="value.data.length" class="apos-attachment-files">
          <AposSlatList 
            :initial-items="next"
            @update="updated"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin.js';
import AposSlatList from '../../../../ui/ui/apos/components/AposSlatList';

export default {
  name: 'AposAttachment',
  components: {
    AposSlatList
  },
  mixins: [ AposInputMixin ],
  computed: {
    limitReached () {
      return this.value.data.length >= this.field.limit;
    },
    message () {
      let message = '<paperclip-icon :size="14" /> Drop a file here or <span class="apos-attachment-highlight">click to open the file explorer</span>';

      if (this.field.disabled) {
        message = 'This field is disabled';
      }

      // limit reached should be a more specific form of disabled and go after it
      if (this.limitReached) {
        message = 'Attachment Limit Reached';
      }

      return message;
    },
    disabled () {
      return (this.limitReached || this.field.disabled);
    }
  },
  methods: {
    updated(items) {
      this.next = items;
    },
    validate(value) {
      if (this.field.required && !value.data.length) {
        return 'required';
      }

      return false;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-attachment-dropzone {
    @include apos-button-reset();
    display: block;
    width: 100%;
    margin: 10px 0;
    padding: 20px;
    border: 2px dashed var(--a-base-8);
    font-size: map-get($font-sizes, default);
    transition: all 0.2s ease;
    &:not([disabled]):hover {
      border: 2px dashed var(--a-primary);
      background-color: var(--a-base-10);
    }
    &:active, &:focus {
      border: 2px solid var(--a-primary);
    }
    &[disabled] {
      color: var(--a-base-4);
      &:hover {
        cursor: not-allowed;
      }
    }
  }

  .apos-attachment-instructions {
    text-align: center;
    // v-html goofiness
    & /deep/ .apos-attachment-highlight {
      color: var(--a-primary);
      font-weight: 700;
    }
  }

</style>

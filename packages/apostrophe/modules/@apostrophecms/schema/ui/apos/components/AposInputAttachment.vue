<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-attachment">
        <AposFile
          :allowed-extensions="field.accept"
          :uploading="uploading"
          :disabled="disabled"
          :attachment="next"
          :def="field.def"
          @upload-file="uploadMedia"
          @update="updated"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputAttachmentLogic from '../logic/AposInputAttachment';
export default {
  name: 'AposInputAttachment',
  mixins: [ AposInputAttachmentLogic ]
};
</script>

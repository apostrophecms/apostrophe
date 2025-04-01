<template>
  <AposModal
    class="apos-settings"
    :modal="modal"
    :modal-title="$t('apostrophe:settings')"
    @esc="close"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:close"
        :disabled="busy"
        @click="close"
      />
    </template>
    <template #leftRail>
      <AposModalBody class="apos-settings__group">
        <template #bodyMain>
          <ul class="apos-settings__group-items">
            <li
              v-for="(group, name) in groups"
              :key="name"
              class="apos-settings__group-item"
              :class="{ 'apos-is-active': name === activeGroup }"
            >
              <button
                data-apos-test="groupTrigger"
                :data-apos-test-name="name"
                :data-apos-test-label="$t(group.label)"
                @click="activeGroup = name"
              >
                {{ $t(group.label) }}
              </button>
            </li>
          </ul>
        </template>
      </AposModalBody>
    </template>
    <template #main>
      <AposModalBody
        v-if="docReady"
        class="apos-settings__content"
      >
        <template #bodyMain>
          <div
            v-for="(group, name) in groups"
            v-show="name === activeGroup"
            :key="name"
            class="apos-settings__subform-group"
            data-apos-test="subformGroup"
            :data-apos-test-name="name"
            :data-apos-test-label="$t(group.label)"
            :data-apos-test-active="name === activeGroup"
          >
            <h2 class="apos-settings__heading">
              {{ $t(group.label) }}
            </h2>
            <AposSubform
              v-for="subform in group.subforms"
              :key="subform.name"
              :ref="subform.name"
              :busy="busy"
              :separator="group.subforms.length > 1"
              :errors="errors"
              :subform="subform"
              :values="values.data[subform.name]"
              :expanded="expanded === subform.name"
              :update-indicator="!!subformUpdateTimeouts[subform.name]"
              data-apos-test="subform"
              :data-apos-test-name="subform.name"
              :data-apos-test-label="$t(subform.label)"
              :data-apos-test-expanded="expanded ? 'true' : 'false'"
              @update-expanded="updateExpanded"
              @submit="submit"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposSettingsManagerLogic from 'Modules/@apostrophecms/settings/logic/AposSettingsManager';

export default {
  name: 'AposSettingsManager',
  mixins: [ AposSettingsManagerLogic ],
  emits: [ 'modal-result' ]
};
</script>

<style lang="scss" scoped>
.apos-settings {
  @include type-base;

  :deep(.apos-modal__inner) {
    // 1/2 or 2/3 width
    // $width: calc(100vw / 2);
    $width: min(700px, calc(calc(100vw / 3) * 2));
    $vertical-spacing: 95px;
    $horizontal-spacing: calc(calc(100vw - #{$width}) / 2);

    inset: $vertical-spacing $horizontal-spacing $vertical-spacing $horizontal-spacing;
    width: $width;
    height: calc(100vh - #{$vertical-spacing * 2});
  }

  :deep(.apos-modal__main--with-left-rail) {
    grid-template-columns: 25% 75%;
  }

  :deep(.apos-modal__body-inner) {
    // padding: $spacing-triple $spacing-triple $spacing-double;
    padding: $spacing-double $spacing-triple;
  }

  :deep(.apos-modal__header__main) {
    // padding: $spacing-triple $spacing-triple $spacing-double;
    padding: $spacing-double $spacing-triple;
  }

  &__heading {
    @include type-title;

    & {
      margin: 0 0 $spacing-double;
    }
  }

  &__content {
    padding: 0;
    scroll-behavior: smooth;
  }

  &__group {
    padding: 0;
    border-right: 1px solid var(--a-base-9);
  }

  &__group-items {
    @include apos-list-reset();
  }
}

.apos-settings__group-item {
  @include type-base;

  & {
    margin-bottom: $spacing-half;
  }

  &.apos-is-active {
    color: var(--a-primary);
  }

  > button {
    @include apos-button-reset();

    & {
      width: 100%;
      padding: $spacing-base 0;
      outline: none;
    }
  }
}
</style>

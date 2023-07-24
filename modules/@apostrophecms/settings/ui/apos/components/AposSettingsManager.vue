<template>
  <AposModal
    class="apos-settings-manager"
    :modal="modal"
    modal-title="Manage Settings"
    @esc="close"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:close"
        @click="close"
      />
    </template>
    <template #leftRail>
      <AposModalBody class="apos-settings__group">
        <template #bodyMain>
          <!-- TODO PHASE 2 groups -->
          <ul class="apos-settings__group-items">
            <li
              class="apos-settings__group-item apos-is-active"
            >
              Preferences
            </li>
          </ul>
        </template>
      </AposModalBody>
    </template>
    <template #main>
      <AposModalBody v-if="docReady" class="apos-settings__content">
        <template #bodyMain>
          <h2 class="apos-settings__heading">
            <!-- TODO PHASE 2 active group name -->
            Preferences
          </h2>
          <!-- TODO PHASE 2 groups -->
          <AposSubform
            v-for="subform in subforms"
            :key="subform.name"
            :busy="busy"
            :errors="errors"
            :subform="subform"
            :values="values.data[subform.name]"
            @submit="submit"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import TheAposSettingsLogic from 'Modules/@apostrophecms/settings/logic/TheAposSettings';

export default {
  name: 'AposSettingsManager',
  mixins: [ TheAposSettingsLogic ],
  emits: [ 'safe-close', 'modal-result' ]
};
</script>

<style lang="scss" scoped>
.apos-settings-manager {
  @include type-base;

  ::v-deep .apos-modal__inner {
    // TODO decide on 1/2 vs 2/3
    // $width: calc(100vw / 2);
    $width: calc(calc(100vw / 3) * 2);
    $vertical-spacing: 95px;
    $horizontal-spacing: calc(calc(100vw - #{$width}) / 2);

    top: $vertical-spacing;
    right: $horizontal-spacing;
    bottom: $vertical-spacing;
    left: $horizontal-spacing;
    width: $width;
    height: calc(100vh - #{$vertical-spacing * 2});
  }

  ::v-deep .apos-modal__main--with-left-rail {
    grid-template-columns: 25% 75%;
  }

  ::v-deep .apos-modal__body-inner {
    padding: $spacing-triple $spacing-triple $spacing-double;
  }

  ::v-deep .apos-busy__spinner {
    display: inline-block;
  }
}

.apos-settings__heading {
  @include type-title;
  margin: 0 0 $spacing-double 0;
}

.apos-settings__content {
  padding-top: 0;
  padding-left: 0;
}

.apos-settings__group {
  padding: 0;
  border-right: 1px solid var(--a-base-9);
}

.apos-settings__group-items {
  @include apos-list-reset();
}

.apos-settings__group-item {
  @include type-base;
  margin-bottom: $spacing-base + $spacing-half;
  &.apos-is-active {
    color: var(--a-primary);
  }
}
</style>

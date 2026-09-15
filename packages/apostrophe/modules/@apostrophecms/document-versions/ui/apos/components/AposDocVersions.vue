<template>
  <AposModal
    class="apos-doc-editor apos-doc-version-editor"
    :class="classes"
    data-apos-test="doc-version-modal"
    :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
    @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="close"
      />
    </template>
    <template #primaryControls>
      <AposContextMenu
        :disabled="!versions.length"
        :button="{
          label: $t('apostrophe:viewOptions'),
          icon: 'view-split-vertical-icon',
          type: 'outline'
        }"
        :unpadded="true"
        menu-placement="bottom-end"
        data-apos-test="doc-version-view-options-menu"
        :dynamic-focus="true"
      >
        <dl
          class="apos-doc-version__view-options-menu"
          role="menu"
          aria-label="menu"
        >
          <dt
            v-for="item in operations"
            :key="item.label"
            class="apos-doc-version__view-options-menu__item"
            :class="{
              'apos-doc-version__view-options-menu__item--disabled':
                item.if && $data[item.if + 'Disabled']
            }"
          >
            <button
              class="apos-doc-version__view-options-menu__item__button"
              data-apos-test="doc-version-view-options-select"
              :value="item.label"
              :disabled="item.if && $data[item.if + 'Disabled']"
              @click="toggleAction(item.action)"
            >
              <p
                class="apos-doc-version__view-options-menu__item__label"
              >
                {{ $t(item.label) }}
              </p>
              <AposToggle
                class="apos-doc-version__view-options-menu__item__toggle"
                :model-value="$data[item.action + 'Disabled']"
                :disable-focus="true"
              />
            </button>
          </dt>
        </dl>
      </AposContextMenu>
      <AposButton
        :disabled="!versions.length"
        type="primary"
        class="apos-doc-version__action"
        data-apos-test="doc-version-action-restore"
        :label="$t('apostrophe:restore')"
        @click="restoreVersion(currentVersion)"
      />
    </template>
    <template #leftRail>
      <AposModalRail
        v-if="displayTabs"
        :class="{ 'apos-modal__rail--down': displayComparison }"
      >
        <AposModalTabs
          v-if="versionTabs.length"
          :key="tabKey"
          :current="currentTab"
          :tabs="versionTabs"
          @select-tab="switchPane"
        />
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div
            v-if="displayComparison"
            class="apos-doc-version-editor__compare"
          >
            <div class="apos-doc-version-editor__compare-header">
              {{ toHumanDate(currentVersion.createdAt) }}
            </div>
            <div class="separator" />
            <div class="apos-doc-version-editor__compare-header">
              <AposDocVersionsListCompare
                :current-version="currentVersionCompare"
                :versions="versionsCompare"
                :pager="pager"
                @select="onVersionCompareSelect"
                @load-more="loadMore"
              />
            </div>
          </div>
          <div
            v-if="versions.length"
            class="apos-doc-editor__body apos-doc-version-editor__body"
            :class="{ 'apos-doc-version-editor__body--compare': displayComparison }"
          >
            <AposSchema
              v-for="tab in versionTabs"
              v-show="tab.name === currentTab"
              :key="tab.name"
              :ref="tab.name"
              :schema="groups[tab.name]?.schema || []"
              :current-fields="groups[tab.name]?.fields || []"
              :utility-rail="false"
              :conditional-fields="conditionalFields"
              :doc-id="docId"
              :model-value="docFields"
              :server-errors="serverErrors"
              :generation="generation"
              :meta="docMeta"
              @update:model-value="evaluateConditions()"
            />
          </div>
          <div
            v-else-if="initialized"
            class="apos-doc-version-editor__body"
          >
            <p class="apos-doc-version-editor__empty-title">
              {{ $t('apostrophe:versionsNotFound') }}
            </p>
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail
        ref="docVersionsRail"
        type="right"
      >
        <AposDocVersionsList
          :current-version="currentVersion"
          :versions="versions"
          @select="onVersionSelect"
        />
        <div
          ref="docVersionsSentinel"
          class="apos-doc-version-sentinel"
        />
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import { mapState } from 'pinia';
import { createId } from '@paralleldrive/cuid2';
import { klona } from 'klona';

import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import AposAdvisoryLockMixin
  from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import observer from '../utils/observer.js';
import locale from '../utils/locale.js';

const dateTimeFormat = locale.getDateTimeFormat();

export default {
  name: 'AposDocVersions',
  mixins: [ AposModalTabsMixin, AposEditorMixin, AposAdvisoryLockMixin ],
  props: {
    moduleName: {
      type: String,
      required: true
    },
    doc: {
      type: Object,
      required: true
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      tabKey: createId(),
      restoreOnly: true,
      // required by the editor mixin
      utilityFields: [],
      fieldErrors: {},
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      displayComparison: false,
      displayTabs: true,
      compareSchema: null,
      currentVersion: null,
      currentVersionCompare: null,
      versions: [],
      versionsMeta: {},
      saveMenu: null,
      initialized: false,
      generation: 0,
      observer: null,
      compareDisabled: true,
      onlyShowDifferencesDisabled: true,
      operations: [
        {
          label: this.$t('apostrophe:compareVersions'),
          action: 'compare'
        },
        {
          label: this.$t('apostrophe:onlyShowDifferences'),
          action: 'onlyShowDifferences',
          if: 'compare'
        }
      ]
    };
  },
  computed: {
    ...mapState(useModalStore, [ 'stack' ]),
    docId() {
      return this.doc._id;
    },
    docType() {
      return this.docFields?.data?.type || this.doc.type;
    },
    docVersionId() {
      return `${this.currentVersionId}:${this.currentVersionCompareId}`;
    },
    currentSchema() {
      return this.compareSchema || this.schema;
    },
    currentVersionId() {
      if (!this.currentVersion) {
        return null;
      }
      return this.currentVersion._id;
    },
    currentVersionCompareId() {
      if (!this.currentVersionCompare) {
        return null;
      }
      return this.currentVersionCompare._id;
    },
    versionType() {
      return this.moduleName;
    },
    versionsCompare() {
      return this.versions.filter(version => version._id !== this.currentVersionId);
    },
    getVersionAllPath() {
      return this.versionModuleAction;
    },
    getOnePath() {
      return `${this.moduleAction}/${this.docId}`;
    },
    versionModuleOptions() {
      return window.apos.modules[this.versionType] || {};
    },
    versionModuleAction() {
      return this.versionModuleOptions.action;
    },
    moduleOptions() {
      return window.apos.modules[this.docType] || {};
    },
    moduleAction() {
      return (window.apos.modules[this.docType] || {}).action;
    },
    groups() {
      const groupSet = {};

      this.currentSchema.forEach((field) => {
        if (!this.filterOutParkedFields([ field.name ]).length) {
          return;
        }

        if (!this.displayTabs) {
          groupSet.basics = groupSet.basics || {
            label: 'apostrophe:basics',
            fields: [],
            schema: []
          };
          groupSet.basics.fields.push(field.name);
          groupSet.basics.schema.push(field);

          return;
        }

        if (field.group && !groupSet[field.group.name]) {
          groupSet[field.group.name] = {
            label: field.group.label,
            fields: [ field.name ],
            schema: [ field ]
          };
        } else if (field.group) {
          groupSet[field.group.name].fields.push(field.name);
          groupSet[field.group.name].schema.push(field);
        }
      });

      return groupSet;
    },
    versionTabs() {
      // AposRelationshipEditor does not implement
      // AposEditorMixin with the function conditionalFields
      const fields = this.groups.utility?.fields || [];
      const utility = {
        name: 'utility',
        label: 'apostrophe:utility',
        fields,
        isVisible: fields.some(field => this.conditionalFields.if[field] !== false)
      };

      return this.tabs.concat(utility);
    },
    modalTitle() {
      return {
        key: 'apostrophe:versionPluralLabel'
      };
    },
    meta() {
      return this.versionsMeta || {};
    },
    classes() {
      const classes = [];
      if (this.displayComparison) {
        classes.push('apos-doc-version-editor--compare');
      }

      if (!this.displayTabs) {
        classes.push('apos-doc-version-editor--highlights-only');
      }

      return classes;
    },
    pager() {
      return {
        currentPage: this.meta.currentPage,
        pages: this.meta.pages
      };
    }
  },
  watch: {
    docVersionId: {
      async handler(newVal, oldVal) {
        if (newVal === oldVal) {
          return;
        }

        try {
          const {
            version,
            document
          } = this.compareDisabled === false
            ? await this.loadVersionCompare(
              this.currentVersionId,
              this.currentVersionCompareId
            )
            : await this.loadVersion(this.currentVersionId);

          this.version = version;
          this.docFields = {
            data: {
              ...document
            }
          };

          this.generation++;
        } catch (error) {
          await apos.notify('apostrophe:versionFailVersionLoadMessage', {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true
          });
        }
      }
    },
    compareDisabled: {
      async handler(newVal, oldVal) {
        if (newVal === oldVal) {
          return;
        }

        if (newVal === true) {
          this.currentVersionCompare = null;
          this.compareSchema = null;

          return;
        }

        this.currentVersionCompare = this.versionsCompare[0];
      }
    },
    onlyShowDifferencesDisabled: {
      async handler(newVal, oldVal) {
        if (newVal === oldVal) {
          return;
        }

        this.displayTabs = !this.displayTabs;
      }
    },
    pager: {
      handler(newVal, oldVal) {
        if (
          !this.observer ||
          (
            newVal.currentPage === oldVal.currentPage &&
            newVal.pages === oldVal.pages
          )
        ) {
          return;
        }

        this.observer.updatePager(newVal);
      }
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.evaluateExternalConditions();
    this.loadVersions()
      .then(() => {
        this.evaluateConditions();
        this.initialized = true;
      });
  },
  unmounted() {
    if (this.observer) {
      this.observer.disconnect();
    }
  },
  methods: {
    loadMore([ target ]) {
      if (!target.isIntersecting) {
        return;
      }
      this.observer.unobserve();
      this.loadVersions(this.versionsMeta.currentPage + 1, false)
        .then(() => this.observer.observe());
    },
    async loadVersions(page, initial = true) {
      let response;
      try {
        if (!(await this.lock(this.getOnePath, this.docId))) {
          this.lockNotAvailable();
          return;
        }
        response = await apos.http.get(this.getVersionAllPath, {
          busy: initial,
          qs: {
            docId: this.doc._id,
            page
          }
        });
      } catch (error) {
        const message = error.status === 404
          ? 'apostrophe:versionFailDocPermsMessage'
          : 'apostrophe:versionFailDocLoadMessage';
        await apos.notify(message, {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        if (initial) {
          this.close();
        }
      } finally {
        this.setVersionsResponse(response);
        if (!this.currentVersion && this.versions.length > 0) {
          this.onVersionSelect(this.versions[0]);
        }
        if (initial) {
          await this.$nextTick();
          // Safety check
          if (this.$refs.docVersionsRail) {
            this.observer = observer({
              callback: this.loadMore,
              root: this.$refs.docVersionsRail.$el,
              // Intersect ~4-5 rows earlier
              rootMargin: '0px 0px 150px 0px',
              target: this.$refs.docVersionsSentinel
            });
            this.observer.observe();
            // Explicitly check if we need to fill the rail.
            // If the content is too short to scroll, the observer might not
            // fire reliably in some environments depending on paint timing.
            const rail = this.$refs.docVersionsRail.$el;
            if (rail.scrollHeight <= rail.clientHeight) {
              this.loadMore([ {
                isIntersecting: true
              } ]);
            }
          }
        }
      }
    },
    async loadVersion(versionId) {
      try {
        const version = await apos.http.get(
          `${this.getVersionAllPath}/${versionId}`,
          {
            busy: true
          }
        );

        this.displayComparison = false;

        return {
          version,
          document: version.doc
        };
      } catch (error) {
        await apos.notify('apostrophe:versionFailVersionLoadMessage', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
      }
    },
    async loadVersionCompare(versionId1, versionId2) {
      try {
        const {
          schema,
          version,
          document
        } = await apos.http.get(
          `${this.versionModuleAction}/compare/${versionId1}/${versionId2}`,
          {
            busy: true
          }
        );
        this.compareSchema = schema
          .filter(field => field.name !== 'archived')
          .map(field => ({
            ...field,
            readOnly: true
          }));
        this.displayComparison = true;

        return {
          version,
          document
        };
      } catch (error) {
        await apos.notify('apostrophe:versionFailVersionLoadMessage', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
      }
    },
    async restoreVersion(version) {
      // XXX do we need confirmation dialog? This operation should be considered
      // dangerous as it replaces any unpublished changes.
      let doc;
      let updated;
      if (!version.doc) {
        if (this.version._id === version._id) {
          doc = this.version.doc;
        }
        if (!doc) {
          const { version: reloadVersion } = await this.loadVersion(version._id);
          doc = reloadVersion.doc;
        }
      } else {
        doc = version.doc;
      }
      if (!doc) {
        await apos.notify('apostrophe:versionFailVersionRestoreMessage', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        return;
      }

      try {
        doc = klona(doc);
        this.addLockToRequest(doc);
        updated = await apos.http.put(this.getOnePath, {
          body: doc,
          busy: true,
          draft: true
        });

        apos.notify('apostrophe:versionRestored', {
          type: 'success',
          icon: 'archive-arrow-up-icon',
          dismiss: true
        });

        if (this.refreshRedirect(this.doc, updated)) {
          return;
        }
        apos.bus.$emit('content-changed', {
          doc: updated,
          action: 'restoreVersion'
        });
        this.$emit('modal-result', updated);
        this.close();
      } catch (e) {
        if (this.isLockedError(e)) {
          await this.showLockedError(e);
          return;
        }
        await apos.notify('apostrophe:versionFailVersionRestoreMessage', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
      }
    },
    refreshRedirect(oldDoc, newDoc) {
      const isInContextEdit = this.stack.length === 1;
      if (isInContextEdit && oldDoc.slug !== newDoc.slug) {
        const current = new URL(window.location.href);
        if (!newDoc._url.match(current.pathname)) {
          window.location = newDoc._url;
          return true;
        }
      }
      return false;
    },
    setVersionsResponse(response) {
      if (!response || !response.results) {
        return;
      }
      const { results, ...meta } = response;
      if (results.length > 0) {
        this.versions.push(...results);
      }
      this.versionsMeta = { ...meta };
    },
    // Implementing a method expected by the advisory lock mixin
    lockNotAvailable() {
      this.close();
    },
    getAposSchema(field) {
      if (field.group.name === 'utility') {
        return this.$refs.utilitySchema;
      } else {
        return this.$refs[field.group.name][0];
      }
    },
    filterOutParkedFields(fields) {
      return fields.filter((fieldName) => {
        return !(this.doc.parked || []).includes(
          fieldName
        );
      });
    },
    onVersionSelect(version) {
      if (this.currentVersionId === version._id) {
        return;
      }
      this.currentVersion = version;
    },
    onVersionCompareSelect(version) {
      if (this.currentVersionCompareId === version._id) {
        return;
      }
      this.currentVersionCompare = version;
    },
    onVersionRestore(version) {
      this.restoreVersion(version);
    },
    close() {
      this.modal.showModal = false;
    },
    toggleAction(action) {
      this[action + 'Disabled'] = !this[action + 'Disabled'];
      if (this[action + 'Disabled']) {
        this.operations
          .filter(operation => operation.if === action)
          .forEach((operation) => {
            this[operation.action + 'Disabled'] = true;
          });
      }
    },
    toHumanDate(date) {
      return dateTimeFormat.format(new Date(date));
    }
  }
};
</script>

<style lang="scss" scoped>
:deep(.apos-modal__main--with-rails) {
  grid-template-columns: 15% 1fr minmax(250px, 22%);
}

.apos-doc-version-sentinel {
  height: 2px;
}

.apos-doc-version-editor {
  &__empty-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--a-text-primary);
    font-family: var(--a-family-default);
    font-weight: var(--a-weight-base);
    letter-spacing: var(--a-letter-base);
    font-size: var(--a-type-large);
    line-height: var(--a-line-tall);
  }

  &__body {
    // For now. Later we may have better support for read-only areas
    // and array fields that allows clicking in to see more information
    // but carefully blocks editing
    pointer-events: none;
  }
}

.apos-doc-version-editor--compare {
  :deep(.apos-field__wrapper) {
    max-width: 100%;
    min-width: 150px;

    .apos-field {
      overflow-x: clip;
    }

    .apos-button__wrapper {
      display: none;
    }
  }

  :deep(.apos-input-array-inline-table) {
    max-width: 100%;

    th:empty {
      visibility: hidden;
      border: none;
    }

    .apos-input-array-inline-item-controls--remove {
      display: none;
    }

    .apos-slat__control--remove {
      display: none;
    }
  }

  :deep(.apos-input-relationship .apos-slat__main) {
    min-width: auto;
  }

  :deep(.apos-input-relationship__input-wrapper) {
    display: none;
  }

  .separator {
    align-self: center;
    width: 1px;
    height: 100vh;
    background-color: var(--a-base-9);
  }

  .apos-modal__rail--down {
    position: relative;
    top: 30px;
    height: calc(100vh - 129px);
    border-top: 1px solid var(--a-base-9);

    @include media-up(lap) {
      height: calc(100vh - 149px);
    }
  }
}

.apos-doc-version-editor--highlights-only {
  :deep(.apos-modal__main--with-rails) {
    grid-template-columns: 1fr minmax(250px, 22%);
  }

  :deep(.apos-field__wrapper) {
    display: none;
  }

  :deep(.apos-field__wrapper--highlight) {
    display: block;

    .apos-field__wrapper {
      display: block;
    }
  }
}

.apos-doc-version__view-options-menu__item {
  display: flex;
  flex-basis: 1;

  &__button {
    @include apos-button-reset();

    & {
      display: flex;
      gap: 20px;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      width: 100%;
      padding: 10px 20px;
    }

    &:focus {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--a-base-7);
    }
  }

  &__label {
    @include type-large;

    & {
      flex-grow: 1;
      max-width: 370px;
      line-height: var(--a-line-tallest);
      margin: 0;
    }
  }

  &--disabled {
    pointer-events: none;
  }

  &--disabled &__label {
    color: $input-color-disabled;
  }
}

.apos-doc-version__view-options-menu__item {
  &--disabled :deep(.apos-toggle__slider) {
    background-color: var(--a-base-7);
  }
}

.apos-doc-version-editor__compare {
  position: relative;
  top: -$spacing-double;
  left: -$spacing-quadruple;
  display: flex;
  width: calc(100% + ($spacing-quadruple * 2));
  height: 30px;
  font-size: var(--a-type-base);
  font-weight: var(--a-weight-base);

  &-header {
    @include type-base;

    & {
      display: flex;
      flex-basis: 50%;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      border-bottom: 1px solid var(--a-base-9);
    }
  }

  :deep(.apos-context-menu) {
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  }

  :deep(.apos-button) {
    border: none;
    background-color: transparent;
    text-decoration: none;
  }

  :deep(.apos-button:hover) {
    text-decoration: underline;
  }

  :deep(.apos-button:focus) {
    text-decoration: underline;
  }

  :deep(.apos-button__content) {
    flex-direction: row-reverse;
  }

  @include media-up(lap) {
    top: -$spacing-quadruple;
  }
}
</style>

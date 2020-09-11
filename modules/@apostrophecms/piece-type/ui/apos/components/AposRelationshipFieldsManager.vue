<template>
  <AposModal
    class="apos-doc-editor" :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="cancel" @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="Exit"
        @click="cancel"
      />
    </template>
    <template #primaryControls>
      <AposButton
        type="primary" label="Save"
        :disabled="doc.hasErrors"
        @click="submit"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <AposModalTabsBody>
            <div class="apos-doc-editor__body">
              <AposSchema
                v-if="docReady"
                :schema="schema"
                v-model="doc"
              />
            </div>
          </AposModalTabsBody>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail type="right">
        <div class="apos-doc-editor__utility">
          <AposSchema
            v-if="docReady"
            :schema="schema"
            v-model="doc"
            :modifiers="['small', 'inverted']"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';

export default {
  name: 'AposRelationshipFieldsManager',
  mixins: [
    AposModalParentMixin
  ],
  props: {
    schema: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  emits: [ 'saved', 'safe-close' ],
  data() {
    return {
      doc: {
        data: {},
        hasErrors: false
      },
      docReady: false,
      modal: {
        active: false,
        type: 'overlay',
        showModal: true
      },
      modalTitle: 'Test'
    };
  },
  async mounted() {
    this.modal.active = true;
    this.docReady = true;

    // if (this.docId) {
    //   let docData;
    //   try {
    //     const getOnePath = `${this.moduleOptions.action}/${this.docId}`;
    //     docData = await apos.http.get(getOnePath, {
    //       busy: true,
    //       qs: this.filterValues
    //     });
    //   } catch {
    //     // TODO: Add error notification. No client API for this yet.
    //     console.error('⁉️ The requested piece was not found.', this.docId);
    //     apos.bus.$emit('busy', false);
    //     this.cancel();
    //   } finally {
    //     this.doc.data = docData;
    //     this.docReady = true;
    //     apos.bus.$emit('busy', false);
    //   }
    // } else {
    //   this.$nextTick(() => {
    //     this.newInstance();
    //   });
    // }
  },
  methods: {
    async submit() {
      apos.bus.$emit('busy', true);

      let route;
      let requestMethod;
      if (this.docId) {
        route = `${this.moduleOptions.action}/${this.docId}`;
        requestMethod = apos.http.put;
      } else {
        route = this.moduleOptions.action;
        requestMethod = apos.http.post;
      }

      try {
        await requestMethod(route, {
          busy: true,
          body: this.doc.data
        });
        this.$emit('saved');

        this.modal.showModal = false;
      } finally {
        apos.bus.$emit('busy', false);
      }
    },
  }
};
</script>

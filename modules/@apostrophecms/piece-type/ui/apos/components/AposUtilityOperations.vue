<!-- The utility operations component presents additional non-selection-specific
  options in docs managers, such as the "new document" option during
  selection. -->
<template>
  <div class="apos-utility-operations">
    <AposButton
      v-for="button in utilityOperations.buttons"
      :key="button.action"
      type="default"
      :icon-only="button.iconOnly"
      :icon="button.icon || null"
      :label="button.label"
      @click="handleUtilityOperation(button)"
    />
    <AposContextMenu
      v-if="utilityOperations.menu.length"
      :button="utilityOperations.button"
      :menu="utilityOperations.menu"
      @item-clicked="handleUtilityOperation"
    />
  </div>
</template>

<script>
export default {
  props: {
    moduleOptions: {
      type: Object,
      required: true
    },
    hasRelationshipField: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      utilityOperations: {
        button: {
          label: 'apostrophe:moreOperations',
          iconOnly: true,
          icon: 'dots-vertical-icon',
          type: 'outline'
        },
        menu: []
      }
    };
  },

  computed: {
    moduleLabels() {
      return {
        singular: this.moduleOptions.label,
        plural: this.moduleOptions.pluralLabel
      };
    }
  },

  async mounted() {
    this.setUtilityOperations();
  },

  methods: {
    async handleUtilityOperation(item) {
      const operation = [
        ...this.utilityOperations.menu,
        ...this.utilityOperations.buttons
      ]
        .find((op) => op.action === item.action);

      if (!operation) {
        // eslint-disable-next-line no-console
        console.error('utility operation definition was not found');
        return;
      }

      const {
        modal, ...modalOptions
      } = operation.modalOptions || {};

      const {
        event, ...payload
      } = operation.eventOptions || {};

      if (modal) {
        await apos.modal.execute(modal, {
          moduleName: this.moduleOptions.name,
          moduleAction: this.moduleOptions.action,
          action: item.action,
          labels: this.moduleLabels,
          messages: operation.messages,
          ...modalOptions
        });
      } else if (event) {
        apos.bus.$emit(event, payload);
      } else {
        // For backwards compatibility, because it did nothing before we should
        // not throw a hard error here
        // eslint-disable-next-line no-console
        console.error('utility operation has no modalOptions.modal or eventOptions.event property');
      }
    },
    setUtilityOperations () {
      const {
        utilityOperations,
        canPublish,
        canEdit,
        canArchive,
        canCreate
      } = this.moduleOptions;

      const operations = ((Array.isArray(utilityOperations) && utilityOperations) || [])
        .filter(operation => {
          let ok = true;
          if (operation.relationship != null) {
            if (this.hasRelationshipField) {
              ok = operation.relationship;
            } else {
              ok = !operation.relationship;
            }
          }
          if (operation.canCreate) {
            ok = ok && canCreate;
          }
          if (operation.canEdit) {
            ok = ok && canEdit;
          }
          if (operation.canArchive) {
            ok = ok && canArchive;
          }
          if (operation.canPublish) {
            ok = ok && canPublish;
          }
          return ok;
        });

      this.utilityOperations.menu = operations.filter(operation => !operation.button);
      this.utilityOperations.buttons = operations.filter(operation => operation.button);
    }
  }
};
</script>
<style scoped>
  .apos-utility-operations {
    display: flex;
    column-gap: 16px;
  }
</style>

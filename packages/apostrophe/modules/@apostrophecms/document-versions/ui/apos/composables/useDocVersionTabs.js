import {
  computed, inject, ref, watch
} from 'vue';
import { klona } from 'klona';
import {
  evaluateExternalConditions as evaluateSchemaExternalConditions,
  getConditionalFields,
  getConditionTypesObject
} from 'Modules/@apostrophecms/schema/lib/conditionalFields.js';

/**
 * The tabs of the versions modal: the read-only schema of the document's
 * type, grouped as the document editor groups it, with the conditional
 * fields evaluated against the version shown. A tab none of whose fields
 * renders is not visible.
 *
 * @param {object} options
 * @param {import('vue').Ref<object>} options.moduleOptions
 *   The browser options of the document's type
 * @param {object} options.doc
 *   The document the modal opened for
 * @param {import('vue').Ref<{ data: object }>} options.docFields
 *   The version shown
 */
export function useDocVersionTabs({
  moduleOptions, doc, docFields
}) {
  const $t = inject('i18n');
  const docId = doc._id;

  const schema = computed(() => {
    const fields = (moduleOptions.value.schema || [])
      .filter(field => apos.schema.components.fields[field.type])
      .filter(field => field.name !== 'archived');
    return klona(fields).map(field => ({
      ...field,
      readOnly: true
    }));
  });

  const externalConditionsResults = ref(getConditionTypesObject());
  const conditionalFields = ref(getConditionTypesObject());

  async function evaluateExternalConditions() {
    externalConditionsResults.value = await evaluateSchemaExternalConditions(
      schema.value,
      docId,
      $t
    );
  }

  // With no version to show, the tabs follow the live document
  function evaluateConditions(data = docFields.value.data) {
    conditionalFields.value = getConditionalFields(
      schema.value,
      data,
      externalConditionsResults.value
    );
  }

  const currentTab = ref(null);

  function isParked(fieldName) {
    return (doc.parked || []).includes(fieldName);
  }

  const groups = computed(() => {
    const groupSet = {};
    for (const field of schema.value) {
      if (isParked(field.name) || !field.group) {
        continue;
      }
      const { group } = field;
      groupSet[group.name] = groupSet[group.name] || {
        label: group.label,
        fields: [],
        schema: []
      };
      groupSet[group.name].fields.push(field.name);
      groupSet[group.name].schema.push(field);
    }
    return groupSet;
  });

  // A tab is worth showing only when one of its fields renders: a hidden
  // field or one whose condition is unmet leaves the pane empty
  function isTabVisible(schema) {
    return schema.some(
      field => !field.hidden && conditionalFields.value.if[field.name] !== false
    );
  }

  const versionTabs = computed(() => {
    const tabs = Object.entries(groups.value)
      .filter(([ name ]) => name !== 'utility')
      .map(([ name, group ]) => ({
        name,
        label: group.label,
        fields: group.fields,
        isVisible: isTabVisible(group.schema)
      }));
    const utility = groups.value.utility;
    tabs.push({
      name: 'utility',
      label: 'apostrophe:utility',
      fields: utility?.fields || [],
      isVisible: isTabVisible(utility?.schema || [])
    });
    return tabs;
  });

  watch(versionTabs, (tabs) => {
    const current = tabs.find(tab => tab.name === currentTab.value);
    if (current?.isVisible) {
      return;
    }
    const first = tabs.find(tab => tab.isVisible) || tabs[0];
    currentTab.value = first?.name || null;
  }, { immediate: true });

  function switchPane(name) {
    currentTab.value = name;
  }

  return {
    groups,
    versionTabs,
    currentTab,
    switchPane,
    conditionalFields,
    evaluateExternalConditions,
    evaluateConditions
  };
}

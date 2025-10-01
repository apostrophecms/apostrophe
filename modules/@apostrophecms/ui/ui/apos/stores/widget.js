import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useWidgetStore = defineStore('widget', () => {
  const refs = ref({});

  function toId(id, namespace) {
    return `${id}:${namespace}`;
  }

  function get(id, namespace) {
    return refs.value[toId(id, namespace)] || null;
  };

  function set(id, namespace, data) {
    refs.value[toId(id, namespace)] = ref({ data: { value: data } });
    return refs.value[toId(id, namespace)];
  }

  function getOrSet(id, namespace, data) {
    return get(id, namespace) || set(id, namespace, data);
  }

  function update(id, namespace, data) {
    if (!refs.value[toId(id, namespace)]) {
      return null;
    }
    refs.value[toId(id, namespace)].data.value = data;
    return refs.value[toId(id, namespace)];
  }

  function remove(id, namespace) {
    delete refs.value[toId(id, namespace)];
    return true;
  }

  return {
    refs,
    toId,
    get,
    set,
    getOrSet,
    update,
    remove
  };
});

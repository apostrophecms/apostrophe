<template>
<!-- TODO: handle joinByOne and joinByArray -->
<!-- TODO: handle mulitple joined types -->
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid"
  >
    <template #body>
      <div class="apos-input-wrapper apos-input-join">
        <div class="apos-input-join__input-wrapper">
          <input
            class="apos-input apos-input--text apos-input--join"
            v-model="next" type="text"
            :placeholder="field.placeholder"
            :disabled="status.disabled" :required="field.required"
            :id="uid"
            @input="input"
          >
          <AposButton
            :label="browseLabel"
            :modifiers="['small']"
            type="input"
          />
        </div>
        <AposSlatList @update="updated" :initial-items="items" />
        <AposSearchList :list="searchList" @select="selected" />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin.js';

export default {
  name: 'AposInputJoinByArray',
  mixins: [ AposInputMixin ],
  props: {
    listItems: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  data () {
    return {
      browseLabel: 'Browse ' + apos.modules[this.field.withType].pluralLabel,
      searchList: [],
      items: this.listItems
    }
  },
  async mounted () {
    const list = await apos.http.get(`${apos.modules[this.field.withType].action}?autocomplete=${this.next}`, {
      busy: true
    });
  },
  methods: {
    validate(value) {
      if (this.field.required && !value.length) {
        return 'required';
      }

      return false;
    },
    updated(items) {
      console.log('Heard update');
      console.log(items);
    },
    selected(items) {
      this.items = items;
    },
    async input () {
      if (this.next.length) {
        const list = await apos.http.get(`${apos.modules[this.field.withType].action}?autocomplete=${this.next}`, {
          busy: true
        });
        this.searchList = list.results;
      } else {
        this.searchList = [];
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-join__input-wrapper {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }

  .apos-button {
    position: absolute;
    right: 7.5px;
  }
</style>

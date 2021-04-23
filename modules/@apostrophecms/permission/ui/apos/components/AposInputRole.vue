<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper apos-input__role">
        <select
          class="apos-input apos-input--select apos-input--role" :id="uid"
          @change="change($event.target.value)"
          :disabled="field.readOnly"
        >
          <option
            v-for="choice in choices" :key="JSON.stringify(choice.value)"
            :value="JSON.stringify(choice.value)"
            :selected="choice.value === value.data"
          >
            {{ choice.label }}
          </option>
        </select>
        <AposIndicator
          icon="menu-down-icon"
          class="apos-input-icon"
          :icon-size="20"
        />
      </div>
      <div class="apos-input__role__permission-grid">
        <div
          v-for="permissionSet in permissionSets"
          :key="permissionSet.name"
          class="apos-input__role__permission-grid__set"
        >
          <h4 class="apos-input__role__permission-grid__set-name">
            {{ permissionSet.label }}
            <AposIndicator
              v-if="permissionSet.includes"
              icon="help-circle-icon"
              class="apos-input__role__permission-grid__help"
              :tooltip="getTooltip(permissionSet.includes)"
              :icon-size="11"
              icon-color="var(--a-base-4)"
            />
          </h4>
          <dl class="apos-input__role__permission-grid__list">
            <div
              v-for="permission in permissionSet.permissions"
              :key="permission.name"
              class="apos-input__role__permission-grid__row"
            >
              <dd class="apos-input__role__permission-grid__value">
                <AposIndicator
                  :icon="permission.value ? 'check-bold-icon' : 'close-icon'"
                  :icon-color="permission.value ? 'var(--a-success)' : 'var(--a-base-5)'"
                />
                <span v-if="permission.value" class="apos-sr-only">
                  Enabled
                </span>
                <span v-else class="apos-sr-only">
                  Disabled
                </span>
              </dd>
              <dt class="apos-input__role__permission-grid__label">
                {{ permission.label }}
              </dt>
            </div>
          </dl>
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputRole',
  mixins: [ AposInputMixin ],
  props: {
    icon: {
      type: String,
      default: 'menu-down-icon'
    }
  },
  data() {
    return {
      next: (this.value.data == null) ? null : this.value.data,
      choices: [],
      permissionSets: []
    };
  },
  watch: {
    async next() {
      this.permissionSets = await this.getPermissionSets(this.next);
    }
  },
  async mounted() {
    // Add an null option if there isn't one already
    if (!this.field.required && !this.field.choices.find(choice => {
      return choice.value === null;
    })) {
      this.choices.push({
        label: '',
        value: null
      });
    }
    this.choices = this.choices.concat(this.field.choices);
    this.$nextTick(() => {
      // this has to happen on nextTick to avoid emitting before schemaReady is
      // set in AposSchema
      if (this.field.required && (this.next == null) && (this.field.choices[0] != null)) {
        this.next = this.field.choices[0].value;
      }
    });
    if (this.next) {
      this.permissionSets = await this.getPermissionSets(this.next);
    }
  },
  methods: {
    getTooltip(includes) {
      const html = document.createElement('div');
      html.setAttribute('class', 'apos-info');
      const list = document.createElement('ul');
      const intro = document.createElement('p');
      const followUp = document.createElement('p');
      const link = document.createElement('a');
      intro.appendChild(document.createTextNode('Pieces are structured content. They are often used for content like articles, events, products, categories, etc.'));
      followUp.appendChild(document.createTextNode('Pieces for this site include:'));
      link.appendChild(document.createTextNode('Explanation of Pieces'));
      link.setAttribute('href', 'https://a3.docs.apostrophecms.org/reference/glossary.html#piece');
      link.setAttribute('_target', 'blank');
      html.appendChild(intro);
      html.appendChild(followUp);
      includes.forEach(item => {
        const li = document.createElement('li');
        li.appendChild(document.createTextNode(item));
        list.appendChild(li);
      });
      html.appendChild(list);
      // TODO append this link when doc urls are more stable
      // html.appendChild(link);
      return { content: html };
    },
    validate(value) {
      if (this.field.required && !value.length) {
        return 'required';
      }
      if (value && !this.field.choices.find(choice => choice.value === value)) {
        return 'invalid';
      }
      return false;
    },
    change(value) {
      // Allows expression of non-string values
      this.next = this.choices.find(choice => choice.value === JSON.parse(value)).value;
    },
    async getPermissionSets(role) {
      return (await apos.http.get(`${apos.permission.action}/grid`, {
        qs: {
          role
        },
        busy: true
      })).permissionSets;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-icon {
    @include apos-transition();
  }

  .apos-input__role__permission-grid {
    @include type-base;
    display: grid;
    margin-top: $spacing-triple;
    grid-template-columns: repeat(auto-fit, minmax(50%, 1fr));
  }

  .apos-input__role__permission-grid__row {
    display: flex;
    align-items: center;
    padding-bottom: $spacing-three-quarters;
    margin-bottom: $spacing-three-quarters;
    border-bottom: 1px solid var(--a-base-9);
  }
  .apos-input__role__permission-grid__list {
    margin-top: 0;
  }
  .apos-input__role__permission-grid__set {
    padding: 0 $spacing-base;
    margin-bottom: $spacing-double;
  }

  .apos-input__role__permission-grid__set-name {
    display: inline-flex;
    margin: 0 0 $spacing-double;
  }

  .apos-input__role__permission-grid__value {
    display: inline-flex;
    margin: 0 $spacing-half 0 0;
  }

  .apos-input__role__permission-grid__help {
    margin-left: $spacing-half;
  }
</style>

<template>
  <fieldset class="apos-breadcrumb-switch">
    <div>
      <!-- <input type="radio" id="html" name="fav_language" value="HTML"> -->
      <!-- <label for="html">HTML</label><br> -->
      <label
        v-for="choice in choices"
        :key="choice.value"
        :for="choice.value"
      >
        <input
          :id="choice.value"
          v-model="next"
          :value="choice.value"
          type="radio"
          :name="name"
          @input="update"
        >
        <span>{{ choice.label }}</span>
      </label>
    </div>
  </fieldset>
</template>

<script>
export default {
  name: 'AposBreadcrumbSwitch',
  components: { },
  props: {
    choices: {
      type: Array,
      required: true
    },
    value: {
      type: String,
      default: undefined
    },
    name: {
      type: String,
      required: true
    }
  },
  emits: [
    'update'
  ],
  data() {
    return {
      next: this.value || null
    };
  },
  computed: {},
  watch: {
  },
  mounted() {
  },
  methods: {
    update(event) {
      this.next = event.target.value;
      this.$emit('update', {
        name: this.name,
        value: this.next
      });
      // console.log('eee');
      // console.log(event);
      // console.log('updating', this.next);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-breadcrumb-switch {
  position: relative;
  padding: 0;
  margin: 0;
  border: none;

  :focus {
    outline: 0;
    box-shadow: 0 0 0 4px #b5c9fc;
  }

  div {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    label:first-child span {
      left: -1px;
    }
    label:last-child span {
      right: -1px;
    }
  }

  input[type="radio"] {
    // Code to hide the input
    clip: rect(0 0 0 0);
    clip-path: inset(100%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
    &:checked + span {
      box-shadow: 0 0 0 1px var(--a-primary-dark-15);
      background-color: var(--a-primary-transparent-90);
      z-index: 1;
      color: var(--a-text-inverted);
    }
  }

  label {
    display: flex;
    align-items: center;

    &:hover input:not(:checked) + span {
      background-color: var(--a-base-9);
    }

    span {
      height: 100%;
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      position: relative;
      margin-left: .0625em;
      letter-spacing: 0.5px;
      color: #3e4963;
      text-align: center;
      transition: background-color .5s ease;
      box-sizing: border-box;
      border-radius: 4px;
      padding: 0 8px;
    }
  }
}

</style>

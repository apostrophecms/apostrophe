<template>
  <transition name="fade-stage">
    <div
      class="apos-login apos-theme-dark"
      v-show="loaded"
      :class="themeClass"
    >
      <div class="apos-login__wrapper">
        <transition name="fade-body">
          <div class="apos-login__upper" v-show="loaded">
            <div class="apos-login__header">
              <label
                class="apos-login__project apos-login__project-env"
                :class="[`apos-login__project-env--${context.env}`]"
              >
                {{ context.env }}
              </label>
              <label class="apos-login__project apos-login__project-name">
                {{ context.name }}
              </label>
              <label class="apos-login--error">
                {{ error }}
              </label>
            </div>

            <div class="apos-login__body" v-show="loaded">
              <form v-if="phase == 'beforeSubmit'" @submit.prevent="submit">
                <AposSchema
                  :schema="schema"
                  v-model="doc"
                />
                <!-- Do not ask these components to render without their precheck data,
                  v-show is not enough -->
                <template v-if="loaded">
                  <Component v-for="requirement in beforeSubmitRequirements" :key="requirement.name" :is="requirement.component" :precheck="getPrecheck(requirement.name)" v-bind="requirement.props" @done="requirementDone(requirement, $event)" />
                </template>
                <!-- TODO -->
                <!-- <a href="#" class="apos-login__link">Forgot Password</a> -->
                <AposButton
                  :busy="busy"
                  :disabled="disabled"
                  type="primary"
                  label="apostrophe:login"
                  button-type="submit"
                  class="apos-login__submit"
                  :modifiers="['gradient-on-hover', 'block']"
                  @click="submit"
                />
              </form>
              <Component v-if="activeRequirement && !prechecking" :precheck="getPrecheck(activeRequirement.name)" :is="activeRequirement.component" v-bind="activeRequirement.props" @done="requirementDone(activeRequirement, $event)" />
            </div>
          </div>
        </transition>
      </div>
      <transition name="fade-footer">
        <div class="apos-login__footer" v-show="loaded">
          <AposLogo class="apos-login__logo" />
          <label class="apos-login__project-version">
            Version {{ context.version }}
          </label>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script>
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';

export default {
  name: 'TheAposLogin',
  mixins: [ AposThemeMixin ],
  data() {
    return {
      phase: 'beforeSubmit',
      mounted: false,
      beforeCreateFinished: false,
      error: '',
      busy: false,
      doc: {
        data: {},
        hasErrors: false
      },
      schema: [
        {
          name: 'username',
          label: 'Username',
          placeholder: 'Enter username',
          type: 'string',
          required: true
        },
        {
          name: 'password',
          label: 'Password',
          placeholder: 'Enter password',
          type: 'password',
          required: true
        }
      ],
      requirements: getRequirements(),
      context: {},
      prechecks: {},
      prechecking: false
    };
  },
  computed: {
    loaded() {
      return this.mounted && this.beforeCreateFinished;
    },
    disabled() {
      return this.doc.hasErrors || !!this.beforeSubmitRequirements.find(requirement => !requirement.done);
    },
    beforeSubmitRequirements() {
      return this.requirements.filter(requirement => requirement.phase === 'beforeSubmit');
    },
    activeRequirement() {
      return (this.phase !== 'beforeSubmit') && this.requirements.find(requirement => (requirement.phase !== 'beforeSubmit') && !requirement.done);
    }
  },
  watch: {
    async activeRequirement() {
      if ((this.phase === 'afterPasswordVerified') && (this?.activeRequirement?.phase === 'afterPasswordVerified') && this.activeRequirement.precheckRequired) {
        try {
          const data = await apos.http.post(`${apos.login.action}/precheck`, {
            busy: true,
            body: {
              name: this.activeRequirement.name,
              incompleteToken: this.incompleteToken
            }
          });
          this.prechecking = true;
          this.prechecks = {
            ...this.prechecks,
            [this.activeRequirement.name]: data
          };
        } catch (e) {
          this.error = e.message || 'An error occurred. Please try again.';
        } finally {
          this.prechecking = false;
        }
      } else {
        return null;
      }
    }
  },
  async beforeCreate () {
    const stateChange = parseInt(window.sessionStorage.getItem('aposStateChange'));
    const seen = JSON.parse(window.sessionStorage.getItem('aposStateChangeSeen') || '{}');
    if (!seen[window.location.href]) {
      const lastModified = Date.parse(document.lastModified);
      if (stateChange && lastModified && (lastModified < stateChange)) {
        seen[window.location.href] = true;
        window.sessionStorage.setItem('aposStateChangeSeen', JSON.stringify(seen));
        location.reload();
        return;
      }
    }
    try {
      this.context = await apos.http.post(`${apos.login.action}/context`, {
        busy: true
      });
      this.prechecks = this.context.prechecks;
    } catch (e) {
      this.error = e.message || 'An error occurred. Please try again.';
    } finally {
      this.beforeCreateFinished = true;
    }
  },
  mounted() {
    this.mounted = true;
  },
  methods: {
    async submit() {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.error = '';
      const activeRequirement = this.activeRequirement;
      if ((this.phase === 'beforeSubmit') && this.requirements.find(requirement => requirement.phase === 'afterSubmit')) {
        // Should be presented after the user clicks submit, but not before the
        // actual submission to the server. So we step to the next phase and wait
        // for the user to interact with it before POSTing
        this.phase = 'afterSubmit';
        return;
      }
      await this.invokeInitialLoginApi();
    },
    async invokeInitialLoginApi() {
      try {
        const response = await apos.http.post(`${apos.login.action}/login`, {
          busy: true,
          body: {
            ...this.doc.data,
            requirements: this.getInitialSubmitRequirementsData(),
            session: true
          }
        });
        if (response && response.incompleteToken) {
          this.incompleteToken = response.incompleteToken;
          this.phase = 'afterPasswordVerified';
        } else {
          this.redirectAfterLogin();
        }
      } catch (e) {
        this.error = e.message || 'An error occurred. Please try again.';
        this.phase = 'beforeSubmit';
        this.requirements = getRequirements();
      } finally {
        this.busy = false;
      }      
    },
    getInitialSubmitRequirementsData() {
      return Object.fromEntries(this.requirements.filter(r => r.phase !== 'afterPasswordVerified').map(r => ([
        r.name,
        r.value
      ])));
    },
    async invokeFinalLoginApi() {
      try {
        await apos.http.post(`${apos.login.action}/login`, {
          busy: true,
          body: {
            ...this.doc.data,
            incompleteToken: this.incompleteToken,
            requirements: this.getFinalSubmitRequirementsData(),
            session: true
          }
        });
        this.redirectAfterLogin();
      } catch (e) {
        this.error = e.message || 'An error occurred. Please try again.';
        this.requirements = getRequirements();
        this.phase = 'beforeSubmit';
      } finally {
        this.busy = false;
      }
    },
    getFinalSubmitRequirementsData() {
      return Object.fromEntries(this.requirements.filter(r => r.phase === 'afterPasswordVerified').map(r => ([
        r.name,
        r.value
      ])));
    },
    redirectAfterLogin() {
      window.sessionStorage.setItem('aposStateChange', Date.now());
      window.sessionStorage.setItem('aposStateChangeSeen', '{}');
      // TODO handle situation where user should be sent somewhere other than homepage.
      // Redisplay homepage with editing interface
      location.assign(`${apos.prefix}/`);
    },
    async requirementDone(requirementDone, value) {
      const requirement = this.requirements.find(requirement => requirement.name === requirementDone.name);
      requirement.done = true;
      requirement.value = value;
      if (requirement.phase === 'beforeSubmit') {
        return;
      }
      // Avoids the need for a deep watch
      this.requirements = [ ...this.requirements ];
      const activeRequirement = this.activeRequirement;
      if (this.phase === 'afterSubmit') {
        if (!(activeRequirement && activeRequirement.phase === 'afterSubmit')) {
          await this.invokeInitialLoginApi();
        }
      } else {
        if (!activeRequirement) {
          await this.invokeFinalLoginApi();
        }
      }
    },
    getPrecheck(name) {
      return this.prechecks[name] || {};
    }
  }
};

function getRequirements() {
  const requirements = Object.entries(apos.login.requirements).map(([ name, requirement ]) => {
    return {
      name,
      component: requirement.component || name,
      ...requirement,
      done: false,
      value: null,
    };
  });
  return [
    ...requirements.filter(r => r.phase === 'beforeSubmit'),
    ...requirements.filter(r => r.phase === 'afterSubmit'),
    ...requirements.filter(r => r.phase === 'afterPasswordVerified')
  ];
}
</script>

<style lang="scss">
  .apos-login-page {
    margin: 0;
  }
</style>

<style lang="scss" scoped>
  $login-container: 330px;

  .apos-login__logo {
    width: 100%;
    max-width: 150px;
  }

  .fade-stage-enter-active {
    transition: opacity 0.2s linear;
    transition-delay: 0.3s;
  }

  .fade-stage-enter-to,
  .fade-body-enter-to,
  .fade-footer-enter-to {
    opacity: 1;
  }

  .fade-stage-enter,
  .fade-body-enter,
  .fade-footer-enter {
    opacity: 0;
  }

  .fade-body-enter-active {
    transition: all 0.25s linear;
    transition-delay: 0.6s;
  }

  .fade-body-enter-to {
    transform: translateY(0);
  }

  .fade-body-enter {
    transform: translateY(4px);
  }

  .fade-footer-enter-active {
    transition: opacity 0.4s linear;
    transition-delay: 1s;
  }

  .apos-login {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100vh;
    background-color: var(--a-background-primary);

    &__wrapper {
      width: 100%;
      max-width: $login-container;
      margin: 0 auto;
    }

    &__header {
      z-index: $z-index-manager-display;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: start;
      width: max-content;
    }

    &__project-name {
      @include type-display;
      margin: 0;
      color: var(--a-text-primary);
      text-transform: capitalize;
    }

    &__project-env {
      @include type-base;
      text-transform: capitalize;
      padding: 6px 12px;
      color: var(--a-white);
      background: var(--a-success);
      border-radius: 5px;
      margin-bottom: 15px;

      &--development {
        background: var(--a-danger);
      }

      &--success {
        background: var(--a-warning);
      }
    }

    &--error {
      @include type-help;
      color: var(--a-danger);
      min-height: 13px;
      margin-top: 20px;
      margin-bottom: 15px;
    }

    form {
      position: relative;
      display: flex;
      flex-direction: column;

      button {
        margin-top: $spacing-double;
      }
    }

    &__loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;

      .apos-spinner {
        width: 38px;
        height: 38px;
        margin-top: 20px;
      }
    }

    &__footer {
      @include type-base;
      position: absolute;
      right: 0;
      bottom: 32px;
      left: 0;
      display: flex;
      width: 100%;
      max-width: $login-container;
      margin: auto;
      align-items: center;
      justify-content: start;
    }

    &__project-version {
      overflow: hidden;
      text-overflow: clip;
      white-space: nowrap;
      color: var(--a-base-5);
      margin-right: 0;
      margin-left: auto;
    }
  }

  .apos-login__submit ::v-deep .apos-button {
    height: 47px;
  }
</style>

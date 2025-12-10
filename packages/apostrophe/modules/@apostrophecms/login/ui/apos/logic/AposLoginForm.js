// This is the business logic of the AposLoginForm Vue component.
// It is in a separate file so that you can override the component's templates
// and styles just by copying the .vue file to your project, and leave the
// business logic unchanged.

import AposLoginFormMixin from 'Modules/@apostrophecms/login/mixins/AposLoginFormMixin';

export default {
  mixins: [ AposLoginFormMixin ],
  emits: [ 'redirect', 'set-stage' ],
  data() {
    return {
      phase: 'beforeSubmit',
      busy: false,
      schema: apos.login.schema,
      requirements: getRequirements(),
      requirementProps: {},
      fetchingRequirementProps: false
    };
  },
  computed: {
    disabled() {
      return this.doc.hasErrors ||
        !!this.beforeSubmitRequirements.find(requirement => !requirement.done);
    },
    beforeSubmitRequirements() {
      return this.requirements.filter(requirement => requirement.phase === 'beforeSubmit');
    },
    uponSubmitRequirements() {
      return this.requirements.filter(requirement => requirement.phase === 'uponSubmit');
    },
    // The currently active requirement expecting a solo presentation.
    // Currently it only concerns `afterPasswordVerified` requirements.
    // beforeSubmit requirements are not presented solo.
    activeSoloRequirement() {
      return (this.phase === 'afterPasswordVerified') &&
        this.requirements.find(requirement =>
          (requirement.phase === 'afterPasswordVerified') && !requirement.done
        );
    }
  },
  watch: {
    context(newVal) {
      this.requirementProps = newVal.requirementProps;
    },
    async activeSoloRequirement(newVal) {
      if (
        (this.phase === 'afterPasswordVerified') &&
        (newVal?.phase === 'afterPasswordVerified') &&
        newVal.propsRequired &&
        !(newVal.success || newVal.error)
      ) {
        try {
          this.fetchingRequirementProps = true;
          const data = await apos.http.post(`${apos.login.action}/requirement-props`, {
            busy: true,
            body: {
              name: newVal.name,
              incompleteToken: this.incompleteToken
            }
          });
          this.requirementProps = {
            ...this.requirementProps,
            [newVal.name]: data
          };
        } catch (e) {
          this.error = e.message || 'apostrophe:loginErrorGeneric';
        } finally {
          this.fetchingRequirementProps = false;
        }
      } else {
        return null;
      }
    },
    uponSubmitRequirements: {
      deep: true,
      async handler(newVal) {
        if (this.phase !== 'uponSubmit') {
          return;
        }

        const isUponSubmitRequirementsPending = newVal
          .some(requirement => requirement.done === null);
        if (isUponSubmitRequirementsPending) {
          return;
        }

        const isUponSubmitRequirementsDone = newVal.every(
          requirement => requirement.done === true
        ) || this.uponSubmitRequirements.length === 0;
        if (isUponSubmitRequirementsDone) {
          await this.postSubmit();

          return;
        }

        const isUponSubmitRequirementsBlocked = newVal
          .some(requirement => requirement.done === false);
        if (isUponSubmitRequirementsBlocked) {
          for (const requirement of this.uponSubmitRequirements) {
            requirement.done = null;
            requirement.value = null;
          }
          this.phase = 'beforeSubmit';
          this.busy = false;
          this.error = '';
        }
      }
    }
  },
  created() {
    this.requirementProps = this.context.requirementProps;
  },
  methods: {
    async submit() {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.error = '';

      this.uponSubmitRequirements.length
        ? this.uponSubmit()
        : await this.postSubmit();
    },
    uponSubmit() {
      this.phase = 'uponSubmit';
      // Note: uponSubmitRequirements watcher will handle the next step
    },
    async postSubmit() {
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
      } finally {
        this.busy = false;
      }
    },
    getInitialSubmitRequirementsData() {
      return Object.fromEntries(this.requirements
        .filter(r => r.phase !== 'afterPasswordVerified' || !r.done)
        .map(r => ([
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
      // TODO handle situation where user should be sent somewhere other than
      // homepage. Redisplay homepage with editing interface
      this.$emit('redirect', `${apos.prefix}/`);
    },
    async requirementBlock(requirementBlock) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementBlock.name);
      requirement.done = false;
      requirement.value = undefined;
    },
    async requirementDone(requirementDone, value) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementDone.name);

      if (requirement.phase === 'beforeSubmit' || requirement.phase === 'uponSubmit') {
        requirement.done = true;
        requirement.value = value;
        return;
      }

      requirement.error = null;

      try {
        await apos.http.post(`${apos.login.action}/requirement-verify`, {
          busy: true,
          body: {
            name: requirement.name,
            value,
            incompleteToken: this.incompleteToken
          }
        });

        requirement.success = true;
      } catch (err) {
        requirement.error = err;
      }

      // Avoids the need for a deep watch
      this.requirements = [ ...this.requirements ];

      if (requirement.success && !requirement.askForConfirmation) {
        requirement.done = true;

        if (!this.activeSoloRequirement) {
          await this.invokeFinalLoginApi();
        }
      }
    },

    async requirementConfirmed (requirementConfirmed) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementConfirmed.name);

      requirement.done = true;

      if (!this.activeSoloRequirement) {
        await this.invokeFinalLoginApi();
      }
    },
    getRequirementProps(name) {
      return this.requirementProps[name] || {};
    }
  }
};

function getRequirements() {
  const requirements = Object
    .entries(apos.login.requirements)
    .map(([ name, requirement ]) => {
      return {
        name,
        component: requirement.component || name,
        ...requirement,
        done: null,
        value: null,
        success: null,
        error: null
      };
    });
  return [
    ...requirements.filter(r => r.phase === 'beforeSubmit'),
    ...requirements.filter(r => r.phase === 'uponSubmit'),
    ...requirements.filter(r => r.phase === 'afterPasswordVerified')
  ];
}

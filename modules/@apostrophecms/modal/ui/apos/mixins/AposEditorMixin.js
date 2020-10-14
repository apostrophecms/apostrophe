// Provide basic bridging functionality between tabs
// and the modal body.

export default {
  methods: {
    // followedBy is either "other" or "utility". The returned object contains
    // properties named for each field that follows other fields. For instance if followedBy is "utility"
    // then in our default configuration `followingValues` will be `{ slug: { title: 'latest title here' } }`
    followingValues(followedBy) {
      const self = this;
      let fields;

      if (followedBy) {
        fields = (followedBy === 'other')
          ? this.schema.filter(field => !this.utilityFields.includes(field.name)) : this.schema.filter(field => this.utilityFields.includes(field.name));
      } else {
        fields = this.schema;
      }

      const followingValues = {};

      for (const field of fields) {
        if (field.following) {
          const following = Array.isArray(field.following) ? field.following : [ field.following ];
          followingValues[field.name] = {};
          for (const name of following) {
            followingValues[field.name][name] = get(name);
          }
        }
      }
      return followingValues;

      function get(name) {
        if (self.docUtilityFields && (self.docUtilityFields.data[name] !== undefined)) {
          return self.docUtilityFields.data[name];
        }
        if (self.docOtherFields && (self.docOtherFields.data[name] !== undefined)) {
          return self.docOtherFields.data[name];
        }
      }
    }
  }
};

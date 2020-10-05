// Provide basic bridging functionality between tabs
// and the modal body.

export default {
  methods: {
    // followedBy is either "other" or "utility". The returned object contains
    // properties named for each field that follows another field; the values are
    // those of the followed field. For instance if followedBy is "utility"
    // then in our default configuration `followingValues` will be `{ slug: 'latest title here' }`
    followingValues: function(followedBy) {
      let fields;
      let source;

      if (followedBy) {
        fields = (followedBy === 'other')
          ? this.schema.filter(field => !this.utilityFields.includes(field.name)) : this.schema.filter(field => this.utilityFields.includes(field.name));

        source = (followedBy === 'other') ? this.docUtilityFields
          : this.docOtherFields;
      } else {
        fields = this.schema;
        source = this.doc;
      }

      const followingValues = {};

      for (const field of fields) {
        if (field.following) {
          followingValues[field.name] = source.data[field.following];
        }
      }

      return followingValues;
    }
  }
};

export default {
  methods: {
    // Fetch a field from the published version of the item, if available and
    // defined, otherwise from the draft version of the item
    displayValue(fieldName) {
      const publishedDoc = this.item._publishedDoc;
      return (publishedDoc && (publishedDoc[fieldName] !== undefined) && publishedDoc[fieldName]) || this.item[fieldName];
    }
  }
};

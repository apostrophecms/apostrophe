export default {
  methods: {
    generateId (prefix) {
      let num = (Math.floor(Math.random() * Math.floor(10000))).toString();
      if (prefix) {
        num = `${prefix}-${num}`;
      }
      return num;
    }
  }
};

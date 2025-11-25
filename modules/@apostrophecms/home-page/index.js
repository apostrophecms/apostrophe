module.exports = {
  extend: '@apostrophecms/page-type',
  helpers: {
    async fetchData() {
      const response = await fetch('https://api.example.com/data');
      const data = await response.json();
      return data;
    }
  }
};

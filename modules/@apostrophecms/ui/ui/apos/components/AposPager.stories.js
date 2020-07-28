import AposPager from './AposPager.vue';

export default {
  title: 'Pagination'
};

export const pagination = () => ({
  components: { AposPager },
  data() {
    return {
      currentPage: 1,
      totalPages: 5
    };
  },
  template: `
    <AposPager
      @click="registerPageChange"  @change="registerPageChange"
      :totalPages="totalPages" :currentPage="currentPage"
    />
  `,
  methods: {
    registerPageChange (pageNum) {
      this.currentPage = pageNum;
    }
  }
});

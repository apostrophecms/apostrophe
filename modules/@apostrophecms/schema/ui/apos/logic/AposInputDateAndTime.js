import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import dayjs from 'dayjs';

export default {
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  data() {
    return {
      next: (this.value && this.value.data) || null,
      date: '',
      time: '',
      disabled: !this.field.required
    };
  },
  mounted () {
    this.initDateAndTime();
  },
  methods: {
    toggle() {
      this.disabled = !this.disabled;

      if (this.disabled) {
        this.next = null;
      }
    },
    validate() {
      if (this.isRequired && !this.next) {
        return 'required';
      }
    },
    initDateAndTime() {
      if (this.next) {
        this.date = dayjs(this.next).format('YYYY-MM-DD');
        this.time = dayjs(this.next).format('HH:mm:ss');
        this.disabled = false;
      }
    },
    setDateAndTime() {
      if (this.date) {
        this.next = dayjs(`${this.date} ${this.time}`.trim()).toISOString();
        this.disabled = false;
      } else {
        this.next = null;
        this.disabled = true;
      }
    }
  }

};

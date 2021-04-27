<template>
  <p
    class="apos-table__cell-field"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ formattedDate }}
  </p>
</template>

<script>
export default {
  name: 'AposCellDate',
  props: {
    item: {
      type: Object,
      required: true
    },
    header: {
      type: Object,
      required: true
    }
  },
  computed: {
    formattedDate () {
      const value = this.item[this.header.name];

      return this.formatDateColumn(value);
    }
  },
  methods: {
    formatDateColumn (value) {
      const d = new Date(value);
      if (Number.isNaN(d.getDate())) {
        // We're not sure what this is, but it's not a date.
        return value;
      }
      const month = d.getMonth();
      const date = d.getDate();
      const year = d.getFullYear();
      let hour = d.getHours();
      const period = hour > 11 ? 'pm' : 'am';
      if (hour > 12) {
        hour = hour - 12;
      } else if (hour === 0) {
        hour = 12;
      }
      const minute = d.getMinutes();

      return `${toTwoChars(month)}/${toTwoChars(date)}/${toTwoChars(year)} at ${hour}:${minute} ${period}`;

      function toTwoChars(num) {
        num = parseInt(num);

        if (num < 10) {
          return `0${num.toString()}`;
        } else if (num > 1000) {
          // Good as long as we replace this by year 10,000.
          return toTwoChars(num.toString().slice(2, 4));
        } else {
          // If it's more than 12 and less than 1000, the problem isn't here.
          return num;
        };
      }
    }

  }
};
</script>

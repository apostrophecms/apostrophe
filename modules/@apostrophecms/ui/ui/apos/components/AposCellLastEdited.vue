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
  name: 'AposCellLastEdited',
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
      return this.getRelativeTime(value);
    }
  },
  methods: {
    getRelativeTime (value) {
      // cribbed from https://gist.github.com/pomber/6195066a9258d1fb93bb59c206345b38
      const d = new Date(value);
      if (Number.isNaN(d.getDate())) {
        // We're not sure what this is, but it's not a date.
        return value;
      }
      const secondsAgo = Math.round((+new Date() - d) / 1000);
      let divisor = null;
      let unit = null;
      const MINUTE = 60;
      const HOUR = MINUTE * 60;
      const DAY = HOUR * 24;
      const WEEK = DAY * 7;
      const MONTH = DAY * 30;
      const YEAR = DAY * 365;

      if (secondsAgo < MINUTE) {
        return secondsAgo + ' seconds ago';
      } else if (secondsAgo < HOUR) {
        [ divisor, unit ] = [ MINUTE, 'minute' ];
      } else if (secondsAgo < DAY) {
        [ divisor, unit ] = [ HOUR, 'hour' ];
      } else if (secondsAgo < WEEK) {
        [ divisor, unit ] = [ DAY, 'day' ];
      } else if (secondsAgo < MONTH) {
        [ divisor, unit ] = [ WEEK, 'week' ];
      } else if (secondsAgo < YEAR) {
        [ divisor, unit ] = [ MONTH, 'month' ];
      } else if (secondsAgo > YEAR) {
        [ divisor, unit ] = [ YEAR, 'year' ];
      }

      const count = Math.floor(secondsAgo / divisor);
      return `${count} ${unit}${(count > 1) ? 's' : ''} ago`;

    }

  }
};
</script>

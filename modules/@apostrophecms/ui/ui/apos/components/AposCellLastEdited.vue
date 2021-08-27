<template>
  <p
    class="apos-table__cell-field apos-table__cell-field--relative-time"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ formattedDate }}
  </p>
</template>

<script>
import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';
import dayjs from 'dayjs';

export default {
  name: 'AposCellLastEdited',
  mixins: [ AposCellMixin ],
  computed: {
    formattedDate () {
      const value = this.get(this.header.name || this.header.property);
      return this.getRelativeTime(value);
    }
  },
  methods: {
    getRelativeTime (value) {
      const format = this.$t('apostrophe:dayjsRelativeTimeFormat');
      // endsWith allows it to still match when the i18n show debug mode
      // is in effect
      if (!format.endsWith('apostrophe')) {
        return dayjs(value).format(format);
      }
      // Custom format for US
      // Cribbed from https://gist.github.com/pomber/6195066a9258d1fb93bb59c206345b38
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
        return secondsAgo + 's';
      } else if (secondsAgo < HOUR) {
        [ divisor, unit ] = [ MINUTE, 'm' ];
      } else if (secondsAgo < DAY) {
        [ divisor, unit ] = [ HOUR, 'h' ];
      } else if (secondsAgo < WEEK) {
        [ divisor, unit ] = [ DAY, 'd' ];
      } else if (secondsAgo < MONTH) {
        [ divisor, unit ] = [ WEEK, 'w' ];
      } else if (secondsAgo < YEAR) {
        [ divisor, unit ] = [ MONTH, 'mo' ];
      } else if (secondsAgo > YEAR) {
        [ divisor, unit ] = [ YEAR, 'yr' ];
      }

      const count = Math.floor(secondsAgo / divisor);
      return `${count}${unit} ago`;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-table__cell-field--relative-time {
    color: var(--a-base-4);
  }
</style>

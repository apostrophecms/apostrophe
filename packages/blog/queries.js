const dayjs = require('dayjs');

module.exports = (self, query) => {
  return {
    builders: {
      future: {
        def: null,
        finalize() {
          let future = query.get('future');

          if (!self.apos.permission.can(query.req, 'edit', self.name, 'draft')) {
            future = false;
          }

          if (future === null) {
            return;
          }

          const today = dayjs().format('YYYY-MM-DD');
          if (future) {
            query.and({ publishedAt: { $gte: today } });
          } else {
            query.and({ publishedAt: { $lte: today } });
          }
        },
        launder(value) {
          return self.apos.launder.booleanOrNull(
            value === '' ? null : value
          );
        },
        choices() {
          return [
            {
              value: null,
              label: 'aposBlog:both'
            },
            {
              value: true,
              label: 'aposBlog:future'
            },
            {
              value: false,
              label: 'aposBlog:past'
            }
          ];
        }
      },

      // Filter by year, in YYYY format.
      year: {
        def: null,
        finalize() {
          const year = query.get('year');
          if (!year) {
            return;
          }

          query.and({ publishedAt: { $regex: '^' + year } });
        },
        launder(value) {
          const year = self.apos.launder.string(value);

          if (!year.match(/^\d\d\d\d$/)) {
            return '';
          }

          return year;
        },
        async choices() {
          const allDates = await query.toDistinct('publishedAt');
          const years = [
            {
              value: null,
              label: 'aposBlog:filterAll'
            }
          ];

          for (const eachDate of allDates) {
            const year = eachDate.substr(0, 4);
            if (!years.find((e) => e.value === year)) {
              years.push({
                value: year,
                label: year
              });
            }
          }
          years.sort().reverse();

          return years;
        }
      },

      // Filter by month, in YYYY-MM format.
      month: {
        def: null,
        finalize() {
          const month = query.get('month');

          if (!month) {
            return;
          }

          query.and({ publishedAt: { $regex: '^' + month } });
        },
        launder(value) {
          const month = self.apos.launder.string(value);

          if (!month.match(/^\d\d\d\d-\d\d$/)) {
            return null;
          }

          return month;
        },
        async choices() {
          const allDates = await query.toDistinct('publishedAt');
          const months = [
            {
              value: null,
              label: 'aposBlog:filterAll'
            }
          ];

          for (const eachDate of allDates) {
            const month = eachDate.substr(0, 7);
            if (!months.find((e) => e.value === month)) {
              months.push({
                value: month,
                label: month
              });
            }
          }
          months.sort().reverse();

          return months;
        }
      },

      // Filter by day, in YYYY-MM-DD format.
      day: {
        def: null,
        finalize() {
          const day = query.get('day');

          if (!day) {
            return;
          }

          query.and({ publishedAt: day });
        },
        launder(value) {
          const day = self.apos.launder.string(value);

          if (!day.match(/^\d\d\d\d-\d\d-\d\d$/)) {
            return null;
          }

          return day;
        },
        async choices() {
          const allDates = await query.toDistinct('publishedAt');
          const days = [
            {
              value: null,
              label: 'aposBlog:filterAll'
            }
          ];

          for (const eachDate of allDates) {
            if (!days.find((e) => e.value === eachDate)) {
              days.push({
                value: eachDate,
                label: eachDate
              });
            }
          }
          days.sort().reverse();

          return days;
        }
      }
    }
  };
};

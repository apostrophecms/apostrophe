const fullDateRegex = /^\d\d\d\d-\d\d-\d\d$/;

module.exports = (self, query) => {
  return {
    builders: {
      upcoming: {
        def: null,
        safeFor: 'public',
        finalize() {
          // Navigation by year, month or day should
          // trump this filter allowing you to
          // browse the past

          if (query.get('year')) {
            return;
          }
          if (query.get('month')) {
            return;
          }
          if (query.get('day')) {
            return;
          }

          const upcoming = query.get('upcoming');

          if (upcoming === null) {
            return;
          }

          if (upcoming) {
            query.and({
              end: { $gt: new Date() }
            });
          } else {
            query.and({
              end: { $lte: new Date() }
            });
          }
        },
        launder(value) {
          return self.apos.launder.booleanOrNull(value);
        },
        choices() {
          return [
            {
              value: null,
              label: 'aposEvent:filterUpcomingBoth'
            },
            {
              value: true,
              label: 'aposEvent:filterUpcomingTrue'
            },
            {
              value: false,
              label: 'aposEvent:filterUpcomingFalse'
            }
          ];
        }
      },
      // Filter by year, in YYYY-MM-DD format. The event must
      // be taking place during that year (it might surround it).
      // Use of this filter cancels the upcoming filter
      year: {
        def: null,
        safeFor: 'public',
        finalize() {
          const year = query.get('year');
          if (!year) {
            return;
          }

          query.and({
            $and: [
              { startDate: { $lte: year + '-12-31' } },
              { endDate: { $gte: year + '-01-01' } }
            ]
          });
        },
        launder(value) {
          return self.apos.launder.string(value);
        },
        async choices() {
          const allDates = await query
            .clone()
            .upcoming(null)
            .toDistinct('startDate');

          const years = [ {
            value: null,
            label: 'aposEvent:filterAll'
          } ];
          for (const eachDate of allDates) {
            const year = eachDate.substr(0, 4);
            if (!years.find(e => e.value === year)) {
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
      // Filter by month, in YYYY-MM- format, using regex. The event must
      // be taking place during that month (it might surround it).
      // Use of this filter cancels the upcoming filter
      month: {
        def: null,
        safeFor: 'public',
        finalize() {
          const month = query.get('month');

          if (!month) {
            return;
          }

          query.and({
            $and: [
              { startDate: { $lte: month + '-31' } },
              { endDate: { $gte: month + '-01' } }
            ]
          });
        },
        launder(s) {
          s = self.apos.launder.string(s);

          if (!s.match(/^\d\d\d\d-\d\d$/)) {
            return null;
          }
          return s;
        },
        async choices() {
          const allDates = await query
            .clone()
            .upcoming(null)
            .toDistinct('startDate');

          const months = [ {
            value: null,
            label: 'aposEvent:filterAll'
          } ];
          for (const eachDate of allDates) {
            const month = eachDate.substr(0, 7);
            if (!months.find(e => e.value === month)) {
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
      // Filter by month, in YYYY-MM-DD format, using regex. The event must
      // be taking place during that month (it might surround it).
      // Use of this filter cancels the upcoming filter
      day: {
        def: null,
        safeFor: 'public',
        finalize() {
          const day = query.get('day');

          if (day === null) {
            return;
          }

          query.and({
            $and: [
              { startDate: { $lte: day } },
              { endDate: { $gte: day } }
            ]
          });
        },
        launder(s) {
          s = self.apos.launder.string(s);

          if (!s.match(fullDateRegex)) {
            return null;
          }
          return s;
        },
        async choices() {
          const allDates = await query
            .clone()
            .upcoming(null)
            .toDistinct('startDate');

          const days = [ {
            value: null,
            label: 'aposEvent:filterAll'
          } ];
          for (const eachDate of allDates) {
            if (!days.find(e => e.value === eachDate)) {
              days.push({
                value: eachDate,
                label: eachDate
              });
            }
          }
          days.sort().reverse();
          return days;
        }
      },
      // Filter for events that are active after a certain date, in YYYY-MM-DD format.
      // The event must end on or after that day.
      // Use of this filter cancels the upcoming filter
      start: {
        def: null,
        safeFor: 'public',
        finalize() {
          const start = query.get('start');

          if (start === null) {
            return;
          }

          query.and({
            endDate: { $gte: start }
          });
        },
        launder(s) {
          s = self.apos.launder.string(s);

          if (!s.match(fullDateRegex)) {
            return null;
          }

          return s;
        }
      },

      // Filter for events that are active up until a certain day, in YYYY-MM-DD format.
      // The event must start on or before that day.
      // Use of this filter cancels the upcoming filter
      end: {
        def: null,
        safeFor: 'public',
        finalize() {
          const end = query.get('end');

          if (end === null) {
            return;
          }

          query.and({
            startDate: { $lte: end }
          });
        },
        launder(s) {
          s = self.apos.launder.string(s);

          if (!s.match(fullDateRegex)) {
            return null;
          }

          return s;
        }
      },
      date: {
        def: null,
        safeFor: 'public',
        finalize() {
          query.day(query.get('date'));
        },
        launder(s) {
          return self.apos.launder.string(s);
        }
      }
    }
  };
};

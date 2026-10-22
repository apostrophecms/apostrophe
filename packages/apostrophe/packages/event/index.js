const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const filters = require('./filters');
const queries = require('./queries');

module.exports = {
  extend: '@apostrophecms/piece-type',
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  options: {
    label: 'aposEvent:label',
    pluralLabel: 'aposEvent:pluralLabel',
    sort: { start: 1 },
    i18n: {
      ns: 'aposEvent',
      browser: true
    }
  },
  columns: {
    add: {
      start: {
        label: 'aposEvent:start'
      }
    }
  },
  fields: {
    add: {
      startDate: {
        label: 'aposEvent:startDate',
        type: 'date',
        required: true
      },
      allDay: {
        label: 'aposEvent:allDay',
        type: 'boolean',
        def: false
      },
      startTime: {
        label: 'aposEvent:startTime',
        type: 'time',
        def: '09:00 AM',
        required: true,
        if: {
          allDay: false
        }
      },
      endTime: {
        label: 'aposEvent:endTime',
        type: 'time',
        def: '05:30 PM',
        required: true,
        if: {
          allDay: false
        }
      },
      dateType: {
        label: 'aposEvent:dateType',
        help:
          'aposEvent:dateTypeHelp',
        type: 'select',
        choices: [
          {
            label: 'aposEvent:dateTypeSingle',
            value: 'single'
          },
          {
            label: 'aposEvent:dateTypeConsecutive',
            value: 'consecutive'
          },
          {
            label: 'aposEvent:dateTypeRecurring',
            value: 'repeat'
          }
        ],
        def: 'single'
      },
      endDate: {
        label: 'aposEvent:endDate',
        type: 'date',
        if: {
          dateType: 'consecutive'
        }
      },
      repeatInterval: {
        label: 'aposEvent:interval',
        type: 'select',
        choices: [
          {
            label: 'aposEvent:intervalWeekly',
            value: 'weeks'
          },
          {
            label: 'aposEvent:intervalMonthly',
            value: 'months'
          }
        ],
        if: {
          dateType: 'repeat'
        }
      },
      repeatCount: {
        label: 'aposEvent:repeatCount',
        type: 'integer',
        def: 1,
        if: {
          dateType: 'repeat'
        }
      },
      description: {
        type: 'string',
        label: 'aposEvent:description',
        textarea: true
      }
    },
    group: {
      basics: {
        fields: [
          'description',
          'startDate',
          'allDay',
          'startTime',
          'endTime'
        ]
      },
      advanced: {
        label: 'aposEvent:advanced',
        fields: [
          'dateType',
          'endDate',
          'repeatInterval',
          'repeatCount'
        ]
      }
    }
  },
  handlers(self, options) {
    return {
      beforeSave: {
        async denormalizeDatesAndTimes(req, piece, options) {
          self.denormalizeDatesAndTimes(piece);
        }
      },
      beforeInsert: {
        setGroupId(req, piece, options) {
          // Sets eventGroupId on parent if this is a repeating item
          if (
            piece.dateType === 'repeat' &&
            !piece.eventGroupId &&
            piece.aposMode === 'draft'
          ) {
            piece.eventGroupId = self.apos.util.generateId();
          }
        }
      },
      afterInsert: {
        async createRepeatItems(req, piece, options) {
          if (piece.isClone) {
            // Workflow is replicating this but also its existing
            // scheduled repetitions, don't re-replicate clones and cause problems
            return;
          }
          if (piece.dateType === 'repeat' && piece.aposMode === 'draft') {
            await self.repeatEvent(req, piece, options);
          }
        }
      },
      afterPublish: {
        async publishChildren(req, data) {
          // If this is a repeating item and firstTime is set, publish its children also
          if (data.published.dateType === 'repeat' && data.firstTime) {
            const existing = await self
              .find(req, {
                eventGroupId: data.draft.eventGroupId
              })
              .toArray();
            for (const child of existing) {
              if (!child.isClone) {
                continue;
              } // Skip the parent event
              await self.publish(req, child, options);
            }
          }
        }
      }
    };
  },
  methods(self, options) {
    return {
      denormalizeDatesAndTimes(piece) {
        // Parse our dates and times
        let startTime = piece.startTime;
        const startDate = piece.startDate;
        let endTime = piece.endTime;
        let endDate;

        if (piece.dateType === 'consecutive') {
          endDate = piece.endDate;
        } else {
          piece.endDate = piece.startDate;
          endDate = piece.startDate;
        }

        if (piece.allDay) {
          startTime = '00:00:00';
          endTime = '23:59:59';
        }

        if (piece.dateType === 'repeat') {
          piece.hasClones = true;
        }

        piece.start = new Date(startDate + ' ' + startTime);
        piece.end = new Date(endDate + ' ' + endTime);
      },
      async repeatEvent(req, piece, options) {
        let i;
        const repeat = parseInt(piece.repeatCount);
        const multiplier = piece.repeatInterval;
        const addDates = [];

        for (i = 1; i <= repeat; i++) {
          addDates.push(
            dayjs(piece.startDate)
              .add(i, multiplier)
              .format('YYYY-MM-DD')
          );
        }

        let eventCopy;
        for (const newDate of addDates) {
          eventCopy = { ...piece };
          eventCopy._id = null;
          eventCopy.aposDocId = null;
          eventCopy.isClone = true;
          eventCopy.hasClones = false;
          eventCopy.startDate = newDate;
          eventCopy.endDate = newDate;
          eventCopy.slug = eventCopy.slug + '-' + newDate;
          eventCopy.dateType = 'single';
          self.denormalizeDatesAndTimes(eventCopy);
          await self.insert(req, eventCopy, options);
        }
      }
    };
  },
  filters,
  queries
};

function getBundleModuleNames() {
  const source = path.join(__dirname, './modules/@apostrophecms');
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`);
}

const { google } = require('googleapis');
const fs = require('fs');
const has = require('lodash.has');
const { klona } = require('klona');

module.exports = {
  improve: '@apostrophecms/form',
  fields: {
    add: {
      googleSheetSubmissions: {
        label: 'aposForm:activateGoogleSubmit',
        type: 'boolean'
      },
      googleSpreadsheetId: {
        label: 'aposForm:googleSheetId',
        type: 'string',
        required: true,
        htmlHelp: 'aposForm:googleSheetIdHtmlHelp',
        if: {
          googleSheetSubmissions: true
        }
      },
      googleSheetName: {
        label: 'aposForm:googleSheetName',
        type: 'string',
        help: 'aposForm:googleSheetNameHelp',
        if: {
          googleSheetSubmissions: true
        }
      }
    },
    group: {
      afterSubmit: {
        fields: [
          'googleSheetSubmissions',
          'googleSpreadsheetId',
          'googleSheetName'
        ]
      }
    }
  },
  methods (self) {
    return {
      async sendToGoogle(req, form, formData) {
        if (form.googleSheetSubmissions === true) {
          // Don't modify the original, this would frustrate other custom
          // submission handlers
          const data = klona(formData);
          const timeRegex = /^(.*?)T(.*?)(\..*)$/;
          const timeFields = (new Date()).toISOString().match(timeRegex);

          const dateColumn = self.options.dateColumnLabel || 'Date Submitted';
          const timeColumn = self.options.timeColumnLabel || 'Time Submitted';

          data[dateColumn] = timeFields[1];
          data[timeColumn] = timeFields[2];

          await self.emit('beforeGoogleSheetSubmit', req, form, data);

          if (!form.googleSheetName) {
            try {
              form.googleSheetName = await self.getFirstSheet(form.googleSpreadsheetId);
            } catch (error) {
              form.googleSheetName = null;
              self.apos.util.error('⚠️ Google sheet info request error: ', error);
            }

            if (!form.googleSheetName) {
              if (req.user) {
                self.apos.notify(req, 'aposForm:googleSheetRetrievalError', {
                  type: 'error',
                  dismiss: true
                });
              }

              return null;
            }
          }

          const target = {
            spreadsheetId: form.googleSpreadsheetId,
            sheetName: form.googleSheetName
          };

          // Get the header row titles.
          let header;

          try {
            header = await self.getHeaderRow(target);
          } catch (err) {
            self.apos.util.error('⚠️ @apostrophecms/form Google Sheets submission error: ', err);

            if (req.user) {
              self.apos.notify(req, 'aposForms:googleSheetSubmissionError', {
                type: 'error',
                dismiss: true
              });
            }
            return null;
          }

          // Rework form submission data to match headers. If no column exists
          // for a form value, add it.
          const liveColumns = [ ...header ];
          const newRow = [];

          header.forEach(column => {
            self.formatData(data, column);

            newRow.push(data[column] || '');

            delete data[column];
          });

          // Add a column header for any data properties left-over.
          for (const key in data) {
            self.formatData(data, key);

            header.push(key);
            newRow.push(data[key]);
          }

          // Update the spreadsheet header if necessary.
          if (liveColumns.length !== header.length) {
            await self.updateHeader(header, target);
          }
          // Make post request to the google sheet.
          await self.appendSubmission(newRow, target);
        }
      },
      formatData (data, key) {
        if (Array.isArray(data[key])) {
          data[key] = data[key].join(',');
        }

        data[key] = typeof data[key] === 'string'
          ? data[key]
          : JSON.stringify(data[key]);
      },
      async getFirstSheet (spreadsheetId) {
        const spreadsheet = await self.sheets.spreadsheets.get({ spreadsheetId });
        if (!spreadsheet || !has(spreadsheet, [
          'data', 'sheets', 0, 'properties', 'title'
        ])) {
          return null;
        }
        return spreadsheet.data.sheets[0].properties.title;
      },
      async getHeaderRow (target) {
        const headerRes = await self.sheets.spreadsheets.values.get({
          spreadsheetId: target.spreadsheetId,
          majorDimension: 'ROWS',
          range: `${target.sheetName}!1:1`
        });

        return headerRes.data.values ? headerRes.data.values[0] : [];
      },
      async updateHeader (newHeader, target) {
        return self.sheets.spreadsheets.values.update({
          spreadsheetId: target.spreadsheetId,
          range: `${target.sheetName}!1:1`,
          valueInputOption: 'RAW',
          responseDateTimeRenderOption: 'FORMATTED_STRING',
          resource: {
            range: `${target.sheetName}!1:1`,
            majorDimension: 'ROWS',
            values: [
              newHeader
            ]
          }
        });
      },
      async appendSubmission(newRow, target) {
        await self.sheets.spreadsheets.values.append({
          spreadsheetId: target.spreadsheetId,
          range: `${target.sheetName}`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          responseDateTimeRenderOption: 'FORMATTED_STRING',
          resource: {
            values: [
              newRow
            ]
          }
        });
      }
    };
  },
  async init (self) {
    // Set the environment variable for API auth.
    const confFolder = self.__meta.chain[self.__meta.chain.length - 1].dirname;
    let credentialsFile;

    if (fs.existsSync(`${confFolder}/credentials.json`)) {
      credentialsFile = `${confFolder}/credentials.json`;
    }

    process.env.GOOGLE_APPLICATION_CREDENTIALS ||= credentialsFile;

    if (
      process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      process.env.GOOGLE_APPLICATION_CREDENTIALS !== 'undefined'
    ) {
      try {
        // Make google auth connection.
        self.googleSheetAuth = await google.auth.getClient({
          scopes: [ 'https://www.googleapis.com/auth/spreadsheets' ]
        });
      } catch (error) {
        self.apos.util.error('⚠️ Google Authentication Error: ', error);
        return;
      }

      self.sheets = google.sheets({
        version: 'v4',
        auth: self.googleSheetAuth
      });
    } else {
      self.apos.util.warnDev('No credentials found for @apostrophecms/form-submission-google.');
    }
  },
  handlers (self) {
    return {
      submission: {
        googleSheetSubmission (req, form, data) {
          if (self.googleSheetAuth && self.sheets) {
            self.sendToGoogle(req, form, data);
          }
        }
      }
    };
  }
};

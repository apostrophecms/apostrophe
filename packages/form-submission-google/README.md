<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Apostrophe Forms Google Sheets Submission</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/blog/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

This module adds an additional form submission option to the Apostrophe Forms extension. It allows website managers to configure individual forms to submit to a specific Google Docs spreadsheet.

## Installation

```bash
npm install @apostrophecms/form-submission-google
```

## Usage

### Initialization

Add this module along with the other Apostrophe Form modules in `app.js` to instantiate it.

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    // The main form module
    '@apostrophecms/form': {},
    '@apostrophecms/form-submission-google': {},
    // ... Other form widgets
  }
});
```

### Set up the Google Sheets API project

1. **Create a project in [the Google Cloud Platform API console](https://console.developers.google.com/apis/dashboard).** Enable the Google Sheets API on the project in the API Library.
2. **Create an [API service account](https://cloud.google.com/iam/docs/service-accounts)** in the Google API Console service.
3. **Save the credentials JSON file** provided with the new service account. *You may not be able to download this again.*
4. **Add the credentials file to the `modules/@apostrophecms/form` directory in your Apostrophe project as `credentials.json`.**
  - Note: We do not recommend committing this file to version control if your code is public. You should add it to the `.gitignore` file (for Git) and put it directly on your production server. *Alternately* you can provide the credentials as JSON in an environment variable named `GOOGLE_APPLICATION_CREDENTIALS`.
5. **Copy the service account email address.** You will need to add this as an "Edit"-level user on your Google spreadsheet as you would a human editor.
6. **Plan for the service account credentials to expire in 10 years.** The service account credentials have a long life span, but it is not infinite.

### Create your spreadsheet.

The sheet must exist, but does not necessarily need to be set up with column headings before use. This can be done later by CMS users as well. There is help text in the UI directing them to make note of the spreadsheet ID and sheet name.

Column headers in the Google spreadsheet must match the form field *names* (not the field labels), or else the module will add new columns to the spreadsheet.

#### A warning about editing the spreadsheet

Please note that you must not add any empty, unlabeled columns to the spreadsheet once submissions begin. Due to the [rules of Google's spreadsheet API](https://developers.google.com/sheets/api/guides/values#appending_values) the gap will be considered as the start of a "new table" and newly appended rows will start at that column, which is probably not what you want. If this does happen, move the data over and add a header to the empty column.

### Note on dates and times

"Date Submitted" and "Time Submitted" columns are included in the Google spreadsheet automatically. These are always in [UTC (Coordinated Universal Time)](https://en.wikipedia.org/wiki/Coordinated_Universal_Time). For best results, format the Google spreadsheet columns as plain text.

You can rename these by setting options on the `@apostrophecms/form` module. The column label should be set before the form is in use to keep all date/time data in the same column.

```javascript
// modules/@apostrophecms/form/index.js
module.exports = {
  options: {
    dateColumnLabel: 'Submission date'
    timeColumnLabel: 'Submission time'
  }
};
```


### Modifying the submission before it is sent to Google

If you wish to modify the submitted data just before it goes to Google, for instance to add a new property, you can add a handler to the `@apostrophecms/form:beforeGoogleSheetSubmit` event. This event handler may be asynchronous.

The example below demonstrates adding a "Unique Key" property to the data based on the date submitted, time submitted, and an email field in the submission:

```javascript
// modules/@apostrophecms/form/index.js
module.exports = {
  handlers (self) {
    return {
      beforeGoogleSheetSubmit: {
        addUniqueKey (req, form, data) {
          data['Unique Key'] = `${data['Date Submitted']}_${data['Time Submitted']}_${data.email}`;
        }
      }
    };
  }
};
```

The submitted spreadsheet rows will now include the additional column.

### Issues with column formatting

This module sends data to Google Sheets "as entered," i.e. as if the it were typed by the user in Google Sheets. In most cases this does good things: dates are detected as dates, times as times, numbers as numbers, etc.

However in certain cases, the results may be surprising. For instance, a phone number with a leading `0` and no spaces or punctuation will lose its leading `0` because this is the standard behavior of Google Sheets when it believes it has detected a number. Google does not store the zero in this situation, it is truly gone.

Fortunately you can correct this by formatting the column correctly in Google Sheets. Open the sheet, select the column that will contain phone numbers, and select "Format -> Number -> Plain text". Leading zeroes will not be removed from future submissions.

<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Scheduled Publishing</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Test status" href="https://github.com/apostrophecms/apostrophe/actions">
      <img alt="GitHub Workflow Status (branch)" src="https://img.shields.io/github/workflow/status/apostrophecms/apostrophe/Tests/main?label=Tests&labelColor=000000&style=for-the-badge">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/module-template/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

This module allows to schedule publishing of your pieces (which includes pages) to specific dates.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```
npm install @apostrophecms/scheduled-publishing
```

## Usage

Configure the Scheduled Publishing module in the `app.js` file:

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/scheduled-publishing': {}
  }
});
```

Editors can now schedule publication and un-publication times for documents. Note that un-publishing a document means it is no longer available except in draft form. Since the home page must always be available, the home page cannot be scheduled for un-publishing.

For publiction and un-publication to actually occur, you'll need to run the appropriate command line task on a periodic basis, as described below.

## Using the command line task

To actually publish or unpublish the documents at scheduled times, you must execute the appropriate command line task:

```bash
node app @apostrophecms/scheduled-publishing:update
```

Typically you will want to schedule this to run periodically using a standard Linux scheduling tool like `cron`. For instance, here is a crontab entry to run the task once per hour:

```bash
# At the top of every hour
0 * * * * (cd /path/to/your/apostrophe/project && node app @apostrophecms/scheduled-publishing:update)
```

You can schedule the task to run more frequently if you plan to schedule publication times in the middle of the hour. Note that the task is safe to run as frequently as you wish, as it won't do anything if no documents are scheduled to be published yet.

For more information, see [how to use cron on Linux](https://opensource.com/article/21/7/cron-linux).

> If you are using our `stagecoach` utility for deployment, don't forget `/current` at the end of the path.

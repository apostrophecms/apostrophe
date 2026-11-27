const path = require('node:path');

module.exports = (self) => {
  return {
    'tool-usage': {
      usage: 'Count the calls of each assistant tool across stored requests.\n' +
        'Usage: node app @apostrophecms/assistant:tool-usage\n' +
        'A tool no longer registered is marked "retired".',
      async task() {
        checkActive();
        const usage = await self.getToolUsage();
        const width = Math.max(4, ...usage.tools.map(tool => tool.name.length + 10));
        const lines = [
          `${usage.requests} requests`,
          '',
          `${'tool'.padEnd(width)}${'requests'.padStart(10)}${'calls'.padStart(8)}`,
          ...usage.tools.map(tool => `${(tool.retired ? `${tool.name} (retired)` : tool.name)
            .padEnd(width)}${String(tool.requests).padStart(10)}${String(tool.calls).padStart(8)}`)
        ];
        print(lines.join('\n'));
      }
    },
    'expire-chats': {
      usage: 'Delete the chats past chatExpireAfter, finish interrupted deletes and ' +
        'remove files left behind, as the in-process sweep does.\n' +
        'Usage: node app @apostrophecms/assistant:expire-chats',
      async task() {
        checkActive();
        const swept = await self.expireChats();
        print(swept
          ? `${swept.chats} chats and ${swept.files} files deleted.`
          : 'Another process is sweeping; nothing done.');
      }
    },
    'export-chats': {
      usage: 'Export one user\'s chats, with their files, into an empty or new directory.\n' +
        'Usage: node app @apostrophecms/assistant:export-chats --user=<username or id> ' +
        '--dir=<directory>',
      async task(argv) {
        checkActive();
        if (!argv.dir || (typeof argv.dir !== 'string')) {
          throw new Error('--dir is required.');
        }
        const ownerId = await getOwnerId(argv);
        const dir = path.resolve(argv.dir);
        const exported = await self.exportUserChats(ownerId, dir);
        print(`${exported.chats} chats and ${exported.files} files exported to ${dir}.`);
      }
    },
    'delete-chats': {
      usage: 'Delete one user\'s chats, with their requests, files and change log entries.\n' +
        'Usage: node app @apostrophecms/assistant:delete-chats --user=<username or id>',
      async task(argv) {
        checkActive();
        const deleted = await self.deleteUserChats(await getOwnerId(argv));
        print(`${deleted.chats} chats deleted.${deleted.busy
          ? ` ${deleted.busy} were busy with a request or a revert; run again once they end.`
          : ''}`);
      }
    }
  };

  function checkActive() {
    if (!self.active) {
      throw new Error('The assistant is not enabled, or the AI engine is not active.');
    }
  }

  // The user `--user` names, by username or id; an id with no user left
  // still names their chats
  async function getOwnerId(argv) {
    const name = (typeof argv.user === 'string') ? argv.user.trim() : '';
    if (!name) {
      throw new Error('--user is required.');
    }
    const user = await self.apos.user.find(self.apos.task.getReq(), {
      $or: [
        { username: name },
        { _id: name }
      ]
    }).permission(false).toObject();
    if (user) {
      return user._id;
    }
    if (await self.chats.findOne({ ownerId: name })) {
      return name;
    }
    throw new Error(`No user "${name}" and no chats of one.`);
  }

  function print(text) {
    // eslint-disable-next-line no-console
    console.log(text);
  }
};

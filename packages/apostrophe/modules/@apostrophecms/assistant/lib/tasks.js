module.exports = (self) => {
  return {
    'tool-usage': {
      usage: 'Count the calls of each assistant tool across stored requests.\n' +
        'Usage: node app @apostrophecms/assistant:tool-usage\n' +
        'A tool no longer registered is marked "retired".',
      async task() {
        if (!self.active) {
          throw new Error('The assistant is not enabled, or the AI engine is not active.');
        }
        const usage = await self.getToolUsage();
        const width = Math.max(4, ...usage.tools.map(tool => tool.name.length + 10));
        const lines = [
          `${usage.requests} requests`,
          '',
          `${'tool'.padEnd(width)}${'requests'.padStart(10)}${'calls'.padStart(8)}`,
          ...usage.tools.map(tool => `${(tool.retired ? `${tool.name} (retired)` : tool.name)
            .padEnd(width)}${String(tool.requests).padStart(10)}${String(tool.calls).padStart(8)}`)
        ];
        // eslint-disable-next-line no-console
        console.log(lines.join('\n'));
      }
    }
  };
};

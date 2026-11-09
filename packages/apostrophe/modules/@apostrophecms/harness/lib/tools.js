// The harness's tools on the AI engine, and the toolset each door selects.

// The tags each door selects, and those it refuses whatever else a tool
// carries: a browser tool never reaches the MCP server
const DOORS = {
  assistant: {
    tags: [ 'content', 'assistant' ],
    refuse: []
  },
  mcp: {
    tags: [ 'content', 'mcp' ],
    refuse: [ 'assistant', 'browser' ]
  }
};

// The harness's own tools; every one is tagged `content`
const TOOLS = [];

module.exports = (self) => {
  return {
    // Registers the harness's tools on the engine
    addTools() {
      for (const tool of TOOLS) {
        self.apos.ai.addTool({
          ...tool,
          tags: [ 'content', ...(tool.tags || []) ]
        });
      }
    },

    // The names of the doors the harness knows
    getDoorNames() {
      return Object.keys(DOORS);
    },

    /**
     * The tool definitions a door selects, as registered after activation:
     * the harness's tools and the door's own. Throws `invalid` for an
     * unknown door.
     *
     * @param {string} door `assistant` or `mcp`.
     * @returns {object[]}
     */
    getDoorTools(door) {
      const selection = Object.hasOwn(DOORS, door) && DOORS[door];
      if (!selection) {
        throw self.apos.error('invalid', `unknown door "${door}"`);
      }
      return self.apos.ai.getTools({ tags: selection.tags })
        .filter(tool => !tool.tags?.some(tag => selection.refuse.includes(tag)))
        .sort((one, two) => one.name.localeCompare(two.name));
    }
  };
};

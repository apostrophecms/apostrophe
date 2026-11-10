module.exports = (self) => {
  return {
    'list-tools': {
      usage: 'List the AI tools a door sends the model, with the size of each definition.\n' +
        'Usage: node app @apostrophecms/harness:list-tools [--door=assistant|mcp]\n' +
        'Without --door, every door is listed.',
      task(argv) {
        const doors = argv.door ? [ argv.door ] : self.getDoorNames();
        const lines = [];
        for (const door of doors) {
          const tools = self.getDoorTools(door);
          const sizes = tools.map(getDefinitionSize);
          const total = sizes.reduce((sum, size) => sum + size, 0);
          lines.push(`# ${door}: ${tools.length} tools, definitions ${total} characters`, '');
          tools.forEach((tool, i) => {
            const input = inputLines(tool.input);
            lines.push(
              `## ${tool.name} [${tool.kind || 'action'}] ${(tool.tags || []).join(', ')}, ` +
                `definition ${sizes[i]} characters`,
              tool.description,
              ...(input.length ? input : [ '(no input)' ]),
              ''
            );
          });
        }
        // eslint-disable-next-line no-console
        console.log(lines.join('\n'));
      }
    },
    'print-instructions': {
      usage: 'Print the instructions every door sends the model, with their size.\n' +
        'Usage: node app @apostrophecms/harness:print-instructions\n' +
        'Each door adds its own sections after them.',
      task() {
        const instructions = self.getInstructions(self.apos.task.getReq());
        // eslint-disable-next-line no-console
        console.log([
          `# Instructions: ${instructions.length} characters, before each door's own sections`,
          '',
          instructions
        ].join('\n'));
      }
    }
  };
};

// What the model receives of a tool on every request: its name,
// description and input schema
function getDefinitionSize(tool) {
  return JSON.stringify({
    name: tool.name,
    description: tool.description,
    input: tool.input
  }).length;
}

// One line per input property, `*` marking the required ones, listed values
// and bounds included; nested objects indented below their parent
function inputLines(schema, indent = 0) {
  const pad = '  '.repeat(indent);
  const lines = [];
  for (const [ name, property ] of Object.entries(schema?.properties || {})) {
    const required = (schema.required || []).includes(name) ? '*' : '';
    lines.push(`${pad}- ${name}${required}: ${summary(property)}`);
    const nested = (property.type === 'array') ? property.items : property;
    if (nested?.properties) {
      lines.push(...inputLines(nested, indent + 1));
    }
  }
  return lines;
}

function summary(property) {
  const type = (property.type === 'array')
    ? `array of ${property.items?.type || 'any'}`
    : (property.type || 'any');
  const values = property.enum || property.items?.enum;
  const notes = [
    values && `one of ${values.join(', ')}`,
    (property.default !== undefined) && `default ${JSON.stringify(property.default)}`
  ].filter(Boolean);
  return [
    type,
    notes.length && `(${notes.join('; ')})`,
    property.description && `: ${property.description}`
  ].filter(Boolean).join(' ');
}

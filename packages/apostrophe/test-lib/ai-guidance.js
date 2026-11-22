// The rule for guidance both AI doors read: it names only what both doors
// have. A test of a module that adds guidance or tools calls
// `findForeignTools` for each door and expects nothing back.

const edit = require('../modules/@apostrophecms/harness/lib/edit.js');
const write = require('../modules/@apostrophecms/harness/lib/write.js');
const localize = require('../modules/@apostrophecms/ai-localize/lib/door-tools.js');

/**
 * Every text the model of `door` can read, each with where it comes from:
 * the instructions before the door's own sections, each type's guidance as
 * the door gets it, each tool the door selects, the schema read of every
 * type, every field type's `aiHow`, the harness's hints and notices, the
 * notes of the localization read.
 *
 * @param {object} apos
 * @param {string} door `assistant` or `mcp`.
 * @returns {Promise<{ where: string, text: string }[]>}
 */
async function getDoorTexts(apos, door) {
  const { harness } = apos;
  const req = harness.withDoor(apos.task.getReq({ mode: 'draft' }), {
    door,
    lockId: 'guidance-test',
    requestId: 'guidance-test'
  });
  const types = harness.getTypeNames();
  const { schema, legend } = await harness.getSchema(req, { types });
  return [
    {
      where: 'the instructions',
      text: harness.getInstructions(req)
    },
    ...types.map(type => ({
      where: `the guidance of ${type}`,
      text: harness.getTypeGuidance(type, door)
    })),
    ...harness.getDoorTools(door).map(tool => ({
      where: `the definition of ${tool.name}`,
      text: JSON.stringify({
        description: tool.description,
        input: tool.input
      })
    })),
    {
      where: 'the schema read',
      text: `${legend}\n${schema}`
    },
    ...Object.entries(apos.schema.fieldTypes).map(([ name, fieldType ]) => ({
      where: `the aiHow of ${name} fields`,
      text: fieldType.aiHow
    })),
    ...[ ...edit.MODEL_TEXTS, ...write.MODEL_TEXTS ].map(text => ({
      where: 'the harness\'s hints and notices',
      text
    })),
    ...localize.MODEL_TEXTS.map(text => ({
      where: 'the notes of get_localization',
      text
    }))
  ].filter(({ text }) => text?.trim());
}

/**
 * The registered tools outside the toolset of `door` that a text its model
 * reads names, as `<tool> in <where>`. Empty when the rule holds.
 *
 * @param {object} apos
 * @param {string} door `assistant` or `mcp`.
 * @returns {Promise<string[]>}
 */
async function findForeignTools(apos, door) {
  const own = new Set(apos.harness.getDoorTools(door).map(({ name }) => name));
  const foreign = apos.ai.getTools()
    .map(({ name }) => name)
    .filter(name => !own.has(name));
  const found = [];
  for (const { where, text } of await getDoorTexts(apos, door)) {
    for (const name of foreign) {
      if (new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(text)) {
        found.push(`${name} in ${where}`);
      }
    }
  }
  return found;
}

module.exports = {
  getDoorTexts,
  findForeignTools
};

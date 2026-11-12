// A request as the panel reads it, built on every read and never stored:
// the reply rendered, the steps the run took, and the documents it had to
// leave because someone was editing them.

const DOOR = 'assistant';
// A step's arguments and result are a trail, not a reader: a document read
// can run to tens of thousands of characters
const STEP_TEXT_MAX = 2000;

module.exports = (self) => {
  return {
    /**
     * A request as the panel reads it. Its message gets its rendered
     * `messageHtml`, its mentions chips, and each assistant message with text
     * its rendered `html` beside the raw content; `steps` lists the
     * tool calls in order, `{ id, name, label, input, output?, error? }`,
     * the arguments and result as capped JSON text; `locked` lists the
     * documents a write was refused for a lock and no later write of the
     * request reached, `{ _id, title }`. The vendor and model are left out
     * unless `modelDisplay` is set.
     *
     * @param {object} request
     * @returns {object}
     */
    renderRequest(request) {
      const {
        provider, model, ...rest
      } = request;
      const messages = request.messages || [];
      return {
        ...rest,
        messageHtml: self.renderMarkdown(request.message, {
          mentions: request.mentions
        }),
        ...(self.options.modelDisplay && {
          provider,
          model
        }),
        messages: messages.map((message) => {
          if (message.role !== 'assistant') {
            return message;
          }
          const text = (message.content || [])
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('')
            .trim();
          return text
            ? {
              ...message,
              html: self.renderMarkdown(text)
            }
            : message;
        }),
        steps: getSteps(),
        locked: getLocked()
      };

      function getSteps() {
        const labels = new Map(self.apos.harness.getDoorTools(DOOR)
          .map(tool => [ tool.name, tool.label ]));
        const steps = [];
        const byId = new Map();
        for (const part of messages.flatMap(message => message.content || [])) {
          if (part.type === 'toolCall') {
            const step = {
              id: part.id,
              name: part.name,
              label: labels.get(part.name) || null,
              input: toText(part.input)
            };
            steps.push(step);
            byId.set(part.id, step);
          } else if (part.type === 'toolResult') {
            const step = byId.get(part.toolCallId);
            if (!step) {
              continue;
            }
            if (part.error !== undefined) {
              step.error = toText(part.error);
            } else {
              step.output = toText(part.output);
            }
          }
        }
        return steps;
      }

      // In the harness's write result, a document is `written` or `refused`
      function getLocked() {
        const locked = new Map();
        for (const part of messages.flatMap(message => message.content || [])) {
          if (part.type !== 'toolResult') {
            continue;
          }
          for (const item of part.output?.written || []) {
            locked.delete(item._id);
          }
          for (const item of part.output?.refused || []) {
            if (item.reason === 'locked') {
              locked.set(item._id, {
                _id: item._id,
                title: item.title || null
              });
            }
          }
        }
        return [ ...locked.values() ];
      }

      function toText(value) {
        const text = (typeof value === 'string') ? value : JSON.stringify(value, null, 2);
        if (!text || (text.length <= STEP_TEXT_MAX)) {
          return text || null;
        }
        return `${text.slice(0, STEP_TEXT_MAX)}\n…`;
      }
    }
  };
};

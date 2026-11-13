// The tools that turn to the editor: `ask_editor` asks up to four questions
// at once and `confirm` asks before going on, each suspending the run with
// an ask the owning browser tab answers; `write_plan` keeps the request's
// plan, which the panel shows above the composer. Each is an action on the
// AI engine tagged `assistant`, so only the assistant's door selects it.

const QUESTION_MAX = 300;
const OPTION_MAX = 120;
const OPTION_DESCRIPTION_MAX = 200;
const ANSWER_MAX = 2000;
const STEP_MAX = 200;
const PLAN_STATUSES = [ 'pending', 'active', 'done' ];

const ANSWERED = {
  type: 'boolean',
  description: 'The user responded; false: they set it aside unanswered, so don\'t ask ' +
    'again in this request'
};

module.exports = (self) => {
  return {
    // Registers the tools and the kinds of ask they suspend on
    addEditorTools() {
      if (!self.options.enabled) {
        return;
      }
      self.addAskKind('question', { accept: self.acceptQuestionAnswer });
      self.addAskKind('confirm', { accept: self.acceptConfirmAnswer });
      self.apos.ai.addTool({
        name: 'ask_editor',
        label: 'apostrophe:aiToolAskEditor',
        description: 'Ask the user and wait for the answers. Only when you can\'t go on ' +
          'without their direction: a choice between real alternatives, or details the ' +
          'task is missing. Each call interrupts them once, so ask everything you need ' +
          'together, up to four questions. Give "options" when the choice is ' +
          'enumerable, each a short label with a one-sentence description when the ' +
          'label alone doesn\'t say what choosing it means, and "other": true when ' +
          'they may answer in their own words besides; omit "options" for a ' +
          'free-text answer. They may leave a question to you ("youDecide"), and may ' +
          'skip the whole set, which ends the request.',
        kind: 'action',
        tags: [ 'assistant' ],
        input: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: {
                type: 'object',
                properties: {
                  question: {
                    type: 'string',
                    minLength: 1,
                    maxLength: QUESTION_MAX,
                    description: 'The question, complete in itself'
                  },
                  options: {
                    type: 'array',
                    minItems: 2,
                    maxItems: 6,
                    items: {
                      type: 'object',
                      properties: {
                        label: {
                          type: 'string',
                          minLength: 1,
                          maxLength: OPTION_MAX,
                          description: 'The answer, in a few words'
                        },
                        description: {
                          type: 'string',
                          minLength: 1,
                          maxLength: OPTION_DESCRIPTION_MAX,
                          description: 'What choosing it means, in one sentence'
                        }
                      },
                      required: [ 'label' ],
                      additionalProperties: false
                    },
                    description: 'The answers to choose from; omit for free text'
                  },
                  other: {
                    type: 'boolean',
                    description: 'With "options": the user may also answer in their own words'
                  }
                },
                required: [ 'question' ],
                additionalProperties: false
              }
            }
          },
          required: [ 'questions' ],
          additionalProperties: false
        },
        schema: {
          type: 'object',
          properties: {
            answered: ANSWERED,
            answers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: {
                    type: 'string',
                    description: 'The option chosen, or the user\'s own words'
                  },
                  youDecide: {
                    type: 'boolean',
                    description: 'The user left this one to you'
                  }
                },
                required: [ 'question' ],
                additionalProperties: false
              },
              description: 'One per question, in the order asked'
            }
          },
          required: [ 'answered' ],
          additionalProperties: false
        },
        async handler(req, { _context, questions }) {
          if (_context.input !== undefined) {
            return _context.input;
          }
          throw self.apos.error('aiInput', 'waiting for the user to answer', {
            kind: 'question',
            questions: questions.map(({
              question, options, other
            }) => ({
              question,
              ...(options && {
                options: options.map(({ label, description }) => ({
                  label,
                  ...(description && { description })
                })),
                other: Boolean(other)
              })
            }))
          });
        }
      });
      self.apos.ai.addTool({
        name: 'confirm',
        label: 'apostrophe:aiToolConfirm',
        description: 'Ask the user before you go on, and wait for the answer. Use it ' +
          'before anything they might not expect: removing content, changing many ' +
          'documents, a step that takes over their screen. Go on only when "approved" ' +
          'is true.',
        kind: 'action',
        tags: [ 'assistant' ],
        input: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              minLength: 1,
              maxLength: QUESTION_MAX,
              description: 'What you are about to do, as a short question with the count ' +
                'when there is one: "Archive the 3 old landing pages?"'
            },
            details: {
              type: 'string',
              maxLength: ANSWER_MAX,
              description: 'What the user should know to decide, in a sentence or two'
            }
          },
          required: [ 'action' ],
          additionalProperties: false
        },
        schema: {
          type: 'object',
          properties: {
            answered: ANSWERED,
            approved: {
              type: 'boolean',
              description: 'The user said to go on'
            }
          },
          required: [ 'answered' ],
          additionalProperties: false
        },
        async handler(req, {
          _context, action, details
        }) {
          if (_context.input !== undefined) {
            return {
              answered: true,
              approved: _context.input.approved
            };
          }
          throw self.apos.error('aiInput', 'waiting for the user to confirm', {
            kind: 'confirm',
            action,
            ...(details && { details })
          });
        }
      });
      self.apos.ai.addTool({
        name: 'write_plan',
        label: 'apostrophe:aiToolWritePlan',
        description: 'Show the user your plan for this request while you work. For a ' +
          'task of several steps; not for one done in a call or two. Each call replaces ' +
          'the plan, so send every step each time, in order: one "active" while you work ' +
          'on it, "done" once finished. Send an empty list to drop the plan.',
        kind: 'action',
        tags: [ 'assistant' ],
        input: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              maxItems: 20,
              items: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    minLength: 1,
                    maxLength: STEP_MAX,
                    description: 'The step, in a few words the user recognizes'
                  },
                  status: {
                    type: 'string',
                    enum: PLAN_STATUSES,
                    default: 'pending'
                  }
                },
                required: [ 'title' ],
                additionalProperties: false
              }
            }
          },
          required: [ 'steps' ],
          additionalProperties: false
        },
        schema: {
          type: 'object',
          properties: {
            steps: {
              type: 'integer',
              description: 'How many steps the plan holds'
            }
          },
          required: [ 'steps' ],
          additionalProperties: false
        },
        async handler(req, { steps }) {
          const { requestId, chat } = self.apos.harness.getDoor(req);
          const request = {
            _id: requestId,
            chatId: chat,
            ownerId: self.getOwnerId(req)
          };
          await self.requests.updateOne({
            _id: request._id,
            ownerId: request.ownerId
          }, {
            $set: {
              plan: steps.length ? steps : null
            }
          });
          await self.publishRequest(req, request);
          return { steps: steps.length };
        }
      });
    },

    /**
     * Turns the editor's answers to a `question` ask into the tool's result.
     * One answer per question, in order: `{ choice }` (an option's index),
     * `{ text }` (the editor's words, for a question without options or one
     * that takes other answers) or `{ youDecide: true }`. Anything else is
     * `invalid`, and the ask keeps waiting.
     *
     * @param {object} req
     * @param {object} ask The stored ask.
     * @param {object} answer `{ answers }`.
     * @returns {object}
     */
    acceptQuestionAnswer(req, ask, answer) {
      const { questions } = ask.payload;
      const answers = Array.isArray(answer?.answers) ? answer.answers : [];
      if (answers.length !== questions.length) {
        throw self.apos.error('invalid', 'one answer per question is needed');
      }
      return {
        answered: true,
        answers: questions.map(({
          question, options, other
        }, index) => {
          const given = answers[index] || {};
          if (given.youDecide === true) {
            return {
              question,
              youDecide: true
            };
          }
          if (Object.hasOwn(given, 'choice')) {
            const choice = options?.[given.choice];
            if (!Number.isInteger(given.choice) || !choice) {
              throw self.apos.error('invalid', `question ${index + 1} has no such option`);
            }
            return {
              question,
              answer: choice.label
            };
          }
          if (options && !other) {
            throw self.apos.error('invalid', `question ${index + 1} takes one of its options`);
          }
          const text = self.apos.launder.string(given.text).trim().slice(0, ANSWER_MAX);
          if (!text) {
            throw self.apos.error('invalid', `question ${index + 1} has no answer`);
          }
          return {
            question,
            answer: text
          };
        })
      };
    },

    /**
     * Turns the editor's answer to a `confirm` ask, `{ approved }`, into the
     * input of the tool or of the gate that asked.
     *
     * @param {object} req
     * @param {object} ask The stored ask.
     * @param {object} answer `{ approved }`.
     * @returns {object}
     */
    acceptConfirmAnswer(req, ask, answer) {
      if (typeof answer?.approved !== 'boolean') {
        throw self.apos.error('invalid', 'a confirmation is answered approved or not');
      }
      return {
        ...(ask.payload.gate && { gate: true }),
        approved: answer.approved
      };
    }
  };
};

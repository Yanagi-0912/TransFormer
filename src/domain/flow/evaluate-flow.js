class FlowEvaluationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FlowEvaluationError';
    this.code = code;
  }
}

/**
 * Deterministically evaluates the next destination for a valid Form Schema v1.
 * Answers are keyed by input Card fieldKey.
 *
 * @param {import('../schema/types').FormSchemaV1|Record<string, any>} form
 * @param {string} currentBlockId
 * @param {Record<string, unknown>} answers
 * @returns {Record<string, string>}
 */
function evaluateNext(form, currentBlockId, answers) {
  const block = form.blocks.find(item => item.id === currentBlockId);
  if (!block) {
    throw new FlowEvaluationError('FLOW_CURRENT_BLOCK_UNKNOWN', 'Current block does not exist.');
  }

  const cardsById = new Map(block.cards.map(card => [card.id, card]));
  const outgoing = form.flow.transitions
    .filter(transition => transition.fromBlockId === currentBlockId)
    .slice()
    .sort((left, right) => left.priority - right.priority);

  for (const transition of outgoing) {
    if (!transition.condition) continue;
    const card = cardsById.get(transition.condition.cardId);
    if (!card) continue;
    const answer = answers[card.fieldKey];
    if (conditionMatches(transition.condition, answer)) {
      return transition.destination;
    }
  }

  const fallback = outgoing.find(transition => !transition.condition);
  if (fallback) return fallback.destination;

  throw new FlowEvaluationError(
    'FLOW_NO_MATCHING_TRANSITION',
    'No condition matched and no fallback transition exists.'
  );
}

function conditionMatches(condition, answer) {
  if (condition.operator === 'equals') {
    return answer === condition.optionId;
  }
  if (condition.operator === 'contains') {
    return Array.isArray(answer) && answer.includes(condition.optionId);
  }
  return false;
}

module.exports = { evaluateNext, FlowEvaluationError };

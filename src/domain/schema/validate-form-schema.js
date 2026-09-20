const ID_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;
const CARD_TYPES = new Set([
  'text', 'image', 'shortText', 'longText', 'singleChoice', 'multipleChoice',
]);
const INPUT_TYPES = new Set(['shortText', 'longText', 'singleChoice', 'multipleChoice']);
const CHOICE_TYPES = new Set(['singleChoice', 'multipleChoice']);
const LAYOUT_AREAS = Object.freeze({
  vertical: ['main'],
  twoColumns: ['left', 'right'],
  imageLeft: ['media', 'content'],
  imageRight: ['content', 'media'],
  hero: ['hero', 'title', 'content'],
});

/**
 * Validates Form Schema v1 structural, referential and semantic invariants.
 * Returns every safely discoverable error; it never mutates the input.
 *
 * @param {unknown} form
 * @returns {Array<{code: string, path: string, message: string}>}
 */
function validateFormSchema(form) {
  const errors = [];
  const add = (code, path, message) => errors.push({ code, path, message });

  if (!isObject(form)) {
    add('SCHEMA_ROOT_TYPE', '', 'Form Schema must be an object.');
    return errors;
  }

  rejectUnknown(form, ['schemaVersion', 'id', 'revision', 'title', 'description', 'startBlockId', 'blocks', 'flow'], '', add);
  requireKeys(form, ['schemaVersion', 'id', 'revision', 'title', 'startBlockId', 'blocks', 'flow'], '', add);

  if (form.schemaVersion !== 1) add('SCHEMA_VERSION_UNSUPPORTED', '/schemaVersion', 'Schema version must be 1.');
  checkId(form.id, '/id', add);
  checkInteger(form.revision, 1, undefined, '/revision', add);
  checkString(form.title, 1, 120, '/title', add);
  if ('description' in form) checkString(form.description, 0, 2000, '/description', add);
  checkId(form.startBlockId, '/startBlockId', add);

  const blockById = new Map();
  const cardById = new Map();
  const cardBlockById = new Map();
  const fieldKeys = new Set();

  if (!Array.isArray(form.blocks)) {
    add('BLOCKS_TYPE', '/blocks', 'Blocks must be an array.');
  } else {
    if (form.blocks.length < 1 || form.blocks.length > 200) {
      add('BLOCKS_COUNT', '/blocks', 'Blocks must contain between 1 and 200 items.');
    }
    form.blocks.forEach((block, index) => {
      validateBlock(block, index, { blockById, cardById, cardBlockById, fieldKeys }, add);
    });
  }

  if (typeof form.startBlockId === 'string' && !blockById.has(form.startBlockId)) {
    add('START_BLOCK_UNKNOWN', '/startBlockId', 'Start block does not exist.');
  }

  const transitions = validateFlow(form.flow, { blockById, cardById, cardBlockById }, add);
  if (blockById.has(form.startBlockId)) {
    validateGraph(form.startBlockId, blockById, transitions, add);
  }

  return errors;
}

function validateBlock(block, blockIndex, indexes, add) {
  const path = `/blocks/${blockIndex}`;
  if (!isObject(block)) {
    add('BLOCK_TYPE', path, 'Block must be an object.');
    return;
  }

  rejectUnknown(block, ['id', 'title', 'cards', 'layout'], path, add);
  requireKeys(block, ['id', 'cards', 'layout'], path, add);
  checkId(block.id, `${path}/id`, add);
  if ('title' in block) checkString(block.title, 0, 120, `${path}/title`, add);

  if (typeof block.id === 'string') {
    if (indexes.blockById.has(block.id)) {
      add('BLOCK_ID_DUPLICATE', `${path}/id`, 'Block ID must be unique.');
    } else {
      indexes.blockById.set(block.id, block);
    }
  }

  const localCards = new Map();
  if (!Array.isArray(block.cards)) {
    add('CARDS_TYPE', `${path}/cards`, 'Cards must be an array.');
  } else {
    if (block.cards.length < 1 || block.cards.length > 100) {
      add('CARDS_COUNT', `${path}/cards`, 'Cards must contain between 1 and 100 items.');
    }
    block.cards.forEach((card, cardIndex) => {
      validateCard(card, `${path}/cards/${cardIndex}`, block.id, indexes, localCards, add);
    });
  }

  validateLayout(block.layout, `${path}/layout`, localCards, add);
}

function validateCard(card, path, blockId, indexes, localCards, add) {
  if (!isObject(card)) {
    add('CARD_TYPE_OBJECT', path, 'Card must be an object.');
    return;
  }

  requireKeys(card, ['id', 'type'], path, add);
  checkId(card.id, `${path}/id`, add);
  if (!CARD_TYPES.has(card.type)) {
    add('CARD_TYPE_UNKNOWN', `${path}/type`, 'Card type is not supported by Schema v1.');
    return;
  }

  const allowedByType = {
    text: ['id', 'type', 'content', 'variant'],
    image: ['id', 'type', 'url', 'alt', 'caption'],
    shortText: ['id', 'type', 'fieldKey', 'label', 'description', 'required', 'placeholder', 'minLength', 'maxLength'],
    longText: ['id', 'type', 'fieldKey', 'label', 'description', 'required', 'placeholder', 'minLength', 'maxLength'],
    singleChoice: ['id', 'type', 'fieldKey', 'label', 'description', 'required', 'options'],
    multipleChoice: ['id', 'type', 'fieldKey', 'label', 'description', 'required', 'minSelections', 'maxSelections', 'options'],
  };
  rejectUnknown(card, allowedByType[card.type], path, add);

  if (typeof card.id === 'string') {
    if (indexes.cardById.has(card.id)) {
      add('CARD_ID_DUPLICATE', `${path}/id`, 'Card ID must be unique across the form.');
    } else {
      indexes.cardById.set(card.id, card);
      indexes.cardBlockById.set(card.id, blockId);
    }
    localCards.set(card.id, card);
  }

  if (card.type === 'text') {
    requireKeys(card, ['content', 'variant'], path, add);
    checkString(card.content, 1, 10000, `${path}/content`, add);
    checkEnum(card.variant, ['heading', 'body', 'caption'], `${path}/variant`, add);
    return;
  }

  if (card.type === 'image') {
    requireKeys(card, ['url', 'alt'], path, add);
    checkString(card.url, 1, 2048, `${path}/url`, add);
    if (typeof card.url === 'string' && !isHttpsUrl(card.url)) {
      add('IMAGE_URL_PROTOCOL', `${path}/url`, 'Image URL must be an absolute HTTPS URL.');
    }
    checkString(card.alt, 0, 500, `${path}/alt`, add);
    if ('caption' in card) checkString(card.caption, 0, 1000, `${path}/caption`, add);
    return;
  }

  validateInputCommon(card, path, indexes.fieldKeys, add);

  if (card.type === 'shortText' || card.type === 'longText') {
    const limit = card.type === 'shortText' ? 1000 : 10000;
    if ('placeholder' in card) checkString(card.placeholder, 0, 200, `${path}/placeholder`, add);
    if ('minLength' in card) checkInteger(card.minLength, 0, limit, `${path}/minLength`, add);
    if ('maxLength' in card) checkInteger(card.maxLength, 1, limit, `${path}/maxLength`, add);
    const min = card.minLength ?? 0;
    const max = card.maxLength ?? (card.type === 'shortText' ? 200 : 2000);
    if (Number.isInteger(min) && Number.isInteger(max) && min > max) {
      add('TEXT_LENGTH_RANGE', path, 'minLength must not exceed maxLength.');
    }
    return;
  }

  const optionIds = validateOptions(card.options, `${path}/options`, add);
  if (card.type === 'multipleChoice') {
    if ('minSelections' in card) checkInteger(card.minSelections, 0, optionIds.size, `${path}/minSelections`, add);
    if ('maxSelections' in card) checkInteger(card.maxSelections, 1, optionIds.size, `${path}/maxSelections`, add);
    const min = card.minSelections ?? 0;
    const max = card.maxSelections ?? optionIds.size;
    if (Number.isInteger(min) && Number.isInteger(max) && min > max) {
      add('SELECTION_RANGE', path, 'minSelections must not exceed maxSelections.');
    }
  }
}

function validateInputCommon(card, path, fieldKeys, add) {
  requireKeys(card, ['fieldKey', 'label', 'required'], path, add);
  checkId(card.fieldKey, `${path}/fieldKey`, add);
  checkString(card.label, 1, 500, `${path}/label`, add);
  if ('description' in card) checkString(card.description, 0, 2000, `${path}/description`, add);
  if (typeof card.required !== 'boolean') add('REQUIRED_FLAG_TYPE', `${path}/required`, 'required must be a boolean.');
  if (typeof card.fieldKey === 'string') {
    if (fieldKeys.has(card.fieldKey)) add('FIELD_KEY_DUPLICATE', `${path}/fieldKey`, 'fieldKey must be unique.');
    fieldKeys.add(card.fieldKey);
  }
}

function validateOptions(options, path, add) {
  const ids = new Set();
  if (!Array.isArray(options)) {
    add('OPTIONS_TYPE', path, 'Options must be an array.');
    return ids;
  }
  if (options.length < 2 || options.length > 100) add('OPTIONS_COUNT', path, 'Options must contain between 2 and 100 items.');
  options.forEach((option, index) => {
    const optionPath = `${path}/${index}`;
    if (!isObject(option)) {
      add('OPTION_TYPE', optionPath, 'Option must be an object.');
      return;
    }
    rejectUnknown(option, ['id', 'label'], optionPath, add);
    requireKeys(option, ['id', 'label'], optionPath, add);
    checkId(option.id, `${optionPath}/id`, add);
    checkString(option.label, 1, 500, `${optionPath}/label`, add);
    if (typeof option.id === 'string') {
      if (ids.has(option.id)) add('OPTION_ID_DUPLICATE', `${optionPath}/id`, 'Option ID must be unique within its Card.');
      ids.add(option.id);
    }
  });
  return ids;
}

function validateLayout(layout, path, cards, add) {
  if (!isObject(layout)) {
    add('LAYOUT_TYPE', path, 'Layout must be an object.');
    return;
  }
  rejectUnknown(layout, ['preset', 'areas'], path, add);
  requireKeys(layout, ['preset', 'areas'], path, add);
  const expectedAreas = LAYOUT_AREAS[layout.preset];
  if (!expectedAreas) {
    add('LAYOUT_PRESET_UNKNOWN', `${path}/preset`, 'Layout preset is not supported.');
    return;
  }
  if (!isObject(layout.areas)) {
    add('LAYOUT_AREAS_TYPE', `${path}/areas`, 'Layout areas must be an object.');
    return;
  }

  rejectUnknown(layout.areas, expectedAreas, `${path}/areas`, add);
  requireKeys(layout.areas, expectedAreas, `${path}/areas`, add);
  const placements = new Map();
  expectedAreas.forEach(area => {
    const ids = layout.areas[area];
    if (!Array.isArray(ids)) {
      add('LAYOUT_AREA_TYPE', `${path}/areas/${area}`, 'Layout area must be an array.');
      return;
    }
    ids.forEach((cardId, index) => {
      const itemPath = `${path}/areas/${area}/${index}`;
      checkId(cardId, itemPath, add);
      if (!cards.has(cardId)) add('LAYOUT_CARD_UNKNOWN', itemPath, 'Layout references a Card outside this Block.');
      if (placements.has(cardId)) add('LAYOUT_CARD_DUPLICATE', itemPath, 'Card may appear in Layout exactly once.');
      placements.set(cardId, area);
    });
  });

  cards.forEach((card, cardId) => {
    if (!placements.has(cardId)) add('LAYOUT_CARD_MISSING', path, `Card ${cardId} is not placed in the Layout.`);
  });

  if (layout.preset === 'imageLeft' || layout.preset === 'imageRight') {
    for (const cardId of layout.areas.media || []) {
      if (cards.get(cardId) && cards.get(cardId).type !== 'image') {
        add('LAYOUT_MEDIA_NOT_IMAGE', `${path}/areas/media`, 'Media area only accepts Image Cards.');
      }
    }
  }
  if (layout.preset === 'hero') {
    const hero = layout.areas.hero || [];
    if (hero.length > 1) add('LAYOUT_HERO_COUNT', `${path}/areas/hero`, 'Hero area accepts at most one Card.');
    if (hero[0] && cards.get(hero[0]) && cards.get(hero[0]).type !== 'image') {
      add('LAYOUT_HERO_NOT_IMAGE', `${path}/areas/hero`, 'Hero area only accepts an Image Card.');
    }
  }
}

function validateFlow(flow, indexes, add) {
  if (!isObject(flow)) {
    add('FLOW_TYPE', '/flow', 'Flow must be an object.');
    return [];
  }
  rejectUnknown(flow, ['transitions'], '/flow', add);
  requireKeys(flow, ['transitions'], '/flow', add);
  if (!Array.isArray(flow.transitions)) {
    add('TRANSITIONS_TYPE', '/flow/transitions', 'Transitions must be an array.');
    return [];
  }
  if (flow.transitions.length < 1) add('TRANSITIONS_COUNT', '/flow/transitions', 'At least one transition is required.');

  const transitionIds = new Set();
  const priorities = new Map();
  const fallbackCounts = new Map();
  flow.transitions.forEach((transition, index) => {
    const path = `/flow/transitions/${index}`;
    if (!isObject(transition)) {
      add('TRANSITION_TYPE', path, 'Transition must be an object.');
      return;
    }
    rejectUnknown(transition, ['id', 'fromBlockId', 'destination', 'priority', 'condition'], path, add);
    requireKeys(transition, ['id', 'fromBlockId', 'destination', 'priority'], path, add);
    checkId(transition.id, `${path}/id`, add);
    checkId(transition.fromBlockId, `${path}/fromBlockId`, add);
    checkInteger(transition.priority, 0, undefined, `${path}/priority`, add);

    if (typeof transition.id === 'string') {
      if (transitionIds.has(transition.id)) add('TRANSITION_ID_DUPLICATE', `${path}/id`, 'Transition ID must be unique.');
      transitionIds.add(transition.id);
    }
    if (typeof transition.fromBlockId === 'string' && !indexes.blockById.has(transition.fromBlockId)) {
      add('FLOW_FROM_BLOCK_UNKNOWN', `${path}/fromBlockId`, 'Transition source Block does not exist.');
    }

    validateDestination(transition.destination, `${path}/destination`, indexes.blockById, add);
    if ('condition' in transition) {
      validateCondition(transition.condition, `${path}/condition`, transition.fromBlockId, indexes, add);
    } else if (typeof transition.fromBlockId === 'string') {
      fallbackCounts.set(transition.fromBlockId, (fallbackCounts.get(transition.fromBlockId) || 0) + 1);
    }

    if (typeof transition.fromBlockId === 'string' && Number.isInteger(transition.priority)) {
      const key = `${transition.fromBlockId}:${transition.priority}`;
      if (priorities.has(key)) add('FLOW_PRIORITY_DUPLICATE', `${path}/priority`, 'Outgoing transition priorities must be unique.');
      priorities.set(key, true);
    }
  });

  fallbackCounts.forEach((count, blockId) => {
    if (count > 1) add('FLOW_FALLBACK_DUPLICATE', '/flow/transitions', `Block ${blockId} has multiple fallback transitions.`);
  });
  return flow.transitions.filter(isObject);
}

function validateDestination(destination, path, blocks, add) {
  if (!isObject(destination)) {
    add('FLOW_DESTINATION_TYPE', path, 'Destination must be an object.');
    return;
  }
  if (destination.type === 'block') {
    rejectUnknown(destination, ['type', 'blockId'], path, add);
    requireKeys(destination, ['type', 'blockId'], path, add);
    checkId(destination.blockId, `${path}/blockId`, add);
    if (typeof destination.blockId === 'string' && !blocks.has(destination.blockId)) {
      add('FLOW_UNKNOWN_BLOCK', `${path}/blockId`, 'Transition references an unknown Block.');
    }
  } else if (destination.type === 'submit') {
    rejectUnknown(destination, ['type'], path, add);
  } else {
    add('FLOW_DESTINATION_UNKNOWN', `${path}/type`, 'Destination type must be block or submit.');
  }
}

function validateCondition(condition, path, fromBlockId, indexes, add) {
  if (!isObject(condition)) {
    add('FLOW_CONDITION_TYPE', path, 'Condition must be an object.');
    return;
  }
  rejectUnknown(condition, ['cardId', 'operator', 'optionId'], path, add);
  requireKeys(condition, ['cardId', 'operator', 'optionId'], path, add);
  checkId(condition.cardId, `${path}/cardId`, add);
  checkEnum(condition.operator, ['equals', 'contains'], `${path}/operator`, add);
  checkId(condition.optionId, `${path}/optionId`, add);

  const card = indexes.cardById.get(condition.cardId);
  if (!card) {
    add('FLOW_CONDITION_CARD_UNKNOWN', `${path}/cardId`, 'Condition references an unknown Card.');
    return;
  }
  if (indexes.cardBlockById.get(condition.cardId) !== fromBlockId) {
    add('FLOW_CONDITION_CARD_SCOPE', `${path}/cardId`, 'Condition Card must belong to the source Block.');
  }
  if (!CHOICE_TYPES.has(card.type)) {
    add('FLOW_CONDITION_CARD_TYPE', `${path}/cardId`, 'Condition Card must be a Choice Card.');
    return;
  }
  if (card.type === 'singleChoice' && condition.operator !== 'equals') {
    add('FLOW_CONDITION_OPERATOR', `${path}/operator`, 'Single Choice requires equals.');
  }
  if (card.type === 'multipleChoice' && condition.operator !== 'contains') {
    add('FLOW_CONDITION_OPERATOR', `${path}/operator`, 'Multiple Choice requires contains.');
  }
  if (Array.isArray(card.options) && !card.options.some(option => option && option.id === condition.optionId)) {
    add('FLOW_CONDITION_OPTION_UNKNOWN', `${path}/optionId`, 'Condition references an unknown Option.');
  }
}

function validateGraph(startBlockId, blocks, transitions, add) {
  const outgoing = new Map([...blocks.keys()].map(id => [id, []]));
  transitions.forEach(transition => {
    if (outgoing.has(transition.fromBlockId)) outgoing.get(transition.fromBlockId).push(transition);
  });

  const reachable = new Set();
  const queue = [startBlockId];
  while (queue.length) {
    const blockId = queue.shift();
    if (reachable.has(blockId)) continue;
    reachable.add(blockId);
    for (const transition of outgoing.get(blockId) || []) {
      if (transition.destination && transition.destination.type === 'block' && blocks.has(transition.destination.blockId)) {
        queue.push(transition.destination.blockId);
      }
    }
  }
  blocks.forEach((_block, blockId) => {
    if (!reachable.has(blockId)) add('FLOW_BLOCK_UNREACHABLE', '/blocks', `Block ${blockId} is unreachable from the Start Block.`);
  });

  const canSubmit = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const blockId of blocks.keys()) {
      if (canSubmit.has(blockId)) continue;
      const paths = outgoing.get(blockId) || [];
      if (paths.some(item => item.destination && (
        item.destination.type === 'submit' ||
        (item.destination.type === 'block' && canSubmit.has(item.destination.blockId))
      ))) {
        canSubmit.add(blockId);
        changed = true;
      }
    }
  }
  reachable.forEach(blockId => {
    if (!canSubmit.has(blockId)) add('FLOW_NO_SUBMIT_PATH', '/flow/transitions', `Reachable Block ${blockId} has no path to submit.`);
    if ((outgoing.get(blockId) || []).length === 0) add('FLOW_OUTGOING_MISSING', '/flow/transitions', `Reachable Block ${blockId} has no outgoing transition.`);
  });
}

function rejectUnknown(object, allowed, path, add) {
  const set = new Set(allowed);
  Object.keys(object).forEach(key => {
    if (!set.has(key)) add('UNKNOWN_PROPERTY', `${path}/${escapePointer(key)}`, 'Property is not allowed by Schema v1.');
  });
}

function requireKeys(object, required, path, add) {
  required.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(object, key)) add('REQUIRED_PROPERTY', `${path}/${escapePointer(key)}`, 'Required property is missing.');
  });
}

function checkId(value, path, add) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) add('INVALID_ID', path, 'ID has an invalid format.');
}

function checkString(value, min, max, path, add) {
  if (typeof value !== 'string') {
    add('STRING_TYPE', path, 'Value must be a string.');
  } else if (value.length < min || value.length > max) {
    add('STRING_LENGTH', path, `String length must be between ${min} and ${max}.`);
  }
}

function checkInteger(value, min, max, path, add) {
  if (!Number.isInteger(value)) {
    add('INTEGER_TYPE', path, 'Value must be an integer.');
  } else if (value < min || (max !== undefined && value > max)) {
    add('INTEGER_RANGE', path, 'Integer is outside the allowed range.');
  }
}

function checkEnum(value, allowed, path, add) {
  if (!allowed.includes(value)) add('ENUM_VALUE', path, `Value must be one of: ${allowed.join(', ')}.`);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapePointer(value) {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

export { validateFormSchema };

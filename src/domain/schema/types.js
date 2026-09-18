/**
 * Form Schema v1 type contract.
 *
 * These JSDoc definitions keep the reference implementation dependency-free
 * while still providing editor type information.
 */

/** @typedef {'heading'|'body'|'caption'} TextVariant */
/** @typedef {'text'|'image'|'shortText'|'longText'|'singleChoice'|'multipleChoice'} CardType */
/** @typedef {'vertical'|'twoColumns'|'imageLeft'|'imageRight'|'hero'} LayoutPreset */
/** @typedef {'equals'|'contains'} ConditionOperator */

/**
 * @typedef {Object} ChoiceOption
 * @property {string} id
 * @property {string} label
 */

/**
 * @typedef {Object} Layout
 * @property {LayoutPreset} preset
 * @property {Record<string, string[]>} areas
 */

/**
 * @typedef {Object} FlowCondition
 * @property {string} cardId
 * @property {ConditionOperator} operator
 * @property {string} optionId
 */

/**
 * @typedef {{type: 'block', blockId: string}|{type: 'submit'}} FlowDestination
 */

/**
 * @typedef {Object} Transition
 * @property {string} id
 * @property {string} fromBlockId
 * @property {FlowDestination} destination
 * @property {number} priority
 * @property {FlowCondition=} condition
 */

/**
 * @typedef {Object} FormBlock
 * @property {string} id
 * @property {string=} title
 * @property {Array<Record<string, unknown>>} cards
 * @property {Layout} layout
 */

/**
 * @typedef {Object} FormSchemaV1
 * @property {1} schemaVersion
 * @property {string} id
 * @property {number} revision
 * @property {string} title
 * @property {string=} description
 * @property {string} startBlockId
 * @property {FormBlock[]} blocks
 * @property {{transitions: Transition[]}} flow
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} code
 * @property {string} path
 * @property {string} message
 */

module.exports = {};

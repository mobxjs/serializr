import { isModelSchema } from "../utils/utils"

/**
 * Returns the standard model schema associated with a class / constructor function
 *
 * @param {object} thing
 * @returns {ModelSchema} model schema
 */
export default function getDefaultModelSchema(thing) {
    if (!thing) return null
    if (isModelSchema(thing)) return thing
    if (isModelSchema(thing.serializeInfo)) return thing.serializeInfo
    if (thing.constructor && thing.constructor.serializeInfo) return thing.constructor.serializeInfo
}

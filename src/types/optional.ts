import { invariant, isPropSchema } from "../utils/utils"
import { _defaultPrimitiveProp, SKIP } from "../constants"
import { PropSchema } from "../api/types"

/**
 * Optional indicates that this model property shouldn't be serialized if it isn't present.
 *
 * @example
 * createModelSchema(Todo, {
 *     title: optional(primitive()),
 * })
 *
 * serialize(new Todo()) // {}
 *
 * @param {PropSchema} propSchema propSchema to (de)serialize the contents of this field
 * @returns {PropSchema}
 */
export default function optional(propSchema?: PropSchema | boolean): PropSchema {
    propSchema = !propSchema || propSchema === true ? _defaultPrimitiveProp : propSchema
    invariant(isPropSchema(propSchema), "expected prop schema as second argument")
    const propSerializer = propSchema.serializer
    invariant(
        typeof propSerializer === "function",
        "expected prop schema to have a callable serializer"
    )
    const serializer: PropSchema["serializer"] = (sourcePropertyValue, key, sourceObject) => {
        const result = propSerializer(sourcePropertyValue, key, sourceObject)
        if (result === undefined) {
            return SKIP
        }
        return result
    }
    return Object.assign({}, propSchema, { serializer })
}

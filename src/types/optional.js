import { invariant, isPropSchema } from "../utils/utils"
import { _defaultPrimitiveProp, SKIP } from "../constants"

/**
 * Optional indicates that this model property shouldn't be serialized if it isn't present.
 *
 * @example
 * createModelSchema(Todo, {
 *     title: optional(primitive()),
 * });
 *
 * console.dir(serialize(new Todo()));
 * // {}
 *
 * @param {PropSchema} propSchema propSchema to (de)serialize the contents of this field
 * @returns {PropSchema}
 */
export default function optional(name, propSchema) {
    propSchema = (!propSchema || propSchema === true)  ? _defaultPrimitiveProp : propSchema
    invariant(isPropSchema(propSchema), "expected prop schema as second argument")
    const propSerializer = propSchema.serializer
    invariant(typeof propSerializer === "function", "expected prop schema to have a callable serializer")
    function serializer(...args) {
        const result = propSerializer(...args)
        if (result === undefined) {
            return SKIP
        }
        return result
    }
    return {
        ...propSchema,
        serializer,
    }
}

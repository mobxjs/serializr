import { invariant, isSchema } from "../utils/utils"
import { _defaultPrimitiveProp, SKIP } from "../constants"
import { Schema } from "../api/types"

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
 * @param propSchema propSchema to (de)serialize the contents of this field
 */
export default function optional(propSchema?: Schema | boolean): Schema {
    propSchema = !propSchema || propSchema === true ? _defaultPrimitiveProp : propSchema
    invariant(isSchema(propSchema), "expected prop schema as second argument")
    const propSerializer = propSchema.serializer
    invariant(
        typeof propSerializer === "function",
        "expected prop schema to have a callable serializer"
    )
    const serializer: Schema["serializer"] = (sourcePropertyValue, key, sourceObject) => {
        const result = propSerializer(sourcePropertyValue, key, sourceObject)
        if (result === undefined) {
            return SKIP
        }
        return result
    }
    return Object.assign({}, propSchema, { serializer })
}

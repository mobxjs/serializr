import { invariant, isPrimitive } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import { SKIP, _defaultPrimitiveProp } from "../constants"
import { ClazzOrModelSchema, Schema, ModelSchema, PropDef } from "../api/types"

/**
 * Serializes an object (graph) into json using the provided model schema.
 * The model schema can be omitted if the object type has a default model schema associated with it.
 * If a list of objects is provided, they should have an uniform type.
 *
 * @param arg1 class or modelschema to use. Optional
 * @param arg2 object(s) to serialize
 * @returns serialized representation of the object
 */
export default function serialize<T>(modelSchema: ClazzOrModelSchema<T>, instance: T): any
export default function serialize<T>(instance: T): any
export default function serialize<T>(modelSchemaOrInstance: ClazzOrModelSchema<T> | T, arg2?: T) {
    invariant(
        arguments.length === 1 || arguments.length === 2,
        "serialize expects one or 2 arguments"
    )
    const instance = (arg2 ?? modelSchemaOrInstance) as T
    let schema = (arg2 && modelSchemaOrInstance) as ClazzOrModelSchema<T> | undefined
    if (Array.isArray(instance)) {
        if (instance.length === 0) return []
        // don't bother finding a schema
        else if (!schema) schema = getDefaultModelSchema(instance[0])
        else if (typeof schema !== "object") schema = getDefaultModelSchema(schema)
    } else if (!schema) {
        schema = getDefaultModelSchema(instance)
    } else if (typeof schema !== "object") {
        schema = getDefaultModelSchema(schema)
    }
    const foundSchema = schema
    invariant(foundSchema, "Failed to find default schema for " + modelSchemaOrInstance)
    if (Array.isArray(instance))
        return instance.map((item, index) => foundSchema.serializer(item, index, instance))
    return foundSchema.serializer(instance, undefined, undefined)
}

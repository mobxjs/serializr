import { invariant, isSchema, isAliasedSchema, isIdentifierSchema } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import { Schema, PropDef } from "../api/types"

/**
 * Alias indicates that this model property should be named differently in the generated json.
 * Alias should be the outermost propschema.
 *
 * @example
 * createModelSchema(Todo, {
 *     title: alias('task', primitive()),
 * })
 *
 * serialize(new Todo('test')) // { "task": "test" }
 *
 * @param name name of the json field to be used for this property
 * @param propSchema propSchema to (de)serialize the contents of this field
 */
export default function alias(name: string, propSchema?: PropDef): Schema {
    invariant(name && typeof name === "string", "expected prop name as first argument")
    propSchema = !propSchema || propSchema === true ? _defaultPrimitiveProp : propSchema
    invariant(isSchema(propSchema), "expected prop schema as second argument")
    invariant(!isAliasedSchema(propSchema), "provided prop is already aliased")
    return {
        jsonname: name,
        serializer: propSchema.serializer,
        deserializer: propSchema.deserializer,
        identifier: isIdentifierSchema(propSchema) || undefined,
        beforeDeserialize: propSchema.beforeDeserialize,
        afterDeserialize: propSchema.afterDeserialize
    }
}

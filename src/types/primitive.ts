import { invariant, isPrimitive, processAdditionalPropArgs } from "../utils/utils"
import { PropSchema, AdditionalPropArgs } from "../api/types"

/**
 * Indicates that this field contains a primitive value (or Date) which should be serialized literally to json.
 *
 * @example
 * createModelSchema(Todo, {
 *     title: primitive(),
 * })
 *
 * serialize(new Todo('test')) // { "title": "test" }
 *
 * @param {AdditionalPropArgs} additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 * @returns {ModelSchema}
 */
export default function primitive(additionalArgs?: AdditionalPropArgs): PropSchema {
    let result: PropSchema = {
        serializer: function(value) {
            invariant(isPrimitive(value), "this value is not primitive: " + value)
            return value
        },
        deserializer: function(jsonValue, done) {
            if (!isPrimitive(jsonValue))
                return void done("[serializr] this value is not primitive: " + jsonValue)
            return void done(null, jsonValue)
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

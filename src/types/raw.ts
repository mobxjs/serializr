import { processAdditionalPropArgs } from "../utils/utils"
import { PropSchema, AdditionalPropArgs } from "../api/types"

/**
 * Indicates that this field is only need to putted in the serialized json or
 * deserialized instance, without any transformations. Stay with its original value
 *
 * @example
 * createModelSchema(Model, {
 *     rawData: raw(),
 * })
 *
 * serialize(new Model({ rawData: { a: 1, b: [], c: {} } } }))
 * // { "rawData": { a: 1, b: [], c: {} } } }
 *
 * @param {AdditionalPropArgs} additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 * @returns {ModelSchema}
 */
export default function raw(additionalArgs: AdditionalPropArgs) {
    let result: PropSchema = {
        serializer: function(value) {
            return value
        },
        deserializer: function(jsonValue, done) {
            return void done(null, jsonValue)
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

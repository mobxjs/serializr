import { invariant, processAdditionalPropArgs } from "../utils/utils"
import { Schema, AdditionalPropArgs } from "../api/types"

/**
 * Similar to primitive, serializes instances of Date objects
 *
 * @param additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 */
export default function date(additionalArgs?: AdditionalPropArgs): Schema {
    // TODO: add format option?
    let result: Schema = {
        serializer: function(value) {
            if (value === null || value === undefined) return value
            invariant(value instanceof Date, "Expected Date object")
            return value.getTime()
        },
        deserializer: function(jsonValue, done) {
            if (jsonValue === null || jsonValue === undefined) return void done(null, jsonValue)
            return void done(null, new Date(jsonValue))
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

import { invariant, isSchema, isMapLike, processAdditionalPropArgs } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import list from "./list"
import { Schema, AdditionalPropArgs } from "../api/types"

/**
 * Similar to map, mapAsArray can be used to serialize a map-like collection where the key is
 * contained in the 'value object'. Example: consider Map<id: number, customer: Customer> where the
 * Customer object has the id stored on itself. mapAsArray stores all values from the map into an
 * array which is serialized. Deserialization returns a ES6 Map or plain object object where the
 * `keyPropertyName` of each object is used for keys. For ES6 maps this has the benefit of being
 * allowed to have non-string keys in the map. The serialized json also may be slightly more
 * compact.
 *
 * @param keyPropertyName - the property of stored objects used as key in the map
 * @param additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 */
export default function mapAsArray(
    propSchema: Schema,
    keyPropertyName: string,
    additionalArgs?: AdditionalPropArgs
): Schema {
    propSchema = propSchema || _defaultPrimitiveProp
    invariant(isSchema(propSchema), "expected prop schema as first argument")
    invariant(!!keyPropertyName, "expected key property name as second argument")
    let result: Schema = {
        serializer: function(m) {
            invariant(m && typeof m === "object", "expected object or Map")
            const result = []
            // eslint-disable-next-line no-unused-vars
            if (isMapLike(m)) {
                m.forEach((value, key) => result.push(propSchema.serializer(value, key, m)))
            } else {
                for (let key in m) result.push(propSchema.serializer(m[key], key, m))
            }
            return result
        },
        deserializer: function(jsonArray, done, context, oldValue) {
            list(propSchema, additionalArgs).deserializer(
                jsonArray,
                function(err, values) {
                    if (err) return void done(err)
                    const oldValueIsMap = isMapLike(oldValue)
                    let newValue
                    if (oldValueIsMap) {
                        oldValue.clear()
                        newValue = oldValue
                    } else {
                        newValue = {}
                    }
                    for (let i = 0, l = jsonArray.length; i < l; i++)
                        if (oldValueIsMap) newValue.set(values[i][keyPropertyName], values[i])
                        else newValue[values[i][keyPropertyName].toString()] = values[i]
                    done(null, newValue)
                },
                context,
                undefined
            )
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

import { invariant, isPropSchema, isMapLike, processAdditionalPropArgs } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import list from "./list"

/**
 * Similar to map, mapAsArray can be used to serialize a map-like collection where the key is
 * contained in the 'value object'. Example: consider Map<id: number, customer: Customer> where the
 * Customer object has the id stored on itself. mapAsArray stores all values from the map into an
 * array which is serialized. Deserialization returns a ES6 Map or plain object object where the
 * `keyPropertyName` of each object is used for keys. For ES6 maps this has the benefit of being
 * allowed to have non-string keys in the map. The serialized json also may be slightly more
 * compact.
 *
 * @param {any} propSchema
 * @param {string} keyPropertyName - the property of stored objects used as key in the map
 * @param {AdditionalPropArgs} additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 * @returns {PropSchema}
 */
export default function mapAsArray(propSchema, keyPropertyName, additionalArgs) {
    propSchema = propSchema || _defaultPrimitiveProp
    invariant(isPropSchema(propSchema), "expected prop schema as first argument")
    invariant(!!keyPropertyName, "expected key property name as second argument")
    var res = {
        serializer: function (m) {
            invariant(m && typeof m === "object", "expected object or Map")
            var isMap = isMapLike(m)
            var result = []
            // eslint-disable-next-line no-unused-vars
            if (isMap) {
                m.forEach(function (value) {
                    result.push(propSchema.serializer(value))
                })
            } else for (var key in m) {
                result.push(propSchema.serializer(m[key]))
                // result[key] = propSchema.serializer(m[key])
            }
            return result
        },
        deserializer: function (jsonArray, done, context, oldValue) {
            list(propSchema, additionalArgs).deserializer(
                jsonArray,
                function (err, values) {
                    if (err)
                        return void done(err)
                    var isMap = isMapLike(oldValue)
                    var newValue
                    if (isMap) {
                        oldValue.clear()
                        newValue = oldValue
                    } else {
                        newValue = {}
                    }
                    for (var i = 0, l = jsonArray.length; i < l; i++)
                        if (isMap)
                            newValue.set(values[i][keyPropertyName], values[i])
                        else
                            newValue[values[i][keyPropertyName].toString()] = values[i]
                    done(null, newValue)
                },
                context
            )
        }
    }
    res = processAdditionalPropArgs(res, additionalArgs)
    return res
}

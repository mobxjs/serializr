import { invariant, isPropSchema, isMapLike } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import list from "./list"

/**
 * Similar to map, mapAsArray can be used to serialize a map-like collection where the key is contained in the 'value object'.
 * Example: consider Map<id: number, customer: Customer> where the Customer object has the id stored on itself.
 * mapAsArray stores all values from the map into an array which is serialized.
 * Deserialization returns a ES6 Map or plain object object where the `keyPropertyName` of each object is used for keys.
 * For ES6 maps this has the benefit of being allowed to have non-string keys in the map. The serialized json also may be slightly more compact.
 *
 * @param {any} propSchema, {string} keyPropertyName - the property of stored objects used as key in the map
 * @returns
 */
export default function mapAsArray(propSchema, keyPropertyName) {
    propSchema = propSchema || _defaultPrimitiveProp
    invariant(isPropSchema(propSchema), "expected prop schema as first argument")
    invariant(!!keyPropertyName, "expected key property name as second argument")
    return {
        serializer: function (m, k, target, context) {
            var result = []
            // eslint-disable-next-line no-unused-vars
            m.forEach(function (value, key) {
                result.push(propSchema.serializer(value, key, m, context))
            })
            return result
        },
        deserializer: function (jsonArray, done, context, oldValue) {
            list(propSchema).deserializer(
              jsonArray,
              function (err, values) {
                  if (err)
                      return void done(err)
                  var isMap = isMapLike(oldValue)
                  var newValue
                  if (isMap) {
                      oldValue.clear()
                      newValue = oldValue
                  } else
                      newValue = {}
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
}

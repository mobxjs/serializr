import {
    invariant,
    isAliasedPropSchema,
    isPropSchema,
    isMapLike,
    processAdditionalPropArgs
} from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import list from "./list"

/**
 * Similar to list, but map represents a string keyed dynamic collection.
 * This can be both plain objects (default) or ES6 Map like structures.
 * This will be inferred from the initial value of the targetted attribute.
 *
 * @param {*} propSchema
 * @param {AdditionalPropArgs} additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 * @returns {PropSchema}
 */
export default function map(propSchema, additionalArgs) {
    propSchema = propSchema || _defaultPrimitiveProp
    invariant(isPropSchema(propSchema), "expected prop schema as first argument")
    invariant(
        !isAliasedPropSchema(propSchema),
        "provided prop is aliased, please put aliases first"
    )
    var res = {
        serializer: function(m) {
            invariant(m && typeof m === "object", "expected object or Map")
            var isMap = isMapLike(m)
            var result = {}
            if (isMap)
                m.forEach(function(value, key) {
                    result[key] = propSchema.serializer(value)
                })
            else for (var key in m) result[key] = propSchema.serializer(m[key])
            return result
        },
        deserializer: function(jsonObject, done, context, oldValue) {
            if (!jsonObject || typeof jsonObject !== "object")
                return void done("[serializr] expected JSON object")
            var keys = Object.keys(jsonObject)
            list(propSchema, additionalArgs).deserializer(
                keys.map(function(key) {
                    return jsonObject[key]
                }),
                function(err, values) {
                    if (err) return void done(err)
                    var isMap = isMapLike(oldValue)
                    var newValue
                    if (isMap) {
                        // if the oldValue is a map, we recycle it
                        // there are many variations and this way we don't have to
                        // know about the original constructor
                        oldValue.clear()
                        newValue = oldValue
                    } else newValue = {}
                    for (var i = 0, l = keys.length; i < l; i++)
                        if (isMap) newValue.set(keys[i], values[i])
                        else newValue[keys[i]] = values[i]
                    done(null, newValue)
                },
                context
            )
        }
    }
    res = processAdditionalPropArgs(res, additionalArgs)
    return res
}

import {
    invariant,
    isAliasedSchema,
    isSchema,
    isMapLike,
    processAdditionalPropArgs
} from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import list from "./list"
import { Schema, AdditionalPropArgs } from "../api/types"

/**
 * Similar to list, but map represents a string keyed dynamic collection.
 * This can be both plain objects (default) or ES6 Map like structures.
 * This will be inferred from the initial value of the targetted attribute.
 *
 * @param additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 */
export default function map(propSchema: Schema, additionalArgs?: AdditionalPropArgs): Schema {
    propSchema = propSchema || _defaultPrimitiveProp
    invariant(isSchema(propSchema), "expected prop schema as first argument")
    invariant(!isAliasedSchema(propSchema), "provided prop is aliased, please put aliases first")
    let result: Schema = {
        serializer: function(m: Map<any, any> | { [key: string]: any }) {
            invariant(m && typeof m === "object", "expected object or Map")
            const result: { [key: string]: any } = {}
            if (isMapLike(m)) {
                m.forEach((value, key) => (result[key] = propSchema.serializer(value, key, m)))
            } else {
                for (const key in m) result[key] = propSchema.serializer(m[key], key, m)
            }
            return result
        },
        deserializer: function(jsonObject, done, context, oldValue) {
            if (!jsonObject || typeof jsonObject !== "object")
                return void done("[serializr] expected JSON object")
            const keys = Object.keys(jsonObject)
            list(propSchema, additionalArgs).deserializer(
                keys.map(function(key) {
                    return jsonObject[key]
                }),
                function(err, values) {
                    if (err) return void done(err)
                    const isMap = isMapLike(oldValue)
                    let newValue
                    if (isMap) {
                        // if the oldValue is a map, we recycle it
                        // there are many variations and this way we don't have to
                        // know about the original constructor
                        oldValue.clear()
                        newValue = oldValue
                    } else newValue = {}
                    for (let i = 0, l = keys.length; i < l; i++)
                        if (isMap) newValue.set(keys[i], values[i])
                        else newValue[keys[i]] = values[i]
                    done(null, newValue)
                },
                context
            )
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

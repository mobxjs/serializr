import { invariant, isPrimitive } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import { SKIP, _defaultPrimitiveProp } from "../constants"

/**
 * Serializes an object (graph) into json using the provided model schema.
 * The model schema can be omitted if the object type has a default model schema associated with it.
 * If a list of objects is provided, they should have an uniform type.
 *
 * @param arg1 class or modelschema to use. Optional
 * @param arg2 object(s) to serialize
 * @returns {object} serialized representation of the object
 */
export default function serialize(arg1, arg2) {
    invariant(
        arguments.length === 1 || arguments.length === 2,
        "serialize expects one or 2 arguments"
    )
    var thing = arguments.length === 1 ? arg1 : arg2
    var schema = arguments.length === 1 ? null : arg1
    if (Array.isArray(thing)) {
        if (thing.length === 0) return []
        // don't bother finding a schema
        else if (!schema) schema = getDefaultModelSchema(thing[0])
        else if (typeof schema !== "object") schema = getDefaultModelSchema(schema)
    } else if (!schema) {
        schema = getDefaultModelSchema(thing)
    } else if (typeof schema !== "object") {
        schema = getDefaultModelSchema(schema)
    }
    invariant(!!schema, "Failed to find default schema for " + arg1)
    if (Array.isArray(thing))
        return thing.map(function(item) {
            return serializeWithSchema(schema, item)
        })
    return serializeWithSchema(schema, thing)
}

export function checkStarSchemaInvariant(propDef) {
    invariant(
        propDef === true || propDef.pattern,
        "prop schema '*' can only be used with 'true' or a prop def with a 'pattern': " +
            JSON.stringify(propDef)
    )
}

export function serializeWithSchema(schema, obj) {
    invariant(schema && typeof schema === "object" && schema.props, "Expected schema")
    invariant(obj && typeof obj === "object", "Expected object")
    var res
    if (schema.extends) res = serializeWithSchema(schema.extends, obj)
    else {
        // TODO: make invariant?:  invariant(!obj.constructor.prototype.constructor.serializeInfo, "object has a serializable supertype, but modelschema did not provide extends clause")
        res = {}
    }
    Object.keys(schema.props).forEach(function(key) {
        var propDef = schema.props[key]
        if (key === "*") {
            serializeStarProps(schema, propDef, obj, res)
            return
        }
        if (propDef === true) propDef = _defaultPrimitiveProp
        if (propDef === false) return
        var jsonValue = propDef.serializer(obj[key], key, obj)
        if (jsonValue === SKIP) {
            return
        }
        res[propDef.jsonname || key] = jsonValue
    })
    return res
}

export function serializeStarProps(schema, propDef, obj, target) {
    checkStarSchemaInvariant(propDef)
    for (var key in obj)
        if (obj.hasOwnProperty(key))
            if (!(key in schema.props)) {
                if (propDef === true || (propDef.pattern && propDef.pattern.test(key))) {
                    var value = obj[key]
                    if (propDef === true) {
                        if (isPrimitive(value)) {
                            target[key] = value
                        }
                    } else if (propDef.props) {
                        var jsonValue = serialize(propDef, value)
                        if (jsonValue === SKIP) {
                            return
                        }
                        // todo: propDef.jsonname could be a transform function on key
                        target[key] = jsonValue
                    } else {
                        var jsonValue = propDef.serializer(value, key, obj)
                        if (jsonValue === SKIP) {
                            return
                        }
                        // todo: propDef.jsonname could be a transform function on key
                        target[key] = jsonValue
                    }
                }
            }
}

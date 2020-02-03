import { invariant, isPrimitive } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import { SKIP, _defaultPrimitiveProp } from "../constants"
import { ClazzOrModelSchema, PropSchema, ModelSchema, PropDef } from "../api/types"

/**
 * Serializes an object (graph) into json using the provided model schema.
 * The model schema can be omitted if the object type has a default model schema associated with it.
 * If a list of objects is provided, they should have an uniform type.
 *
 * @param arg1 class or modelschema to use. Optional
 * @param arg2 object(s) to serialize
 * @returns serialized representation of the object
 */
export default function serialize<T>(modelSchema: ClazzOrModelSchema<T>, instance: T): any
export default function serialize<T>(instance: T): any
export default function serialize<T>(modelSchemaOrInstance: ClazzOrModelSchema<T> | T, arg2?: T) {
    invariant(
        arguments.length === 1 || arguments.length === 2,
        "serialize expects one or 2 arguments"
    )
    const instance = (arg2 ?? modelSchemaOrInstance) as T
    let schema = (arg2 && modelSchemaOrInstance) as ClazzOrModelSchema<T> | undefined
    if (Array.isArray(instance)) {
        if (instance.length === 0) return []
        // don't bother finding a schema
        else if (!schema) schema = getDefaultModelSchema(instance[0])
        else if (typeof schema !== "object") schema = getDefaultModelSchema(schema)
    } else if (!schema) {
        schema = getDefaultModelSchema(instance)
    } else if (typeof schema !== "object") {
        schema = getDefaultModelSchema(schema)
    }
    const foundSchema = schema
    invariant(foundSchema, "Failed to find default schema for " + modelSchemaOrInstance)
    if (Array.isArray(instance)) return instance.map(item => serializeWithSchema(foundSchema, item))
    return serializeWithSchema(foundSchema, instance)
}

function serializeWithSchema<T>(schema: ModelSchema<T>, obj: any): T {
    invariant(schema && typeof schema === "object" && schema.props, "Expected schema")
    invariant(obj && typeof obj === "object", "Expected object")
    let res: any
    if (schema.extends) res = serializeWithSchema(schema.extends, obj)
    else {
        // TODO: make invariant?:  invariant(!obj.constructor.prototype.constructor.serializeInfo, "object has a serializable supertype, but modelschema did not provide extends clause")
        res = {}
    }
    Object.keys(schema.props).forEach(function(key) {
        let propDef: PropDef = schema.props[key as keyof T]
        if (!propDef) return
        if (key === "*") {
            serializeStarProps(schema, propDef, obj, res)
            return
        }
        if (propDef === true) propDef = _defaultPrimitiveProp
        const jsonValue = propDef.serializer(obj[key], key, obj)
        if (jsonValue === SKIP) {
            return
        }
        res[propDef.jsonname || key] = jsonValue
    })
    return res
}

function serializeStarProps(schema: ModelSchema<any>, propDef: PropDef, obj: any, target: any) {
    for (const key of Object.keys(obj))
        if (!(key in schema.props)) {
            if (propDef === true || (propDef && (!propDef.pattern || propDef.pattern.test(key)))) {
                const value = obj[key]
                if (propDef === true) {
                    if (isPrimitive(value)) {
                        target[key] = value
                    }
                } else {
                    const jsonValue = propDef.serializer(value, key, obj)
                    if (jsonValue === SKIP) {
                        return
                    }
                    // TODO: propDef.jsonname could be a transform function on key
                    target[key] = jsonValue
                }
            }
        }
}

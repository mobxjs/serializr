import { invariant, isPrimitive } from "../utils/utils"
import createModelSchema from "../api/createModelSchema"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import setDefaultModelSchema from "../api/setDefaultModelSchema"
import { SKIP, _defaultPrimitiveProp } from "../constants"
import SerializeContext from "./SerializeContext";

/**
 * Serializes an object (graph) into json using the provided model schema.
 * The model schema can be omitted if the object type has a default model schema associated with it.
 * If a list of objects is provided, they should have an uniform type.
 *
 * @param arg1 modelschema to use. Optional
 * @param arg2 object(s) to serialize
 * @returns {object} serialized representation of the object
 */
export default function serialize(arg1, arg2, parentContext) {
    invariant(arguments.length >= 1 && arguments.length <= 3, "serialize expects one or 2 arguments")
    var thing = arguments.length === 1 ? arg1 : arg2
    var schema = arguments.length === 1 ? null : arg1
    if (Array.isArray(thing)) {
        if (thing.length === 0)
            return [] // don't bother finding a schema
        else if (!schema)
            schema = getDefaultModelSchema(thing[0])
    } else if (!schema) {
        schema = getDefaultModelSchema(thing)
    }
    invariant(!!schema, "Failed to find default schema for " + arg1)

    var context = new SerializeContext(parentContext, schema)
    var result
    if (Array.isArray(thing)) {
        result = thing.map(function (item) {
            return serializeWithSchemaAndContext(context, schema, item)
        })
    } else {
        result = serializeWithSchemaAndContext(context, schema, thing);
    }
    context.finished(result);
    return result;
}

export function serializeWithSchema(schema, obj) {
    return serializeWithSchemaAndContext(null, schema, obj);
}

function serializeWithSchemaAndContext(parentContext, schema, obj) {
    invariant(schema && typeof schema === "object", "Expected schema")
    invariant(obj && typeof obj === "object", "Expected object")
    var res
    if (schema.extends)
        res = serializeWithSchemaAndContext(parentContext, schema.extends, obj)
    else {
        // TODO: make invariant?:  invariant(!obj.constructor.prototype.constructor.serializeInfo, "object has a serializable supertype, but modelschema did not provide extends clause")
        res = {}
    }

    var context = new SerializeContext(parentContext, schema, res)
    Object.keys(schema.props).forEach(function (key) {
        var propDef = schema.props[key]
        if (key === "*") {
            invariant(propDef === true, "prop schema '*' can only be used with 'true'")
            serializeStarProps(schema, obj, res)
            return
        }
        if (propDef === true)
            propDef = _defaultPrimitiveProp
        if (propDef === false)
            return
        var jsonValue = propDef.serializer(obj[key], key, obj, context)
        if (jsonValue === SKIP){
            return
        }
        res[propDef.jsonname || key] = jsonValue
    })
    context.finished(res);
    return res
}

export function serializeStarProps(schema, obj, target) {
    for (var key in obj) if (obj.hasOwnProperty(key)) if (!(key in schema.props)) {
        var value = obj[key]
        // when serializing only serialize primitive props. Assumes other props (without schema) are local state that doesn't need serialization
        if (isPrimitive(value))
            target[key] = value
    }
}

/**
 * The `serializeAll` decorator can be used on a class to signal that all primitive properties should be serialized automatically.
 *
 * @example
 * @serializeAll class Store {
 *     a = 3;
 *     b;
 * }
 *
 * const store = new Store();
 * store.c = 5;
 * store.d = {};
 * t.deepEqual(serialize(store), { a: 3, b: undefined, c: 5 });
 */
export function serializeAll(target) {
    invariant(arguments.length === 1 && typeof target === "function", "@serializeAll can only be used as class decorator")

    var info = getDefaultModelSchema(target)
    if (!info || !target.hasOwnProperty("serializeInfo")) {
        info = createModelSchema(target, {})
        setDefaultModelSchema(target, info)
    }

    getDefaultModelSchema(target).props["*"] = true
    return target
}

/*
 * Deserialization
 */
import { invariant, isPrimitive, isModelSchema, parallel, GUARDED_NOOP } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import { SKIP, _defaultPrimitiveProp } from "../constants"
import Context from "./Context"

function schemaHasAlias(schema, name) {
    for (var key in schema.props)
        if (typeof schema.props[key] === "object" && schema.props[key].jsonname === name)
            return true
    return false
}

function deserializeStarProps(schema, obj, json) {
    for (var key in json) if (!(key in schema.props) && !schemaHasAlias(schema, key)) {
        var value = json[key]
        // when deserializing we don't want to silently ignore 'unparseable data' to avoid confusing bugs
        invariant(isPrimitive(value), "encountered non primitive value while deserializing '*' properties in property '" + key + "': " + value)
        obj[key] = value
    }
}

/**
 * Deserializes a json structor into an object graph.
 * This process might be asynchronous (for example if there are references with an asynchronous
 * lookup function). The function returns an object (or array of objects), but the returned object
 * might be incomplete until the callback has fired as well (which might happen immediately)
 *
 * @param {object|array} schema to use for deserialization
 * @param {json} json data to deserialize
 * @param {function} callback node style callback that is invoked once the deserializaiton has finished.
 * First argument is the optional error, second argument is the deserialized object (same as the return value)
 * @param {*} customArgs custom arguments that are available as `context.args` during the deserialization process. This can be used as dependency injection mechanism to pass in, for example, stores.
 * @returns {object|array} deserialized object, possibly incomplete.
 */
export default function deserialize(schema, json, callback, customArgs) {
    invariant(arguments.length >= 2, "deserialize expects at least 2 arguments")
    schema = getDefaultModelSchema(schema)
    invariant(isModelSchema(schema), "first argument should be model schema")
    if (Array.isArray(json)) {
        var items = []
        parallel(
            json,
            function (childJson, itemDone) {
                var instance = deserializeObjectWithSchema(null, schema, childJson, itemDone, customArgs)
                // instance is created synchronously so can be pushed
                items.push(instance)
            },
            callback || GUARDED_NOOP
        )
        return items
    } else
  return deserializeObjectWithSchema(null, schema, json, callback, customArgs)
}

export function deserializeObjectWithSchema(parentContext, schema, json, callback, customArgs) {
    if (json === null || json === undefined)
        return void callback(null, null)
    var context = new Context(parentContext, schema, json, callback, customArgs)
    var target = schema.factory(context)
    // todo async invariant
    invariant(!!target, "No object returned from factory")
    // TODO: make invariant?            invariant(schema.extends || !target.constructor.prototype.constructor.serializeInfo, "object has a serializable supertype, but modelschema did not provide extends clause")
    context.target = target
    var lock = context.createCallback(GUARDED_NOOP)
    deserializePropsWithSchema(context, schema, json, target)
    lock()
    return target
}

export function deserializePropsWithSchema(context, schema, json, target) {
    if (schema.extends)
        deserializePropsWithSchema(context, schema.extends, json, target)
    Object.keys(schema.props).forEach(function (propName) {
        var propDef = schema.props[propName]
        if (propName === "*") {
            invariant(propDef === true, "prop schema '*' can onle be used with 'true'")
            deserializeStarProps(schema, target, json)
            return
        }
        if (propDef === true)
            propDef = _defaultPrimitiveProp
        if (propDef === false)
            return
        var jsonAttr = propDef.jsonname || propName
        if (!(jsonAttr in json))
            return
        propDef.deserializer(
            json[jsonAttr],
            // for individual props, use root context based callbacks
            // this allows props to complete after completing the object itself
            // enabling reference resolving and such
            context.rootContext.createCallback(function (value) {
                if (value !== SKIP){
                    target[propName] = value
                }
            }),
            context,
            target[propName] // initial value
        )
    })
}

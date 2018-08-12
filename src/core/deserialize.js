/*
 * Deserialization
 */
import {invariant, isPrimitive, isModelSchema, parallel, GUARDED_NOOP} from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import {SKIP, _defaultPrimitiveProp} from "../constants"
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

function onBeforeDeserialize(jsonValue, jsonParentValue, propName, context, propDef) {
    var cancel = false
    if (propDef && typeof propDef.beforeDeserialize === "function") {
        var result = propDef.beforeDeserialize(jsonValue, jsonParentValue, propName, context, propDef)
        if (result) {
            if (result.jsonValue) {
                jsonValue = result.jsonValue
            }
            cancel = result.cancel === true
        }
    }
    return {jsonValue: jsonValue, cancel: cancel}
}

function onAfterDeserialize(err, value, jsonValue, targetPropertyName, context, propDef) {
    var result = {}
    if (propDef && typeof propDef.afterDeserialize === "function") {
        result = propDef.afterDeserialize(err, value, jsonValue, targetPropertyName, context, propDef)
    }
    return result
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

export function deserializeObjectWithSchema(parentContext, modelSchema, json, callback, customArgs) {
    if (json === null || json === undefined)
        return void callback(null, null)
    var context = new Context(parentContext, modelSchema, json, callback, customArgs)
    var target = modelSchema.factory(context)
    // todo async invariant
    invariant(!!target, "No object returned from factory")
    // TODO: make invariant?            invariant(schema.extends || !target.constructor.prototype.constructor.serializeInfo, "object has a serializable supertype, but modelschema did not provide extends clause")
    context.target = target
    var lock = context.createCallback(GUARDED_NOOP)
    deserializePropsWithSchema(context, modelSchema, json, target)
    lock()
    return target
}

export function deserializePropsWithSchema(context, modelSchema, json, target) {
    if (modelSchema.extends)
        deserializePropsWithSchema(context, modelSchema.extends, json, target)

    function deserializeProp(propDef, jsonValue, propName) {
        propDef.deserializer(
            jsonValue,
            // for individual props, use root context based callbacks
            // this allows props to complete after completing the object itself
            // enabling reference resolving and such
            context.rootContext.createCallback(
                function (value) {
                    if (value !== SKIP) {
                        target[propName] = value
                        onAfterDeserialize(null, value, jsonValue, propName, context, propDef)
                    }
                },
                function (err, value) {
                    var isError = true
                    if (typeof propDef.afterDeserialize === "function") {
                        var res = onAfterDeserialize(err, value, jsonValue, propName, context, propDef)
                        if (res && res.continueOnError === true) {
                            isError = false
                            if (res.retryJsonValue !== undefined) {
                                deserializeProp(propDef, res.retryJsonValue, propName)
                            }
                        }
                    }
                    return isError
                }),
            context,
            target[propName] // initial value
        )
    }

    Object.keys(modelSchema.props).forEach(function (propName) {
        var propDef = modelSchema.props[propName]
        if (propName === "*") {
            invariant(propDef === true, "prop schema '*' can only be used with 'true'")
            deserializeStarProps(modelSchema, target, json)
            return
        }
        if (propDef === true)
            propDef = _defaultPrimitiveProp
        if (propDef === false)
            return
        var jsonAttr = propDef.jsonname || propName
        var jsonValue = json[jsonAttr]
        var resBefore = onBeforeDeserialize(jsonValue, json, jsonAttr, context, propDef)
        jsonValue = resBefore.jsonValue
        if (resBefore.cancel || !(jsonAttr in json) && jsonValue === undefined)
            return
        deserializeProp(propDef, jsonValue, propName)
    })
}

/*
 * Deserialization
 */
import { invariant, isPrimitive, isModelSchema, parallel, GUARDED_NOOP } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import { SKIP, _defaultPrimitiveProp } from "../constants"
import Context from "./Context"
import {checkStarSchemaInvariant} from "./serialize";

function schemaHasAlias(schema, name) {
    for (var key in schema.props)
        if (typeof schema.props[key] === "object" && schema.props[key].jsonname === name)
            return true
    return false
}

function deserializeStarProps(context, schema, propDef, obj, json) {
    checkStarSchemaInvariant(propDef)
    for (var key in json) if (!(key in schema.props) && !schemaHasAlias(schema, key)) {
        var jsonValue = json[key]
        if (propDef === true) {
            // when deserializing we don't want to silently ignore 'unparseable data' to avoid
            // confusing bugs
            invariant(isPrimitive(jsonValue),
                "encountered non primitive value while deserializing '*' properties in property '" +
                key + "': " + jsonValue)
            obj[key] = jsonValue
        } else if (propDef.pattern.test(key)) {
            if (propDef.factory) {
                var resultValue = deserializeObjectWithSchema(context, propDef, jsonValue, context.callback || GUARDED_NOOP, {})
                // deserializeObjectWithSchema returns undefined on error
                if (resultValue !== undefined) {
                    obj[key] = resultValue;
                }
            } else {
                function setValue(resultValue) {
                    if (resultValue !== SKIP) {
                        obj[key] = resultValue
                    }
                }
                propDef.deserializer(jsonValue,
                    // for individual props, use root context based callbacks
                    // this allows props to complete after completing the object itself
                    // enabling reference resolving and such
                    context.rootContext.createCallback(setValue),
                    context)
            }
        }
    }
}

/**
 * Deserializes a json structure into an object graph.
 *
 * This process might be asynchronous (for example if there are references with an asynchronous
 * lookup function). The function returns an object (or array of objects), but the returned object
 * might be incomplete until the callback has fired as well (which might happen immediately)
 *
 * @param {object|array} schema to use for deserialization
 * @param {json} json data to deserialize
 * @param {function} callback node style callback that is invoked once the deserialization has
 *   finished. First argument is the optional error, second argument is the deserialized object
 *   (same as the return value)
 * @param {*} customArgs custom arguments that are available as `context.args` during the
 *   deserialization process. This can be used as dependency injection mechanism to pass in, for
 *   example, stores.
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
    if (json === null || json === undefined || typeof json !== "object")
        return void callback(null, null)
    var context = new Context(parentContext, modelSchema, json, callback, customArgs)
    var target = modelSchema.factory(context)
    // todo async invariant
    invariant(!!target, "No object returned from factory")
    // TODO: make invariant?            invariant(schema.extends ||
    // !target.constructor.prototype.constructor.serializeInfo, "object has a serializable
    // supertype, but modelschema did not provide extends clause")
    context.setTarget(target)
    var lock = context.createCallback(GUARDED_NOOP)
    deserializePropsWithSchema(context, modelSchema, json, target)
    lock()
    return target
}

export function deserializePropsWithSchema(context, modelSchema, json, target) {
    if (modelSchema.extends)
        deserializePropsWithSchema(context, modelSchema.extends, json, target)

    function deserializeProp(propDef, jsonValue, propName) {

        function setValue(value) {
            if (value !== SKIP) {
                target[propName] = value
            }
        }

        function preProcess(resultCallback) {
            return function (err, newValue) {
                function finalCallback(errPreliminary, finalOrRetryValue) {
                    if (errPreliminary && finalOrRetryValue !== undefined &&
                        typeof propDef.afterDeserialize === "function") {

                        propDef.deserializer(
                            finalOrRetryValue,
                            preProcess(resultCallback),
                            context,
                            target[propName]
                        )
                    } else {
                        resultCallback(errPreliminary, finalOrRetryValue)
                    }
                }

                onAfterDeserialize(finalCallback, err, newValue, jsonValue, json,
                    propName, context, propDef)
            }
        }

        propDef.deserializer(
            jsonValue,
            // for individual props, use root context based callbacks
            // this allows props to complete after completing the object itself
            // enabling reference resolving and such
            preProcess(context.rootContext.createCallback(setValue)),
            context,
            target[propName] // initial value
        )
    }

    Object.keys(modelSchema.props).forEach(function (propName) {
        var propDef = modelSchema.props[propName]

        function callbackDeserialize(err, jsonValue) {
            if (!err && jsonValue !== undefined) {
                deserializeProp(propDef, jsonValue, propName)
            }
        }
        if (propName === "*") {
            deserializeStarProps(context, modelSchema, propDef, target, json)
            return
        }
        if (propDef === true)
            propDef = _defaultPrimitiveProp
        if (propDef === false)
            return
        var jsonAttr = propDef.jsonname || propName
        var jsonValue = json[jsonAttr]
        onBeforeDeserialize(callbackDeserialize, jsonValue, json, jsonAttr, context, propDef)
    })
}


export function onBeforeDeserialize(
    callback, jsonValue, jsonParentValue, propNameOrIndex, context, propDef) {

    if (propDef && typeof propDef.beforeDeserialize === "function") {
        propDef.beforeDeserialize(callback, jsonValue, jsonParentValue, propNameOrIndex, context,
            propDef)
    } else {
        callback(null, jsonValue)
    }
}

export function onAfterDeserialize(
    callback, err, newValue, jsonValue, jsonParentValue, propNameOrIndex, context, propDef) {

    if (propDef && typeof propDef.afterDeserialize === "function") {
        propDef.afterDeserialize(callback, err, newValue, jsonValue, jsonParentValue,
            propNameOrIndex, context, propDef)
    } else {
        callback(err, newValue)
    }
}


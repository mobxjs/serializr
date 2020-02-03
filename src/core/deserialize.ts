/*
 * Deserialization
 */
import { invariant, isPrimitive, isModelSchema, parallel, GUARDED_NOOP } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import { SKIP, _defaultPrimitiveProp } from "../constants"
import Context from "./Context"
import {
    ClazzOrModelSchema,
    AfterDeserializeFunc,
    BeforeDeserializeFunc,
    PropSchema,
    ModelSchema,
    PropDef
} from "../api/types"

function schemaHasAlias(schema: ModelSchema<any>, name: string) {
    for (const key in schema.props) {
        const propSchema = schema.props[key]
        if (typeof propSchema === "object" && propSchema.jsonname === name) return true
    }
    return false
}

function deserializeStarProps(
    context: Context,
    schema: ModelSchema<any>,
    propDef: PropDef,
    obj: any,
    json: any
) {
    for (const key in json)
        if (!(key in schema.props) && !schemaHasAlias(schema, key)) {
            const jsonValue = json[key]
            if (propDef === true) {
                // when deserializing we don't want to silently ignore 'unparseable data' to avoid
                // confusing bugs
                invariant(
                    isPrimitive(jsonValue),
                    "encountered non primitive value while deserializing '*' properties in property '" +
                        key +
                        "': " +
                        jsonValue
                )
                obj[key] = jsonValue
            } else if (propDef && (!propDef.pattern || propDef.pattern.test(key))) {
                propDef.deserializer(
                    jsonValue,
                    // for individual props, use root context based callbacks
                    // this allows props to complete after completing the object itself
                    // enabling reference resolving and such
                    context.rootContext.createCallback(r => r !== SKIP && (obj[key] = r)),
                    context
                )
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
 * @param schema to use for deserialization
 * @param json data to deserialize
 * @param callback node style callback that is invoked once the deserialization has
 *   finished. First argument is the optional error, second argument is the deserialized object
 *   (same as the return value)
 * @param customArgs custom arguments that are available as `context.args` during the
 *   deserialization process. This can be used as dependency injection mechanism to pass in, for
 *   example, stores.
 * @returns deserialized object, possibly incomplete.
 */
export default function deserialize<T>(
    modelschema: ClazzOrModelSchema<T>,
    jsonArray: any[],
    callback?: (err: any, result: T[]) => void,
    customArgs?: any
): T[]
export default function deserialize<T>(
    modelschema: ClazzOrModelSchema<T>,
    json: any,
    callback?: (err: any, result: T) => void,
    customArgs?: any
): T
export default function deserialize<T>(
    clazzOrModelSchema: ClazzOrModelSchema<T>,
    json: any | any[],
    callback: (err?: any, result?: T | T[]) => void = GUARDED_NOOP,
    customArgs?: any
): T | T[] {
    invariant(arguments.length >= 2, "deserialize expects at least 2 arguments")
    const schema = getDefaultModelSchema(clazzOrModelSchema)
    invariant(isModelSchema(schema), "first argument should be model schema")
    if (Array.isArray(json)) {
        const items: any[] = []
        parallel(
            json,
            function(childJson, itemDone) {
                const instance = deserializeObjectWithSchema(
                    undefined,
                    schema,
                    childJson,
                    itemDone,
                    customArgs
                )
                // instance is created synchronously so can be pushed
                items.push(instance)
            },
            callback
        )
        return items
    } else {
        return deserializeObjectWithSchema(undefined, schema, json, callback, customArgs)
    }
}

export function deserializeObjectWithSchema(
    parentContext: Context<any> | undefined,
    modelSchema: ModelSchema<any>,
    json: any,
    callback: (err?: any, value?: any) => void,
    customArgs: any
) {
    if (json === null || json === undefined || typeof json !== "object")
        return void callback(null, null)
    const context = new Context(parentContext, modelSchema, json, callback, customArgs)
    const target = modelSchema.factory(context)
    // todo async invariant
    invariant(!!target, "No object returned from factory")
    // TODO: make invariant?            invariant(schema.extends ||
    // !target.constructor.prototype.constructor.serializeInfo, "object has a serializable
    // supertype, but modelschema did not provide extends clause")
    context.setTarget(target)
    const lock = context.createCallback(GUARDED_NOOP)
    deserializePropsWithSchema(context, modelSchema, json, target)
    lock()
    return target
}

export function deserializePropsWithSchema<T>(
    context: Context<T>,
    modelSchema: ModelSchema<T>,
    json: any,
    target: T
) {
    if (modelSchema.extends) deserializePropsWithSchema(context, modelSchema.extends, json, target)

    function deserializeProp(propDef: PropSchema, jsonValue: object, propName: keyof T) {
        function preProcess(resultCallback: (err: any, result: any) => void) {
            return function(err: any, newValue: any) {
                function finalCallback(errPreliminary: any, finalOrRetryValue: any) {
                    if (
                        errPreliminary &&
                        finalOrRetryValue !== undefined &&
                        typeof propDef.afterDeserialize === "function"
                    ) {
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

                onAfterDeserialize(
                    finalCallback,
                    err,
                    newValue,
                    jsonValue,
                    json,
                    propName,
                    context,
                    propDef
                )
            }
        }

        propDef.deserializer(
            jsonValue,
            // for individual props, use root context based callbacks
            // this allows props to complete after completing the object itself
            // enabling reference resolving and such
            preProcess(
                context.rootContext.createCallback(r => r !== SKIP && (target[propName] = r))
            ),
            context,
            target[propName] // initial value
        )
    }

    for (const key of Object.keys(modelSchema.props) as (keyof T)[]) {
        let propDef: PropDef = modelSchema.props[key]
        if (!propDef) return

        if (key === "*") {
            deserializeStarProps(context, modelSchema, propDef, target, json)
            return
        }
        if (propDef === true) propDef = _defaultPrimitiveProp
        const jsonAttr = propDef.jsonname ?? key
        invariant("symbol" !== typeof jsonAttr, "You must alias symbol properties. prop = %l", key)
        const jsonValue = json[jsonAttr]
        const propSchema = propDef
        const callbackDeserialize = (err: any, jsonValue: any) => {
            if (!err && jsonValue !== undefined) {
                deserializeProp(propSchema, jsonValue, key)
            }
        }
        onBeforeDeserialize(
            callbackDeserialize,
            jsonValue,
            json,
            jsonAttr as string | number,
            context,
            propDef
        )
    }
}

export const onBeforeDeserialize: BeforeDeserializeFunc = (
    callback,
    jsonValue,
    jsonParentValue,
    propNameOrIndex,
    context,
    propDef
) => {
    if (propDef && typeof propDef.beforeDeserialize === "function") {
        propDef.beforeDeserialize(
            callback,
            jsonValue,
            jsonParentValue,
            propNameOrIndex,
            context,
            propDef
        )
    } else {
        callback(null, jsonValue)
    }
}

export const onAfterDeserialize: AfterDeserializeFunc = (
    callback,
    err,
    newValue,
    jsonValue,
    jsonParentValue,
    propNameOrIndex,
    context,
    propDef
) => {
    if (propDef && typeof propDef.afterDeserialize === "function") {
        propDef.afterDeserialize(
            callback,
            err,
            newValue,
            jsonValue,
            jsonParentValue,
            propNameOrIndex,
            context,
            propDef
        )
    } else {
        callback(err, newValue)
    }
}

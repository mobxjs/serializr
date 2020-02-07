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
    Schema,
    ModelSchema,
    PropDef
} from "../api/types"

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
        return deserializeWithSchema(schema, json, callback, customArgs)
    }
}

export function deserializeWithSchema(
    schema: Schema,
    jsonValue: any,
    callback: (err?: any, value?: any) => void,
    customArgs: any
) {
    const context = new Context(schema, jsonValue, callback, customArgs)
    doDeserialize(callback, jsonValue, undefined, undefined, context, schema)
}
export function doDeserialize(
    callback: (err?: any, value?: any) => void,
    jsonValue: any,
    jsonParentValue: any,
    jsonPropNameOrIndex: symbol | number | string,
    context: Context,
    schema: Schema
) {
    const serialize: (err: any, value: any) => void = (err, preprocessedJsonValue) =>
        schema.deserializer(
            preprocessedJsonValue,
            schema.afterDeserialize
                ? (err, newValue) =>
                      schema.afterDeserialize(
                          callback,
                          err,
                          newValue,
                          preprocessedJsonValue,
                          jsonParentValue,
                          jsonPropNameOrIndex,
                          context,
                          schema
                      )
                : callback,
            context
        )
    if (schema.beforeDeserialize) {
        schema.beforeDeserialize(
            serialize,
            jsonValue,
            jsonParentValue,
            jsonPropNameOrIndex,
            context,
            schema
        )
    } else {
        serialize(undefined, jsonValue)
    }
}

import {
    invariant,
    isModelSchema,
    processAdditionalPropArgs,
    GUARDED_NOOP,
    isPrimitive
} from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import serialize from "../core/serialize"
import { ClazzOrModelSchema, AdditionalPropArgs, Schema, ModelSchema, PropDef } from "../api/types"
import Context from "../core/Context"
import { doDeserialize } from "../core/deserialize"
import { _defaultPrimitiveProp, SKIP } from "../constants"

function schemaHasAlias(schema: ModelSchema<any>, name: string) {
    for (const key in schema.props) {
        const propSchema = schema.props[key]
        if (typeof propSchema === "object" && propSchema.jsonname === name) return true
    }
    return false
}

/**
 * `object` indicates that this property contains an object that needs to be (de)serialized
 * using its own model schema.
 *
 * N.B. mind issues with circular dependencies when importing model schema's from other files! The module resolve algorithm might expose classes before `createModelSchema` is executed for the target class.
 *
 * @example
 * class SubTask {}
 * class Todo {}
 *
 * createModelSchema(SubTask, {
 *     title: true,
 * })
 * createModelSchema(Todo, {
 *     title: true,
 *     subTask: object(SubTask),
 * })
 *
 * const todo = deserialize(Todo, {
 *     title: 'Task',
 *     subTask: {
 *         title: 'Sub task',
 *     },
 * })
 *
 * @param modelSchema to be used to (de)serialize the object
 * @param additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 */
export default function object(
    modelSchema: ClazzOrModelSchema<any>,
    additionalArgs?: AdditionalPropArgs
): Schema {
    invariant(
        typeof modelSchema === "object" || typeof modelSchema === "function",
        "No modelschema provided. If you are importing it from another file be aware of circular dependencies."
    )
    let result: Schema = {
        serializer: function(item) {
            modelSchema = getDefaultModelSchema(modelSchema)!
            invariant(isModelSchema(modelSchema), "expected modelSchema, got " + modelSchema)
            if (item === null || item === undefined) return item
            return serializePropsWithSchema(modelSchema, item)
        },
        deserializer: function(jsonValue, callback, context, currentPropValue, customArg) {
            modelSchema = getDefaultModelSchema(modelSchema)!

            if (jsonValue === null || jsonValue === undefined || typeof jsonValue !== "object")
                return void callback(null, null)
            const target = modelSchema.factory(context)
            // todo async invariant
            invariant(!!target, "No object returned from factory")
            // TODO: make invariant?            invariant(schema.extends ||
            // !target.constructor.prototype.constructor.serializeInfo, "object has a serializable
            // supertype, but modelschema did not provide extends clause")
            const lock = context.createCallback(GUARDED_NOOP)
            deserializePropsWithSchema(context, modelSchema, jsonValue, target)
            lock()
            return target
        }
    }
    result = Object.assign(modelSchema, result)
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

function serializePropsWithSchema<T>(schema: ModelSchema<T>, obj: any): T {
    invariant(schema && typeof schema === "object" && schema.props, "Expected schema")
    invariant(obj && typeof obj === "object", "Expected object")
    let res: any
    if (schema.extends) res = serializePropsWithSchema(schema.extends, obj)
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
                doDeserialize(
                    context.createCallback(r => r !== SKIP && (obj[key] = r)),
                    jsonValue,
                    json,
                    key,
                    context,
                    schema
                )
            }
        }
}
export function deserializePropsWithSchema<T>(
    context: Context<T>,
    modelSchema: ModelSchema<T>,
    json: any,
    target: any
) {
    if (modelSchema.extends) deserializePropsWithSchema(context, modelSchema.extends, json, target)

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
        doDeserialize(
            context.createCallback(r => {
                if (r === SKIP) return
                target[key] = r
                if (propSchema.identifier) {
                    context.resolve(modelSchema, r, target)
                }
            }),
            jsonValue,
            json,
            jsonAttr as string | number,
            context,
            propSchema
        )
    }
}

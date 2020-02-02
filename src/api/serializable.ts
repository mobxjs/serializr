import { invariant, isPropSchema, isAliasedPropSchema } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import primitive from "../types/primitive"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import createModelSchema from "../api/createModelSchema"
import { PropSchema, ModelSchema, PropDef } from "./types"
import Context from "../core/Context"

// Ugly way to get the parameter names since they aren't easily retrievable via reflection
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm
const ARGUMENT_NAMES = /([^\s,]+)/g

function getParamNames(func: Function) {
    const fnStr = func.toString().replace(STRIP_COMMENTS, "")
    return fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES) ?? []
}

function serializableDecorator(
    propSchema: PropSchema,
    target: any,
    propName: string,
    descriptor: PropertyDescriptor | undefined
) {
    invariant(
        arguments.length >= 2,
        "too few arguments. Please use @serializable as property decorator"
    )
    // Fix for @serializable used in class constructor params (typescript)
    let factory
    if (
        propName === undefined &&
        typeof target === "function" &&
        target.prototype &&
        descriptor !== undefined &&
        typeof descriptor === "number"
    ) {
        invariant(isPropSchema(propSchema), "Constructor params must use alias(name)")
        invariant(isAliasedPropSchema(propSchema), "Constructor params must use alias(name)")
        const paramNames = getParamNames(target)
        if (paramNames.length >= descriptor) {
            propName = paramNames[descriptor]
            propSchema.paramNumber = descriptor
            descriptor = undefined
            target = target.prototype
            // Create a factory so the constructor is called properly
            factory = function(context: Context) {
                const params: any = []
                for (let i = 0; i < target.constructor.length; i++) {
                    Object.keys(context.modelSchema.props).forEach(function(key) {
                        const prop = context.modelSchema.props[key]
                        if ((prop as PropSchema).paramNumber === i) {
                            params[i] = context.json[(prop as PropSchema).jsonname!]
                        }
                    })
                }

                return target.constructor.bind(undefined, ...params)
            }
        }
    }
    invariant(typeof propName === "string", "incorrect usage of @serializable decorator")
    let info: ModelSchema<any> | undefined = getDefaultModelSchema(target)

    if (!info || !target.constructor.hasOwnProperty("serializeInfo"))
        info = createModelSchema(target.constructor, {}, factory)
    if (info && info.targetClass !== target.constructor)
        // fixes typescript issue that tends to copy fields from super constructor to sub constructor in extends
        info = createModelSchema(target.constructor, {}, factory)
    info.props[propName] = propSchema
    // MWE: why won't babel work without?
    if (descriptor && !descriptor.get && !descriptor.set) descriptor.writable = true
    return descriptor
}

/**
 * Decorator that defines a new property mapping on the default model schema for the class
 * it is used in.
 *
 * When using typescript, the decorator can also be used on fields declared as constructor arguments (using the `private` / `protected` / `public` keywords).
 * The default factory will then invoke the constructor with the correct arguments as well.
 *
 * @example
 * class Todo {
 *     \@serializable(primitive())
 *     title // shorthand for primitves
 *
 *     \@serializable
 *     done
 *
 *     constructor(title, done) {
 *         this.title = title
 *         this.done = done
 *     }
 * }
 *
 * const json = serialize(new Todo('Test', false))
 * const todo = deserialize(Todo, json)
 */
export default function serializable(
    propSchema: PropDef
): (target: any, key: string, baseDescriptor?: PropertyDescriptor) => void
export default function serializable(
    target: any,
    key: string,
    baseDescriptor?: PropertyDescriptor
): void
export default function serializable(
    targetOrPropSchema: any | PropDef,
    key?: string,
    baseDescriptor?: PropertyDescriptor
) {
    if (!key) {
        // decorated with propSchema
        const propSchema =
            targetOrPropSchema === true ? _defaultPrimitiveProp : (targetOrPropSchema as PropSchema)
        invariant(isPropSchema(propSchema), "@serializable expects prop schema")
        const result: (
            target: Object,
            key: string,
            baseDescriptor: PropertyDescriptor
        ) => void = serializableDecorator.bind(null, propSchema)
        return result
    } else {
        // decorated without arguments, treat as primitive
        serializableDecorator(primitive(), targetOrPropSchema, key, baseDescriptor!)
    }
}

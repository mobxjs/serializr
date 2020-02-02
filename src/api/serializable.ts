import { invariant, isPropSchema } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import primitive from "../types/primitive"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import createModelSchema from "../api/createModelSchema"

// Ugly way to get the parameter names since they aren't easily retrievable via reflection
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm
var ARGUMENT_NAMES = /([^\s,]+)/g

function getParamNames(func) {
    var fnStr = func.toString().replace(STRIP_COMMENTS, "")
    var result = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES)
    if (result === null) result = []
    return result
}

function serializableDecorator(propSchema, target, propName, descriptor) {
    invariant(
        arguments.length >= 2,
        "too few arguments. Please use @serializable as property decorator"
    )
    // Fix for @serializable used in class constructor params (typescript)
    var factory
    if (
        propName === undefined &&
        typeof target === "function" &&
        target.prototype &&
        descriptor !== undefined &&
        typeof descriptor === "number"
    ) {
        invariant(isPropSchema(propSchema), "Constructor params must use alias(name)")
        invariant(propSchema.jsonname, "Constructor params must use alias(name)")
        var paramNames = getParamNames(target)
        if (paramNames.length >= descriptor) {
            propName = paramNames[descriptor]
            propSchema.paramNumber = descriptor
            descriptor = undefined
            target = target.prototype
            // Create a factory so the constructor is called properly
            factory = function(context) {
                var params = []
                for (var i = 0; i < target.constructor.length; i++) {
                    Object.keys(context.modelSchema.props).forEach(function(key) {
                        var prop = context.modelSchema.props[key]
                        if (prop.paramNumber === i) {
                            params[i] = context.json[prop.jsonname]
                        }
                    })
                }

                return new (Function.prototype.bind.apply(
                    target.constructor,
                    [null].concat(params)
                ))()
            }
        }
    }
    invariant(typeof propName === "string", "incorrect usage of @serializable decorator")
    var info = getDefaultModelSchema(target)

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
 *     @serializable(primitive())
 *     title; // shorthand for primitves
 *
 *     @serializable done;
 *
 *     constructor(title, done) {
 *         this.title = title;
 *         this.done = done;
 *     }
 * }
 *
 * var json = serialize(new Todo('Test', false));
 * var todo = deserialize(Todo, json);
 *
 * @param arg1
 * @param arg2
 * @param arg3
 * @returns {PropertyDescriptor}
 */
export default function serializable(arg1, arg2, arg3) {
    if (arguments.length === 1) {
        // decorated with propSchema
        var propSchema = arg1 === true ? _defaultPrimitiveProp : arg1
        invariant(isPropSchema(propSchema), "@serializable expects prop schema")
        return serializableDecorator.bind(null, propSchema)
    } else {
        // decorated without arguments, treat as primitive
        return serializableDecorator(primitive(), arg1, arg2, arg3)
    }
}

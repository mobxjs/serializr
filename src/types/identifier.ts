import { invariant, processAdditionalPropArgs } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import { AdditionalPropArgs, PropSchema, RegisterFunction } from "../api/types"

const defaultRegisterFunction: RegisterFunction = (id, value, context) => {
    context.rootContext.resolve(context.modelSchema, id, context.target)
}

/**
 *
 *
 * Similar to primitive, but this field will be marked as the identifier for the given Model type.
 * This is used by for example `reference()` to serialize the reference
 *
 * Identifier accepts an optional `registerFn` with the signature:
 * `(id, target, context) => void`
 * that can be used to register this object in some store. note that not all fields of this object might
 * have been deserialized yet.
 *
 * @example
 * const todos = {}
 *
 * const s = createSimpleSchema({
 *     id: identifier((id, object) => (todos[id] = object)),
 *     title: true,
 * })
 *
 * deserialize(s, {
 *     id: 1,
 *     title: 'test0',
 * })
 * deserialize(s, [{ id: 2, title: 'test2' }, { id: 1, title: 'test1' }])
 *
 * t.deepEqual(todos, {
 *     1: { id: 1, title: 'test1' },
 *     2: { id: 2, title: 'test2' },
 * })
 *
 * @param { RegisterFunction | AdditionalPropArgs } arg1 optional registerFn: function to register this object during creation.
 * @param {AdditionalPropArgs} arg2 optional object that contains beforeDeserialize and/or afterDeserialize handlers
 *
 * @returns {PropSchema}
 */
export function identifier(
    registerFn?: RegisterFunction,
    additionalArgs?: AdditionalPropArgs
): PropSchema
export function identifier(additionalArgs: AdditionalPropArgs): PropSchema
export default function identifier(
    arg1?: RegisterFunction | AdditionalPropArgs,
    arg2?: AdditionalPropArgs
) {
    let registerFn: RegisterFunction
    let additionalArgs: AdditionalPropArgs | undefined
    if (typeof arg1 === "function") {
        registerFn = arg1
        additionalArgs = arg2
    } else {
        additionalArgs = arg1
    }
    invariant(
        !additionalArgs || typeof additionalArgs === "object",
        "Additional property arguments should be an object, register function should be omitted or a funtion"
    )
    let result: PropSchema = {
        identifier: true,
        serializer: _defaultPrimitiveProp.serializer,
        deserializer: function(jsonValue, done, context) {
            _defaultPrimitiveProp.deserializer(
                jsonValue,
                function(err, id) {
                    defaultRegisterFunction(id, context.target, context)
                    if (registerFn) registerFn(id, context.target, context)
                    done(err, id)
                },
                context
            )
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

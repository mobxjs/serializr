import { invariant, processAdditionalPropArgs } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import { AdditionalPropArgs, Schema, RegisterFunction } from "../api/types"

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
 * @param arg1 optional registerFn: function to register this object during creation.
 * @param arg2 optional object that contains beforeDeserialize and/or afterDeserialize handlers
 *
 */
export function identifier(
    registerFn?: RegisterFunction,
    additionalArgs?: AdditionalPropArgs
): Schema
export function identifier(additionalArgs: AdditionalPropArgs): Schema
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
    let result: Schema = {
        identifier: true,
        // registerFn,
        serializer: _defaultPrimitiveProp.serializer,
        deserializer: _defaultPrimitiveProp.deserializer
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

import { invariant } from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"

function defaultRegisterFunction(id, value, context) {
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
 * var todos = {};
 * 
 * var s = _.createSimpleSchema({
 *     id: _.identifier((id, object) => (todos[id] = object)),
 *     title: true,
 * });
 * 
 * _.deserialize(s, {
 *     id: 1,
 *     title: 'test0',
 * });
 * _.deserialize(s, [{ id: 2, title: 'test2' }, { id: 1, title: 'test1' }]);
 * 
 * t.deepEqual(todos, {
 *     1: { id: 1, title: 'test1' },
 *     2: { id: 2, title: 'test2' },
 * });
 *
 * @param {RegisterFunction} registerFn optional function to register this object during creation.
 *
 * @returns {PropSchema}
 */
export default function identifier(registerFn) {
    invariant(!registerFn || typeof registerFn === "function", "First argument should be omitted or function")
    return {
        identifier: true,
        serializer: _defaultPrimitiveProp.serializer,
        deserializer: function (jsonValue, done, context) {
            _defaultPrimitiveProp.deserializer(jsonValue, function(err, id) {
                defaultRegisterFunction(id, context.target, context)
                if (registerFn)
                    registerFn(id, context.target, context)
                done(err, id)
            })
        }
    }
}
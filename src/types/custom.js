import { invariant } from "../utils/utils"

/**
 * Can be used to create simple custom propSchema. Multiple things can be done inside of a custom propSchema, like deserializing and serializing other (polymorphic) objects, skipping the serialization of something or checking the context of the obj being (de)serialized.

 * The `custom` function takes two parameters, the `serializer` function and the `deserializer` function.

 * The `serializer` function has the signature:
 * `(value, key, obj) => void`

 * When serializing the object `{a: 1}` the `serializer` function will be called with `serializer(1, 'a', {a: 1})`.

 * The `deserializer` function has the signature:
 * `(value, context) => void`

 * When deserializing the object `{b: 2}` the `deserializer` function will be called with `deserializer(2, contextObj)` ([contextObj reference](https://github.com/mobxjs/serializr#deserialization-context)).
 *
 * @example
 * var schema = _.createSimpleSchema({
 *     a: _.custom(
 *         function(v) {
 *             return v + 2;
 *         },
 *         function(v) {
 *             return v - 2;
 *         }
 *     ),
 * });
 * t.deepEqual(_.serialize(s, { a: 4 }), { a: 6 });
 * t.deepEqual(_.deserialize(s, { a: 6 }), { a: 4 });
 *
 * @param {function} serializer function that takes a model value and turns it into a json value. It also takes context argument, which can allow you to add a global callback to the ending of serialization.
 * @param {function} deserializer function that takes a json value and turns it into a model value. It also takes context argument, which can allow you to deserialize based on the context of other parameters.
 * @returns {PropSchema}
 */
export default function custom(serializer, deserializer) {
    invariant(typeof serializer === "function", "first argument should be function")
    invariant(typeof deserializer === "function", "second argument should be function")
    return {
        serializer: serializer,
        deserializer: function (jsonValue, done, context, oldValue) {
            done(null, deserializer(jsonValue, context, oldValue))
        }
    }
}

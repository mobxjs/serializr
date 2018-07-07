import { invariant } from "../utils/utils"

/**
 * Can be used to create asynchronous custom propSchema. Multiple things can be done inside of a custom propSchema, like deserializing and serializing other (polymorphic) objects, skipping the serialization of something or checking the context of the obj being (de)serialized.
 * In comparison to the 'custom' propSchema it is possible to wait for asynchronous deserialization steps. This allows e.g. resolution of references during the deserialization process (using context.await..

 * The `customAsync` function takes two parameters, the `serializer` function and the `deserializer` function.

 * The `serializer` function has the signature:
 * `(value, key, obj) => void`

 * When serializing the object `{a: 1}` the `serializer` function will be called with `serializer(1, 'a', {a: 1})`.

 * The `deserializer` function has the signature:
 * `(value, callback, context, oldValue) => void`

 * The `callback` function has the signature:
 * `(error, result) => void`

 * When deserializing the object `{b: 2}` the `deserializer` function will be called with `deserializer(2, callback, contextObj, oldValue)` ([contextObj reference](https://github.com/mobxjs/serializr#deserialization-context)).
 *
 * @example
 * var schema = _.createSimpleSchema({
 *     a: _.customAsync(
 *         function(v) {
 *             return v + 2;
 *         },
 *         function(v, callback, context, oldValue) {
 *             somePromise(v, context, oldValue).then((result) => {
 *                 callback(null, result - 2)
 *             }.catch((err) => {
 *                 callback(err)
 *             }
 *         }
 *     ),
 * });
 * t.deepEqual(_.serialize(s, { a: 4 }), { a: 6 });
 * _.deserialize(s, { a: 6 }, (err, res) => {
 *   t.deepEqual(res.a, 4)
 * };
 *
 * @param {function} serializer function that takes a model value and turns it into a json value
 * @param {function} deserializer function that takes a json value and turns it into a model value. It also receives a callback function to notify the caller about the completion of the deserialization. It also takes context argument, which can allow you to deserialize based on the context of other parameters.
 * @returns {PropSchema}
 */
export default function customAsync(serializer, deserializer) {
    invariant(typeof serializer === "function", "first argument should be function")
    invariant(typeof deserializer === "function", "second argument should be function")
    return {
        serializer: serializer,
        deserializer: function (jsonValue, done, context, oldValue) {
            deserializer(jsonValue, done, context, oldValue)
        }
    }
}

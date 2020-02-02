import { invariant, processAdditionalPropArgs } from "../utils/utils"

/**
 * Can be used to create simple custom propSchema. Multiple things can be done inside of a custom propSchema, like deserializing and serializing other (polymorphic) objects, skipping the serialization of something or checking the context of the obj being (de)serialized.

 * The `custom` function takes two parameters, the `serializer` function and the `deserializer` function.

 * The `serializer` function has the signature:
 * `(value, key, obj) => void`

 * When serializing the object `{a: 1}` the `serializer` function will be called with `serializer(1, 'a', {a: 1})`.

 * The `deserializer` function has the following signature for synchronous processing
 * `(value, context, oldValue) => void`

 * For asynchronous processing the function expects the following signature
 * `(value, context, oldValue, callback) => void`

 * When deserializing the object `{b: 2}` the `deserializer` function will be called with `deserializer(2, contextObj)` ([contextObj reference](https://github.com/mobxjs/serializr#deserialization-context)).
 *
 * @example
 * var schemaDefault = _.createSimpleSchema({
 *     a: _.custom(
 *         function(v) {
 *             return v + 2;
 *         },
 *         function(v) {
 *             return v - 2;
 *         }
 *     ),
 * });
 * t.deepEqual(_.serialize(schemaDefault, { a: 4 }), { a: 6 });
 * t.deepEqual(_.deserialize(schemaDefault, { a: 6 }), { a: 4 });
 *
 * var schemaWithAsyncProps = _.createSimpleSchema({
 *     a: _.customAsync(
 *         function(v) {
 *             return v + 2;
 *         },
 *         function(v, context, oldValue, callback) {
 *             somePromise(v, context, oldValue).then((result) => {
 *                 callback(null, result - 2)
 *             }.catch((err) => {
 *                 callback(err)
 *             }
 *         }
 *     ),
 * });
 * t.deepEqual(_.serialize(schemaWithAsyncProps, { a: 4 }), { a: 6 });
 * _.deserialize(schemaWithAsyncProps, { a: 6 }, (err, res) => {
 *   t.deepEqual(res.a, 4)
 * };

 *
 * @param {function} serializer function that takes a model value and turns it into a json value
 * @param {function} deserializer function that takes a json value and turns it into a model value. It also takes context argument, which can allow you to deserialize based on the context of other parameters.
 * @param {AdditionalPropArgs} additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 * @returns {PropSchema}
 */
export default function custom(serializer, deserializer, additionalArgs) {
    invariant(typeof serializer === "function", "first argument should be function")
    invariant(typeof deserializer === "function", "second argument should be a function or promise")
    var result = {
        serializer: serializer,
        deserializer: function(jsonValue, done, context, oldValue) {
            if (deserializer.length === 4) {
                deserializer(jsonValue, context, oldValue, done, additionalArgs)
            } else {
                done(null, deserializer(jsonValue, context, oldValue, null, additionalArgs))
            }
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

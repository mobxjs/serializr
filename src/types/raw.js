/**
 * Indicates that this field is only need to putted in the serialized json or
 * deserialized instance, without any transformations. Stay with its original value
 *
 * @example
 * createModelSchema(Model, {
 *     rawData: raw(),
 * });
 *
 * console.dir(serialize(new Model({ rawData: { a: 1, b: [], c: {} } } })));
 * // outputs: { rawData: { a: 1, b: [], c: {} } } }
 *
 * @returns {ModelSchema}
 */
export default function raw() {
    return {
        serializer: function (value) {
            return value
        },
        deserializer: function (jsonValue, done) {
            return void done(null, jsonValue)
        }
    }
}

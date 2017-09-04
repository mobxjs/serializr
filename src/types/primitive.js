import { invariant } from "../utils/utils"
import { isPrimitive } from "../utils/utils"

/**
 * Indicates that this field contains a primitive value (or Date) which should be serialized literally to json.
 *
 * @example
 * createModelSchema(Todo, {
 *     title: primitive(),
 * });
 *
 * console.dir(serialize(new Todo('test')));
 * // outputs: { title : "test" }
 *
 * @returns {ModelSchema}
 */
export default function primitive() {
    return {
        serializer: function (value) {
            invariant(isPrimitive(value), "this value is not primitive: " + value)
            return value
        },
        deserializer: function (jsonValue, done) {
            if (!isPrimitive(jsonValue))
                return void done("[serializr] this value is not primitive: " + jsonValue)
            return void done(null, jsonValue)
        }
    }
}

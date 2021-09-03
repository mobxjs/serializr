import deserialize from "../core/deserialize";
import serialize from "../core/serialize";
import { SKIP } from "../constants";
import custom from "./custom";
import { ClazzOrModelSchema } from "../api/types";

/**
 * This allows to embed the property values in the resulting json output
 * and vice-versa.
 *
 * @param type {ClazzOrModelSchema<T>} Some class or model schema.
 */
export default function embedded<T>(type: ClazzOrModelSchema<T>) {
    return custom(
        (value, _key, _sourceObject, jsonOutput) => {
            const serialized = serialize(value)
            Object.assign(jsonOutput, serialized)
            return SKIP
        },
        (_, context) => {
            return deserialize(type, context.json)
        },
        {
            beforeDeserialize(callback, jsonValue, jsonParentValue) {
                callback(null, null)
            }
        }
    )
}

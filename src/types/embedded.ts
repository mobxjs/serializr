import deserialize from "../core/deserialize";
import serialize from "../core/serialize";
import { SKIP } from "../constants";
import custom from "./custom";

interface Type<T> {
    new (...args: any[]): T
}

export default function embedded<T>(type: Type<T>) {
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

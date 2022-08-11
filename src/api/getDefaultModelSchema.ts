import { isModelSchema } from "../utils/utils";
import { ModelSchema } from "./types";

/**
 * Returns the standard model schema associated with a class / constructor function
 *
 */
export default function getDefaultModelSchema<T>(thing: any): ModelSchema<T> | undefined {
    if (!thing) return undefined;
    if (isModelSchema(thing)) return thing;
    if (isModelSchema(thing.serializeInfo)) return thing.serializeInfo;
    if (thing.constructor && thing.constructor.serializeInfo)
        return thing.constructor.serializeInfo;
}

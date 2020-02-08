/*
 * Update
 */

import { invariant, isModelSchema, GUARDED_NOOP } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import Context from "./Context"
import { deserializePropsWithSchema } from "./deserialize"
import { ClazzOrModelSchema } from "../api/types"

/**
 * Similar to deserialize, but updates an existing object instance.
 * Properties will always updated entirely, but properties not present in the json will be kept as is.
 * Further this method behaves similar to deserialize.
 *
 * @param target target instance to update
 * @param json the json to deserialize
 * @param modelSchema, optional if it can be inferred from the target type
 * @param customArgs custom arguments that are available as `context.args` during the deserialization process. This can be used as dependency injection mechanism to pass in, for example, stores.
 * @param callback the callback to invoke once deserialization has completed.
 * @returns deserialized object, possibly incomplete.
 */
export default function update<T>(
    target: T,
    json: any,
    modelSchema?: ClazzOrModelSchema<T>,
    customArgs?: any,
    callback?: any
) {
    modelSchema = getDefaultModelSchema(modelSchema || target)
    invariant(isModelSchema(modelSchema), "update failed to determine schema")
    invariant(
        typeof target === "object" && target && !Array.isArray(target),
        "update needs an object"
    )
    const context = new Context(undefined, modelSchema, json, callback || GUARDED_NOOP, customArgs)
    context.setTarget(target)
    const lock = context.createCallback(GUARDED_NOOP)
    const result = deserializePropsWithSchema(context, modelSchema, json, target)
    lock()
    return result
}

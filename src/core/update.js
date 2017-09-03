/*
 * Update
 */

import { invariant, isModelSchema, GUARDED_NOOP } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import Context from "./Context"
import { deserializePropsWithSchema } from "./deserialize"

/**
 * Similar to deserialize, but updates an existing object instance.
 * Properties will always updated entirely, but properties not present in the json will be kept as is.
 * Further this method behaves similar to deserialize.
 *
 * @param {object} modelSchema, optional if it can be inferred from the instance type
 * @param {object} target target instance to update
 * @param {object} json the json to deserialize
 * @param {function} callback the callback to invoke once deserialization has completed.
 * @param {*} customArgs custom arguments that are available as `context.args` during the deserialization process. This can be used as dependency injection mechanism to pass in, for example, stores.
 */
export default function update(modelSchema, target, json, callback, customArgs) {
    var inferModelSchema =
        arguments.length === 2 // only target and json
        || typeof arguments[2] === "function" // callback as third arg

    if (inferModelSchema) {
        target = arguments[0]
        modelSchema = getDefaultModelSchema(target)
        json = arguments[1]
        callback = arguments[2]
        customArgs = arguments[3]
    } else {
        modelSchema = getDefaultModelSchema(modelSchema)
    }
    invariant(isModelSchema(modelSchema), "update failed to determine schema")
    invariant(typeof target === "object" && target && !Array.isArray(target), "update needs an object")
    var context = new Context(null, modelSchema, json, callback, customArgs)
    context.target = target
    var lock = context.createCallback(GUARDED_NOOP)
    deserializePropsWithSchema(context, modelSchema, json, target)
    lock()
}

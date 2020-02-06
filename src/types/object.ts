import { invariant, isModelSchema, processAdditionalPropArgs } from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import serialize from "../core/serialize"
import { deserializeObjectWithSchema } from "../core/deserialize"
import { ClazzOrModelSchema, AdditionalPropArgs, PropSchema } from "../api/types"
import Context from "../core/Context"

/**
 * `object` indicates that this property contains an object that needs to be (de)serialized
 * using its own model schema.
 *
 * N.B. mind issues with circular dependencies when importing model schema's from other files! The module resolve algorithm might expose classes before `createModelSchema` is executed for the target class.
 *
 * @example
 * class SubTask {}
 * class Todo {}
 *
 * createModelSchema(SubTask, {
 *     title: true,
 * })
 * createModelSchema(Todo, {
 *     title: true,
 *     subTask: object(SubTask),
 * })
 *
 * const todo = deserialize(Todo, {
 *     title: 'Task',
 *     subTask: {
 *         title: 'Sub task',
 *     },
 * })
 *
 * @param modelSchema to be used to (de)serialize the object
 * @param additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 */
export default function object(
    modelSchema: ClazzOrModelSchema<any>,
    additionalArgs?: AdditionalPropArgs
): PropSchema {
    invariant(
        typeof modelSchema === "object" || typeof modelSchema === "function",
        "No modelschema provided. If you are importing it from another file be aware of circular dependencies."
    )
    let result: PropSchema = {
        serializer: function(item) {
            modelSchema = getDefaultModelSchema(modelSchema)!
            invariant(isModelSchema(modelSchema), "expected modelSchema, got " + modelSchema)
            if (item === null || item === undefined) return item
            return serialize(modelSchema, item)
        },
        deserializer: function(jsonValue, callback, parentContext) {
            modelSchema = getDefaultModelSchema(modelSchema)!

            if (jsonValue === null || jsonValue === undefined || typeof jsonValue !== "object")
                return void callback(null, null)
            const context = new Context(parentContext, modelSchema, jsonValue, callback, customArgs)
            const target = modelSchema.factory(context)
            // todo async invariant
            invariant(!!target, "No object returned from factory")
            // TODO: make invariant?            invariant(schema.extends ||
            // !target.constructor.prototype.constructor.serializeInfo, "object has a serializable
            // supertype, but modelschema did not provide extends clause")
            context.setTarget(target)
            const lock = context.createCallback(GUARDED_NOOP)
            deserializePropsWithSchema(context, modelSchema, jsonValue, target)
            lock()
            return target
            invariant(isModelSchema(modelSchema), "expected modelSchema, got " + modelSchema)
            if (jsonValue === null || jsonValue === undefined) return void callback(null, jsonValue)
            return void deserializeObjectWithSchema(
                parentContext,
                modelSchema,
                jsonValue,
                callback,
                undefined
            )
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

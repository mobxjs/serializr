import { SKIP } from "../constants"
import {
    invariant,
    isSchema,
    isAliasedSchema,
    parallel,
    processAdditionalPropArgs
} from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"
import { AdditionalPropArgs, Schema } from "../api/types"
import { doDeserialize } from "../core/deserialize"

/**
 * List indicates that this property contains a list of things.
 * Accepts a sub model schema to serialize the contents
 *
 * @example
 * class SubTask {}
 * class Task {}
 * class Todo {}
 *
 * createModelSchema(SubTask, {
 *     title: true,
 * })
 * createModelSchema(Todo, {
 *     title: true,
 *     subTask: list(object(SubTask)),
 * })
 *
 * const todo = deserialize(Todo, {
 *     title: 'Task',
 *     subTask: [
 *         {
 *             title: 'Sub task 1',
 *         },
 *     ],
 * })
 *
 * @param propSchema to be used to (de)serialize the contents of the array
 * @param additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 */
export default function list(propSchema: Schema, additionalArgs?: AdditionalPropArgs): Schema {
    propSchema = propSchema || _defaultPrimitiveProp
    invariant(isSchema(propSchema), "expected prop schema as first argument")
    invariant(!isAliasedSchema(propSchema), "provided prop is aliased, please put aliases first")
    let result: Schema = {
        serializer: function(ar) {
            if (ar === undefined) {
                return SKIP
            }
            invariant(ar && "length" in ar && "map" in ar, "expected array (like) object")
            return ar.map(propSchema.serializer)
        },
        deserializer: function(jsonArray, done, context) {
            if (!Array.isArray(jsonArray)) return void done("[serializr] expected JSON array")

            parallel(
                jsonArray,
                (jsonValue, onItemDone, itemIndex) =>
                    doDeserialize(onItemDone, jsonValue, jsonArray, itemIndex, context, propSchema),
                done
            )
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

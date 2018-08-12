import {invariant, isPropSchema, isAliasedPropSchema, parallel, processAdditionalPropArgs} from "../utils/utils"
import { _defaultPrimitiveProp } from "../constants"

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
 * });
 * createModelSchema(Todo, {
 *     title: true,
 *     subTask: list(object(SubTask)),
 * });
 *
 * const todo = deserialize(Todo, {
 *     title: 'Task',
 *     subTask: [
 *         {
 *             title: 'Sub task 1',
 *         },
 *     ],
 * });
 *
 * @param {PropSchema} propSchema to be used to (de)serialize the contents of the array
 * @param {AdditionalPropArgs} additionalArgs optional
 * @returns {PropSchema}
 */
export default function list(propSchema, additionalArgs) {
    propSchema = propSchema || _defaultPrimitiveProp
    invariant(isPropSchema(propSchema), "expected prop schema as first argument")
    invariant(!isAliasedPropSchema(propSchema), "provided prop is aliased, please put aliases first")
    var result = {
        serializer: function (ar) {
            invariant(ar && "length" in ar && "map" in ar, "expected array (like) object")
            return ar.map(propSchema.serializer)
        },
        deserializer: function(jsonArray, done, context) {
            if (!Array.isArray(jsonArray))
                return void done("[serializr] expected JSON array")
            parallel(
                jsonArray,
                function (item, itemDone) {
                    return propSchema.deserializer(item, itemDone, context)
                },
                done
            )
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

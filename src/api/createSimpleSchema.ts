import { Props, ModelSchema } from "./types"
import object from "../types/object"

/**
 * Creates a model schema that (de)serializes from / to plain javascript objects.
 * Its factory method is: `() => ({})`
 *
 * @example
 * const todoSchema = createSimpleSchema({
 *     title: true,
 *     done: true,
 * })
 *
 * const json = serialize(todoSchema, { title: 'Test', done: false })
 * const todo = deserialize(todoSchema, json)
 *
 * @param props property mapping,
 * @returns model schema
 */
export default function createSimpleSchema<T extends Object>(props: Props): ModelSchema<T> {
    return object({
        factory: function() {
            return {} as any
        },
        props: props
    })
}

/**
 * Creates a model schema that (de)serializes from / to plain javascript objects.
 * Its factory method is: `() => ({})`
 *
 * @example
 * var todoSchema = createSimpleSchema({
 *     title: true,
 *     done: true,
 * });
 *
 * var json = serialize(todoSchema, { title: 'Test', done: false });
 * var todo = deserialize(todoSchema, json);
 *
 * @param {object} props property mapping,
 * @returns {object} model schema
 */
export default function createSimpleSchema(props) {
    return {
        factory: function() {
            return {}
        },
        props: props
    }
}

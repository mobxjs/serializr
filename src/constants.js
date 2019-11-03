import primitive from "./types/primitive"

/**
 * If you want to skip serialization or deserialization, you can use SKIP.
 *
 * @example
 * // Skipping serialization with custom serializer.
 *
 * var schema = _.createSimpleSchema({
 *     a: _.custom(
 *         function(v) {
 *             return _.SKIP
 *         },
 *         function(v) {
 *             return v;
 *         }
 *     ),
 * });
 * t.deepEqual(_.serialize(s, { a: 4 }), { });
 * t.deepEqual(_.deserialize(s, { a: 4 }), { a: 4 });
 *
 * @example
 * // Skipping deserialization with computed mobx property.
 *
 * class TodoState {
 *     // Todo.category is @observable(reference(...))
 *     @serializable(list(object(Todo)))
 *     @observable
 *     todos: Todo[]
 *
 *     // we want to serialize the categories, so that the references in
 *     // this.todos can be resolved, but we don't want to set this property
 *     @serializable(
 *         list(object(TodoCategory),
 *         { afterDeserialize: callback => callback(undefined, SKIP) }))
 *     @computed
 *     get categories() {
 *         return this.todos.map(todo => todo.category)
 *     }
 * }
 */
export var SKIP = typeof Symbol !== "undefined" ? Symbol("SKIP") : { SKIP: true }

export var _defaultPrimitiveProp = primitive()

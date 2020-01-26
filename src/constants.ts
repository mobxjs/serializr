import primitive from "./types/primitive"

/**
 * In the event that a property needs to be deserialized, but not serialized, you can use the SKIP symbol to omit the property. This has to be used with the custom serializer.
 *
 * @example
 * const schema = _.createSimpleSchema({
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
 */
export const SKIP = typeof Symbol !== "undefined" ? Symbol("SKIP") : { SKIP: true }
export type SKIP = typeof SKIP

export const _defaultPrimitiveProp = primitive()

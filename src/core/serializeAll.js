import { invariant } from "../utils/utils"
import createModelSchema from "../api/createModelSchema"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import setDefaultModelSchema from "../api/setDefaultModelSchema"
import object from "../types/object"

/**
 * The `serializeAll` decorator can may used on a class to signal that all primitive properties,
 * or complex properties with a name matching a `pattern`, should be serialized automatically.
 *
 * @example
 * @serializeAll class Store {
 *     a = 3;
 *     b;
 * }
 *
 * const store = new Store();
 * store.c = 5;
 * store.d = {};
 * t.deepEqual(serialize(store), { c: 5 });
 *
 * @example
 * class DataType {
 *     @serializable
 *     x;
 *     @serializable
 *     y;
 * }
 * @serializeAll(/^[a-z]$/, DataType) class ComplexStore {
 * }
 *
 * const store = new ComplexStore();
 * store.a = {x: 1, y: 2};
 * store.b = {};
 * store.somethingElse = 5;
 * t.deepEqual(serialize(store), { a: {x: 1, y: 2}, b: { x: undefined, y: undefined } });
 */
export default function serializeAll(targetOrPattern, clazzOrSchema) {
    let propSchema
    let invokeImmediately = false
    if (arguments.length === 1) {
        invariant(
            typeof targetOrPattern === "function",
            "@serializeAll can only be used as class decorator"
        )
        propSchema = true
        invokeImmediately = true
    } else {
        invariant(
            typeof targetOrPattern === "object" && targetOrPattern.test,
            "@serializeAll pattern doesn't have test"
        )
        if (typeof clazzOrSchema === "function") {
            clazzOrSchema = object(clazzOrSchema)
        }
        invariant(
            typeof clazzOrSchema === "object" && clazzOrSchema.serializer,
            "couldn't resolve schema"
        )
        propSchema = Object.assign({}, clazzOrSchema, {
            pattern: targetOrPattern
        })
    }
    function result(target) {
        var info = getDefaultModelSchema(target)
        if (!info || !target.hasOwnProperty("serializeInfo")) {
            info = createModelSchema(target, {})
            setDefaultModelSchema(target, info)
        }
        getDefaultModelSchema(target).props["*"] = propSchema
        return target
    }
    if (invokeImmediately) {
        return result(targetOrPattern)
    }
    return result
}

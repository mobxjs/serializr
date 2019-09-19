import { invariant } from "../utils/utils"
import createModelSchema from "../api/createModelSchema"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import setDefaultModelSchema from "../api/setDefaultModelSchema"
import object from "../types/object"

/**
 * The `serializeAll` decorator can be used on a class to signal that all primitive properties should be serialized automatically.
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
 * t.deepEqual(serialize(store), { a: 3, b: undefined, c: 5 });
 */
export default function serializeAll(targetOrPattern, clazzOrSchema) {
    let propSchema;
    let invokeImmediately = false;
    if (arguments.length === 1) {
        invariant(typeof targetOrPattern === "function", "@serializeAll can only be used as class decorator");
        propSchema = true;
        invokeImmediately = true;
    }
    else {
        invariant(typeof targetOrPattern === "object" && targetOrPattern.test, "@serializeAll pattern doesn't have test");
        if (typeof clazzOrSchema === "function") {
            clazzOrSchema = object(clazzOrSchema);
        }
        invariant(typeof clazzOrSchema === "object" && clazzOrSchema.serializer, "couldn't resolve schema");
        propSchema = Object.assign({}, clazzOrSchema, {pattern: targetOrPattern})
    }
    function result(target) {
        var info = getDefaultModelSchema(target);
        if (!info || !target.hasOwnProperty("serializeInfo")) {
            info = createModelSchema(target, {});
            setDefaultModelSchema(target, info);
        }
        getDefaultModelSchema(target).props["*"] = propSchema;
        return target;
    }
    if (invokeImmediately) {
        return result(targetOrPattern);
    }
    return result;
}

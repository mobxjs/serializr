import { invariant, isPropSchema } from "../utils/utils"
import createModelSchema from "../api/createModelSchema"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import setDefaultModelSchema from "../api/setDefaultModelSchema"
import object from "../types/object"
import { Clazz, ModelSchema, PropDef } from "../api/types"
import { _defaultPrimitiveProp } from "../constants"

/**
 * The `serializeAll` decorator can used on a class to signal that all primitive properties,
 * or complex properties with a name matching a `pattern`, should be serialized automatically.
 *
 * @example
 * \@serializeAll
 * class Store {
 *     a = 3
 *     b
 * }
 *
 * const store = new Store()
 * store.c = 5
 * store.d = {}
 * serialize(store) // { "c": 5 }
 *
 * @example
 * class DataType {
 *     \@serializable
 *     x
 *     \@serializable
 *     y
 * }
 *
 * \@serializeAll(/^[a-z]$/, DataType)
 * class ComplexStore {
 * }
 *
 * const store = new ComplexStore()
 * store.a = {x: 1, y: 2}
 * store.b = {}
 * store.somethingElse = 5
 * serialize(store) // { a: {x: 1, y: 2}, b: { x: undefined, y: undefined } }
 */
export default function serializeAll<T>(clazz: Clazz<T>): Clazz<T>
export default function serializeAll(
    pattern: RegExp,
    propertyType: PropDef | Clazz<any>
): (clazz: Clazz<any>) => Clazz<any>
export default function serializeAll(
    targetOrPattern: Clazz<any> | RegExp,
    propertyType?: PropDef | Clazz<any>
) {
    let propSchema: PropDef
    if (arguments.length === 1) {
        propSchema = true
        return decorator(targetOrPattern as Clazz<any>)
    } else {
        invariant(
            typeof targetOrPattern === "object" && targetOrPattern.test,
            "@serializeAll pattern doesn't have test"
        )
        if (typeof propertyType === "function") {
            propertyType = object(propertyType)
        }
        if (true === propertyType) {
            propertyType = _defaultPrimitiveProp
        }
        invariant(isPropSchema(propertyType), "couldn't resolve schema")
        propSchema = Object.assign({}, propertyType, {
            pattern: targetOrPattern
        })
    }
    function decorator(target: Clazz<any>) {
        invariant(typeof target === "function", "@serializeAll can only be used as class decorator")
        let info: ModelSchema<any> | undefined = getDefaultModelSchema(target)
        if (!info) {
            info = createModelSchema(target, {})
            setDefaultModelSchema(target, info)
        }
        info.props["*"] = propSchema
        return target
    }
    return decorator
}

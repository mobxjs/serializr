import invariant from "./invariant"
import { ModelSchema, AdditionalPropArgs, Schema } from "../api/types"

export function GUARDED_NOOP(err?: any) {
    if (err)
        // unguarded error...
        throw new Error(err)
}

export function once<F extends Function>(fn: F): F {
    let fired = false
    return function() {
        if (!fired) {
            fired = true
            return fn.apply(null, arguments)
        }
        invariant(false, "callback was invoked twice")
    } as any
}

export function parallel<T, R>(
    ar: T[],
    processor: (val: T, cb: (err?: any, result?: R) => void, idx: number) => void,
    cb: (err?: any, result?: R[]) => void
) {
    // TODO: limit parallelization?
    if (ar.length === 0) return void cb(null, [])
    let left = ar.filter(x => true).length // only count items processed by forEach
    const resultArray: R[] = []
    let failed = false
    ar.forEach((value, idx) => {
        processor(
            value,
            (err, result) => {
                if (err) {
                    if (!failed) {
                        failed = true
                        cb(err)
                    }
                } else {
                    resultArray[idx] = result!
                    if (--left === 0) cb(null, resultArray)
                }
            },
            idx
        )
    })
}

export function isPrimitive(value: any): value is number | string | undefined | null | bigint {
    if (value === null) return true
    return typeof value !== "object" && typeof value !== "function"
}

export function isModelSchema(thing: any): thing is ModelSchema<any> {
    return thing && thing.factory && thing.props
}

export function isSchema(thing: any): thing is Schema {
    return thing && thing.serializer && thing.deserializer
}

export function isAliasedSchema(propSchema: any): propSchema is Schema & { jsonname: string } {
    return typeof propSchema === "object" && "string" == typeof propSchema.jsonname
}

export function isIdentifierSchema(propSchema: any): propSchema is Schema {
    return typeof propSchema === "object" && propSchema.identifier === true
}

export function isAssignableTo(actualType: ModelSchema<any>, expectedType: ModelSchema<any>) {
    let currentActualType: ModelSchema<any> | undefined = actualType
    while (currentActualType) {
        if (currentActualType === expectedType) return true
        currentActualType = currentActualType.extends
    }
    return false
}

export function isMapLike(thing: any): thing is Pick<Map<any, any>, "keys" | "clear" | "forEach"> {
    return thing && typeof thing.keys === "function" && typeof thing.clear === "function"
}

export function getIdentifierProp(modelSchema: ModelSchema<any>): string | undefined {
    invariant(isModelSchema(modelSchema), "modelSchema must be a ModelSchema")
    // optimization: cache this lookup
    let currentModelSchema: ModelSchema<any> | undefined = modelSchema
    while (currentModelSchema) {
        for (const propName in currentModelSchema.props)
            if (isIdentifierSchema(currentModelSchema.props[propName])) return propName
        currentModelSchema = currentModelSchema.extends
    }
    return undefined
}

export function processAdditionalPropArgs<T extends Schema>(
    propSchema: T,
    additionalArgs?: AdditionalPropArgs
) {
    if (additionalArgs) {
        invariant(isSchema(propSchema), "expected a propSchema")
        Object.assign(propSchema, additionalArgs)
    }
    return propSchema
}

export { invariant }

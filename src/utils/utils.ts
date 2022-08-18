import invariant from "./invariant";
import { ModelSchema, AdditionalPropArgs, PropSchema } from "../api/types";

export function GUARDED_NOOP(err?: any) {
    if (err)
        // unguarded error...
        throw new Error(err);
}

export function once<F extends (...args: any[]) => any>(fn: F): F {
    let fired = false;
    return function (...args: any[]) {
        if (!fired) {
            fired = true;
            return fn(...args);
        }
        invariant(false, "callback was invoked twice");
    } as any;
}

export function parallel<T, R>(
    ar: T[],
    processor: (val: T, cb2: (err?: any, result?: R) => void, idx: number) => void,
    cb: (err?: any, result?: R[]) => void
) {
    // TODO: limit parallelization?
    if (ar.length === 0) return void cb(null, []);
    let left = ar.filter((x) => true).length; // only count items processed by forEach
    const resultArray: R[] = [];
    let failed = false;
    ar.forEach((value, idx) => {
        processor(
            value,
            (err, result) => {
                if (err) {
                    if (!failed) {
                        failed = true;
                        cb(err);
                    }
                } else {
                    resultArray[idx] = result!;
                    if (--left === 0) cb(null, resultArray);
                }
            },
            idx
        );
    });
}

export function isPrimitive(value: any): value is number | string | undefined | null | bigint {
    if (value === null) return true;
    return typeof value !== "object" && typeof value !== "function";
}

export function isModelSchema(thing: any): thing is ModelSchema<any> {
    return thing && thing.factory && thing.props;
}

export function isPropSchema(thing: any): thing is PropSchema {
    return thing && thing.serializer && thing.deserializer;
}

export function isAliasedPropSchema(
    propSchema: any
): propSchema is PropSchema & { jsonname: string } {
    return typeof propSchema === "object" && "string" == typeof propSchema.jsonname;
}

export function isIdentifierPropSchema(propSchema: any): propSchema is PropSchema {
    return typeof propSchema === "object" && propSchema.identifier === true;
}

export function isAssignableTo(actualType: ModelSchema<any>, expectedType: ModelSchema<any>) {
    let currentActualType: ModelSchema<any> | undefined = actualType;
    while (currentActualType) {
        if (currentActualType === expectedType) return true;
        currentActualType = currentActualType.extends;
    }
    return false;
}

export type MapLike = Pick<Map<any, any>, "keys" | "clear" | "forEach" | "set">;

export function isMapLike(thing: any): thing is MapLike {
    return (
        thing &&
        typeof thing.keys === "function" &&
        typeof thing.clear === "function" &&
        typeof thing.forEach === "function" &&
        typeof thing.set === "function"
    );
}

export function getIdentifierProp(modelSchema: ModelSchema<any>): string | undefined {
    invariant(isModelSchema(modelSchema), "modelSchema must be a ModelSchema");
    // optimization: cache this lookup
    let currentModelSchema: ModelSchema<any> | undefined = modelSchema;
    while (currentModelSchema) {
        for (const propName in currentModelSchema.props)
            if (isIdentifierPropSchema(currentModelSchema.props[propName])) return propName;
        currentModelSchema = currentModelSchema.extends;
    }
    return undefined;
}

export function processAdditionalPropArgs<T extends PropSchema>(
    propSchema: T,
    additionalArgs?: AdditionalPropArgs
) {
    if (additionalArgs) {
        invariant(isPropSchema(propSchema), "expected a propSchema");
        Object.assign(propSchema, additionalArgs);
    }
    return propSchema;
}

export function isRegExp(obj: any): obj is RegExp {
    return typeof obj === "object" && obj.test;
}

export { invariant };

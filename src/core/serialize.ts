import getDefaultModelSchema from "../api/getDefaultModelSchema";
import { ClazzOrModelSchema, ModelSchema, PropDef } from "../api/types";
import { SKIP, _defaultPrimitiveProp } from "../constants";
import { invariant, isPrimitive } from "../utils/utils";

type Primitive = string | number | boolean | null | undefined | symbol | bigint;

// Helper type to identify keys of properties that are functions
type FunctionKeys<T> = {
	[K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

// Helper type to recursively serialize object properties, excluding functions
type SerializeObjectProperties<T extends object> = {
	[P in keyof Omit<T, FunctionKeys<T>>]: Serialized<T[P]>;
};

/**
 * Recursively defines a type that represents the serialized form of T.
 * - Primitive types remain unchanged.
 * - Functions are omitted.
 * - Array elements are recursively serialized.
 * - Object properties are recursively serialized (excluding functions).
 */
export type Serialized<T> = T extends Primitive
	? T // Keep primitives as is
	: T extends Array<infer U>
		? Array<Serialized<U>> // Handle arrays recursively
		: T extends object
			? SerializeObjectProperties<T> // Handle objects recursively, omitting functions
			: T; // Fallback for other types (like Date, RegExp, etc. which might need specific handling depending on the serialization library)

/**
 * Serializes an object (graph) into json using the provided model schema.
 * The model schema can be omitted if the object type has a default model schema associated with it.
 * If a list of objects is provided, they should have an uniform type.
 *
 * @param arg1 class or modelschema to use. Optional
 * @param arg2 object(s) to serialize
 * @returns serialized representation of the object
 */
export default function serialize<T>(modelSchema: ClazzOrModelSchema<T>, instance: T): Serialized<T>;
export default function serialize<T>(instance: T): Serialized<T>;
export default function serialize<T>(modelSchema: ClazzOrModelSchema<T>, instance: T[]): Serialized<T>[];
export default function serialize<T>(instance: T[]): Serialized<T>[];
export default function serialize<T>(...args: [ClazzOrModelSchema<T>, T | T[]] | [T | T[]]): Serialized<T> | Serialized<T>[] {
    invariant(args.length === 1 || args.length === 2, "serialize expects one or 2 arguments");

    let schema: ClazzOrModelSchema<T> | undefined;
    let value: T | T[];
    if (args.length === 1) {
        schema = undefined;
        value = args[0];
    } else {
        [schema, value] = args;
    }

    if (Array.isArray(value)) {
        return value.map((item) => (schema ? serialize(schema, item) : serialize(item))) as Serialized<T>[];
    }

    if (!schema) {
        schema = getDefaultModelSchema(value);
    } else if (typeof schema !== "object") {
        schema = getDefaultModelSchema(schema);
    }

    if (!schema) {
        // only call modelSchemaOrInstance.toString() on error
        invariant(schema, `Failed to find default schema for ${value}`);
    }
    return serializeWithSchema(schema, value) as Serialized<T>;
}

function serializeWithSchema<T>(schema: ModelSchema<T>, obj: any): T {
    invariant(schema && typeof schema === "object" && schema.props, "Expected schema");
    invariant(obj && typeof obj === "object", "Expected object");
    let res: any;
    if (schema.extends) res = serializeWithSchema(schema.extends, obj);
    else {
        // TODO: make invariant?:  invariant(!obj.constructor.prototype.constructor.serializeInfo, "object has a serializable supertype, but modelschema did not provide extends clause")
        res = {};
    }
    Object.keys(schema.props).forEach(function (key) {
        let propDef: PropDef = schema.props[key as keyof T];
        if (!propDef) return;
        if (key === "*") {
            serializeStarProps(schema, propDef, obj, res);
            return;
        }
        if (propDef === true) propDef = _defaultPrimitiveProp;
        const jsonValue = propDef.serializer(obj[key], key, obj);
        if (jsonValue === SKIP) {
            return;
        }
        res[propDef.jsonname || key] = jsonValue;
    });
    if (schema.discriminator?.storeDiscriminator) {
        schema.discriminator.storeDiscriminator(res);
    }
    return res;
}

function serializeStarProps(schema: ModelSchema<any>, propDef: PropDef, obj: any, target: any) {
    for (const key of Object.keys(obj))
        if (!(key in schema.props)) {
            if (propDef === true || (propDef && (!propDef.pattern || propDef.pattern.test(key)))) {
                const value = obj[key];
                if (propDef === true) {
                    if (isPrimitive(value)) {
                        target[key] = value;
                    }
                } else {
                    const jsonValue = propDef.serializer(value, key, obj);
                    if (jsonValue === SKIP) {
                        return;
                    }
                    // TODO: propDef.jsonname could be a transform function on
                    // key
                    target[key] = jsonValue;
                }
            }
        }
}

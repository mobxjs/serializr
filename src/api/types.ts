import Context from "../core/Context";
import { SKIP } from "../constants";

/**
 * Can be passed to function which create `PropSchema`s to set additional properties.
 */
export type AdditionalPropArgs = Pick<
    PropSchema,
    "beforeDeserialize" | "afterDeserialize" | "pattern"
>;
export type PropSerializer = (
    sourcePropertyValue: any,
    key: string | number | symbol,
    sourceObject: any
) => any | typeof SKIP;
export type PropDeserializer = (
    jsonValue: any,
    callback: (err?: any, targetPropertyValue?: any | typeof SKIP) => void,
    context: Context,
    currentPropertyValue?: any
) => void;
export interface PropSchema {
    serializer: PropSerializer;
    deserializer: PropDeserializer;
    beforeDeserialize?: BeforeDeserializeFunc;
    afterDeserialize?: AfterDeserializeFunc;
    /**
     * Filter properties to which this schema applies. Used with `ModelSchema.props["*"]`.
     */
    pattern?: { test: (propName: string) => boolean };
    jsonname?: string;
    identifier?: true;
    paramNumber?: number;
}

export type AfterDeserializeFunc = (
    callback: (err: any, value: any) => void,
    err: any,
    newValue: any,
    jsonValue: any,
    jsonParentValue: any,
    propNameOrIndex: string | number | symbol,
    context: Context,
    propDef: PropSchema
) => void;

export type BeforeDeserializeFunc = (
    callback: (err: any, value: any) => void,
    jsonValue: any,
    jsonParentValue: any,
    propNameOrIndex: string | number,
    context: Context,
    propDef: PropSchema
) => void;

/**
 * true is shorthand for `primitive().`
 * false/undefined will be ignored
 */
export type Props<T = any> = {
    [propName in keyof T]: PropDef;
};
export type PropDef = PropSchema | boolean | undefined;

export interface ModelSchema<T> {
    targetClass?: Clazz<any>;
    factory: (context: Context) => T;
    props: Props<T>;
    extends?: ModelSchema<any>;
}

export type Clazz<T> = new (...args: any[]) => T;
export type ClazzOrModelSchema<T> = ModelSchema<T> | Clazz<T>;

export type RefLookupFunction = (
    id: string,
    callback: (err: any, result: any) => void,
    context: Context
) => void;
export type RegisterFunction = (id: any, object: any, context: Context) => void;

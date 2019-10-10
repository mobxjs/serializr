// TODO: put this in the source files, and extract it, to preserve comments

export interface Context {
    json: any;
    target: any;
    parentContext: Context;
    args: any;
    await(modelschema: ClazzOrModelSchema<any>,id:string,callback?: (err: any, result: any) => void):any;
	rootContext:Context;
}

export type Factory<T> = (context: Context) => T


export interface AdditionalPropArgs {
    beforeDeserialize?: BeforeDeserializeFunc;
    afterDeserialize?: AfterDeserializeFunc;
}

export interface PropSchema {
    serializer(sourcePropertyValue: any): any;
    deserializer(jsonValue: any, callback: (err: any, targetPropertyValue: any) => void, context: Context, currentPropertyValue: any): void;
    beforeDeserialize?: BeforeDeserializeFunc;
    afterDeserialize?: AfterDeserializeFunc;
}

export type Props = {
    [propName:string]: boolean | PropSchema
}

export interface ModelSchema<T> {
    factory: Factory<T>,
    props: Props
}

export type Clazz<T> = new(...args: any[]) => T;
export type ClazzOrModelSchema<T> = ModelSchema<T> | Clazz<T>;

export type AfterDeserializeFunc = (callback: (err: any, value: any) => void, err: any, newValue: any, jsonValue: any, jsonParentValue: any, propNameOrIndex: string | number, context: Context, propDef: PropSchema, numRetry: number) => void;

export type BeforeDeserializeFunc = (callback: (err: any, value: any) => void, jsonValue: any, jsonParentValue: any, propNameOrIndex: string | number, context: Context, propDef: PropSchema) => void;

export function createSimpleSchema<T extends Object>(props: Props): ModelSchema<T>;

export function createModelSchema<T extends Object>(clazz: Clazz<T>, props: Props, factory?: Factory<T>): ModelSchema<T>;

export function serializable(propSchema: PropSchema | boolean): (target: Object, key: string, baseDescriptor?: PropertyDescriptor) => void;
export function serializable(target: Object, key: string, baseDescriptor?: PropertyDescriptor): void;

export function getDefaultModelSchema<T>(clazz: Clazz<T>): ModelSchema<T>;

export function setDefaultModelSchema<T>(clazz: Clazz<T>, modelschema: ModelSchema<T>): void;

export function serialize<T>(modelschema: ClazzOrModelSchema<T>, instance: T): any;
export function serialize<T>(instance: T): any;

export function cancelDeserialize<T>(instance: T): void;

export function deserialize<T>(modelschema: ClazzOrModelSchema<T>, jsonArray: any[], callback?: (err: any, result: T[]) => void, customArgs?: any): T[];
export function deserialize<T>(modelschema: ClazzOrModelSchema<T>, json: any, callback?: (err: any, result: T) => void, customArgs?: any): T;

export function update<T>(modelschema: ClazzOrModelSchema<T>, instance:T, json: any, callback?: (err: any, result: T) => void, customArgs?: any): void;
export function update<T>(instance:T, json: any, callback?: (err: any, result: T) => void, customArgs?: any): void;

export function primitive(additionalArgs?: AdditionalPropArgs): PropSchema;

export function identifier(registerFn?: (id: any, value: any, context: Context) => void, additionalArgs?: AdditionalPropArgs): PropSchema;
export function identifier(additionalArgs: AdditionalPropArgs): PropSchema;

export function date(additionalArgs?: AdditionalPropArgs): PropSchema;

export function alias(jsonName: string, propSchema?: PropSchema | boolean): PropSchema;
export function optional(propSchema?: PropSchema | boolean): PropSchema;

export function child(modelschema: ClazzOrModelSchema<any>, additionalArgs?: AdditionalPropArgs): PropSchema;
export function object(modelschema: ClazzOrModelSchema<any>, additionalArgs?: AdditionalPropArgs): PropSchema;

export type RefLookupFunction = (id: string, callback: (err: any, result: any) => void,context:Context) => void;
export type RegisterFunction = (id: any, object: any, context: Context) => void;

export function ref(modelschema: ClazzOrModelSchema<any>, lookupFn?: RefLookupFunction, additionalArgs?: AdditionalPropArgs): PropSchema;
export function ref(modelschema: ClazzOrModelSchema<any>, additionalArgs?: AdditionalPropArgs): PropSchema;
export function ref(identifierAttr: string, lookupFn: RefLookupFunction, additionalArgs?: AdditionalPropArgs): PropSchema;
export function reference(modelschema: ClazzOrModelSchema<any>, lookupFn?: RefLookupFunction, additionalArgs?: AdditionalPropArgs): PropSchema;
export function reference(modelschema: ClazzOrModelSchema<any>, additionalArgs?: AdditionalPropArgs): PropSchema;
export function reference(identifierAttr: string, lookupFn: RefLookupFunction, additionalArgs?: AdditionalPropArgs): PropSchema;

export function list(propSchema: PropSchema, additionalArgs?: AdditionalPropArgs): PropSchema;

export function map(propSchema: PropSchema, additionalArgs?: AdditionalPropArgs): PropSchema;

export function mapAsArray(propSchema: PropSchema, keyPropertyName: string, additionalArgs?: AdditionalPropArgs): PropSchema;

export function custom(serializer: (value: any) => any, deserializer: (jsonValue: any, context?: any, oldValue?: any) => any, additionalArgs?: AdditionalPropArgs): PropSchema;
export function custom(serializer: (value: any) => any, deserializer: (jsonValue: any, context: any, oldValue: any, callback: (err: any, result: any) => void) => any, additionalArgs?: AdditionalPropArgs): PropSchema;

export function serializeAll<T>(clazz: Clazz<T>): Clazz<T>;
export function serializeAll(pattern: RegExp, propSchema: PropSchema | true | Function): (clazz: Clazz<any>) => Clazz<any>;

export function raw(): any;

export const SKIP: {}

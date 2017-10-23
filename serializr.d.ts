// TODO: put this in the source files, and extract it, to preserve comments

export interface Context {
    json: any;
    target: any;
    parentContext: Context;
    args: any;
}

export type Factory<T> = (context: Context) => T

export interface PropSchema {
    serializer(sourcePropertyValue: any): any;
    deserializer(jsonValue: any, callback: (err: any, targetPropertyValue: any) => void, context: Context, currentPropertyValue: any): void;
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

export function createSimpleSchema<T extends Object>(props: Props): ModelSchema<T>;

export function createModelSchema<T extends Object>(clazz: Clazz<T>, props: Props, factory?: Factory<T>): ModelSchema<T>;

export function serializable(propSchema: PropSchema | boolean): (target: Object, key: string, baseDescriptor?: PropertyDescriptor) => void;
export function serializable(target: Object, key: string, baseDescriptor?: PropertyDescriptor): void;

export function getDefaultModelSchema<T>(clazz: Clazz<T>): ModelSchema<T>;

export function setDefaultModelSchema<T>(clazz: Clazz<T>, modelschema: ModelSchema<T>): void;

export function serialize<T>(modelschema: ClazzOrModelSchema<T>, instance: T): any;
export function serialize<T>(instance: T): any;

export function deserialize<T>(modelschema: ClazzOrModelSchema<T>, jsonArray: any[], callback?: (err: any, result: T[]) => void, customArgs?: any): T[];
export function deserialize<T>(modelschema: ClazzOrModelSchema<T>, json: any, callback?: (err: any, result: T) => void, customArgs?: any): T;

export function update<T>(modelschema: ClazzOrModelSchema<T>, instance:T, json: any, callback?: (err: any, result: T) => void, customArgs?: any): void;
export function update<T>(instance:T, json: any, callback?: (err: any, result: T) => void, customArgs?: any): void;

export function primitive(): PropSchema;

export function identifier(registerFn?: (id: any, value: any, context: Context) => void): PropSchema;

export function date(): PropSchema;

export function alias(jsonName: string, propSchema?: PropSchema | boolean): PropSchema;

export function child(modelschema: ClazzOrModelSchema<any>): PropSchema;
export function object(modelschema: ClazzOrModelSchema<any>): PropSchema;

export type RefLookupFunction = (id: string, callback: (err: any, result: any) => void) => void;
export type RegisterFunction = (id: any, object: any, context: Context) => void;

export function ref(modelschema: ClazzOrModelSchema<any>, lookupFn?: RefLookupFunction): PropSchema;
export function ref(identifierAttr: string, lookupFn: RefLookupFunction): PropSchema;
export function reference(modelschema: ClazzOrModelSchema<any>, lookupFn?: RefLookupFunction): PropSchema;
export function reference(identifierAttr: string, lookupFn: RefLookupFunction): PropSchema;

export function list(propSchema: PropSchema): PropSchema;

export function map(propSchema: PropSchema): PropSchema;

export function mapAsArray(propSchema: PropSchema, keyPropertyName: string): PropSchema;

export function custom(serializer: (value: any) => any, deserializer: (jsonValue: any) => any): PropSchema;

export function serializeAll<T extends Function>(clazz: T): T

export const SKIP: {}
// TODO: put this in the source files, and extract it, to preserve comments

export interface Context {
    json: any;
    target: any;
    parentContext: Context;
    args: any;
}

export type Factory<T> = (context: Context) => T

export interface PropSchema {
    serializer(sourcePropertyValue: any);
    deserializer(jsonValue: any, callback: (err, targetPropertyValue: any) => void, context: Context, currentPropertyValue: any);
}

export type Props = {
    [propName:string]: boolean | PropSchema
}

export interface ModelSchema<T> {
    factory: Factory<T>,
    props: Props
}

export type Clazz<T> = new() => T;
export type ClazzOrModelSchema<T> = ModelSchema<T> | Clazz<T>;

export function createSimpleSchema<T extends Object>(props: Props): ModelSchema<T>;

export function createModelSchema<T extends Object>(clazz: Clazz<T>, props: Props, factory?: Factory<T>): ModelSchema<T>;

export function serializable(propSchema: PropSchema | boolean): (target: Object, key: string, baseDescriptor?: PropertyDescriptor) => void;
export function serializable(target: Object, key: string, baseDescriptor?: PropertyDescriptor);

export function getDefaultModelSchema<T>(clazz: Clazz<T>): ModelSchema<T>;

export function setDefaultModelSchema<T>(clazz: Clazz<T>, modelschema: ModelSchema<T>);

export function serialize<T>(modelschema: ModelSchema<T>, instance: T): any;
export function serialize<T>(instance: T): any;

export function deserialize<T>(modelschema: ClazzOrModelSchema<T>, json: any, callback?: (err: any, result: T) => void, customArgs?: any): T;

export function update<T>(modelschema: ModelSchema<T>, instance:T, json: any, callback?: (err: any, result: T) => void, customArgs?: any);
export function update<T>(instance:T, json: any, callback?: (err: any, result: T) => void, customArgs?: any);

export function primitive(): PropSchema;

export function identifier(): PropSchema;

export function alias(jsonName: string, propSchema: PropSchema): PropSchema;

export function child(modelschema: ModelSchema<any>): PropSchema;

export type RefLookupFunction = (id: string, callback: (err, result) => void) => void;

export function ref(modelschema: ModelSchema<any>, lookupFn: RefLookupFunction): PropSchema;
export function ref(identiierAttr: string, lookupFn: RefLookupFunction): PropSchema;

export function list(propSchema: PropSchema): PropSchema;

export function map(propSchema: PropSchema): PropSchema;

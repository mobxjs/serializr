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

export function createSimpleSchema<T extends Object>(props: Props): ModelSchema<T>;

export function createModelSchema<T extends Object>(clazz: new() => T, props: Props, factory?: Factory<T>): ModelSchema<T>;

export function serializable(propSchema: PropSchema): (target: Object, key: string, baseDescriptor?: PropertyDescriptor) => any;

export function getDefaultModelSchema<T>(clazz: new() => T): ModelSchema<T>;

export function setDefaultModelSchema<T>(clazz: new() => T, modelschema: ModelSchema<T>);

export function serialize<T>(modelschema: ModelSchema<T>, instance: T): any;
export function serialize<T>(instance: T): any;

export function deserialize<T>(modelschema: ModelSchema<T>, json: any, callback: (err: any, result: T) => void, customArgs?: any): T;

export function update<T>(modelschema: ModelSchema<T>, instance:T, json: any, callback: (err: any, result: T) => void, customArgs?: any);
export function update<T>(instance:T, json: any, callback: (err: any, result: T) => void, customArgs?: any);

export function primitive(): PropSchema;

export function identifier(): PropSchema;

export function alias(jsonName: string, propSchema: PropSchema): PropSchema;

export function child(modelschema: ModelSchema<any>): PropSchema;

export type RefLookupFunction = (id: string, callback: (err, result) => void) => void;

export function ref(modelschema: ModelSchema<any>, lookupFn: RefLookupFunction): PropSchema;
export function ref(identiierAttr: string, lookupFn: RefLookupFunction): PropSchema;

export function list(propSchema: PropSchema): PropSchema;

export function map(propSchema: PropSchema): PropSchema;

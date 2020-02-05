import Context from "../core/Context"
import { SKIP } from "../constants"

/**
 * JSON is just an alias of `any`, it is used in function signatures to make clear which arguments expected to be JSON.
 */
export type JSON = any

export interface AdditionalPropArgs {
    beforeDeserialize?: BeforeDeserializeFunc
    afterDeserialize?: AfterDeserializeFunc
    pattern?: { test: (propName: string) => boolean }
}
export type PropSerializer = (
    sourcePropertyValue: any,
    key: string | number | symbol,
    sourceObject: any
) => JSON | SKIP
export type PropDeserializer = (
    jsonValue: JSON,
    callback: (err?: any, targetPropertyValue?: any | SKIP) => void,
    context: Context,
    currentPropertyValue?: any
) => void
export interface PropSchema {
    serializer: PropSerializer
    deserializer: PropDeserializer
    beforeDeserialize?: BeforeDeserializeFunc
    afterDeserialize?: AfterDeserializeFunc
    /**
     * Filter properties to which this schema applies. Used with ModelSchema.props["*"].
     */
    pattern?: { test: (propName: string) => boolean }
    jsonname?: string
    identifier?: true
    paramNumber?: number
}

export type AfterDeserializeFunc = (
    callback: (err: any, value: any) => void,
    err: any,
    newValue: any,
    jsonValue: JSON,
    jsonParentValue: JSON,
    propNameOrIndex: string | number | symbol,
    context: Context,
    propDef: PropSchema
) => void

export type BeforeDeserializeFunc = (
    callback: (err: any, value: any) => void,
    jsonValue: JSON,
    jsonParentValue: JSON,
    propNameOrIndex: string | number,
    context: Context,
    propDef: PropSchema
) => void

export type Factory<T> = (context: Context) => T

/**
 * true is shorthand for primitive().
 * false/undefined will be ignored
 */
export type Props<T = any> = {
    [propName in keyof T]: PropDef
}
export type PropDef = PropSchema | boolean | undefined

export interface ModelSchema<T> {
    targetClass?: Clazz<any>
    factory: Factory<T>
    props: Props<T>
    extends?: ModelSchema<any>
}

export type Clazz<T> = new (...args: any[]) => T
export type ClazzOrModelSchema<T> = ModelSchema<T> | Clazz<T>

export type RefLookupFunction = (
    id: string,
    callback: (err: any, result: any) => void,
    context: Context
) => void
export type RegisterFunction = (id: any, object: any, context: Context) => void

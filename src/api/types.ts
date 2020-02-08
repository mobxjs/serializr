import Context from "../core/Context"
import { SKIP } from "../constants"

export interface AdditionalPropArgs {
    beforeDeserialize?: BeforeDeserializeFunc
    afterDeserialize?: AfterDeserializeFunc
    pattern?: { test: (propName: string) => boolean }
}
export type PropSerializer = (
    sourcePropertyValue: any,
    key: string | number | symbol | undefined,
    sourceObject: any
) => any | SKIP
export type PropDeserializer = (
    jsonValue: any,
    callback: (err?: any, newValue?: any | SKIP) => void,
    context: Context,
    currentPropertyValue?: any,
    customArg?: any
) => void
export type AfterDeserializeFunc = (
    callback: (err: any, value: any) => void,
    err: any,
    newValue: any,
    jsonValue: any,
    jsonParentValue: any,
    jsonPropNameOrIndex: string | number | undefined,
    context: Context,
    propDef: Schema
) => void
export type BeforeDeserializeFunc = (
    callback: (err: any, value: any) => void,
    jsonValue: any,
    jsonParentValue: any,
    propNameOrIndex: string | number | undefined,
    context: Context,
    propDef: Schema
) => void
export interface Schema {
    serializer: PropSerializer
    deserializer: PropDeserializer
    beforeDeserialize?: BeforeDeserializeFunc
    afterDeserialize?: AfterDeserializeFunc
    /**
     * Filter properties to which this schema applies. Used with `ModelSchema.props["*"]`.
     */
    pattern?: { test: (propName: string) => boolean }
    jsonname?: string
    identifier?: true
    paramNumber?: number
}

export type Factory<T> = (context: Context) => T

/**
 * true is shorthand for primitive().
 * false/undefined will be ignored
 */
export type Props<T = any> = {
    [propName in keyof T]: PropDef
}
export type PropDef = Schema | boolean | undefined

export interface ModelSchema<T> extends Schema {
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

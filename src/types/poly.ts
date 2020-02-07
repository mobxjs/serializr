import { invariant, processAdditionalPropArgs } from "../utils/utils"
import { PropSchema, AdditionalPropArgs, Clazz } from "../api/types"

/**
 *
 */
export default function poly(classes: Clazz<any>[], additionalArgs?: AdditionalPropArgs): PropSchema
export default function poly(
    valueToClassString: (value: any) => [string, PropSchema],
    classStringToPropSchema: (classString: string) => PropSchema,
    additionalArgs?: AdditionalPropArgs
): PropSchema
export default function poly(
    arg1: ((value: any) => [string, PropSchema]) | Clazz<any>[],
    arg2?: AdditionalPropArgs | ((classString: string) => PropSchema),
    additionalArgs?: AdditionalPropArgs
): PropSchema {
    let valueToClassString: (value: any) => [string, PropSchema]
    let classStringToPropSchema: (classString: string) => PropSchema
    if ("function" === typeof arg1) {
        valueToClassString = arg1
        classStringToPropSchema = arg2 as (classString: string) => PropSchema
    } else {
        const classes = arg1 as Clazz<any>[]
        additionalArgs = arg2 as AdditionalPropArgs
        valueToClassString = (value: any) => [value.constructor.name, value.constructor]
        classStringToPropSchema = (classString: string) => classes.find(c => c.name === classString)
    }
    let result: PropSchema = {
        serializer: function(value, key, sourceObject) {
            if (value === null || value === undefined) return value
            const [$class, schema] = valueToClassString(value)
            const obj = schema.serializer(value, key, sourceObject)
            obj.$class = $class
            return obj
        },
        deserializer: function(jsonValue, done, context, currentPropertyValue, customArg) {
            if (jsonValue === null || jsonValue === undefined) return void done(null, jsonValue)
            const schema = classStringToPropSchema(jsonValue.$class)
            delete jsonValue.$class
            schema.deserializer(jsonValue, done, context, currentPropertyValue, customArg) 
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

import {
    invariant,
    isModelSchema,
    getIdentifierProp,
    processAdditionalPropArgs
} from "../utils/utils"
import getDefaultModelSchema from "../api/getDefaultModelSchema"
import {
    ClazzOrModelSchema,
    RefLookupFunction,
    AdditionalPropArgs,
    PropSchema,
    ModelSchema
} from "../api/types"
import Context from "../core/Context"

function createDefaultRefLookup(modelSchema: ModelSchema<any>) {
    return function resolve(
        uuid: string,
        cb: (err?: any, result?: any) => any,
        context: Context<any>
    ) {
        context.rootContext.await(modelSchema, uuid, cb)
    }
}

/**
 * `reference` can be used to (de)serialize references that point to other models.
 *
 * The first parameter should be either a ModelSchema that has an `identifier()` property (see identifier)
 * or a string that represents which attribute in the target object represents the identifier of the object.
 *
 * The second parameter is a lookup function that is invoked during deserialization to resolve an identifier to
 * an object. Its signature should be as follows:
 *
 * `lookupFunction(identifier, callback, context)` where:
 * 1. `identifier` is the identifier being resolved
 * 2. `callback` is a node style calblack function to be invoked with the found object (as second arg) or an error (first arg)
 * 3. `context` see context.
 *
 * The lookupFunction is optional. If it is not provided, it will try to find an object of the expected type and required identifier within the same JSON document
 *
 * N.B. mind issues with circular dependencies when importing model schemas from other files! The module resolve algorithm might expose classes before `createModelSchema` is executed for the target class.
 *
 * @example
 * class User {}
 * class Post {}
 *
 * createModelSchema(User, {
 *     uuid: identifier(),
 *     displayname: primitive(),
 * })
 *
 * createModelSchema(Post, {
 *     author: reference(User, findUserById),
 *     message: primitive(),
 * })
 *
 * function findUserById(uuid, callback) {
 *     fetch('http://host/user/' + uuid)
 *         .then(userData => {
 *             deserialize(User, userData, callback)
 *         })
 *         .catch(callback)
 * }
 *
 * deserialize(
 *     Post,
 *     {
 *         message: 'Hello World',
 *         author: 234,
 *     },
 *     (err, post) => {
 *         console.log(post)
 *     }
 * )
 *
 * @param target: ModelSchema or string
 * @param {RefLookupFunction | AdditionalPropArgs} lookupFn optional function or additionalArgs object
 * @param {AdditionalPropArgs} additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 * @returns {PropSchema}
 */
export default function reference(
    modelSchema: ClazzOrModelSchema<any>,
    lookupFn?: RefLookupFunction,
    additionalArgs?: AdditionalPropArgs
): PropSchema
export default function reference(
    modelSchema: ClazzOrModelSchema<any>,
    additionalArgs?: AdditionalPropArgs
): PropSchema
export default function reference(
    identifierAttr: string,
    lookupFn: RefLookupFunction,
    additionalArgs?: AdditionalPropArgs
): PropSchema
export default function reference(
    target: ClazzOrModelSchema<any> | string,
    lookupFnOrAdditionalPropArgs?: RefLookupFunction | AdditionalPropArgs,
    additionalArgs?: AdditionalPropArgs
) {
    invariant(
        !!target,
        "No modelSchema provided. If you are importing it from another file be aware of circular dependencies."
    )
    let lookupFn =
        "function" === typeof lookupFnOrAdditionalPropArgs
            ? lookupFnOrAdditionalPropArgs
            : undefined
    additionalArgs =
        additionalArgs ||
        (lookupFn ? undefined : (lookupFnOrAdditionalPropArgs as AdditionalPropArgs | undefined))
    let initialized = false
    let childIdentifierAttribute: string | undefined
    function initialize() {
        initialized = true
        invariant(
            typeof target !== "string" || typeof lookupFn === "function",
            "if the reference target is specified by attribute name, a lookup function is required"
        )
        invariant(
            !lookupFn || typeof lookupFn === "function",
            "second argument should be a lookup function or additional arguments object"
        )
        if (typeof target === "string") {
            childIdentifierAttribute = target
        } else {
            const modelSchema = getDefaultModelSchema(target)!
            invariant(
                isModelSchema(modelSchema),
                "expected model schema or string as first argument for 'ref', got " + modelSchema
            )
            lookupFn = lookupFn || createDefaultRefLookup(modelSchema)
            childIdentifierAttribute = getIdentifierProp(modelSchema)
            invariant(
                !!childIdentifierAttribute,
                "provided model schema doesn't define an identifier() property and cannot be used by 'ref'."
            )
        }
    }
    let result: PropSchema = {
        serializer: function(item) {
            if (!initialized) initialize()
            return item ? item[childIdentifierAttribute!] : null
        },
        deserializer: function(identifierValue, done, context) {
            if (!initialized) initialize()
            if (identifierValue === null || identifierValue === undefined)
                done(null, identifierValue)
            else lookupFn!(identifierValue, done, context)
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}

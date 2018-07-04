/*
 * ## Managing model schemas
 */

/**
 * JSDOC type defintions for usage w/o typescript.
 * @typedef {object} PropSchema
 * @property {serializerFunction} serializer
 * @property {deserializerFunction} deserializer
 * @property {boolean} identifier
 *
 * @typedef {object} PropertyDescriptor
 * @param {*} value
 * @param {boolean} writeable
 * @param {Function|undefined} get
 * @param {Function|undefined} set
 * @param {boolean} configurable
 * @param {boolean} enumerable
 *
 * @callback serializerFunction
 * @param {*} sourcePropertyValue
 * @returns any - serialized object
 *
 *
 * @callback deserializerFunction
 * @param {*} jsonValue
 * @param {cpsCallback} callback
 * @param {Context} context
 * @param {*} currentPropertyValue
 * @returns void
 *
 * @callback RegisterFunction
 * @param {*} id
 * @param {object} target
 * @param {Context} context
 *
 * @callback cpsCallback
 * @param {*} result
 * @param {*} error
 * @returns void
 *
 * @callback RefLookupFunction
 * @param {string} id
 * @param {cpsCallback} callback
 * @returns void
 *
 * @typedef {object} ModelSchema
 * @param factory
 * @param props
 * @param targetClass
 */
export { default as createSimpleSchema } from "./api/createSimpleSchema"
export { default as createModelSchema } from "./api/createModelSchema"
export { default as getDefaultModelSchema } from "./api/getDefaultModelSchema"
export { default as setDefaultModelSchema } from "./api/setDefaultModelSchema"
export { default as serializable } from "./api/serializable"

/*
 * ## Serialization and deserialization
 */
export { default as serialize, serializeAll } from "./core/serialize"
export { default as deserialize } from "./core/deserialize"
export { default as update } from "./core/update"

export { default as primitive } from "./types/primitive"
export { default as identifier } from "./types/identifier"
export { default as date } from "./types/date"
export { default as alias } from "./types/alias"
export { default as custom } from "./types/custom"
export { default as customAsync } from "./types/customAsync"
export { default as object } from "./types/object"
export { default as reference } from "./types/reference"
export { default as list } from "./types/list"
export { default as map } from "./types/map"
export { default as mapAsArray } from "./types/mapAsArray"
export { default as raw } from "./types/raw"

export { SKIP } from "./constants"

// deprecated
export { default as child } from "./types/object"
export { default as ref } from "./types/reference"
// ~ deprecated

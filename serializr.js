(function() {
    "use strict"

    function mrFactory() {
/*
 * Generic utility functions
 */
        function NOOP() {}

        function  once(fn) {
            var fired = false
            return function() {
                if (!fired) {
                    fired = true
                    return fn.apply(null, arguments)
                }
                invariant(false, "callback was invoked twice")
            }
        }

        function invariant(cond, message) {
            if (!cond)
                throw new Error("[serializr] " + (message || "Illegal State"))
        }

        function parallel(ar, processor, cb) {
            // TODO: limit parallelization?
            if (ar.length === 0)
                return void cb(null, [])
            var left = ar.length
            var resultArray = []
            var failed = false
            var processorCb = function(idx, err, result) {
                if (err) {
                    if (!failed) {
                        failed = true
                        cb(err)
                    }
                } else {
                    resultArray[idx] = result
                    if (--left === 0)
                        cb(null, resultArray)
                }
            }
            ar.forEach(function (value, idx) {
                processor(value, processorCb.bind(null, idx))
            })
        }

        function extend(target) {
            for (var i = 1; i < arguments.length; i++) {
                var source =  arguments[i]
                if (source && typeof source === "object") for (var key in source)
                    if (source.hasOwnProperty(key))
                        target[key] = source[key]
            }
            return target
        }

/**
 * ## Managing model schemas
 */
        var _defaultPrimitiveProp = primitive()

        /**
         * Creates a model schema that (de)serializes from / to plain javascript objects
         *
         * @example
         * var todoSchema = createSimpleSchema({
         *   title: true,
         *   done: true
         * };
         *
         * var json = serialize(todoSchema, { title: "Test", done: false })
         * var todo = deserialize(todoSchema, json)
         *
         * @param {object} props property mapping,
         * @returns {object} model schema
         */
        function createSimpleSchema(props) {
            return {
                factory: function() {
                    return {}
                },
                props: props
            }
        }

        /**
         * Creates a model schema that (de)serializes an object created by a constructor function (class).
         * The created model schema is associated by the targeted type as default model schema, see setDefaultModelSchema
         *
         * @example
         * function Todo(title, done) {
         *   this.title = title;
         *   this.done = done;
         * }
         *
         * createModelSchema(Todo, {
         *   title: true,
         *   done: true
         * })
         *
         * var json = serialize(new Todo("Test", false))
         * var todo = deserialize(Todo, json)
         *
         * @param {function} clazz clazz or constructor function
         * @param {object} props property mapping
         * @returns {object} model schema
         */
        function createModelSchema(clazz, props) {
            invariant(clazz !== Object, "one cannot simply put define a model schema for Object")
            invariant(typeof clazz === "function", "expected constructor function")
            setDefaultModelSchema(clazz, {
                factory: function() {
                    return new clazz()
                },
                props: props
            })
        }

        /**
         * Decorator that defines a new property mapping on the default model schema for the class
         * it is used in.
         *
         * @example
         * class Todo {
         *   @serializable(primitive())
         *   title;
         *
         *   @serializable // shorthand for primitves
         *   done;
         *
         *   constructor(title, done) {
         *     this.title = title;
         *     this.done = done;
         *   }
         * }
         *
         * var json = serialize(new Todo("Test", false))
         * var todo = deserialize(Todo, json)
         */
        function serializable(arg1, arg2, arg3) {
            if (arguments.length === 1) {
                // decorated with propSchema
                var propSchema = arg1
                invariant(isPropSchema(propSchema), "@serializable expects prop schema")
                return serializableDecorator.bind(null, propSchema)
            } else {
                // decorated without arguments, treat as primitive
                return serializableDecorator(primitive(), arg1, arg2, arg3)
            }
        }

        function serializableDecorator(propSchema, target, propName, descriptor) {
            invariant(arguments.length >= 2, "too few arguments. Please use @serializable as property decorator")
            invariant(typeof propName === "string", "incorrect usage of @serializable decorator")
            var info = getDefaultModelSchema(target)
            if (!info) {
                var constructor = target.constructor
                info = setDefaultModelSchema(
                    constructor,
                    {
                        factory: function() {
                            return new constructor()
                        },
                        props: {}
                    }
                )
            }
            info.props[propName] = propSchema
            return descriptor
        }

        /**
         * Returns the standard model schema associated with a class / constructor function
         *
         * @param {function} clazz class or constructor function
         * @returns {object} model schema
         */
        function getDefaultModelSchema(thing) {
            if (!thing)
                return null
            if (isModelSchema(thing))
                return thing
            if (isModelSchema(thing.serializeInfo))
                return thing.serializeInfo
            if (thing.constructor && thing.constructor.serializeInfo)
                return thing.constructor.serializeInfo
        }

        /**
         * Sets the default model schema for class / constructor function.
         * Everywhere where a model schema is required as argument, this class / constructor function
         * can be passed in as well (for example when using `child` or `ref`.
         *
         * When passing an instance of this class to `serialize`, it is not required to pass the model schema
         * as first argument anymore, because the default schema will be inferred from the instance type.
         *
         * @param {function} clazz class or constructor function
         * @returns {object} model schema
         */
        function setDefaultModelSchema(clazz, modelSchema) {
            invariant(isModelSchema(modelSchema))
            return clazz.serializeInfo = modelSchema
        }

        function isModelSchema(thing) {
            return thing && thing.factory && thing.props
        }

        function isPropSchema(thing) {
            return thing && thing.serializer && thing.deserializer
        }

        function isAliasedPropSchema(propSchema) {
            return !!propSchema.jsonname
        }

        function isIdentifierPropSchema(propSchema) {
            return propSchema.identifier === true
        }

        function getIdentifierProp(modelSchema) {
            invariant(isModelSchema(modelSchema))
            // optimizatoin: cache this lookup
            for (var propName in modelSchema.props)
                if (modelSchema.props[propName].identifier === true)
                    return propName
            return null
        }

/**
 * ## Serialization and deserialization
 */

/*
 * Serialization
 */

        /**
         * Serializes an object (graph) into json using the provided model schema.
         * The model schema can be omitted if the object type has a default model schema associated with it.
         * If a list of objects is provided, they should have an uniform type.
         *
         * @param {object} modelschema to use. Optional
         * @param {object or array} object object(s) to serialize
         * @returns {object} serialized representation of the object
         */
        function serialize(arg1, arg2) {
            invariant(arguments.length === 1 || arguments.length === 2, "serialize expects one or 2 arguments")
            var thing = arguments.length === 1 ? arg1 : arg2
            var schema = arguments.length === 1 ? null : arg1
            if (Array.isArray(thing)) {
                if (thing.length === 0)
                    return [] // don't bother finding a schema
                else if (!schema)
                    schema = getDefaultModelSchema(thing[0])
            } else if (!schema) {
                schema = getDefaultModelSchema(thing)
            }
            invariant(!!schema, "Failed to find default schema for " + arg1)
            if (Array.isArray(thing))
                return thing.map(function (item) {
                    return serializeWithSchema(schema, item)
                })
            return serializeWithSchema(schema, thing)
        }

        function serializeWithSchema(schema, obj) {
            invariant(schema && typeof schema === "object", "Expected schema")
            invariant(obj && typeof obj === "object", "Expected object")
            var res
            if (schema.extends)
                res = serializeWithSchema(schema.extends, obj)
            else
                res = {}
            Object.keys(schema.props).forEach(function (key) {
                var propDef = schema.props[key]
                if (propDef === true)
                    propDef = _defaultPrimitiveProp
                var jsonValue = propDef.serializer(obj[key])
                res[propDef.jsonname || key] = jsonValue
            })
            return res
        }

/*
 * Deserialization
 */

        /**
         * Deserializes an json structor into an object graph.
         * This process might be asynchronous (for example if there are references with an asynchronous
         * lookup function). The function returns an object (or array of objects), but the returned object
         * might be incomplete until the callback has fired as well (which might happen immediately)
         *
         * @param {object or array} modelschema to use for deserialization
         * @param {json} json data to deserialize
         * @param {function} callback node style callback that is invoked once the deserializaiton has finished.
         * First argument is the optional error, second argument is the deserialized object (same as the return value)
         * @param {object or array} deserialized object, possibly incomplete.
         */
        function deserialize(schema, json, callback) {
            invariant(arguments.length >= 2, "deserialize expects at least 2 arguments")
            schema = getDefaultModelSchema(schema)
            invariant(isModelSchema(schema), "first argument should be model schema")
            callback = callback || NOOP
            if (Array.isArray(json)) {
                var items = []
                parallel(
                    json,
                    function (childJson, itemDone) {
                        var instance = deserializeObjectWithSchema(null, schema, childJson, itemDone)
                        // instance is created synchronously so can be pushed
                        items.push(instance)
                    },
                    callback
                )
                return items
            } else
                return deserializeObjectWithSchema(null, schema, json, callback)
        }

        function deserializeObjectWithSchema(parentContext, schema, json, callback) {
            if (json === null || json === undefined)
                return void callback(null, null)
            var context = new Context(parentContext, json, callback)
            var target = schema.factory(context)
            // todo async invariant
            invariant(!!target, "No object returned from factory")
            context.target = target
            var lock = context.createCallback(NOOP)
            deserializePropsWithSchema(context, schema, json, target)
            lock()
            return target
        }

        function deserializePropsWithSchema(context, schema, json, target) {
            if (schema.extends)
                deserializePropsWithSchema(context, schema.extends, json, target)
            Object.keys(schema.props).forEach(function (propName) {
                var propDef = schema.props[propName]
                if (propDef === true)
                    propDef = _defaultPrimitiveProp
                var jsonAttr = propDef.jsonname || propName
                if (!(jsonAttr in json))
                    return
                propDef.deserializer(
                    json[jsonAttr],
                    context.createCallback(function (value) {
                        target[propName] = value
                    }),
                    context,
                    target[propName]
                )
            })
        }

        function Context(parentContext, json, onReadyCb) {
            this.parentContext = parentContext
            this.onReadyCb = onReadyCb || NOOP
            this.json = json
            this.target = null
            this.pendingCallbacks = 0
            this.hasError = false
        }
        Context.prototype.createCallback = function (fn) {
            this.pendingCallbacks++
            // once: defend agains userland calling 'done' twice
            return once(function(err, value) {
                if (err) {
                    if (!this.hasError) {
                        this.hasError = true
                        this.onReadyCb(err)
                    }
                } else if (!this.hasError) {
                    fn(value)
                    if (--this.pendingCallbacks === 0)
                        this.onReadyCb(null, this.target)
                }
            }.bind(this))
        }
        Context.prototype.getParentObject = function() {
            return this.parentContext ? this.parentContext.target : null
        }

/*
 * Update
 */
        /**
         * Similar to deserialize, but updates an existing object instance.
         * Properties will always updated entirely, but properties not present in the json will be kept as is.
         * Further this method behaves similar to deserialize.
         *
         * @param {object} modelschema, optional if it can be inferred from the instance type
         * @param {object} target target instance to update
         * @param {object} json the json to deserialize
         * @param {function} callback the callback to invoke once deserialization has completed.
         */
        function update(arg1, arg2, arg3, arg4) {
            var modelSchemaProvided = arguments.length === 4 || typeof arg3 !== "function"
            var schema, target, json, callback
            if (modelSchemaProvided) {
                schema = arg1
                target = arg2
                json = arg3
                callback = arg4
            } else {
                target = arg1
                schema = getDefaultModelSchema(target)
                json = arg2
                callback = arg3
            }
            invariant(isModelSchema(schema), "update failed to determine schema")
            invariant(typeof target === "object" && target && !Array.isArray(target), "update needs an object")
            var context = new Context(null, json, callback)
            context.target = target
            var lock = context.createCallback(NOOP)
            deserializePropsWithSchema(context, schema, json, target)
            lock()
        }

/**
 * ## Property schemas
 */

        /**
         * Indicates that this field contains a primitive value (or Date) which should be serialized literally to json.
         *
         * @example
         * createModelSchema(Todo, {
         *   title: primitive()
         * })
         *
         * console.dir(serialize(new Todo("test")))
         * // { title : "test" }
         *
         * @returns {PropSchema}
         */
        function primitive() {
            return {
                serializer: function (value) {
                    if (value instanceof Date)
                        return 0 + value
                    invariant((typeof value !== "object" || value === null) && typeof value !== "function", "this value is not primitive: " + value)
                    return value
                },
                deserializer: function (jsonValue, done) {
                    if ((typeof jsonValue === "object" && jsonValue !== null) || typeof jsonValue === "function")
                        return void done("[serializr] this value is not primitive: " + jsonValue)
                    return void done(null, jsonValue)
                }
            }
        }

        /**
         * Similar to primitive, but this field will be marked as the identifier for the given Model type.
         * This is used by for example `ref()` to serialize the reference
         *
         * @returns
         */
        function identifier() {
            return extend({
                identifier: true
            }, _defaultPrimitiveProp)
        }

        /**
         * Alias indicates that this model property should be named differently in the generated json.
         * Alias should be the outermost propschema.
         *
         * @example
         * createModelSchema(Todo, {
         *   title: alias("task", primitive())
         * })
         *
         * console.dir(serialize(new Todo("test")))
         * // { task : "test" }
         *
         * @param {string} alias name of the json field to be used for this property
         * @param {PropSchema} propSchema propSchema to (de)serialize the contents of this field
         * @returns {PropSchema}
         */
        function alias(name, propSchema) {
            invariant(name && typeof name === "string", "expected prop name as first argument")
            propSchema = propSchema || _defaultPrimitiveProp
            invariant(isPropSchema(propSchema), "expected prop schema as second argument")
            invariant(!isAliasedPropSchema(propSchema), "provided prop is already aliased")
            return {
                jsonname: name,
                serializer: propSchema.serializer,
                deserializer: propSchema.deserializer,
                identifier: isIdentifierPropSchema(propSchema)
            }
        }


        /**
         * Child indicates that this property contains an object that needs to be (de)serialized
         * using it's own model schema.
         *
         * @example
         * createModelSchema(SubTask, {
         *   title: true
         * })
         * createModelSchema(Todo, {
         *   title: true
         *   subTask: child(SubTask)
         * })
         *
         * const todo = deserialize(Todo, {
         *   title: "Task",
         *   subTask: {
         *     title: "Sub task"
         *   }
         * })
         *
         * @param {modelSchema} modelSchema to be used to (de)serialize the child
         * @returns {PropSchema}
         */
        function child(modelSchema) {
            modelSchema = getDefaultModelSchema(modelSchema)
            invariant(isModelSchema(modelSchema), "expected modelSchema, got " + modelSchema)
            return {
                serializer: function (item) {
                    if (item === null || item === undefined)
                        return item
                    return serialize(modelSchema, item)
                },
                deserializer: function (childJson, done, context) {
                    if (childJson === null || childJson === undefined)
                        return void done(null, childJson)
                    return void deserializeObjectWithSchema(context, modelSchema, childJson, done)
                }
            }
        }

        /**
         * Ref can be used to (de)serialize references that points to other models.
         *
         * The first parameter should be either a ModelSchema that has an `identifier()` property (see identifier)
         * or a string that represents which attribute in the target object represents the identifier of the object.
         *
         * The second parameter is a lookup function that is invoked during deserialization to resolve an identifier to
         * an object. It's signature should be as follows:
         *
         * `lookupFunction(identifier, callback, context)` where:
         * 1. `identifier` is the identifier being resolved
         * 2. `callback` is a node style calblack function to be invoked with the found object (as second arg) or an error (first arg)
         * 3. `context` see context.
         *
         * @example
         * createModelSchema(User, {
         *   uuid: identifier(),
         *   displayname: primitive()
         * })
         *
         * createModelSchema(Post, {
         *   author: ref(User, findUserById)
         *   message: primitive()
         * })
         *
         * function findUserById(uuid, callback) {
         *   fetch("http://host/user/" + uuid)
         *     .then((userData) => {
         *       deserialize(User, userData, callback)
         *     })
         *     .catch(callback)
         * }
         *
         * deserialize(
         *   Post,
         *   {
         *     message: "Hello World",
         *     author: 234
         *   },
         *   (err, post) => {
         *     console.log(post)
         *   }
         * )
         *
         * @param {ModelSchema or string} target
         * @param {function} lookup function
         * @returns {PropSchema}
         */
        function ref(target, lookupFn) {
            invariant(typeof lookupFn === "function", "second argument should be a lookup function")
            var childIdentifierAttribute
            if (typeof target === "string")
                childIdentifierAttribute = target
            else {
                var modelSchema = getDefaultModelSchema(target)
                invariant(isModelSchema(modelSchema), "expected model schema or string as first argument for 'ref', got " + modelSchema)
                childIdentifierAttribute = getIdentifierProp(modelSchema)
                invariant(!!childIdentifierAttribute, "provided model schema doesn't define an identifier() property and cannot be used by 'ref'.")
            }
            return {
                serializer: function (item) {
                    return item ? item[childIdentifierAttribute] : null
                },
                deserializer: function(identifierValue, done, context) {
                    lookupFn(identifierValue, done, context)
                }
            }
        }

        /**
         * List indicates that this property contains a list of things.
         * Accepts a sub model schema to serialize the contents
         *
         * @example
         * createModelSchema(SubTask, {
         *   title: true
         * })
         * createModelSchema(Todo, {
         *   title: true
         *   subTask: list(child(SubTask))
         * })
         *
         * const todo = deserialize(Todo, {
         *   title: "Task",
         *   subTask: [{
         *     title: "Sub task 1"
         *   }]
         * })
         *
         * @param {PropSchema} propSchema to be used to (de)serialize the contents of the array
         * @returns {PropSchema}
         */

        function list(propSchema) {
            propSchema = propSchema || _defaultPrimitiveProp
            invariant(isPropSchema(propSchema), "expected prop schema as second argument")
            invariant(!isAliasedPropSchema(propSchema), "provided prop is aliased, please put aliases first")
            return {
                serializer: function (ar) {
                    invariant(ar && "length" in ar && "map" in ar, "expected array (like) object")
                    return ar.map(propSchema.serializer)
                },
                deserializer: function(jsonArray, done, context) {
                    if (!Array.isArray(jsonArray))
                        return void done("[serializr] expected JSON array")
                    parallel(
                        jsonArray,
                        function (item, itemDone) {
                            return propSchema.deserializer(item, itemDone, context)
                        },
                        done
                    )
                }
            }
        }

        function isMapLike(thing) {
            return thing && typeof thing.keys === "function" && typeof thing.clear === "function"
        }

        /**
         * Similar to list, but map represents a string keyed dynamic collection.
         * This can be both plain objects (default) or ES6 Map like structures.
         * This will be inferred from the initial value of the targetted attribute.
         *
         * @param {any} propSchema
         * @returns
         */
        function map(propSchema) {
            propSchema = propSchema || _defaultPrimitiveProp
            invariant(isPropSchema(propSchema), "expected prop schema as second argument")
            invariant(!isAliasedPropSchema(propSchema), "provided prop is aliased, please put aliases first")
            return {
                serializer: function (m) {
                    invariant(m && typeof m === "object", "expected object or Map")
                    var isMap = isMapLike(m)
                    var result = {}
                    if (isMap)
                        m.forEach(function(value, key) {
                            result[key] = propSchema.serializer(value)
                        })
                    else for (var key in m)
                        result[key] = propSchema.serializer(m[key])
                    return result
                },
                deserializer: function(jsonObject, done, context, oldValue) {
                    if (!jsonObject || typeof jsonObject !== "object")
                        return void done("[serializr] expected JSON object")
                    var keys = Object.keys(jsonObject)
                    list(propSchema).deserializer(
                        keys.map(function (key) {
                            return jsonObject[key]
                        }),
                        function (err, values) {
                            if (err)
                                return void done(err)
                            var isMap = isMapLike(oldValue)
                            var newValue
                            if (isMap) {
                                // if the oldValue is a map, we recycle it
                                // there are many variations and this way we don't have to
                                // know about the original constructor
                                oldValue.clear()
                                newValue = oldValue
                            } else
                                newValue = {}
                            for (var i = 0, l = keys.length; i < l; i++)
                                if (isMap)
                                    newValue.set(keys[i], values[i])
                                else
                                    newValue[keys[i]] = values[i]
                            done(null, newValue)
                        },
                        context
                    )
                }
            }
        }

/**
 * UMD shizzle
 */
        return {
            createModelSchema: createModelSchema,
            createSimpleSchema: createSimpleSchema,
            setDefaultModelSchema: getDefaultModelSchema,
            getDefaultModelSchema: getDefaultModelSchema,
            serializable: serializable,
            serialize: serialize,
            deserialize: deserialize,
            update: update,
            primitive: primitive,
            identifier: identifier,
            alias: alias,
            list: list,
            map: map,
            child: child,
            ref: ref
        }
    }

    // UMD
    if (typeof exports === "object") {
        module.exports = mrFactory()
    } else if (typeof define === "function" && define.amd) {
        define("serializer", [], mrFactory)
    } else {
        this.serializer = mrFactory()
    }
})()

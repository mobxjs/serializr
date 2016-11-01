(function(g) {
    "use strict"

    function mrFactory() {
/*
 * Generic utility functions
 */
        function GUARDED_NOOP(err) {
            if (err) // unguarded error...
                throw new Error(err)
        }

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

        function isPrimitive(value) {
            if (value === null)
                return true
            return typeof value !== "object" && typeof value !== "function"
        }

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
        
        /**
         * Creates a model schema that (de)serializes from / to plain javascript objects.
         * Its factory method is: `() => ({})`
         *
         * @example
         * var todoSchema = createSimpleSchema({
         *   title: true,
         *   done: true
         * });
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
         * The created model schema is associated by the targeted type as default model schema, see setDefaultModelSchema.
         * Its factory method is `() => new clazz()` (unless overriden, see third arg).
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
         * @param {constructor|class} clazz class or constructor function
         * @param {object} props property mapping
         * @param {function} factory optional custom factory. Receives context as first arg
         * @returns {object} model schema
         */
        function createModelSchema(clazz, props, factory) {
            invariant(clazz !== Object, "one cannot simply put define a model schema for Object")
            invariant(typeof clazz === "function", "expected constructor function")
            var model = {
                targetClass: clazz,
                factory: factory || function() {
                    return new clazz()
                },
                props: props
            }
            // find super model
            if (clazz.prototype.constructor !== Object) {
                var s = getDefaultModelSchema(clazz.prototype.constructor)
                if (s && s.targetClass !== clazz)
                    model.extends = s
            }
            setDefaultModelSchema(clazz, model)
            return model
        }

        /**
         * Decorator that defines a new property mapping on the default model schema for the class
         * it is used in.
         *
         * When using typescript, the decorator can also be used on fields declared as constructor arguments (using the `private` / `protected` / `public` keywords).
         * The default factory will then invoke the constructor with the correct arguments as well.
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
         *
         * @param arg1
         * @param arg2
         * @param arg3
         * @returns {PropertyDescriptor}
         */
        function serializable(arg1, arg2, arg3) {
            if (arguments.length === 1) {
                // decorated with propSchema
                var propSchema = arg1 === true ? _defaultPrimitiveProp : arg1
                invariant(isPropSchema(propSchema), "@serializable expects prop schema")
                return serializableDecorator.bind(null, propSchema)
            } else {
                // decorated without arguments, treat as primitive
                return serializableDecorator(primitive(), arg1, arg2, arg3)
            }
        }

        // Ugly way to get the parameter names since they aren't easily retrievable via reflection
        var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg
        var ARGUMENT_NAMES = /([^\s,]+)/g
        function getParamNames(func) {
            var fnStr = func.toString().replace(STRIP_COMMENTS, "")
            var result = fnStr.slice(fnStr.indexOf("(")+1, fnStr.indexOf(")")).match(ARGUMENT_NAMES)
            if(result === null)
                result = []
            return result
        }

        function serializableDecorator(propSchema, target, propName, descriptor) {
            invariant(arguments.length >= 2, "too few arguments. Please use @serializable as property decorator")
            // Fix for @serializable used in class constructor params (typescript)
            var factory
            if (propName === undefined && typeof target === "function"
                && target.prototype
                && descriptor !== undefined && typeof descriptor === "number") {
                invariant(isPropSchema(propSchema), "Constructor params must use alias(name)")
                invariant(propSchema.jsonname, "Constructor params must use alias(name)")
                var paramNames = getParamNames(target)
                if (paramNames.length >= descriptor) {
                    propName = paramNames[descriptor];
                    propSchema.paramNumber = descriptor
                    descriptor = undefined
                    target = target.prototype
                    // Create a factory so the constructor is called properly
                    factory = function(context) {
                        function F(args) {
                            return target.constructor.apply(this, args)
                        }
                        F.prototype = target.constructor.prototype
                        var params = []
                        for (var i = 0; i < target.constructor.length; i++) {
                          Object.keys(context.modelSchema.props).forEach(function (key) {
                            var prop = context.modelSchema.props[key];
                            if (prop.paramNumber === i) {
                              params[i] = context.json[prop.jsonname];
                            }
                          });
                        }
                        return new F(params)
                    }
                }
            }
            invariant(typeof propName === "string", "incorrect usage of @serializable decorator")
            var info = getDefaultModelSchema(target)

            if (!info || !target.constructor.hasOwnProperty("serializeInfo"))
                info = createModelSchema(target.constructor, {}, factory)
            if (info && info.targetClass !== target.constructor)
                // fixes typescript issue that tends to copy fields from super constructor to sub constructor in extends
                info = createModelSchema(target.constructor, {}, factory)
            info.props[propName] = propSchema
            // MWE: why won't babel work without?
            if (descriptor && !descriptor.get && !descriptor.set)
                descriptor.writable = true
            return descriptor
        }

        /**
         * Returns the standard model schema associated with a class / constructor function
         *
         * @param {object} thing
         * @returns {ModelSchema} model schema
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
         * can be passed in as well (for example when using `object` or `ref`.
         *
         * When passing an instance of this class to `serialize`, it is not required to pass the model schema
         * as first argument anymore, because the default schema will be inferred from the instance type.
         *
         * @param {constructor|class} clazz class or constructor function
         * @param {ModelSchema} modelSchema - a model schema
         * @returns {ModelSchema} model schema
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
            return typeof propSchema === "object" && !!propSchema.jsonname
        }

        function isIdentifierPropSchema(propSchema) {
            return  typeof propSchema === "object" && propSchema.identifier === true
        }

        function getIdentifierProp(modelSchema) {
            invariant(isModelSchema(modelSchema))
            // optimization: cache this lookup
            while (modelSchema) {
                for (var propName in modelSchema.props)
                    if (typeof modelSchema.props[propName] === "object" && modelSchema.props[propName].identifier === true)
                        return propName
                modelSchema = modelSchema.extends
            }
            return null
        }

        function isAssignableTo(actualType, expectedType) {
            while (actualType) {
                if (actualType === expectedType)
                    return true
                actualType = actualType.extends
            }
            return false
        }

/*
 * ## Serialization and deserialization
 */

        /**
         * Serializes an object (graph) into json using the provided model schema.
         * The model schema can be omitted if the object type has a default model schema associated with it.
         * If a list of objects is provided, they should have an uniform type.
         *
         * @param arg1 modelschema to use. Optional
         * @param arg2 object(s) to serialize
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
            else {
// TODO, make invariant?:  invariant(!obj.constructor.prototype.constructor.serializeInfo, "object has a serializable supertype, but modelschema did not provide extends clause")
                res = {}
            }
            Object.keys(schema.props).forEach(function (key) {
                var propDef = schema.props[key]
                if (key === "*") {
                    invariant(propDef === true, "prop schema '*' can onle be used with 'true'")
                    serializeStarProps(schema, obj, res)
                    return
                }
                if (propDef === true)
                    propDef = _defaultPrimitiveProp
                if (propDef === false)
                    return
                var jsonValue = propDef.serializer(obj[key])
                res[propDef.jsonname || key] = jsonValue
            })
            return res
        }

        function serializeStarProps(schema, obj, target) {
            for (var key in obj) if (obj.hasOwnProperty(key)) if (!(key in schema.props)) {
                var value = obj[key]
                invariant(isPrimitive(value), "encountered non primitive value while serializing '*' properties in property '" + key + "': " + value)
                target[key] = value
            }
        }

/*
 * Deserialization
 */

        /**
         * Deserializes a json structor into an object graph.
         * This process might be asynchronous (for example if there are references with an asynchronous
         * lookup function). The function returns an object (or array of objects), but the returned object
         * might be incomplete until the callback has fired as well (which might happen immediately)
         *
         * @param {object|array} schema to use for deserialization
         * @param {json} json data to deserialize
         * @param {function} callback node style callback that is invoked once the deserializaiton has finished.
         * First argument is the optional error, second argument is the deserialized object (same as the return value)
         * @param {*} customArgs custom arguments that are available as `context.args` during the deserialization process. This can be used as dependency injection mechanism to pass in, for example, stores.
         * @returns {object|array} deserialized object, possibly incomplete.
         */
        function deserialize(schema, json, callback, customArgs) {
            invariant(arguments.length >= 2, "deserialize expects at least 2 arguments")
            schema = getDefaultModelSchema(schema)
            invariant(isModelSchema(schema), "first argument should be model schema")
            if (Array.isArray(json)) {
                var items = []
                parallel(
                    json,
                    function (childJson, itemDone) {
                        var instance = deserializeObjectWithSchema(null, schema, childJson, itemDone, customArgs)
                        // instance is created synchronously so can be pushed
                        items.push(instance)
                    },
                    callback || GUARDED_NOOP
                )
                return items
            } else
                return deserializeObjectWithSchema(null, schema, json, callback, customArgs)
        }

        function deserializeObjectWithSchema(parentContext, schema, json, callback, customArgs) {
            if (json === null || json === undefined)
                return void callback(null, null)
            var context = new Context(parentContext, schema, json, callback, customArgs)
            var target = schema.factory(context)
            // todo async invariant
            invariant(!!target, "No object returned from factory")
// TODO: make invariant?            invariant(schema.extends || !target.constructor.prototype.constructor.serializeInfo, "object has a serializable supertype, but modelschema did not provide extends clause")
            context.target = target
            var lock = context.createCallback(GUARDED_NOOP)
            deserializePropsWithSchema(context, schema, json, target)
            lock()
            return target
        }

        function deserializePropsWithSchema(context, schema, json, target) {
            if (schema.extends)
                deserializePropsWithSchema(context, schema.extends, json, target)
            Object.keys(schema.props).forEach(function (propName) {
                var propDef = schema.props[propName]
                if (propName === "*") {
                    invariant(propDef === true, "prop schema '*' can onle be used with 'true'")
                    deserializeStarProps(schema, target, json)
                    return
                }
                if (propDef === true)
                    propDef = _defaultPrimitiveProp
                if (propDef === false)
                    return
                var jsonAttr = propDef.jsonname || propName
                if (!(jsonAttr in json))
                    return
                propDef.deserializer(
                    json[jsonAttr],
                    // for individual props, use root context based callbacks
                    // this allows props to complete after completing the object itself
                    // enabling reference resolving and such
                    context.rootContext.createCallback(function (value) {
                        target[propName] = value
                    }),
                    context,
                    target[propName] // initial value
                )
            })
        }

        function schemaHasAlias(schema, name) {
            for (var key in schema.props)
                if (typeof schema.props[key] === "object" && schema.props[key].jsonname === name)
                    return true
            return false
        }

        function deserializeStarProps(schema, obj, json) {
            for (var key in json) if (!(key in schema.props) && !schemaHasAlias(schema, key)) {
                var value = json[key]
                invariant(isPrimitive(value), "encountered non primitive value while deserializing '*' properties in property '" + key + "': " + value)
                obj[key] = value
            }
        }

        function Context(parentContext, modelSchema, json, onReadyCb, customArgs) {
            this.parentContext = parentContext
            this.isRoot = !parentContext
            this.pendingCallbacks = 0
            this.pendingRefsCount = 0
            this.onReadyCb = onReadyCb || GUARDED_NOOP
            this.json = json
            this.target = null
            this.hasError = false
            this.modelSchema = modelSchema
            if (this.isRoot) {
                this.rootContext = this
                this.args = customArgs
                this.pendingRefs = {} // uuid: [{ modelSchema, uuid, cb }]
                this.resolvedRefs = {} // uuid: [{ modelSchema, value }]
            } else {
                this.rootContext = parentContext.rootContext
                this.args = parentContext.args
            }
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
                    if (--this.pendingCallbacks === this.pendingRefsCount) {
                        if (this.pendingRefsCount > 0)
                            // all pending callbacks are pending reference resolvers. not good.
                            this.onReadyCb(new Error(
                                "Unresolvable references in json: \"" +
                                Object.keys(this.pendingRefs).filter(function (uuid) {
                                    return this.pendingRefs[uuid].length > 0
                                }, this).join("\", \"") +
                                 "\""
                            ))
                        else
                            this.onReadyCb(null, this.target)
                    }
                }
            }.bind(this))
        }

        // given an object with uuid, modelSchema, callback, awaits until the given uuid is available
        // resolve immediately if possible
        Context.prototype.await = function (modelSchema, uuid, callback) {
            invariant(this.isRoot)
            if (uuid in this.resolvedRefs) {
                var match = this.resolvedRefs[uuid].filter(function (resolved) {
                    return isAssignableTo(resolved.modelSchema, modelSchema)
                })[0]
                if (match)
                    return void callback(null, match.value)
            }
            this.pendingRefsCount++
            if (!this.pendingRefs[uuid])
                this.pendingRefs[uuid] = []
            this.pendingRefs[uuid].push({
                modelSchema: modelSchema,
                uuid: uuid,
                callback: callback
            })
        }

        // given a modelschema, uuid and value, resolve all references that where looking for this object
        Context.prototype.resolve = function(modelSchema, uuid, value) {
            invariant(this.isRoot)
            if (!this.resolvedRefs[uuid])
                this.resolvedRefs[uuid] = []
            this.resolvedRefs[uuid].push({
                modelSchema: modelSchema, value: value
            })
            if (uuid in this.pendingRefs) {
                for (var i = this.pendingRefs[uuid].length - 1; i >= 0; i--) {
                    var opts = this.pendingRefs[uuid][i]
                    if (isAssignableTo(modelSchema, opts.modelSchema)) {
                        this.pendingRefs[uuid].splice(i, 1)
                        this.pendingRefsCount--
                        opts.callback(null, value)
                    }
                }
            }
        }

/*
 * Update
 */
        /**
         * Similar to deserialize, but updates an existing object instance.
         * Properties will always updated entirely, but properties not present in the json will be kept as is.
         * Further this method behaves similar to deserialize.
         *
         * @param {object} modelSchema, optional if it can be inferred from the instance type
         * @param {object} target target instance to update
         * @param {object} json the json to deserialize
         * @param {function} callback the callback to invoke once deserialization has completed.
         * @param {*} customArgs custom arguments that are available as `context.args` during the deserialization process. This can be used as dependency injection mechanism to pass in, for example, stores.
         */
        function update(modelSchema, target, json, callback, customArgs) {
            var inferModelSchema =
                arguments.length === 2 // only target and json
                || typeof arguments[2] === "function" // callback as third arg

            if (inferModelSchema) {
                target = arguments[0]
                modelSchema = getDefaultModelSchema(target)
                json = arguments[1]
                callback = arguments[2]
                customArgs = arguments[3]
            }
            invariant(isModelSchema(modelSchema), "update failed to determine schema")
            invariant(typeof target === "object" && target && !Array.isArray(target), "update needs an object")
            var context = new Context(null, modelSchema, json, callback, customArgs)
            context.target = target
            var lock = context.createCallback(GUARDED_NOOP)
            deserializePropsWithSchema(context, modelSchema, json, target)
            lock()
        }

/*
 * ## Property schemas
 */

        var _defaultPrimitiveProp = primitive()


        /**
         * Indicates that this field contains a primitive value (or Date) which should be serialized literally to json.
         *
         * @example
         * createModelSchema(Todo, {
         *   title: primitive()
         * })
         *
         * console.dir(serialize(new Todo("test")))
         * // outputs: { title : "test" }
         *
         * @returns {ModelSchema}
         */
        function primitive() {
            return {
                serializer: function (value) {
                    invariant(isPrimitive(value), "this value is not primitive: " + value)
                    return value
                },
                deserializer: function (jsonValue, done) {
                    if (!isPrimitive(jsonValue))
                        return void done("[serializr] this value is not primitive: " + jsonValue)
                    return void done(null, jsonValue)
                }
            }
        }

        /**
         *
         *
         * Similar to primitive, but this field will be marked as the identifier for the given Model type.
         * This is used by for example `reference()` to serialize the reference
         *
         * Identifier accepts an optional `registerFn` with the signature:
         * `(id, target, context) => void`
         * that can be used to register this object in some store. note that not all fields of this object might
         * have been deserialized yet.
         *
         * @example
         * var todos = {};
         *
         * var s = _.createSimpleSchema({
         *     id: _.identifier((id, object) => todos[id] = object),
         *     title: true
         * })
         *
         * _.deserialize(s, {
         *     id: 1, title: "test0"
         * })
         * _.deserialize(s, [
         *     { id: 2, title: "test2" },
         *     { id: 1, title: "test1" }
         * ])
         *
         * t.deepEqual(todos, {
         *     1: { id: 1, title: "test1" },
         *     2: { id: 2, title: "test2" }
         * })
         *
         *
         * @param {RegisterFunction} registerFn optional function to register this object during creation.
         *
         * @returns {PropSchema}
         */
        function identifier(registerFn) {
            invariant(!registerFn || typeof registerFn === "function", "First argument should be ommitted or function")
            return {
                identifier: true,
                serializer: _defaultPrimitiveProp.serializer,
                deserializer: function (jsonValue, done, context) {
                    _defaultPrimitiveProp.deserializer(jsonValue, function(err, id) {
                        defaultRegisterFunction(id, context.target, context)
                        if (registerFn)
                            registerFn(id, context.target, context)
                        done(err, id)
                    })
                }
            }
        }

        function defaultRegisterFunction(id, value, context) {
            context.rootContext.resolve(context.modelSchema, id, context.target)
        }

        /**
         * Similar to primitive, serializes instances of Date objects
         *
         * @returns
         */
        function date() {
            // TODO: add format option?
            return {
                serializer: function(value) {
                    if (value === null || value === undefined)
                        return value
                    invariant(value instanceof Date, "Expected Date object")
                    return value.getTime()
                },
                deserializer: function (jsonValue, done) {
                    if (jsonValue === null || jsonValue === undefined)
                        return void done(null, jsonValue)
                    return void done(null, new Date(jsonValue))
                }
            }
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
         * @param {string} name name of the json field to be used for this property
         * @param {PropSchema} propSchema propSchema to (de)serialize the contents of this field
         * @returns {PropSchema}
         */
        function alias(name, propSchema) {
            invariant(name && typeof name === "string", "expected prop name as first argument")
            propSchema = (!propSchema || propSchema === true)  ? _defaultPrimitiveProp : propSchema
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
         * Can be used to create simple custom propSchema.
         *
         * @example
         * var schema = _.createSimpleSchema({
         *   a: _.custom(
         *     function(v) { return v + 2 },
         *     function(v) { return v - 2 }
         *   )
         * })
         * t.deepEqual(_.serialize(s, { a: 4 }), { a: 6 })
         * t.deepEqual(_.deserialize(s, { a: 6 }), { a: 4 })
         *
         * @param {function} serializer function that takes a model value and turns it into a json value
         * @param {function} deserializer function that takes a json value and turns it into a model value
         * @returns {PropSchema}
         */
        function custom(serializer, deserializer) {
            invariant(typeof serializer === "function", "first argument should be function")
            invariant(typeof deserializer === "function", "second argument should be function")
            return {
                serializer: serializer,
                deserializer: function (jsonValue, done) {
                    done(null, deserializer(jsonValue))
                }
            }
        }

        /**
         * `object` indicates that this property contains an object that needs to be (de)serialized
         * using its own model schema.
         *
         * N.B. mind issues with circular dependencies when importing model schema's from other files! The module resolve algorithm might expose classes before `createModelSchema` is executed for the target class.
         *
         * @example
         *
         * class SubTask{}
         * class Todo{}
         *
         * createModelSchema(SubTask, {
         *   title: true
         * });
         * createModelSchema(Todo, {
         *   title: true,
         *   subTask: object(SubTask)
         * });
         *
         * const todo = deserialize(Todo, {
         *   title: "Task",
         *   subTask: {
         *     title: "Sub task"
         *   }
         * });
         *
         * @param {ModelSchema} modelSchema to be used to (de)serialize the object
         * @returns {PropSchema}
         */
        function object(modelSchema) {
            invariant(typeof modelSchema === "object" || typeof modelSchema === "function", "No modelschema provided. If you are importing it from another file be aware of circular dependencies.")
            return {
                serializer: function (item) {
                    modelSchema = getDefaultModelSchema(modelSchema)
                    invariant(isModelSchema(modelSchema), "expected modelSchema, got " + modelSchema)
                    if (item === null || item === undefined)
                        return item
                    return serialize(modelSchema, item)
                },
                deserializer: function (childJson, done, context) {
                    modelSchema = getDefaultModelSchema(modelSchema)
                    invariant(isModelSchema(modelSchema), "expected modelSchema, got " + modelSchema)
                    if (childJson === null || childJson === undefined)
                        return void done(null, childJson)
                    return void deserializeObjectWithSchema(context, modelSchema, childJson, done)
                }
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
         *
         *
         * class User{}
         * class Post{}
         *
         * createModelSchema(User, {
         *   uuid: identifier(),
         *   displayname: primitive()
         * })
         *
         * createModelSchema(Post, {
         *   author: reference(User, findUserById),
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
         * @param target: ModelSchema or string
         * @param {RefLookupFunction} lookupFn function
         * @returns {PropSchema}
         */
        function reference(target, lookupFn) {
            invariant(!!target, "No modelschema provided. If you are importing it from another file be aware of circular dependencies.")
            var initialized = false
            var childIdentifierAttribute
            function initialize() {
                initialized = true
                invariant(typeof target !== "string" || lookupFn, "if the reference target is specified by attribute name, a lookup function is required")
                invariant(!lookupFn || typeof lookupFn === "function", "second argument should be a lookup function")
                if (typeof target === "string")
                    childIdentifierAttribute = target
                else {
                    var modelSchema = getDefaultModelSchema(target)
                    invariant(isModelSchema(modelSchema), "expected model schema or string as first argument for 'ref', got " + modelSchema)
                    lookupFn = lookupFn || createDefaultRefLookup(modelSchema)
                    childIdentifierAttribute = getIdentifierProp(modelSchema)
                    invariant(!!childIdentifierAttribute, "provided model schema doesn't define an identifier() property and cannot be used by 'ref'.")
                }
            }
            return {
                serializer: function (item) {
                    if (!initialized)
                        initialize()
                    return item ? item[childIdentifierAttribute] : null
                },
                deserializer: function(identifierValue, done, context) {
                    if (!initialized)
                        initialize()
                    if (identifierValue === null || identifierValue === undefined)
                        done(null, identifierValue)
                    else
                        lookupFn(identifierValue, done, context)
                }
            }
        }

        function createDefaultRefLookup(modelSchema) {
            return function resolve(uuid, cb, context) {
                context.rootContext.await(modelSchema, uuid, cb)
            }
        }

        /**
         * List indicates that this property contains a list of things.
         * Accepts a sub model schema to serialize the contents
         *
         * @example
         *
         * class SubTask{}
         * class Task{}
         * class Todo{}
         *
         * createModelSchema(SubTask, {
         *   title: true
         * })
         * createModelSchema(Todo, {
         *   title: true,
         *   subTask: list(object(SubTask))
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
         * @param {*} propSchema
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

/*
 * UMD shizzle
 */
        return {
            createModelSchema: createModelSchema,
            createSimpleSchema: createSimpleSchema,
            setDefaultModelSchema: setDefaultModelSchema,
            getDefaultModelSchema: getDefaultModelSchema,
            serializable: serializable,
            serialize: serialize,
            deserialize: deserialize,
            update: update,
            primitive: primitive,
            identifier: identifier,
            date: date,
            alias: alias,
            list: list,
            map: map,
            object: object,
            child: object, // deprecate
            reference: reference,
            ref: reference, // deprecate
            custom: custom
        }
    }

    // UMD
    if (typeof exports === "object") {
        module.exports = mrFactory()
    } else if (typeof define === "function" && define.amd) {
        define("serializr", [], mrFactory)
    } else {
        g.serializr = mrFactory()
    }
})(function() { return this }())

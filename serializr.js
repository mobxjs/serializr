(function() {
    "use strict"

    function mrFactory() {
/**
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

/**
 * Serializr utilities
 */
        var _defaultPrimitiveProp = primitive()

        function createSimpleSchema(props) {
            return {
                factory: function() {
                    return {}
                },
                props: props
            }
        }

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
            return ("jsonname" in propSchema)
        }

        function isContext(thing) {
            return thing instanceof Context
        }

        function serializableDecorator(propSchema, target, propName, descriptor) {
            invariant(arguments.length >= 2, "too few arguments. Please use @serializable as property decorator")
            invariant(typeof propName === "string", "incorrect usage of @serializable decorator")
            var info = getDefaultModelSchema(target)
            if (!info) {
                var constructor = target.constructor
                info = setDefaultModelSchema(
                    target,
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
/**
 * Serialization
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

/** 
 * Deserialization
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

/**
 * Update
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
 * Built in property types
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

        function alias(name, propSchema) {
            invariant(name && typeof name === "string", "expected prop name as first argument")
            propSchema = propSchema || _defaultPrimitiveProp
            invariant(isPropSchema(propSchema), "expected prop schema as second argument")
            invariant(!isAliasedPropSchema(propSchema), "provided prop is already aliased")
            return {
                jsonname: name,
                serializer: propSchema.serializer,
                deserializer: propSchema.deserializer
            }
        }

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

        function ref(childIdentifierAttribute, lookupFn) {
            invariant(typeof childIdentifierAttribute === "string", "first argument should be a string")
            invariant(typeof lookupFn === "function", "second argument should be a lookup function")
            return {
                serializer: function (item) {
                    return item ? item[childIdentifierAttribute] : null
                },
                deserializer: function(identifier, done, context) {
                    lookupFn(identifier, done, context)   
                }
            }
        }

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
            getDefaultModelSchema: getDefaultModelSchema,
            isModelSchema: isModelSchema,
            isPropSchema: isPropSchema,
            isContext: isContext,
            serializable: serializable,
            serialize: serialize,
            deserialize: deserialize,
            update: update,
            primitive: primitive,
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

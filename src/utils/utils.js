export function GUARDED_NOOP(err) {
    if (err) // unguarded error...
        throw new Error(err)
}

export function once(fn) {
    var fired = false
    return function() {
        if (!fired) {
            fired = true
            return fn.apply(null, arguments)
        }
        invariant(false, "callback was invoked twice")
    }
}

export function invariant(cond, message) {
    if (!cond)
        throw new Error("[serializr] " + (message || "Illegal State"))
}

export function parallel(ar, processor, cb) {
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

export function isPrimitive(value) {
    if (value === null)
        return true
    return typeof value !== "object" && typeof value !== "function"
}

export function isModelSchema(thing) {
    return thing && thing.factory && thing.props
}

export function isPropSchema(thing) {
    return thing && thing.serializer && thing.deserializer
}

export function isAliasedPropSchema(propSchema) {
    return typeof propSchema === "object" && !!propSchema.jsonname
}

export function isIdentifierPropSchema(propSchema) {
    return  typeof propSchema === "object" && propSchema.identifier === true
}

export function isAssignableTo(actualType, expectedType) {
    while (actualType) {
        if (actualType === expectedType)
            return true
        actualType = actualType.extends
    }
    return false
}

export function isMapLike(thing) {
    return thing && typeof thing.keys === "function" && typeof thing.clear === "function"
}

export function isPromise(obj) {
    return !!obj && (typeof obj === "object" || typeof obj === "function") && typeof obj.then === "function"
}

export function getIdentifierProp(modelSchema) {
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

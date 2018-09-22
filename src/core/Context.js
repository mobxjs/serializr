import { extend, GUARDED_NOOP, once, invariant, isAssignableTo } from "../utils/utils"

var rootContextCache = new Map()

export default function Context(parentContext, modelSchema, json, onReadyCb, customArgs) {
    this.parentContext = parentContext
    this.isRoot = !parentContext
    this.pendingCallbacks = 0
    this.pendingRefsCount = 0
    this.onReadyCb = onReadyCb || GUARDED_NOOP
    this.json = json
    this.target = null // always set this property using setTarget
    this.hasError = false
    this.modelSchema = modelSchema
    if (this.isRoot) {
        this.rootContext = this
        this.args = customArgs
        this.pendingRefs = {} // uuid: [{ modelSchema, uuid, cb }]
        this.resolvedRefs = {} // uuid: [{ modelSchema, value }]
    } else {
        this.rootContext = parentContext.rootContext
        var args = parentContext.args
        if (customArgs) {
            if (args) {
                extend(args, customArgs)
            } else {
                args = customArgs
            }
        }
        this.args = args
    }
}

Context.prototype.createCallback = function (fn) {
    this.pendingCallbacks++
    // once: defend against user-land calling 'done' twice
    return once(function (err, value) {
        if (err) {
            if (!this.hasError) {
                this.hasError = true
                this.onReadyCb(err)
                rootContextCache.delete(this)
            }
        } else if (!this.hasError) {
            fn(value)
            if (--this.pendingCallbacks === this.pendingRefsCount) {
                if (this.pendingRefsCount > 0) {
                    // all pending callbacks are pending reference resolvers. not good.
                    this.onReadyCb(new Error(
                        "Unresolvable references in json: \"" +
                        Object.keys(this.pendingRefs).filter(function (uuid) {
                            return this.pendingRefs[uuid].length > 0
                        }, this).join("\", \"") +
                        "\""
                    ))
                    rootContextCache.delete(this)
                } else {
                    this.onReadyCb(null, this.target)
                    rootContextCache.delete(this)
                }
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

// given a model schema, uuid and value, resolve all references that where looking for this object
Context.prototype.resolve = function (modelSchema, uuid, value) {
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

// set target and update root context cache
Context.prototype.setTarget = function (target) {
    if (this.isRoot && this.target) {
        rootContextCache.delete(this.target)
    }
    this.target = target
    rootContextCache.set(this.target, this)
}

// call all remaining reference lookup callbacks indicating an error during ref resolution
Context.prototype.cancelAwaits = function () {
    invariant(this.isRoot)
    var self = this
    Object.keys(this.pendingRefs).forEach(function (uuid) {
        self.pendingRefs[uuid].forEach(function (refOpts) {
            self.pendingRefsCount--
            refOpts.callback(new Error("Reference resolution canceled for " + uuid))
        })
    })
    this.pendingRefs = {}
    this.pendingRefsCount = 0
}

export function getTargetContext(target) {
    return rootContextCache.get(target)
}

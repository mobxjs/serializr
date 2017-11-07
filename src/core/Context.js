import { once, invariant, isAssignableTo } from "../utils/utils"
import { BaseContext } from "./BaseContext";

export default function Context(parentContext, modelSchema, json, onReadyCb, customArgs) {
    BaseContext.call(this, parentContext, onReadyCb);

    this.pendingCallbacks = 0
    this.pendingRefsCount = 0
    this.json = json
    this.target = null
    this.modelSchema = modelSchema
    if (this.isRoot) {
        this.args = customArgs
        this.pendingRefs = {} // uuid: [{ modelSchema, uuid, cb }]
        this.resolvedRefs = {} // uuid: [{ modelSchema, value }]
    } else if (parentContext) {
        this.args = parentContext.args
    }
}

Context.prototype = new BaseContext();

Context.prototype.createCallback = function (fn) {
    this.pendingCallbacks++
    // once: defend against user-land calling 'done' twice
    return once(function(err, value) {
        if (err) {
            if (!this.hasError) {
                this.setError(err);
                this.finished();
            }
        } else if (!this.hasError) {
            fn(value)
            if (--this.pendingCallbacks === this.pendingRefsCount) {
                if (this.pendingRefsCount > 0) {
                    // all pending callbacks are pending reference resolvers. not good.
                    this.setError(new Error(
                        "Unresolvable references in json: \"" +
                        Object.keys(this.pendingRefs).filter(function (uuid) {
                            return this.pendingRefs[uuid].length > 0
                        }, this).join("\", \"") +
                        "\""
                    ));
                }
                this.finished(this.target);
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
import { GUARDED_NOOP, once, invariant, isAssignableTo } from "../utils/utils"
import { ClazzOrModelSchema, ModelSchema } from "../api/types"

const rootContextCache = new WeakMap()

// export interface Context {
//     json: any
//     target: any
//     parentContext: Context
//     args: any
//     await(
//         modelschema: ClazzOrModelSchema<any>,
//         id: string,
//         callback?: (err: any, result: any) => void
//     ): any
//     rootContext: Context
// }
export default class Context<T = any> {
    private isRoot: boolean
    private pendingCallbacks: number
    private pendingRefsCount: number
    public target: any
    private hasError: boolean
    public rootContext: Context<any>
    private args: any
    private pendingRefs!: {
        [uuid: string]: {
            modelSchema: ModelSchema<any>
            uuid: string
            callback: (err?: any, value?: any) => void
        }[]
    }
    private resolvedRefs!: {
        [uuid: string]: {
            modelSchema: ModelSchema<any>
            value: any
        }[]
    }

    constructor(
        readonly parentContext: Context<any> | undefined,
        readonly modelSchema: ModelSchema<T>,
        readonly json: any,
        private readonly onReadyCb: (err?: any, value?: T) => void,
        customArgs?: any[]
    ) {
        this.isRoot = !parentContext
        this.pendingCallbacks = 0
        this.pendingRefsCount = 0
        this.target = undefined // always set this property using setTarget
        this.hasError = false
        if (!parentContext) {
            this.rootContext = this
            this.args = customArgs
            this.pendingRefs = {}
            this.resolvedRefs = {}
        } else {
            this.rootContext = parentContext.rootContext
            this.args = parentContext.args
        }
    }

    createCallback(fn: (value: T) => void) {
        this.pendingCallbacks++
        // once: defend against user-land calling 'done' twice
        return once((err?: any, value?: T) => {
            if (err) {
                if (!this.hasError) {
                    this.hasError = true
                    this.onReadyCb(err)
                    rootContextCache.delete(this)
                }
            } else if (!this.hasError) {
                fn(value!)
                if (--this.pendingCallbacks === this.pendingRefsCount) {
                    if (this.pendingRefsCount > 0) {
                        // all pending callbacks are pending reference resolvers. not good.
                        this.onReadyCb(
                            new Error(
                                'Unresolvable references in json: "' +
                                    Object.keys(this.pendingRefs)
                                        .filter(uuid => this.pendingRefs[uuid].length > 0)
                                        .join('", "') +
                                    '"'
                            )
                        )
                        rootContextCache.delete(this)
                    } else {
                        this.onReadyCb(null, this.target)
                        rootContextCache.delete(this)
                    }
                }
            }
        })
    }

    // given an object with uuid, modelSchema, callback, awaits until the given uuid is available
    // resolve immediately if possible
    await(modelSchema: ModelSchema<any>, uuid: string, callback: (err?: any, value?: any) => void) {
        invariant(this.isRoot, "await can only be called on the root context")
        if (uuid in this.resolvedRefs) {
            const match = this.resolvedRefs[uuid].filter(function(resolved) {
                return isAssignableTo(resolved.modelSchema, modelSchema)
            })[0]
            if (match) return void callback(null, match.value)
        }
        this.pendingRefsCount++
        if (!this.pendingRefs[uuid]) this.pendingRefs[uuid] = []
        this.pendingRefs[uuid].push({
            modelSchema: modelSchema,
            uuid: uuid,
            callback: callback
        })
    }

    // given a model schema, uuid and value, resolve all references that were looking for this object
    resolve(modelSchema: ModelSchema<any>, uuid: string, value: any) {
        invariant(this.isRoot, "resolve can only called on the root context")
        if (!this.resolvedRefs[uuid]) this.resolvedRefs[uuid] = []
        this.resolvedRefs[uuid].push({
            modelSchema: modelSchema,
            value: value
        })
        if (uuid in this.pendingRefs) {
            for (let i = this.pendingRefs[uuid].length - 1; i >= 0; i--) {
                const opts = this.pendingRefs[uuid][i]
                if (isAssignableTo(modelSchema, opts.modelSchema)) {
                    this.pendingRefs[uuid].splice(i, 1)
                    this.pendingRefsCount--
                    opts.callback(null, value)
                }
            }
        }
    }

    // set target and update root context cache
    setTarget(target: T) {
        if (this.isRoot && this.target) {
            rootContextCache.delete(this.target)
        }
        this.target = target
        rootContextCache.set(this.target, this)
    }

    // call all remaining reference lookup callbacks indicating an error during ref resolution
    cancelAwaits() {
        invariant(this.isRoot, "cancelAwaits can only be called on the root context")
        const self = this
        Object.keys(this.pendingRefs).forEach(function(uuid) {
            self.pendingRefs[uuid].forEach(function(refOpts) {
                self.pendingRefsCount--
                refOpts.callback(new Error("Reference resolution canceled for " + uuid))
            })
        })
        this.pendingRefs = {}
        this.pendingRefsCount = 0
    }
}
export function getTargetContext(target: any) {
    return rootContextCache.get(target)
}

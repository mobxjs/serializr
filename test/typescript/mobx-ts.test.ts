import {
    serializable,
    alias,
    date,
    list,
    map,
    mapAsArray,
    object,
    optional,
    identifier,
    reference,
    primitive,
    serialize,
    cancelDeserialize,
    deserialize,
    serializeAll,
    getDefaultModelSchema,
    custom,
    AdditionalPropArgs,
    SKIP,
} from "../../src/serializr"

import test from "tape"

import {
    observable,
    autorun,
    runInAction,
    getObserverTree,
    getDependencyTree,
    makeObservable,
} from "mobx"

describe("Basic functionality", () => {
    it("Typescript should work with MobX reactive class", () => {
        class A {
            @serializable
            @observable
            w

            @serializable
            @observable
            x = 3

            @observable
            @serializable(primitive())
            y = 4

            @serializable(true)
            z = 5

            constructor() {
                makeObservable(this)
            }
        }

        const a = new A()

        let res
        let called = 0
        autorun((reaction) => {
            called++
            res = serialize(a)
        })

        expect(called).toBe(1)
        expect(res).toEqual({ w: undefined, x: 3, y: 4, z: 5 })
        a.z++ // no autorun
        expect(a.z).toBe(6)

        runInAction(() => a.y++)
        expect(called).toBe(2)
        expect(res).toEqual({ w: undefined, x: 3, y: 5, z: 6 })

        runInAction(() => a.x++)
        expect(called).toBe(3)
        expect(res).toEqual({ w: undefined, x: 4, y: 5, z: 6 })

        const b = deserialize(A, { x: 1, y: 2, z: 3 })
        expect(serialize(b)).toEqual({ w: undefined, x: 1, y: 2, z: 3 })
        expect(b).toBeInstanceOf(A)
    })
})

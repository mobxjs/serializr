import { autorun, makeObservable, observable, runInAction } from "mobx"
import { deserialize, primitive, serializable, serialize } from "../../src/serializr"

describe("Mobx integration", () => {
    it("should work with MobX reactive class", () => {
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
        autorun(() => {
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

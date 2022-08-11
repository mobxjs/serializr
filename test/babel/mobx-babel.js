import { autorun, makeObservable, observable, runInAction } from "mobx"
import {
    deserialize, primitive, serializable, serialize
} from "../../"

const test = require("tape")

test("Babel should work with MobX reactive class", (t) => {
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

        constructor(){
            makeObservable(this);
        }
    }

    const a = new A()

    let res
    let called = 0
    autorun(() => {
        called++
        res = serialize(a)
    })

    t.equal(called, 1)
    t.deepEqual(res, { w: undefined, x: 3, y: 4, z: 5 })
    a.z++ // no autorun
    t.equal(a.z, 6)

    runInAction(() => a.y++)
    t.equal(called, 2)
    t.deepEqual(res, { w: undefined, x: 3, y: 5, z: 6 })

    runInAction(() => a.x++)
    t.equal(called, 3)
    t.deepEqual(res, { w: undefined, x: 4, y: 5, z: 6 })

    const b = deserialize(A, { x: 1, y: 2, z: 3 })
    t.deepEqual(serialize(b), { w: undefined, x: 1, y: 2, z: 3 })
    t.ok(b instanceof A)

    t.end()
})
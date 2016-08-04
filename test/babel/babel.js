import {serializable, primitive, serialize, deserialize} from "../../";
import {observable, autorun} from "mobx";

const test = require("tape");

test("should work in babel", t => {
    class A {
        @serializable @observable
        x = 3;

        @observable @serializable(primitive())
        y = 4;

        @serializable(true)
        z = 5;
    }

    const a = new A();

    let res;
    let called = 0;
    autorun(() => {
        called++;
        res = serialize(a)
    });

    t.equal(called, 1);
    t.deepEqual(res, { x: 3, y: 4, z: 5});
    a.z++; // no autorun
    t.equal(a.z, 6);

    a.y++;
    t.equal(called, 2);
    t.deepEqual(res, { x: 3, y: 5, z: 6});

    a.x++;
    t.equal(called, 3);
    t.deepEqual(res, { x: 4, y: 5, z: 6});

    const b = deserialize(A, { x: 1, y: 2, z: 3});
    t.deepEqual(serialize(b), {x: 1, y: 2, z: 3});
    t.ok(b instanceof A);

    t.end();
});

test("[babel] it should handle prototypes", t => {
    class A {
        @serializable a = "hoi";
        @serializable a2 = "oeps";
    }

    class B extends A {
        @serializable b = "boe";
        @serializable b2 = "oef"
    }

    t.deepEqual(serialize(new A()), {
        a: "hoi", a2: "oeps"
    });

    t.deepEqual(serialize(new B()), {
        a: "hoi", a2: "oeps",
        b: "boe", b2: "oef"
    });

    t.end();
});
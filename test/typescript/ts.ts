import {serializable, alias, list, object, identifier, reference, primitive, serialize, deserialize} from "../../";
import {observable, autorun} from "mobx";

declare var require;
const test = require("tape");

test("should work in typescript", t => {
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

test("typescript class with constructor params", t => {
   class Rectangle {
      @serializable
      public someNumber: number;

      constructor(@serializable(alias("identifier", identifier())) public id: string, @serializable(alias("width", true)) public width: number, @serializable(alias("height", true)) public height: number) { }

      public getArea(): number {
        return this.width * this.height;
      }
    }

    const a = new Rectangle("A", 10, 20);
    a.someNumber = 123;
    
    let json = serialize(a);
    const b = deserialize(Rectangle, json);
    t.equal(a.id, b.id);
    t.equal(a.width, b.width);
    t.equal(a.height, b.height);
    t.equal(a.someNumber, b.someNumber);
    t.equal(b.getArea(), 200);

    t.end();
});

test("[ts] it should handle prototypes", t => {
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

test.skip("[ts] it should handle not yet defined modelschema's for classes", t => {
    // classes are declared as var, not as function, so aren't hoisted :'(
    class Message {
        @serializable(list(object(Comment)))
        child = [];

        @serializable(reference(Comment))
        ref = null;
    }
    class Comment {
        @serializable(identifier()) id = 0;
        @serializable(true) title;
    }

    const json = {
        ref: 1,
        child: [
            { id: 2, title: "foo" },
            { id: 1, title: "bar "}
        ]
    };
    const m = deserialize(Message, json);

    t.equal(m.child.length, 2);
    t.ok(m.child[1] === m.ref);

    t.deepEqual(serialize(m), json);

    t.end();
});

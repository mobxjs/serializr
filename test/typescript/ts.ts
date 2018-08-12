import {
    serializable,
    alias,
    date,
    list,
    map,
    mapAsArray,
    object,
    identifier,
    reference,
    primitive,
    serialize,
    deserialize,
    serializeAll,
    custom
} from "../../";
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
    t.deepEqual(res, {x: 3, y: 4, z: 5});
    a.z++; // no autorun
    t.equal(a.z, 6);

    a.y++;
    t.equal(called, 2);
    t.deepEqual(res, {x: 3, y: 5, z: 6});

    a.x++;
    t.equal(called, 3);
    t.deepEqual(res, {x: 4, y: 5, z: 6});

    const b = deserialize(A, {x: 1, y: 2, z: 3});
    t.deepEqual(serialize(b), {x: 1, y: 2, z: 3});
    t.ok(b instanceof A);

    t.end();
});

test("typescript class with constructor params", t => {
    class Rectangle {
        @serializable
        public someNumber: number;

        @serializable(alias("identifier", identifier()))
        public id: string;

        @serializable(alias("width", true))
        public width: number

        @serializable(alias("height", true))
        public height: number

        constructor(id: string, width: number, height: number) {
            this.id = id;
            this.width = width;
            this.height = height;
        }

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

test("typescript class with only constructor params", t => {
    class Rectangle {
        @serializable(alias("identifier", identifier()))
        public id: string;

        @serializable(alias("width", true))
        public width: number

        @serializable(alias("height", true))
        public height: number

        constructor(id: string, width: number, height: number) {
            this.id = id;
            this.width = width;
            this.height = height;
        }
    }

    const a = new Rectangle("A", 10, 20);

    let json = serialize(a);
    const b = deserialize(Rectangle, json);
    t.equal(a.id, b.id);
    t.equal(a.width, b.width);
    t.equal(a.height, b.height);

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

test("[ts] custom prop schemas", t => {
    function customSerializer(v) {
        return v
    }

    function customDeserializer(jsonValue, context, oldValue) {
        return jsonValue
    }

    function customAsyncDeserializer(jsonValue, context, oldValue, done) {
        done(null, jsonValue)
    }

    class A {
        @serializable(custom(customSerializer, customDeserializer)) a = "hoi";
        @serializable(custom(customSerializer, customAsyncDeserializer)) a2 = "oeps";
    }

    let result = serialize(new A())
    const initial = {
        a: "hoi", a2: "oeps"
    }
    const updated = {
        a: "all", a2: "new"
    }
    t.deepEqual(result, initial)


    deserialize(A, updated, (err, resultObj) => {
        err ? t.end(err) : null
        result = serialize(resultObj)
        t.deepEqual(result, updated)
        t.end()
    })
});

test.skip("[ts] it should handle not yet defined modelschema's for classes", t => {
    // classes are declared as var, not as function, so aren't hoisted :'(
    class Comment {
        @serializable(identifier()) id = 0;
        @serializable(true) title;
    }

    class Message {
        @serializable(list(object(Comment)))
        child = [];

        @serializable(reference(Comment))
        ref = null;
    }

    const json = {
        ref: 1,
        child: [
            {id: 2, title: "foo"},
            {id: 1, title: "bar "}
        ]
    };
    const m = deserialize(Message, json);

    t.equal(m.child.length, 2);
    t.ok(m.child[1] === m.ref);

    t.deepEqual(serialize(m), json);

    t.end();
});

test("[ts] additional lifecycle handlers 'beforeDeserialize' and 'afterDeserialize'", t => {

    const jsonInput = {
        id1: 1101,
        id11: 1102,
        custom1: 2,
        customAsync1: "trigger error",
        date1: 1534021029937,
        listObj1: [
            {
                id1: 1121,
                text1: "good data",
                valid1: true
            },
            {
                id1: 1122,
                text1: "ignored",
                valid1: false
            },
            null,
            1234,
            "invalid"
        ],
        mapObj1: {
            1131: {
                id1: 1131,
                text1: "good data",
                valid1: true
            },
            1132: {
                id1: 1132,
                text1: "ignored",
                valid1: false
            },
            1133: null
        },
        mapRefObj1: {
            1131: 1131,
            1132: 1132,
            1133: 1133
        },
        mapArrayRefObj1: {
            1131: 1131,
            1132: 1132,
            1133: 1133
        },
        obj1: {
            id1: 1141,
            text1: "yee"
        },
        primitiveNumber1: 12,
        primitiveText1: "foo",
        aliasPrimitiveText1: "yo",
    }

    const jsonResult = {
        id: 1101,
        custom: 2,
        customAsync: "ok now",
        date: 1534021029937,
        listObj: [
            {
                id: 1121,
                text: "good data",
                valid: true
            },
            {
                id: 1122,
                text: "ignored",
                valid: false
            }
        ],
        mapObj: {
            1131: {
                id: 1131,
                text: "good data",
                valid: true
            },
            1132: {
                id: 1132,
                text: "ignored",
                valid: false
            }
        },
        mapRefObj: {
            1131: 1131,
            1132: 1132,
        },
        mapArrayRefObj: {
            1131: 1131,
            1132: 1132,
        },
        obj: {
            id: 1141,
            text: "yee"
        },
        primitiveNumber: 12,
        primitiveText: "foo",
        aliasText: "yo",
    }

    function customSerializer(v) {
        return v
    }

    function customDeserializer(jsonValue, context, oldValue) {
        return jsonValue
    }

    function customAsyncDeserializer(jsonValue, context, oldValue, done) {
        if (jsonValue === "trigger error") {
            done(new Error("this error should be overruled in afterDeserialize"))
        } else {
            done(null, jsonValue)
        }
    }

    function beforeDeserialize(jsonValue, jsonParentValue, propName, context, propDef) {
        var jsonAttrName = propName + '1'
        return {
            jsonValue: jsonValue || jsonParentValue[jsonAttrName],
            cancel: false
        }
    }

    function afterDeserialize(error, targetPropertyValue, jsonValue, targetPropertyName, context, propDef) {
        if (!error) {
            return
        }
        return {
            continueOnError: true,
            retryJsonValue: "ok now"
        }
    }

    const args = {
        beforeDeserialize: beforeDeserialize,
        afterDeserialize: afterDeserialize
    }

    class SubData {
        @serializable(identifier()) id
        @serializable text
        @serializable valid = true
    }

    class FinalData {
        @serializable(identifier(args)) id
        @serializable(custom(customSerializer, customDeserializer, args)) custom
        @serializable(custom(customSerializer, customAsyncDeserializer, args)) customAsync
        @serializable(date(args)) date
        @serializable(list(object(SubData, args), args)) listObj
        @serializable(map(object(SubData, args), args)) mapObj
        @serializable(map(reference(SubData, args), args)) mapRefObj
        @serializable(mapAsArray(reference(SubData, args), 'id', args)) mapArrayRefObj
        @serializable(object(SubData, args)) obj
        @serializable(primitive(args)) primitiveNumber
        @serializable(primitive(args)) primitiveText
        @serializable(alias('aliasText', primitive(args))) aliasPrimitiveText
    }

    const result = deserialize(FinalData, jsonInput)

    t.deepEqual(serialize(result), jsonInput);

    t.end();

})

test("@serializeAll (babel)", t => {
    @serializeAll
    class Store {
        a = 3
        b
    }

    const store = new Store();
    (store as any).c = 5;
    (store as any).d = {};

    t.deepEqual(serialize(store), {a: 3, c: 5})

    const store2 = deserialize(Store, {a: 2, b: 3, c: 4})
    t.equal(store2.a, 2)
    t.equal(store2.b, 3)
    t.equal((store2 as any).c, 4)

    t.end()
})

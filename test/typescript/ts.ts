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
    custom
} from "../../";

import { observable, autorun } from "mobx";

declare var require;
const test = require("tape");

test("should work in typescript", t => {
    class A {
        @serializable @observable
        w

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
    t.deepEqual(res, { w: undefined, x: 3, y: 4, z: 5 });
    a.z++; // no autorun
    t.equal(a.z, 6);

    a.y++;
    t.equal(called, 2);
    t.deepEqual(res, { w: undefined, x: 3, y: 5, z: 6 });

    a.x++;
    t.equal(called, 3);
    t.deepEqual(res, { w: undefined, x: 4, y: 5, z: 6 });

    const b = deserialize(A, { x: 1, y: 2, z: 3 });
    t.deepEqual(serialize(b), { w: undefined, x: 1, y: 2, z: 3 });
    t.ok(b instanceof A);

    t.end();
});

test("typescript class with constructor params", t => {
    class Rectangle {
        @serializable
        public someNumber: number;

        @serializable(alias("identifier", identifier()))
        public id: string;

        @serializable(alias("desc", optional()))
        public description?: string;

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
    t.equal(false, json.hasOwnProperty("desc"));
    t.equal(false, json.hasOwnProperty("description"));
    const b = deserialize(Rectangle, json);
    t.equal(a.id, b.id);
    t.equal(a.width, b.width);
    t.equal(a.height, b.height);
    t.equal(a.someNumber, b.someNumber);
    t.equal(b.getArea(), 200);

    a.description = "example";
    json = serialize(a);
    t.equal("example", json["desc"]);
    t.equal(false, json.hasOwnProperty("description"));

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

    function customCallbackDeserializer(jsonValue, context, oldValue, done) {
        done(null, jsonValue)
    }

    function customAsyncDeserializer(jsonValue, context, oldValue, done) {
        setTimeout(() => {
            done(null, jsonValue)
        }, 1)
    }

    class A {
        @serializable(custom(customSerializer, customDeserializer)) a = "hoi";
        @serializable(custom(customSerializer, customCallbackDeserializer)) a2 = "oeps";
        @serializable(custom(customSerializer, customAsyncDeserializer)) a3 = "lulu";
    }

    let result = serialize(new A())
    const initial = {
        a: "hoi", a2: "oeps", a3: "lulu"
    }
    const updated = {
        a: "all", a2: "new", a3: "lala"
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
            { id: 2, title: "foo" },
            { id: 1, title: "bar " }
        ]
    };
    const m = deserialize(Message, json);

    t.equal(m.child.length, 2);
    t.ok(m.child[1] === m.ref);

    t.deepEqual(serialize(m), json);

    t.end();
});

test("[ts] array parameters", t => {
    class User {
        @serializable nick
        @serializable age
        @serializable gender
        @serializable(list(primitive())) hobbies
        @serializable(list(primitive())) friends
    }

    const user = new User()

    user.age = 22
    user.nick = 'Nick'
    user.hobbies = ['debugging']

    const result = serialize(user)

    t.deepEqual(result, {age: 22, nick: 'Nick', gender: undefined, hobbies: ['debugging']})

    t.end();
})


test("[ts] additional lifecycle handlers 'beforeDeserialize' and 'afterDeserialize'", t => {

    const jsonInput = {
        id1: "1101",
        id11: 1102,
        custom1: 2,
        customAsync1: "trigger error",
        date1: 1534021029937,
        listObj1: [
            {
                id1: "1121",
                text1: "good data",
                valid: true
            },
            {
                id1: "1122",
                text1: "ignored",
                valid: false
            },
            {
                id1: "1123",
                text1: "good data",
                valid: true
            },
            null,
            undefined,
            1234,
            "invalid"
        ],
        listRefObj1: [
            "1121", "1122", "1123", "1234", "1131", "1132", "1133", "1134", undefined, null, 1234, "invalid", "1121"
        ],
        mapObj1: {
            1131: {
                id1: "1131",
                text1: "good data",
                valid: true
            },
            1132: {
                id1: "1132",
                text1: "ignored",
                valid: false
            },
            1133: {
                id1: "1133",
                text1: "good data",
                valid: true
            },
            1134: null,
            1234: null
        },
        mapRefObj1: {
            1131: "1131",
            1132: "1132",
            1133: "1133",
            1134: "1134",
            1234: "1234"
        },
        mapArrayRefObj1: [
            "1131",
            "1132",
            "1133",
            "1134",
            "1234"
        ],
        obj1: {
            id1: "1141",
            text1: "yee",
            valid: true
        },
        primitiveNumber1: 12,
        primitiveText1: "foo",
        aliasText: "yo",
    }

    const jsonResult = {
        id: "1101",
        custom: 2,
        customAsync: "ok now",
        date: 1534021029937,
        listObj: [
            {
                id: "1121",
                text: "good data",
                valid: true
            },
            {
                id: "1123",
                text: "good data",
                valid: true
            },
        ],
        listRefObj: [
            "1121", "1123", "1131", "1133", "1121"
        ],
        mapObj: {
            1131: {
                id: "1131",
                text: "good data",
                valid: true
            },
            1133: {
                id: "1133",
                text: "good data",
                valid: true
            },
        },
        mapRefObj: {
            1131: "1131",
            1133: "1133",
        },
        mapArrayRefObj: [
            "1131",
            "1133",
        ],
        obj: {
            id: "1141",
            text: "yee",
            valid: true
        },
        primitiveNumber: 12,
        primitiveText: "foo hee haa",
        aliasText: "yo hee haa",
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

    const renameOpts = {
        beforeDeserialize: function (callback, jsonValue, jsonParentValue, propNameOrIndex,) {
            var jsonAttrName = propNameOrIndex + '1'
            jsonValue = jsonValue || jsonParentValue[jsonAttrName]
            callback(null, jsonValue)
        }
    }

    const replaceValueOpts = {
        beforeDeserialize: function (callback, jsonValue, jsonParentValue, propNameOrIndex) {
            var jsonAttrName = propNameOrIndex + '1'
            jsonValue = (jsonValue || jsonParentValue[jsonAttrName]) + ' hee'
            callback(null, jsonValue)
        },
        afterDeserialize: function (callback, error, newValue, jsonValue, jsonParentValue, propNameOrIndex, context,
                                    propDef, numRetry) {
            var err = null
            if (numRetry === 0) {
                err = new Error('retry once more')
            }
            callback(err, newValue + ' haa')
        }
    }

    const resumeOnErrorOpts = {
        beforeDeserialize: function (callback, jsonValue, jsonParentValue, propNameOrIndex) {
            var jsonAttrName = propNameOrIndex + '1'
            jsonValue = jsonValue || jsonParentValue[jsonAttrName]
            callback(null, jsonValue)
        },
        afterDeserialize(callback, error) {
            callback(null, 'ok now')
        }
    }

    const removeInvalidItemsOpts = {
        /**
         * remove all invalid objects in lists and maps,
         * also does this for reference objects asynchronously
         */
        beforeDeserialize(callback, jsonValue, jsonParentValue, propNameOrIndex, context, propDef) {
            var numItemsWaiting = 0
            var jsonAttrName = propNameOrIndex + '1'
            jsonValue = jsonValue || jsonParentValue[jsonAttrName]
            var result = jsonValue

            function getValidItem(inputValue, nameOrIndex) {

                function onItemCallback(err) {
                    if (!err) {
                        result[nameOrIndex] = inputValue
                    }
                    numItemsWaiting -= 1
                    if (numItemsWaiting === 0) {
                        if (Array.isArray(result)) {
                            // clear gaps in array
                            result = result.filter(function() { return true })
                        }
                        callback(null, result)
                    }
                }

                if (inputValue) {
                    if (typeof inputValue === 'object') {
                        if (inputValue.valid === true) {
                            onItemCallback(null)
                        } else {
                            onItemCallback(new Error('not a valid item'))
                        }
                    } else if (propNameOrIndex.indexOf('Ref') >= 0) {
                        context.rootContext.await(getDefaultModelSchema(SubData), inputValue, onItemCallback)
                    } else {
                        onItemCallback(new Error('object expected'))
                    }
                } else {
                    onItemCallback(new Error('not a valid reference'))
                }
            }


            if (Array.isArray(jsonValue)) {
                result = []
                numItemsWaiting = jsonValue.length
                jsonValue.forEach((value, index) => {
                    getValidItem(value, index)
                })
            } else if (typeof jsonValue === 'object') {
                result = {}
                var keys = Object.keys(jsonValue)
                numItemsWaiting = keys.length
                keys.forEach((key) => {
                    getValidItem(jsonValue[key], key)
                })
            }
        },
        /**
         * remove item in case it caused an error during deserialization
         */
        afterDeserialize: function (callback, error, newValue, jsonValue, jsonParentValue, propNameOrIndex, context,
                                    propDef, numRetry) {
            if (error && error.itemKey) {
                if (Array.isArray(jsonValue)) {
                    var nextArray = jsonValue.splice(error.itemKey, 1)
                    callback(error, nextArray)
                } else {
                    var nextObj = Object.assign({}, jsonValue)
                    delete nextObj[error.itemKey]
                    callback(error, nextObj)
                }
            } else {
                callback(error, newValue)
            }
        }
    }

    class SubData {
        @serializable(identifier(renameOpts)) id
        @serializable(primitive(renameOpts)) text
        @serializable(primitive(renameOpts)) valid
    }

    class FinalData {
        @serializable(identifier(renameOpts)) id
        @serializable(custom(customSerializer, customDeserializer, renameOpts)) custom
        @serializable(custom(customSerializer, customAsyncDeserializer, resumeOnErrorOpts)) customAsync
        @serializable(date(renameOpts)) date
        @serializable(list(object(SubData, renameOpts), removeInvalidItemsOpts)) listObj
        @serializable(list(reference(SubData, renameOpts), removeInvalidItemsOpts)) listRefObj
        @serializable(map(object(SubData, renameOpts), removeInvalidItemsOpts)) mapObj
        @serializable(map(reference(SubData, renameOpts), removeInvalidItemsOpts)) mapRefObj
        @serializable(mapAsArray(reference(SubData, renameOpts), 'id', removeInvalidItemsOpts)) mapArrayRefObj
        @serializable(object(SubData, renameOpts)) obj
        @serializable(primitive(renameOpts)) primitiveNumber
        @serializable(primitive(replaceValueOpts)) primitiveText
        @serializable(alias('aliasText', primitive(replaceValueOpts))) aliasPrimitiveText
    }

    let resultIsFinal = false
    const prelimResult = deserialize(FinalData, jsonInput, (err, result) => {
        resultIsFinal = true
        err ? t.end(err) : null
        t.deepEqual(serialize(result), jsonResult);
        t.end();
    })

    setTimeout(() => {
            cancelDeserialize(prelimResult)
        }, 100
    )

    setTimeout(() => {
            if (!resultIsFinal) {
                t.end(new Error("deserialization canceled due to timeout"))
            }
        }, 1000
    )


})

test("[ts] @serializeAll", t => {
    @serializeAll
    class Store {
        a = 3
        b
    }

    const store = new Store();
    (store as any).c = 5;
    (store as any).d = {};

    t.deepEqual(serialize(store), { a: 3, c: 5 })

    const store2 = deserialize(Store, { a: 2, b: 3, c: 4 })
    t.equal(store2.a, 2)
    t.equal(store2.b, 3)
    t.equal((store2 as any).c, 4)

    t.end()
})

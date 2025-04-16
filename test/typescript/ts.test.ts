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
    subSchema,
    DEFAULT_DISCRIMINATOR_ATTR,
} from "../../src/serializr"

describe("Basic functionality", () => {
    it("should work in typescript", () => {
        class A {
            @serializable
            w

            @serializable
            x = 3

            @serializable(primitive())
            y = 4

            @serializable(true)
            z = 5
        }

        const a = new A()
        const res = serialize(a)
        expect(res).toEqual({ w: undefined, x: 3, y: 4, z: 5 })
    })

    it("(de)serialize class with constructor params", () => {
        class Rectangle {
            @serializable
            public someNumber: number

            @serializable(alias("identifier", identifier()))
            public id: string

            @serializable(alias("desc", optional()))
            public description?: string

            @serializable(alias("width", true))
            public width: number

            @serializable(alias("height", true))
            public height: number

            constructor(id: string, width: number, height: number) {
                this.id = id
                this.width = width
                this.height = height
            }

            public getArea(): number {
                return this.width * this.height
            }
        }

        const a = new Rectangle("A", 10, 20)
        a.someNumber = 123

        let json = serialize(a)
        expect(false).toBe(json.hasOwnProperty("desc"))
        expect(false).toBe(json.hasOwnProperty("description"))
        const b = deserialize(Rectangle, json)
        expect(a.id).toBe(b.id)
        expect(a.width).toBe(b.width)
        expect(a.height).toBe(b.height)
        expect(a.someNumber).toBe(b.someNumber)
        expect(b.getArea()).toBe(200)

        a.description = "example"
        json = serialize(a)
        expect("example").toBe(json["desc"])
        expect(false).toBe(json.hasOwnProperty("description"))
    })

    it("(de)serialize class having only constructor params", () => {
        class Rectangle {
            @serializable(alias("identifier", identifier()))
            public id: string

            @serializable(alias("width", true))
            public width: number

            @serializable(alias("height", true))
            public height: number

            constructor(id: string, width: number, height: number) {
                this.id = id
                this.width = width
                this.height = height
            }
        }

        const a = new Rectangle("A", 10, 20)

        let json = serialize(a)
        const b = deserialize(Rectangle, json)
        expect(a.id).toBe(b.id)
        expect(a.width).toBe(b.width)
        expect(a.height).toBe(b.height)
    })

    it("should handle prototypes", () => {
        class A {
            @serializable a = "hoi"
            @serializable a2 = "oeps"
        }

        class B extends A {
            @serializable b = "boe"
            @serializable b2 = "oef"
        }

        expect(serialize(new A())).toEqual({
            a: "hoi",
            a2: "oeps",
        })

        expect(serialize(new B())).toEqual({
            a: "hoi",
            a2: "oeps",
            b: "boe",
            b2: "oef",
        })
    })

    it("should handle custom prop schemas", () => {
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
            @serializable(custom(customSerializer, customDeserializer)) a = "hoi"
            @serializable(custom(customSerializer, customCallbackDeserializer)) a2 = "oeps"
            @serializable(custom(customSerializer, customAsyncDeserializer)) a3 = "lulu"
        }

        let result = serialize(new A())
        const initial = {
            a: "hoi",
            a2: "oeps",
            a3: "lulu",
        }
        const updated = {
            a: "all",
            a2: "new",
            a3: "lala",
        }
        expect(result).toEqual(initial)

        deserialize(A, updated, (err, resultObj) => {
            if (err) fail(err)

            result = serialize(resultObj)
            expect(result).toEqual(updated)
        })
    })

    it("should handle not yet defined modelschema's for classes", () => {
        // classes are declared as var, not as function, so aren't hoisted :'(
        class Comment {
            @serializable(identifier()) id = 0
            @serializable(true) title
        }

        class Message {
            @serializable(list(object(Comment)))
            child = []

            @serializable(reference(Comment))
            ref = null
        }

        const json = {
            ref: 1,
            child: [
                { id: 2, title: "foo" },
                { id: 1, title: "bar " },
            ],
        }
        const m = deserialize(Message, json)

        expect(m.child.length).toBe(2)
        expect(m.child[1]).toBe(m.ref)

        expect(serialize(m)).toEqual(json)
    })

    it("should handle array parameters", () => {
        class User {
            @serializable nick
            @serializable age
            @serializable gender
            @serializable(list(primitive())) hobbies
            @serializable(list(primitive())) friends
        }

        const user = new User()

        user.age = 22
        user.nick = "Nick"
        user.hobbies = ["debugging"]

        const result = serialize(user)

        expect(result).toEqual({ age: 22, nick: "Nick", gender: undefined, hobbies: ["debugging"] })
    })

    it("invokes additional lifecycle handlers 'beforeDeserialize' and 'afterDeserialize'", () => {
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
                    valid: true,
                },
                {
                    id1: "1122",
                    text1: "ignored",
                    valid: false,
                },
                {
                    id1: "1123",
                    text1: "good data",
                    valid: true,
                },
                null,
                undefined,
                1234,
                "invalid",
            ],
            listRefObj1: [
                "1121",
                "1122",
                "1123",
                "1234",
                "1131",
                "1132",
                "1133",
                "1134",
                undefined,
                null,
                1234,
                "invalid",
                "1121",
            ],
            mapObj1: {
                1131: {
                    id1: "1131",
                    text1: "good data",
                    valid: true,
                },
                1132: {
                    id1: "1132",
                    text1: "ignored",
                    valid: false,
                },
                1133: {
                    id1: "1133",
                    text1: "good data",
                    valid: true,
                },
                1134: null,
                1234: null,
            },
            mapRefObj1: {
                1131: "1131",
                1132: "1132",
                1133: "1133",
                1134: "1134",
                1234: "1234",
            },
            mapArrayRefObj1: ["1131", "1132", "1133", "1134", "1234"],
            obj1: {
                id1: "1141",
                text1: "yee",
                valid: true,
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
                    valid: true,
                },
                {
                    id: "1123",
                    text: "good data",
                    valid: true,
                },
            ],
            listRefObj: ["1121", "1123", "1131", "1133", "1121"],
            mapObj: {
                1131: {
                    id: "1131",
                    text: "good data",
                    valid: true,
                },
                1133: {
                    id: "1133",
                    text: "good data",
                    valid: true,
                },
            },
            mapRefObj: {
                1131: "1131",
                1133: "1133",
            },
            mapArrayRefObj: ["1131", "1133"],
            obj: {
                id: "1141",
                text: "yee",
                valid: true,
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
            beforeDeserialize: function (callback, jsonValue, jsonParentValue, propNameOrIndex) {
                const jsonAttrName = propNameOrIndex + "1"
                jsonValue = jsonValue || jsonParentValue[jsonAttrName]
                callback(null, jsonValue)
            },
        }

        const replaceValueOpts: AdditionalPropArgs = {
            beforeDeserialize: function (callback, jsonValue, jsonParentValue, propNameOrIndex) {
                const jsonAttrName = propNameOrIndex + "1"
                jsonValue = (jsonValue || jsonParentValue[jsonAttrName]) + " hee"
                callback(null, jsonValue)
            },
            afterDeserialize: function (
                callback,
                error,
                newValue,
                jsonValue,
                jsonParentValue,
                propNameOrIndex,
                context,
                propDef
            ) {
                callback(undefined, newValue + " haa")
            },
        }

        const resumeOnErrorOpts = {
            beforeDeserialize: function (callback, jsonValue, jsonParentValue, propNameOrIndex) {
                const jsonAttrName = propNameOrIndex + "1"
                jsonValue = jsonValue || jsonParentValue[jsonAttrName]
                callback(null, jsonValue)
            },
            afterDeserialize(callback, error) {
                callback(null, "ok now")
            },
        }

        const removeInvalidItemsOpts: AdditionalPropArgs = {
            /**
             * remove all invalid objects in lists and maps,
             * also does this for reference objects asynchronously
             */
            beforeDeserialize(
                callback,
                jsonValue,
                jsonParentValue,
                propNameOrIndex,
                context,
                propDef
            ) {
                let numItemsWaiting = 0
                const jsonAttrName = propNameOrIndex + "1"
                jsonValue = jsonValue || jsonParentValue[jsonAttrName]
                let result = jsonValue

                function getValidItem(inputValue, nameOrIndex) {
                    function onItemCallback(err) {
                        if (!err) {
                            result[nameOrIndex] = inputValue
                        }
                        numItemsWaiting -= 1
                        if (numItemsWaiting === 0) {
                            if (Array.isArray(result)) {
                                // clear gaps in array
                                result = result.filter(function () {
                                    return true
                                })
                            }
                            callback(null, result)
                        }
                    }

                    if (inputValue) {
                        if (typeof inputValue === "object") {
                            if (inputValue.valid === true) {
                                onItemCallback(null)
                            } else {
                                onItemCallback(new Error("not a valid item"))
                            }
                        } else if (("" + propNameOrIndex).indexOf("Ref") >= 0) {
                            context.rootContext.await(
                                getDefaultModelSchema(SubData),
                                inputValue,
                                onItemCallback
                            )
                        } else {
                            onItemCallback(new Error("object expected"))
                        }
                    } else {
                        onItemCallback(new Error("not a valid reference"))
                    }
                }

                if (Array.isArray(jsonValue)) {
                    result = []
                    numItemsWaiting = jsonValue.length
                    jsonValue.forEach((value, index) => {
                        getValidItem(value, index)
                    })
                } else if (typeof jsonValue === "object") {
                    result = {}
                    const keys = Object.keys(jsonValue)
                    numItemsWaiting = keys.length
                    keys.forEach((key) => {
                        getValidItem(jsonValue[key], key)
                    })
                }
            },
            /**
             * remove item in case it caused an error during deserialization
             */
            afterDeserialize: function (
                callback,
                error,
                newValue,
                jsonValue,
                jsonParentValue,
                propNameOrIndex,
                context,
                propDef
            ) {
                if (error && error.itemKey) {
                    // TODO: put some code here which is actually used
                    throw new Error("this never gets run!")
                    if (Array.isArray(jsonValue)) {
                        const nextArray = jsonValue.splice(error.itemKey, 1)
                        callback(error, nextArray)
                    } else {
                        const nextObj = Object.assign({}, jsonValue)
                        delete nextObj[error.itemKey]
                        callback(error, nextObj)
                    }
                } else {
                    callback(error, newValue)
                }
            },
        }

        class SubData {
            @serializable(identifier(renameOpts)) id
            @serializable(primitive(renameOpts)) text
            @serializable(primitive(renameOpts)) valid
        }

        class FinalData {
            @serializable(identifier(renameOpts)) id
            @serializable(custom(customSerializer, customDeserializer, renameOpts)) custom
            @serializable(custom(customSerializer, customAsyncDeserializer, resumeOnErrorOpts))
            customAsync
            @serializable(date(renameOpts)) date
            @serializable(list(object(SubData, renameOpts), removeInvalidItemsOpts)) listObj
            @serializable(list(reference(SubData, renameOpts), removeInvalidItemsOpts)) listRefObj
            @serializable(map(object(SubData, renameOpts), removeInvalidItemsOpts)) mapObj
            @serializable(map(reference(SubData, renameOpts), removeInvalidItemsOpts)) mapRefObj
            @serializable(mapAsArray(reference(SubData, renameOpts), "id", removeInvalidItemsOpts))
            mapArrayRefObj
            @serializable(object(SubData, renameOpts)) obj
            @serializable(primitive(renameOpts)) primitiveNumber
            @serializable(primitive(replaceValueOpts)) primitiveText
            @serializable(alias("aliasText", primitive(replaceValueOpts))) aliasPrimitiveText
        }

        let resultIsFinal = false
        const prelimResult = deserialize(FinalData, jsonInput, (err, result) => {
            resultIsFinal = true
            if (err) {
                fail(err)
            }
            expect(serialize(result)).toEqual(jsonResult)
        })

        setTimeout(() => {
            cancelDeserialize(prelimResult)
        }, 100)

        setTimeout(() => {
            if (!resultIsFinal) {
                fail("deserialization should have been canceled")
            }
        }, 1000)
    })

    it("works with @serializeAll", () => {
        @serializeAll
        class Store {
            a = 3
            b
        }

        const store = new Store()
        ;(store as any).c = 5
        ;(store as any).d = {}

        expect(serialize(store)).toEqual({ a: 3, b: undefined, c: 5 })

        const store2 = deserialize(Store, { a: 2, b: 3, c: 4 })
        expect(store2.a).toBe(2)
        expect(store2.b).toBe(3)
        expect((store2 as any).c).toBe(4)
    })

    it("works with @serializeAll(schema)", () => {
        class StarValue {
            @serializable(optional())
            public x?: number
        }

        @serializeAll(/^\d\.\d+$/, StarValue)
        class StoreWithStarSchema {
            [key: string]: StarValue
        }

        const store = new StoreWithStarSchema()
        store["1.4"] = { x: 1 }
        store["1.77"] = {}
        ;(store as any).c = 5
        ;(store as any).d = {}

        expect(serialize(store)).toEqual({ "1.4": { x: 1 }, "1.77": {} })

        const store2 = deserialize(StoreWithStarSchema, { "1.4": { x: 1 }, "1.77": {}, c: 4 })
        expect(store["1.4"]).toEqual({ x: 1 })
        expect(store["1.77"]).toEqual({})
        expect((store2 as any).c).toBe(undefined)
    })

    it("works with  @serializeAll(list schema)", () => {
        class StarValue {
            @serializable(optional())
            public x?: number
        }

        @serializeAll(/^\d\.\d+$/, list(object(StarValue)))
        class StoreWithStarSchema {
            [key: string]: StarValue[]
        }

        const store = new StoreWithStarSchema()
        store["1.4"] = [{ x: 1 }]
        store["1.77"] = [{}]
        ;(store as any).c = 5
        ;(store as any).d = {}

        expect(serialize(store)).toEqual({ "1.4": [{ x: 1 }], "1.77": [{}] })

        const store2 = deserialize(StoreWithStarSchema, { "1.4": [{ x: 1 }], "1.77": [{}], c: 4 })
        expect(store["1.4"]).toEqual([{ x: 1 }])
        expect(store["1.77"]).toEqual([{}])
        expect((store2 as any).c).toBe(undefined)
    })

    it("runs tests from serializeAll documentation", () => {
        @serializeAll
        class Store {
            [key: string]: number
        }

        const store = new Store()
        store.c = 5
        ;(store as any).d = {}
        expect(serialize(store)).toEqual({ c: 5 })

        class DataType {
            @serializable
            x?: number
            @serializable(optional())
            y?: number
        }
        @serializeAll(/^[a-z]$/, DataType)
        class ComplexStore {
            [key: string]: DataType
        }

        const complexStore = new ComplexStore()
        complexStore.a = { x: 1, y: 2 }
        complexStore.b = {}
        ;(complexStore as any).somethingElse = 5
        expect(serialize(complexStore)).toEqual({ a: { x: 1, y: 2 }, b: { x: undefined } })
    })

    it("handles list(custom(...)) with SKIP", () => {
        class Store {
            @serializable(
                list(
                    custom(
                        (x) => x,
                        (x) => (2 === x ? SKIP : x)
                    )
                )
            )
            list: number[]
        }

        const expected = new Store()
        expected.list = [1, 3]
        expect(deserialize(Store, { list: [1, 2, 3] })).toEqual(expected)
    })

    it("handles heterogeneous array serialization", () => {
        class Person {
            @serializable name: string
            @serializable surname: string
        }

        class Car {
            @serializable model: string
            @serializable color: string
        }

        const serialized = serialize([
            Object.assign(new Person(), {
                name: "John",
                surname: "Doe",
            }),
            Object.assign(new Car(), {
                model: "Fiat 500",
                color: "Red",
            }),
        ])

        expect(serialized).toEqual([
            {
                name: "John",
                surname: "Doe",
            },
            {
                model: "Fiat 500",
                color: "Red",
            },
        ])
    })
})

describe("@subSchema", () => {
    it("(de)serialize class hierarchy with simple discriminator", () => {
        class Todo {
            @serializable
            id: string

            @serializable
            text: string
        }

        @subSchema("picture")
        class PictureTodo extends Todo {
            @serializable
            pictureUrl: string
        }

        @subSchema("video")
        class VideoTodo extends Todo {
            @serializable
            videoUrl: string
        }

        const src = [
            Object.assign(new PictureTodo(), {
                id: "pic1",
                text: "Lorem Ipsum",
                pictureUrl:
                    "https://i.etsystatic.com/13081791/c/900/715/0/288/il/b7343b/2529177643/il_340x270.2529177643_h9nm.jpg",
            }),
            Object.assign(new VideoTodo(), {
                id: "vid1",
                text: "Lorem Ipsum",
                videoUrl: "https://www.youtube.com/watch?v=oMLHqAUyhEk",
            }),
        ]

        const picSerialized = serialize(src[0])
        const serialized = serialize(src) as any[]

        expect(picSerialized.id).toBe(src[0].id)
        expect(picSerialized[DEFAULT_DISCRIMINATOR_ATTR]).toBe("picture")

        expect(serialized[0].id).toBe(src[0].id)
        expect(serialized[0][DEFAULT_DISCRIMINATOR_ATTR]).toBe("picture")
        expect(serialized[1].id).toBe(src[1].id)
        expect(serialized[1][DEFAULT_DISCRIMINATOR_ATTR]).toBe("video")

        const [deserPic, deserVid] = deserialize(Todo, serialized)
        expect(deserPic).toBeInstanceOf(PictureTodo)
        expect(deserVid).toBeInstanceOf(VideoTodo)

        expect(src[0]).toEqual(deserPic)
        expect(src[1]).toEqual(deserVid)
    })

    it("(de)serialize class hierarchy with complex discriminator", () => {
        class Todo {
            @serializable
            id: string

            @serializable
            text: string
        }

        @subSchema({
            isActualType: (src) => !!src["pictureUrl"],
        })
        class PictureTodo extends Todo {
            @serializable
            pictureUrl: string
        }

        @subSchema({
            isActualType: (src) => !!src["videoUrl"],
        })
        class VideoTodo extends Todo {
            @serializable
            videoUrl: string
        }

        const src = [
            Object.assign(new PictureTodo(), {
                id: "pic1",
                text: "Lorem Ipsum",
                pictureUrl:
                    "https://i.etsystatic.com/13081791/c/900/715/0/288/il/b7343b/2529177643/il_340x270.2529177643_h9nm.jpg",
            }),
            Object.assign(new VideoTodo(), {
                id: "vid1",
                text: "Lorem Ipsum",
                videoUrl: "https://www.youtube.com/watch?v=oMLHqAUyhEk",
            }),
        ]

        const [deserPic, deserVid] = deserialize(Todo, serialize(src) as any[])
        expect(deserPic).toBeInstanceOf(PictureTodo)
        expect(deserVid).toBeInstanceOf(VideoTodo)

        expect(src[0]).toEqual(deserPic)
        expect(src[1]).toEqual(deserVid)
    })

    it("(de)serialize class hierarchy with multiple levels", () => {
        class Todo {
            @serializable
            id: string

            @serializable
            text: string
        }

        @subSchema("picture")
        class PictureTodo extends Todo {
            @serializable
            pictureUrl: string
        }

        @subSchema("betterPicture", Todo)
        class BetterPictureTodo extends PictureTodo {
            @serializable
            altText: string
        }

        @subSchema("video")
        class VideoTodo extends Todo {
            @serializable
            videoUrl: string
        }

        const src = [
            Object.assign(new PictureTodo(), {
                id: "pic1",
                text: "Lorem Ipsum",
                pictureUrl:
                    "https://i.etsystatic.com/13081791/c/900/715/0/288/il/b7343b/2529177643/il_340x270.2529177643_h9nm.jpg",
            }),
            Object.assign(new BetterPictureTodo(), {
                id: "pic1",
                text: "Lorem Ipsum",
                pictureUrl:
                    "https://i.etsystatic.com/13081791/c/900/715/0/288/il/b7343b/2529177643/il_340x270.2529177643_h9nm.jpg",
                altText: "Alt text",
            }),
            Object.assign(new VideoTodo(), {
                id: "vid1",
                text: "Lorem Ipsum",
                videoUrl: "https://www.youtube.com/watch?v=oMLHqAUyhEk",
            }),
        ]

        const serialized = serialize(src) as any[]

        expect(serialized[0].id).toBe(src[0].id)
        expect(serialized[0][DEFAULT_DISCRIMINATOR_ATTR]).toBe("picture")
        expect(serialized[1].id).toBe(src[1].id)
        expect(serialized[1][DEFAULT_DISCRIMINATOR_ATTR]).toBe("betterPicture")
        expect(serialized[2].id).toBe(src[2].id)
        expect(serialized[2][DEFAULT_DISCRIMINATOR_ATTR]).toBe("video")

        const [deserPic, deserBetterPic, deserVid] = deserialize(Todo, serialized)
        expect(deserPic).toBeInstanceOf(PictureTodo)
        expect(deserPic).not.toBeInstanceOf(BetterPictureTodo)
        expect(deserBetterPic).toBeInstanceOf(BetterPictureTodo)
        expect(deserBetterPic).toBeInstanceOf(PictureTodo)
        expect(deserVid).toBeInstanceOf(VideoTodo)

        expect(src[0]).toEqual(deserPic)
        expect(src[1]).toEqual(deserBetterPic)
        expect(src[2]).toEqual(deserVid)
    })
})

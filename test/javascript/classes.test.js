import {
    alias,
    createModelSchema,
    createSimpleSchema,
    deserialize,
    getDefaultModelSchema,
    identifier,
    list,
    object,
    reference,
    serialize,
    subSchema,
    update,
} from "../../src/serializr"

describe("Javascript classes", () => {
    describe("schema's can be defined on constructors", () => {
        function Todo(title) {
            this.title = title
        }

        createModelSchema(Todo, {
            title: true,
        })

        var json = {
            title: "test",
        }

        it("can serialize, deserialize and update", () => {
            var source = new Todo("test")

            expect(serialize(source)).toEqual(json)

            var res = deserialize(Todo, json)
            expect(res.title).toBe("test")
            expect(res instanceof Todo).toBe(true)

            update(res, {
                title: "bloop",
            })
            expect(res.title).toBe("bloop")

            update(Todo, res, {
                title: "bloop2",
            })
            expect(res.title).toBe("bloop2")
        })

        it("can serialize a list", () => {
            var jsonlist = [{ title: "test1" }, { title: "test2" }]
            var todos = deserialize(Todo, jsonlist)
            expect(todos.length).toBe(2)
            expect(serialize(todos)).toEqual(jsonlist)
        })

        it("may be used to serialize a list of plain objects", () => {
            var jsonlist = [{ title: "test1" }, { title: "test2" }]

            jsonlist[0].otherProp = "should not serialize"
            jsonlist[1].otherProp = "should not serialize"

            expect(() => serialize(jsonlist)).toThrow()

            serialize(Todo, jsonlist).forEach((serialized, i) => {
                expect(serialized.title).toBe(jsonlist[i].title)
                expect(serialized.otherProp).toBe(undefined)
            })
        })

        it("may be used to serialize plain objects", () => {
            var source2 = {
                title: "test",
                otherProp: "should not serialize",
            }
            expect(() => serialize(source2)).toThrow()

            expect(serialize(Todo, source2)).toEqual(json)
            var res2 = deserialize(Todo, json)
            expect(res2.title).toBe("test")
            expect(res2.otherProp).toBeUndefined()
            expect(res2).toBeInstanceOf(Todo)
        })
    })

    describe("complex async schemas", () => {
        var postStore = []
        var commentStore = {}

        function Post(id, msg) {
            this.id = id
            this.message = msg
            this.comments = []
            postStore.push(this)
        }
        function Comment(id, msg) {
            this.id = id
            this.message = msg
            commentStore[id] = this
        }

        createModelSchema(Comment, {
            id: alias("__id", identifier()), // mark as identifier, use alias
            message: true,
        })
        createModelSchema(Post, {
            id: true,
            message: true,
            comments: list(reference(Comment, fetchComment)),
        })

        function fetchComment(id, cb) {
            if (!commentStore[id])
                setTimeout(function () {
                    cb("Comment not found: " + id)
                }, 10)
            else
                setTimeout(function () {
                    cb(null, commentStore[id])
                }, 10)
        }

        it("(de)serialize aliased identifier correctly ", () => {
            var c1 = new Comment(2, "World")
            var serialized = serialize(c1)
            expect(serialized).toEqual({
                __id: 2,
                message: "World",
            })
            expect(serialize(deserialize(Comment, serialized))).toEqual(serialized)
        })

        it("can use a simple async fetch", () => {
            var p = new Post(1, "Hello")
            var c1 = new Comment(2, "World")
            var c2 = new Comment(3, "Universe")
            p.comments.push(c1, c2)

            var serialized = serialize(p)
            expect(serialized).toEqual({
                id: 1,
                message: "Hello",
                comments: [2, 3],
            })

            var clone = deserialize(Post, serialized, function (err, r) {
                expect(err).toBeFalsy()
                expect(clone).toBe(r)
                expect(r.comments.length).toBe(2)
                expect(r.comments[0]).toBe(c1)
                expect(r.comments[1]).toBe(c2)
            })

            expect(clone).toBeInstanceOf(Post)
            expect(clone.id).toBe(1)
            expect(clone.message).toBe("Hello")
            expect(clone.comments.length).toBe(0)
        })
    })

    it("it should handle not yet defined modelschema's for classes", () => {
        function Message() {}
        createModelSchema(Message, {
            child: list(object(Comment)), // model for Comment not defined yet!
            ref: reference(Comment),
        })

        function Comment() {}
        createModelSchema(Comment, {
            id: identifier(),
            "*": true,
        })

        var json = {
            ref: 1,
            child: [
                { id: 2, title: "foo" },
                { id: 1, title: "bar " },
            ],
        }
        var m = deserialize(Message, json)

        expect(m.child.length).toBe(2)
        expect(m.child[1]).toBe(m.ref)

        expect(serialize(m)).toEqual(json)
    })

    it("should work with context and factories", () => {
        function Message() {
            this.title = "test"
            this.comments = []
        }

        function Comment() {
            this.title = "bla"
        }

        var myArgs = "myStore"
        var theMessage = null
        var json = {
            title: "bloopie",
            comments: [
                {
                    title: "42",
                },
            ],
        }
        var mContext

        var commentModel = {
            factory: (context) => {
                expect(context.json).toEqual(json.comments[0])
                expect(context.parentContext).toEqual(mContext)
                expect(context.parentContext.target).toEqual(theMessage)
                expect(context.args).toEqual(myArgs)
                expect(context.target).toEqual(undefined) // only available after factory has been invoked
                return new Comment()
            },
            props: {
                title: true,
            },
        }

        var messageModel = {
            factory: (context) => {
                mContext = context
                expect(context.json).toEqual(json)
                expect(context.parentContext).toEqual(undefined)
                expect(context.args).toEqual(myArgs)
                expect(context.target).toEqual(undefined) // only available after factory has been invoked
                return (theMessage = new Message())
            },
            props: {
                title: true,
                comments: list(object(commentModel)),
            },
        }

        var res = deserialize(
            messageModel,
            json,
            (err, message) => {
                expect(message).toBe(theMessage)
                expect(err).toBeDefined()
                expect(serialize(messageModel, json)).toEqual(message)
            },
            myArgs
        )
        expect(res).toBe(theMessage)
    })

    it("should sync error handling", () => {
        var sub = createSimpleSchema({
            id: true,
        })

        var parent = createSimpleSchema({
            r: list(
                reference("id", (id, cb) => {
                    if (id === 42) cb("oops")
                    else cb(null, null)
                })
            ),
        })

        expect(() => {
            var a = deserialize(parent, { r: [1, 42] })
        }).toThrow()
    })

    it("handling async error without handler", () => {
        var sub = createSimpleSchema({
            id: true,
        })

        var parent = createSimpleSchema({
            r: list(
                reference("id", (id, cb) => {
                    if (id === 42)
                        setImmediate(() => {
                            // normally this error would be ungarded, killing the app
                            expect(() => cb("oops")).toThrow()
                        })
                    else setImmediate(() => cb(null, null))
                })
            ),
        })

        var a = deserialize(parent, { r: [1, 42] })
    })

    it("async error handling with handler", () => {
        var sub = createSimpleSchema({
            id: true,
        })

        var parent = createSimpleSchema({
            r: list(
                reference("id", (id, cb) => {
                    if (id === 42)
                        setImmediate(() => {
                            cb("oops")
                        })
                    else setImmediate(() => cb(null, null))
                })
            ),
        })

        var a = deserialize(parent, { r: [1, 42] }, (err, res) => {
            expect(res).toBeFalsy()
            expect(a).toBeTruthy()
            expect(err).toBe("oops")
        })
    })

    describe("default reference resolving", () => {
        function Store() {
            this.boxes = []
            this.arrows = []
        }
        function Box(id) {
            this.id = id
        }
        function Arrow(from, to) {}
        createModelSchema(Box, {
            id: identifier(),
        })
        createModelSchema(Arrow, {
            from: reference(Box),
            to: reference(Box),
        })
        createModelSchema(Store, {
            boxes: list(object(Box)),
            arrows: list(object(Arrow)),
        })

        it("should resolve references", () => {
            var s = deserialize(Store, {
                boxes: [{ id: 1 }, { id: 2 }],
                arrows: [
                    { from: 1, to: 2 },
                    { from: 2, to: 2 },
                ],
            })
            expect(s.boxes.length).toBe(2)
            expect(s.arrows.length).toBe(2)
            expect(s.arrows[0].from).toEqual(s.boxes[0])
            expect(s.arrows[0].to).toEqual(s.boxes[1])
            expect(s.arrows[1].from).toEqual(s.boxes[1])
            expect(s.arrows[1].to).toEqual(s.boxes[1])
        })

        it("should resolve wrongly ordered references", () => {
            var swappedScheme = createModelSchema(Store, {
                arrows: list(object(Arrow)),
                boxes: list(object(Box)),
            })
            var s = deserialize(Store, {
                arrows: [
                    { from: 1, to: 2 },
                    { from: 2, to: 2 },
                ],
                boxes: [{ id: 1 }, { id: 2 }],
            })
            expect(s.boxes.length).toBe(2)
            expect(s.arrows.length).toBe(2)
            expect(s.arrows[0].from).toEqual(s.boxes[0])
            expect(s.arrows[0].to).toEqual(s.boxes[1])
            expect(s.arrows[1].from).toEqual(s.boxes[1])
            expect(s.arrows[1].to).toEqual(s.boxes[1])
        })

        it("should throw on missing references", () => {
            deserialize(
                Store,
                {
                    boxes: [{ id: 1 }, { id: 2 }],
                    arrows: [
                        { from: 1, to: 4 },
                        { from: 3, to: 2 },
                    ],
                },
                (err, res) => {
                    expect(res).toBeFalsy(res)
                    expect("" + err).toBe('Error: Unresolvable references in json: "3", "4"')
                }
            )
        })
    })

    it("should hand to handle colliding references", () => {
        function Store() {
            this.boxes = []
            this.arrows = []
            this.circles = []
        }
        function Box(id) {
            this.id = id
        }
        function Circle(id) {
            this.id = id
        }
        function Arrow(from, to) {}
        createModelSchema(Box, {
            id: identifier(),
        })
        createModelSchema(Circle, {
            id: identifier(),
        })
        createModelSchema(Arrow, {
            from: reference(Box),
            to: reference(Circle),
        })
        createModelSchema(Store, {
            boxes: list(object(Box)),
            arrows: list(object(Arrow)),
            circles: list(object(Circle)),
        })

        var s = deserialize(Store, {
            boxes: [{ id: 1 }],
            arrows: [{ from: 1, to: 1 }],
            circles: [{ id: 1 }],
        })

        expect(s.arrows[0].from).toBeInstanceOf(Box)
        expect(s.arrows[0].to).toBeInstanceOf(Circle)
        expect(s.arrows[0].from).toEqual(s.boxes[0])
        expect(s.arrows[0].to).toEqual(s.circles[0])
    })

    describe("it should handle references to subtypes", () => {
        function Store() {
            this.boxes = []
            this.arrows = []
            this.circles = []
        }
        function Box(id) {
            this.id = id
        }
        function Circle(id) {}
        function Arrow(from, to) {}
        createModelSchema(Box, {
            id: identifier(),
        })
        createModelSchema(Circle, {})
        getDefaultModelSchema(Circle).extends = getDefaultModelSchema(Box)

        createModelSchema(Arrow, {
            from: reference(Box),
            to: reference(Circle),
        })
        createModelSchema(Store, {
            boxes: list(object(Box)),
            arrows: list(object(Arrow)),
            circles: list(object(Circle)),
        })

        it("it should accept subtypes", () => {
            var s = deserialize(Store, {
                boxes: [{ id: 1 }],
                arrows: [{ from: 2, to: 2 }],
                circles: [{ id: 2 }],
            })

            expect(s.arrows[0].from).toBeInstanceOf(Circle)
            expect(s.arrows[0].to).toBeInstanceOf(Circle)
            expect(s.arrows[0].from).toBe(s.circles[0])
            expect(s.arrows[0].to).toBe(s.circles[0])
        })

        it("it should not find supertypes", () => {
            expect(() => {
                deserialize(Store, {
                    boxes: [{ id: 1 }, { id: 2 }],
                    arrows: [{ from: 1, to: 2 }], // to should be Circle, not a Box
                    circles: [{ id: 3 }],
                })
            }).toThrow()
        })
    })

    it("identifier can register themselves", () => {
        var todos = {}

        var s = createSimpleSchema({
            id: identifier((id, object) => (todos[id] = object)),
            title: true,
        })

        deserialize(s, {
            id: 1,
            title: "test0",
        })
        deserialize(s, [
            { id: 2, title: "test2" },
            { id: 1, title: "test1" },
        ])

        expect(todos).toEqual({
            1: { id: 1, title: "test1" },
            2: { id: 2, title: "test2" },
        })
    })

    describe("it should handle polymorphism", () => {
        class Store {
            constructor(id = 0, shapes = []) {
                this.id = id
                this.shapes = shapes
            }
        }

        class Shape {
            constructor(id) {
                this.id = id
            }
        }

        class Sphere extends Shape {
            constructor(id, radius = -1) {
                super(id)
                this.radius = radius
            }
        }

        class Box extends Shape {
            constructor(id, side = -10) {
                super(id)
                this.side = side
            }
        }

        createModelSchema(Shape, {
            id: identifier(),
        })

        createModelSchema(Sphere, { radius: true })
        getDefaultModelSchema(Sphere).extends = getDefaultModelSchema(Shape)

        createModelSchema(Box, { side: true })
        getDefaultModelSchema(Box).extends = getDefaultModelSchema(Shape)

        subSchema("sphere", Shape)(Sphere)
        subSchema("box", Shape)(Box)

        createModelSchema(Store, {
            shapes: list(object(Shape)),
        })

        it("it should accept subtypes", () => {
            var store = new Store(100, [
                new Sphere(1, 10),
                new Box(2, 20),
                new Sphere(10, 100),
                new Box(3, 40),
            ])

            const json = serialize(store)
            const s = deserialize(Store, json)

            expect(s.shapes[0]).toBeInstanceOf(Sphere)
            expect(s.shapes[0].radius).toBe(10)
            expect(s.shapes[1]).toBeInstanceOf(Box)
            expect(s.shapes[1].side).toBe(20)
            expect(s.shapes[2]).toBeInstanceOf(Sphere)
            expect(s.shapes[2].radius).toBe(100)
            expect(s.shapes[3]).toBeInstanceOf(Box)
            expect(s.shapes[3].side).toBe(40)
        })
    })
})

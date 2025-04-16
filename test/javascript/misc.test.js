import {
    serializable,
    primitive,
    serialize,
    deserialize,
    list,
    object,
    reference,
    identifier,
    serializeAll,
    subSchema,
    DEFAULT_DISCRIMINATOR_ATTR,
} from "../../src/serializr"

describe("Misc behaviors", () => {
    it("can serialize", () => {
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

    it("handles inheritance", () => {
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

    it("should handle not yet defined modelschema for classes", () => {
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

        expect(m.child).toHaveLength(2)
        expect(m.child[1] === m.ref).toBeTruthy()

        expect(serialize(m)).toEqual(json)
    })

    it("issue 10", () => {
        class Route {
            @serializable(identifier()) id = ""
            @serializable(primitive()) pattern = ""

            constructor(id = "", pattern = "") {
                this.id = id
                this.pattern = pattern
            }
        }

        class Router {
            @serializable(list(object(Route))) routes = []

            constructor(routes = []) {
                this.routes = routes
            }
        }

        class Store {
            @serializable(object(Router)) router = new Router()

            addRoute() {
                this.router.routes.push(new Route("home", "/"))
            }
        }

        const store = new Store()
        store.addRoute() // WHEN THIS LINE IS REMOVED THEN THERE IS NO ERROR THROWN
        const serial = serialize(store)
        const store2 = deserialize(Store, serial)
        expect(store2.router.routes).toHaveLength(1)
    })

    it("@serializeAll works", () => {
        @serializeAll
        class Store {
            a = 3
            b
        }

        const store = new Store()
        store.c = 5
        store.d = {}

        expect(serialize(store)).toEqual({ a: 3, b: undefined, c: 5 })

        const store2 = deserialize(Store, { a: 2, b: 3, c: 4 })
        expect(store2.a).toBe(2)
        expect(store2.b).toBe(3)
        expect(store2.c).toBe(4)
    })

    it("serializes class a hierarchy with simple discriminator", () => {
        class Todo {
            @serializable
            id

            @serializable
            text
        }

        @subSchema("picture")
        class PictureTodo extends Todo {
            @serializable
            pictureUrl
        }

        @subSchema("video")
        class VideoTodo extends Todo {
            @serializable
            videoUrl
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
        const serialized = serialize(src)

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

    it("serializes class hierarchy with complex discriminator", () => {
        class Todo {
            @serializable
            id

            @serializable
            text
        }

        @subSchema({
            isActualType: (src) => !!src["pictureUrl"],
            storeDiscriminator: () => {},
        })
        class PictureTodo extends Todo {
            @serializable
            pictureUrl
        }

        @subSchema({
            isActualType: (src) => !!src["videoUrl"],
            storeDiscriminator: () => {},
        })
        class VideoTodo extends Todo {
            @serializable
            videoUrl
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

        const [deserPic, deserVid] = deserialize(Todo, serialize(src))
        expect(deserPic).toBeInstanceOf(PictureTodo)
        expect(deserVid).toBeInstanceOf(VideoTodo)

        expect(src[0]).toEqual(deserPic)
        expect(src[1]).toEqual(deserVid)
    })

    it("serializes a class hierarchy with multiple levels", () => {
        class Todo {
            @serializable
            id

            @serializable
            text
        }

        @subSchema("picture")
        class PictureTodo extends Todo {
            @serializable
            pictureUrl
        }

        @subSchema("betterPicture", Todo)
        class BetterPictureTodo extends PictureTodo {
            @serializable
            altText
        }

        @subSchema("video")
        class VideoTodo extends Todo {
            @serializable
            videoUrl
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

        const serialized = serialize(src)

        expect(serialized[0].id).toBe(src[0].id)
        expect(serialized[0][DEFAULT_DISCRIMINATOR_ATTR]).toBe("picture")
        expect(serialized[1].id).toBe(src[1].id)
        expect(serialized[1][DEFAULT_DISCRIMINATOR_ATTR]).toBe("betterPicture")
        expect(serialized[2].id).toBe(src[2].id)
        expect(serialized[2][DEFAULT_DISCRIMINATOR_ATTR]).toBe("video")

        const [deserPic, deserBetterPic, deserVid] = deserialize(Todo, serialized)

        expect(deserPic).toBeInstanceOf(PictureTodo)
        expect(deserBetterPic).toBeInstanceOf(BetterPictureTodo)
        expect(deserVid).toBeInstanceOf(VideoTodo)

        expect(src[0]).toEqual(deserPic)
        expect(src[1]).toEqual(deserBetterPic)
        expect(src[2]).toEqual(deserVid)
    })
})

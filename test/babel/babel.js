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
    DEFAULT_DISCRIMINATOR_ATTR
} from "../../"
const test = require("tape")

test("should work in babel", (t) => {
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

    const a = new A();
    const res = serialize(a);
    t.deepEqual(res, { w: undefined, x: 3, y: 4, z: 5 });
    t.end();
})

test("[babel] it should handle prototypes", (t) => {
    class A {
        @serializable a = "hoi"
        @serializable a2 = "oeps"
    }

    class B extends A {
        @serializable b = "boe"
        @serializable b2 = "oef"
    }

    t.deepEqual(serialize(new A()), {
        a: "hoi",
        a2: "oeps",
    })

    t.deepEqual(serialize(new B()), {
        a: "hoi",
        a2: "oeps",
        b: "boe",
        b2: "oef",
    })

    t.end()
})

test.skip("[ts] it should handle not yet defined modelschema's for classes", (t) => {
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

    t.equal(m.child.length, 2)
    t.ok(m.child[1] === m.ref)

    t.deepEqual(serialize(m), json)

    t.end()
})

test("issue 10", (t) => {
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
    t.equal(store2.router.routes.length, 1)
    t.end()
})

test("[babel] @serializeAll", (t) => {
    @serializeAll
    class Store {
        a = 3
        b
    }

    const store = new Store()
    store.c = 5
    store.d = {}

    t.deepEqual(serialize(store), { a: 3, b: undefined, c: 5 })

    const store2 = deserialize(Store, { a: 2, b: 3, c: 4 })
    t.equal(store2.a, 2)
    t.equal(store2.b, 3)
    t.equal(store2.c, 4)

    t.end()
})


test("[babel] class hierarchy with simple discriminator", (t) => {
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
    ];

    const picSerialized = serialize(src[0]);
    const serialized = serialize(src);

    t.equal(picSerialized.id, src[0].id);
    t.equal(picSerialized[DEFAULT_DISCRIMINATOR_ATTR], "picture");

    t.equal(serialized[0].id, src[0].id);
    t.equal(serialized[0][DEFAULT_DISCRIMINATOR_ATTR], "picture");
    t.equal(serialized[1].id, src[1].id);
    t.equal(serialized[1][DEFAULT_DISCRIMINATOR_ATTR], "video");

    const [deserPic, deserVid] = deserialize(Todo, serialized);
    t.true(deserPic instanceof PictureTodo, "Deserialized pic should be instance of PictureTodo");
    t.true(deserVid instanceof VideoTodo, "Deserialized pic should be instance of VideoTodo");

    t.deepEqual(src[0], deserPic);
    t.deepEqual(src[1], deserVid);
    t.end();
});

test("[babel] class hierarchy with complex discriminator", (t) => {
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
    ];

    const [deserPic, deserVid] = deserialize(Todo, serialize(src));
    t.true(deserPic instanceof PictureTodo, "Deserialized pic should be instance of PictureTodo");
    t.true(deserVid instanceof VideoTodo, "Deserialized pic should be instance of VideoTodo");

    t.deepEqual(src[0], deserPic);
    t.deepEqual(src[1], deserVid);
    t.end();
});

test("[babel] class hierarchy with multiple levels", (t) => {
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
    ];

    const serialized = serialize(src);

    t.equal(serialized[0].id, src[0].id);
    t.equal(serialized[0][DEFAULT_DISCRIMINATOR_ATTR], "picture");
    t.equal(serialized[1].id, src[1].id);
    t.equal(serialized[1][DEFAULT_DISCRIMINATOR_ATTR], "betterPicture");
    t.equal(serialized[2].id, src[2].id);
    t.equal(serialized[2][DEFAULT_DISCRIMINATOR_ATTR], "video");

    const [deserPic, deserBetterPic, deserVid] = deserialize(Todo, serialized);
    t.true(deserPic instanceof PictureTodo, "Deserialized pic should be instance of PictureTodo");
    t.true(
        deserBetterPic instanceof BetterPictureTodo,
        "Deserialized betterPic should be instance of BetterPictureTodo"
    );
    t.true(deserVid instanceof VideoTodo, "Deserialized pic should be instance of VideoTodo");

    t.deepEqual(src[0], deserPic);
    t.deepEqual(src[1], deserBetterPic);
    t.deepEqual(src[2], deserVid);
    t.end();
});
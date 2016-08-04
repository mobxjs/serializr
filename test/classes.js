var test = require("tape")
var _ = require("../")

test("schema's can be defined on constructors", t => {
    function Todo(title) {
        this.title = title
    }

    _.createModelSchema(Todo, {
        title: true
    })

    var source = new Todo("test")
    var json = {
        title: "test"
    }

    t.deepEqual(_.serialize(source), json)
    var res = _.deserialize(Todo, json)
    t.equal(res.title, "test")
    t.equal(res instanceof Todo, true)

    _.update(res, {
        title: "bloop"
    })
    t.equal(res.title, "bloop")

    test("serialize list", t => {
        var jsonlist = [{ title: "test1" }, { title: "test2" }]
        var todos = _.deserialize(Todo, jsonlist)
        t.equal(todos.length, 2)
        t.deepEqual(_.serialize(todos), jsonlist)

        t.end()
    })

    t.end()
})

test("complex async schema", t => {
    function Post(id, msg) {
        this.id = id
        this.message = msg;
        this.comments = [];
        postStore.push(this)
    }
    function Comment(id, msg) {
        this.id = id
        this.message = msg
        commentStore[id] = this
    }

    _.createModelSchema(Comment, {
        id: _.alias("__id", _.identifier()), // mark as identifier, use alias
        message: true
    })
    _.createModelSchema(Post, {
        id: true,
        message: true,
        comments: _.list(_.ref(Comment, fetchComment))
    })

    var postStore = []
    var commentStore = {}

    function fetchComment(id, cb) {
        if (!commentStore[id])
            setTimeout(function() {
                cb("Comment not foun: " + id)
            }, 10)
        else
            setTimeout(function() {
                cb(null, commentStore[id])
            }, 10)
    }

    test("aliased identifier is (de)serialized correctly ", t => {
        var c1 = new Comment(2, "World")
        var serialized = _.serialize(c1)
        t.deepEqual(serialized, {
            __id: 2, message: "World"
        })
        t.deepEqual(_.serialize(_.deserialize(Comment, serialized)), serialized)
        t.end()
    })

    test("simple async fetch", t => {
        var p = new Post(1, "Hello")
        var c1 = new Comment(2, "World")
        var c2 = new Comment(3, "Universe")
        p.comments.push(c1, c2)

        var serialized = _.serialize(p)
        t.deepEqual(serialized, {
            id: 1, message: "Hello", comments: [2, 3]
        })

        var clone = _.deserialize(Post, serialized, function (err, r) {
            t.notOk(err)
            t.ok(clone === r)
            t.equal(r.comments.length, 2)
            t.ok(r.comments[0] === c1)
            t.ok(r.comments[1] === c2)

            t.end()
        })

        t.ok(clone instanceof Post)
        t.equal(clone.id, 1)
        t.equal(clone.message, "Hello")
        t.equal(clone.comments.length, 0)
        // end in the above async callback
    })

    t.end()
})

test("it should handle not yet defined modelschema's for classes", t => {
    function Message() {

    }
    _.createModelSchema(Message, {
        child: _.list(_.object(Comment)), // model for Comment not defined yet!
        ref: _.reference(Comment)
    })

    function Comment() {

    }
    _.createModelSchema(Comment, {
        id: _.identifier(),
        "*": true
    })

    var json = {
        ref: 1,
        child: [
            { id: 2, title: "foo" },
            { id: 1, title: "bar "}
        ]
    }
    var m = _.deserialize(Message, json)

    t.equal(m.child.length, 2)
    t.ok(m.child[1] === m.ref)

    t.deepEqual(_.serialize(m), json)

    t.end()
})

test("test context and factories", t => {
    function Message() {
        this.title = "test"
        this.comments = []
    }

    function Comment() {
        this.title = "bla"
    }

    var myArgs = "myStore";
    var theMessage = null;
    var json = {
        title: "bloopie",
        comments: [{
            title: "42"
        }]
    }
    var mContext;

    var commentModel = {
        factory: (context) => {
            t.deepEqual(context.json, json.comments[0])
            t.deepEqual(context.parentContext, mContext)
            t.deepEqual(context.parentContext.target, theMessage)
            t.deepEqual(context.args, myArgs)
            t.deepEqual(context.target, null) // only available after factory has been invoked
            return new Comment()
        },
        props: {
            title: true
        }
    }

    var messageModel = {
        factory: (context) => {
            mContext = context
            t.deepEqual(context.json, json)
            t.deepEqual(context.parentContext, null)
            t.deepEqual(context.args, myArgs)
            t.deepEqual(context.target, null) // only available after factory has been invoked
            return (theMessage = new Message())
        },
        props: {
            title: true,
            comments: _.list(_.child(commentModel))
        }
    }

    var res = _.deserialize(messageModel, json, (err, message) => {
        t.ok(message === theMessage)
        t.notOk(err)
        t.deepEqual(_.serialize(messageModel, message), json)
    }, myArgs)

    t.ok(res === theMessage)
    t.end()
})

test("sync error handling", t => {
    var sub = _.createSimpleSchema({
        id: true
    });

    var parent = _.createSimpleSchema({
        r: _.list(_.ref("id", (id, cb) => {
            if (id === 42)
                cb("oops")
            else
                cb(null, null)
        }))
    })

    t.throws(() => {
        var a = _.deserialize(parent, { r: [1, 42] })
    }, /oops/)

    t.end();
})

test("async error handling without handler", t => {
    var sub = _.createSimpleSchema({
        id: true
    });

    var parent = _.createSimpleSchema({
        r: _.list(_.ref("id", (id, cb) => {
            if (id === 42)
                setImmediate(() => {
                    // normally this error would be ungarded, killing the app
                    t.throws(
                        () => cb("oops"),
                        /oops/
                    )
                    t.end()
                })
            else
                setImmediate(() => cb(null, null))
        }))
    })

    var a = _.deserialize(parent, { r: [1, 42] })
})


test("async error handling with handler", t => {
    var sub = _.createSimpleSchema({
        id: true
    });

    var parent = _.createSimpleSchema({
        r: _.list(_.ref("id", (id, cb) => {
            if (id === 42)
                setImmediate(() => {
                    cb("oops")
                })
            else
                setImmediate(() => cb(null, null))
        }))
    })

    var a = _.deserialize(parent, { r: [1, 42] }, (err, res) => {
        t.notOk(res)
        t.ok(a)
        t.equal(err, "oops")
        t.end()
    })
})

test("default reference resolving", t => {
    function Store() {
        this.boxes = []
        this.arrows = []
    }
    function Box(id) {
        this.id = id
    }
    function Arrow(from, to) {

    }
    _.createModelSchema(Box, {
        id: _.identifier()
    })
    _.createModelSchema(Arrow, {
        from: _.ref(Box),
        to: _.ref(Box)
    })
    _.createModelSchema(Store, {
        boxes: _.list(_.child(Box)),
        arrows: _.list(_.child(Arrow))
    })

    test("it should resolve references", t => {
        var s = _.deserialize(Store, {
            boxes : [ { id: 1 }, { id: 2 }],
            arrows: [
                { from: 1, to: 2 },
                { from: 2, to: 2 }
            ]
        })
        t.equal(s.boxes.length, 2)
        t.equal(s.arrows.length, 2)
        t.ok(s.arrows[0].from === s.boxes[0])
        t.ok(s.arrows[0].to === s.boxes[1])
        t.ok(s.arrows[1].from === s.boxes[1])
        t.ok(s.arrows[1].to === s.boxes[1])
        t.end()
    })

    test("it should resolve wrongly ordered references", t => {
        var swappedScheme = _.createModelSchema(Store, {
            arrows: _.list(_.child(Arrow)),
            boxes: _.list(_.child(Box))
        })
        var s = _.deserialize(Store, {
            arrows: [
                { from: 1, to: 2 },
                { from: 2, to: 2 }
            ],
            boxes : [ { id: 1 }, { id: 2 }]
        })
        t.equal(s.boxes.length, 2)
        t.equal(s.arrows.length, 2)
        t.ok(s.arrows[0].from === s.boxes[0])
        t.ok(s.arrows[0].to === s.boxes[1])
        t.ok(s.arrows[1].from === s.boxes[1])
        t.ok(s.arrows[1].to === s.boxes[1])
        t.end()

    })

    test("it should throw on missing references", t => {
         _.deserialize(
             Store,
             {
                boxes : [ { id: 1 }, { id: 2 }],
                arrows: [
                    { from: 1, to: 4 },
                    { from: 3, to: 2 }
                ]
            },
            (err, res) => {
                t.notOk(res)
                t.equal("" + err, 'Error: Unresolvable references in json: "3", "4"')
                t.end()
            }
        )
    })

    t.end()
})

test("it should hand to handle colliding references", t => {
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
    function Arrow(from, to) {

    }
    _.createModelSchema(Box, {
        id: _.identifier()
    })
    _.createModelSchema(Circle, {
        id: _.identifier()
    })
    _.createModelSchema(Arrow, {
        from: _.ref(Box),
        to: _.ref(Circle)
    })
    _.createModelSchema(Store, {
        boxes: _.list(_.child(Box)),
        arrows: _.list(_.child(Arrow)),
        circles: _.list(_.child(Circle))
    })

    var s = _.deserialize(Store, {
        boxes: [{ id: 1 }],
        arrows: [{ from: 1, to: 1 }],
        circles: [{ id: 1 }]
    })

    t.ok(s.arrows[0].from instanceof Box)
    t.ok(s.arrows[0].to instanceof Circle)
    t.ok(s.arrows[0].from === s.boxes[0])
    t.ok(s.arrows[0].to === s.circles[0])

    t.end()
})

test("it should handle refs to subtypes", t => {
    function Store() {
        this.boxes = []
        this.arrows = []
        this.circles = []
    }
    function Box(id) {
        this.id = id
    }
    function Circle(id) {
    }
    function Arrow(from, to) {

    }
    _.createModelSchema(Box, {
        id: _.identifier()
    })
    _.createModelSchema(Circle, {
    })
    _.getDefaultModelSchema(Circle).extends = _.getDefaultModelSchema(Box)

    _.createModelSchema(Arrow, {
        from: _.ref(Box),
        to: _.ref(Circle)
    })
    _.createModelSchema(Store, {
        boxes: _.list(_.child(Box)),
        arrows: _.list(_.child(Arrow)),
        circles: _.list(_.child(Circle))
    })

    test("it should accept subtypes", t => {
        var s = _.deserialize(Store, {
            boxes: [{ id: 1 }],
            arrows: [{ from: 2, to: 2 }],
            circles: [{ id: 2 }]
        })

        t.ok(s.arrows[0].from instanceof Circle)
        t.ok(s.arrows[0].to instanceof Circle)
        t.ok(s.arrows[0].from === s.circles[0])
        t.ok(s.arrows[0].to === s.circles[0])
        t.end()
    })

    test("it should not find supertypes", t => {
        t.throws(
            () => {
                _.deserialize(Store, {
                    boxes: [{ id: 1 }, { id: 2}],
                    arrows: [{ from: 1, to: 2 }], // to should be Circle, not a Box
                    circles: [{ id: 3 }]
                })
            },
            /Error: Unresolvable references in json: "2"/
        )
        t.end()
    })

    t.end()
})

test("identifier can register themselves", t => {
    var todos = {};

    var s = _.createSimpleSchema({
        id: _.identifier((id, object) => todos[id] = object),
        title: true
    })

    _.deserialize(s, {
        id: 1, title: "test0"
    })
    _.deserialize(s, [
        { id: 2, title: "test2" },
        { id: 1, title: "test1" }
    ])

    t.deepEqual(todos, {
        1: { id: 1, title: "test1" },
        2: { id: 2, title: "test2" }
    })
    t.end()
})
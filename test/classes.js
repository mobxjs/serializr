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
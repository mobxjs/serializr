var test = require("tape")
var _ = require("..")
var serialize = _.serialize
var deserialize = _.deserialize
var primitive = _.primitive
var update = _.update

test("it should serialize simple object", t => {
    var schema = {
        factory: () => ({}),
        props: {
            x: primitive()
        }
    }

    test("it should (de)serialize simple objects", t => {
        var a = { x: 42, y: 1337 }
        var s = serialize(schema, a)

        t.deepEqual(s, { x: 42 })
        t.deepEqual(deserialize(schema, s), { x: 42 })

        var d = { x: 1 }
        update(schema, a, d)
        t.deepEqual(a, {
            y: 1337, x: 1
        })

        test("it should skip missing attrs", t => {
            update(schema, a, {}, (err, res) => {
                t.ok(res === a)
                t.notOk(err)
                t.equal(res.x, 1)
                t.end()
            })
        })

        t.end()
    })

    test("it should (de)serialize arrays", t => {
        var data = [ { x: 1 }, { x: 2}]

        t.deepEqual(serialize(schema, data), data)
        t.deepEqual(deserialize(schema, data), data)

        t.end()
    })

    t.end()
})

test("it should support 'false' and 'true' propSchemas", t => {
    var s = _.createSimpleSchema({
        x: true,
        y: false
    })

    var a = { x: 1, y : 2}
    t.deepEqual(_.serialize(s, a), { x: 1 })

    _.update(s, a, { x: 4, y : 3})
    t.equal(a.x, 4)
    t.equal(a.y, 2)
    t.end()
})

test("it should respect `*` prop schemas", t => {
    var s = _.createSimpleSchema({ "*" : true })
    t.deepEqual(_.serialize(s, { a: 42, b: 17 }), { a: 42, b: 17 })
    t.deepEqual(_.deserialize(s, { a: 42, b: 17 }), { a: 42, b: 17 })

    t.throws(() => _.serialize(s, { a: new Date() }), /encountered non primitive value while serializing/)
    t.throws(() => _.serialize(s, { a: {} }), /encountered non primitive value while serializing/)

    t.throws(() => _.deserialize(s, { a: new Date() }), /encountered non primitive value while deserializing/)
    t.throws(() => _.deserialize(s, { a: {} }), /encountered non primitive value while deserializing/)

    var s2 = _.createSimpleSchema({
        "*" : true,
        a: _.date()
    })
    t.doesNotThrow(() => _.serialize(s2, { a: new Date() }))
    t.throws(() => _.serialize(s2, { c: {} }), /encountered non primitive value while serializing/)

    t.doesNotThrow(() => _.deserialize(s2, { a: new Date().getTime() }), /bla/)
    t.throws(() => _.deserialize(s2, { c: {} }), /encountered non primitive value while deserializing/)

    // don't assign aliased attrs
    var s3 = _.createSimpleSchema({
        a: _.alias("b", true),
        "*" : true,
    })
    t.deepEqual(_.deserialize(s3, { b: 4, a: 5}), { a: 4 })


    t.end()
})

test("it should respect custom schemas", t => {
    var s = _.createSimpleSchema({
        a: _.custom(
            function(v) { return v + 2 },
            function(v) { return v - 2 }
        )
    })
    t.deepEqual(_.serialize(s, { a: 4 }), { a: 6 })
    t.deepEqual(_.deserialize(s, { a: 6 }), { a: 4 })
    t.end()
})

test("it should not set values for custom serializers/deserializer that return undefined", t => {
    var s = _.createSimpleSchema({
        a: _.custom(
            function(v) { return v },
            function(v) { return undefined }
        )
    })
    t.deepEqual(_.serialize(s, { a: 4 }), { a: 4 })
    t.deepEqual(_.deserialize(s, { a: 4 }), { })

    s = _.createSimpleSchema({
        a: _.custom(
            function(v) { return undefined },
            function(v) { return null }
        )
    })
    t.deepEqual(_.serialize(s, { a: 4 }), { })
    t.deepEqual(_.deserialize(s, { a: 4 }), { a: null })

    t.end()
})

test("it should respect extends", t => {
    var superSchema = _.createSimpleSchema({
        x: primitive()
    })
    var subSchema = _.createSimpleSchema({
        y: _.alias("z", primitive())
    })
    subSchema.extends = superSchema

    var source = { x: 7, y: 8}
    var json = { x: 7, z: 8}
    t.deepEqual(serialize(subSchema, source), json)
    t.deepEqual(deserialize(subSchema, json), source)

    t.end()
})

test("it should respect aliases", t => {
    var schema = _.createSimpleSchema({
        x: primitive(),
        y: _.alias("z", primitive())
    })

    var source = { x: 7, y: 8}
    var json = { x: 7, z: 8}
    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    t.end()
})


test("it should respect lists", t => {
    var schema = _.createSimpleSchema({
        x: _.list(primitive()),
    })

    var source = { x: [7, 8, 9] }
    var json = source
    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    t.end()
})

test("it should respect childs", t => {
    var childSchema = _.createSimpleSchema({
        x: primitive()
    })
    var parentSchema = _.createSimpleSchema({
        y: _.child(childSchema),
        z: _.child(childSchema)
    })

    var source = {
        y: { x: 42 },
        z: null
    }
    var json = source

    t.deepEqual(serialize(parentSchema, source), json)
    t.deepEqual(deserialize(parentSchema, json), source)

    t.end()
})

test("it should respect refs", t => {
    var objects = {
        mars: { y: 42, uuid: "mars" },
        twix: { y: 42, uuid: "twix" }
    }

    function lookup(uuid, cb) {
        return cb(null, objects[uuid])
    }

    var schema = _.createSimpleSchema({
        x: _.alias("z", _.list(_.ref("uuid", lookup)))
    })

    var source = {
        x: [objects.mars, objects.twix, objects.mars]
    }
    var json = {
        z: ["mars", "twix", "mars"]
    }

    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    t.end()
})

test("it should support maps", t => {
    var schema = _.createSimpleSchema({
        x: _.map()
    })

    var source = {
        x: {
            foo: 1,
            bar: 2
        }
    }
    var json = source

    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    // recycle objects if possible
    var m = source.x
    update(schema, source, { x: { bar: 3, baz: 4 }})
    t.deepEqual(source, { x: { bar: 3, baz: 4 }})

    t.end()
})

test("it should support ES6 maps", t => {
    var factory = function() {
        return {
            x: new Map()
        }
    }
    var schema = {
        factory: factory,
        props: {
            x: _.map()
        }
    }

    var source = factory()
    source.x.set("foo", 1)
    source.x.set("bar", 2)
    var json = {
        x: {
            foo: 1,
            bar: 2
        }
    }

    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    // recycle objects if possible
    var m = source.x
    update(schema, source, { x: { bar: 3, baz: 4 }})
    t.deepEqual(serialize(schema, source), { x: { bar: 3, baz: 4 }})
    t.ok(source.x === m)
    t.ok(source.x instanceof Map)

    t.end()
})

test("it should support dates", t => {
    var s = _.createSimpleSchema({
        d1: _.date(),
        d2: _.date()
    })

    var now = Date.now();
    var a = _.deserialize(s, {
        d1: null,
        d2: now
    })
    t.equal(a.d1, null)
    t.ok(a.d2 instanceof Date)
    t.equal(a.d2.getTime(), now)

    t.deepEqual(_.serialize(s, a), {
        d1: null,
        d2: now
    })

    t.end()
})

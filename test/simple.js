var test = require("tape")
var _ = require("..")
var serialize = _.serialize
var deserialize = _.deserialize
var optional = _.optional
var primitive = _.primitive
var update = _.update

test("it should serialize simple object", (t1) => {
    var schema = {
        factory: () => ({}),
        props: {
            x: primitive(),
        },
    }

    test("it should (de)serialize simple objects", (t) => {
        var a = { x: 42, y: 1337 }
        var s = serialize(schema, a)

        t.deepEqual(s, { x: 42 })
        t.deepEqual(deserialize(schema, s), { x: 42 })

        var d = { x: 1 }
        update(schema, a, d)
        t.deepEqual(a, {
            y: 1337,
            x: 1,
        })

        test("it should skip missing attrs", (t3) => {
            update(schema, a, {}, (err, res) => {
                t3.ok(res === a)
                t3.notOk(err)
                t3.equal(res.x, 1)
                t3.end()
            })
        })

        t.end()
    })

    test("it should serialize all fields in the schema even if they're not defined on the object (existing behavior)", (t) => {
        var a = { y: 1337 }
        var s = serialize(schema, a)

        t.deepEqual(s, { x: undefined })
        // Note that this behavior is only one-way: it doesn't set props as undefined on the deserialized object.
        t.deepEqual(deserialize(schema, s), {})

        var d = { x: 1 }
        update(schema, a, d)
        t.deepEqual(a, {
            y: 1337,
            x: 1,
        })

        test("it should skip missing attrs", (t3) => {
            update(schema, a, {}, (err, res) => {
                t3.ok(res === a)
                t3.notOk(err)
                t3.equal(res.x, 1)
                t3.end()
            })
        })

        t.end()
    })

    test("it should (de)serialize arrays", (t) => {
        var data = [{ x: 1 }, { x: 2 }]

        t.deepEqual(serialize(schema, data), data)
        t.deepEqual(deserialize(schema, data), data)

        t.end()
    })

    t1.end()
})

test("it should support 'false' and 'true' propSchemas", (t) => {
    var s = _.createSimpleSchema({
        x: true,
        y: false,
    })

    var a = { x: 1, y: 2 }
    t.deepEqual(_.serialize(s, a), { x: 1 })

    _.update(s, a, { x: 4, y: 3 })
    t.equal(a.x, 4)
    t.equal(a.y, 2)
    t.end()
})

test("it should respect `*` : true (primitive) prop schemas", (t) => {
    var s = _.createSimpleSchema({ "*": true })
    t.deepEqual(_.serialize(s, { a: 42, b: 17 }), { a: 42, b: 17 })
    t.deepEqual(_.deserialize(s, { a: 42, b: 17 }), { a: 42, b: 17 })

    t.deepEqual(_.serialize(s, { a: new Date(), d: 2 }), { d: 2 })
    t.deepEqual(_.serialize(s, { a: {}, d: 2 }), { d: 2 })

    t.throws(
        () => _.deserialize(s, { a: new Date() }),
        /encountered non primitive value while deserializing/
    )
    t.throws(
        () => _.deserialize(s, { a: {} }),
        /encountered non primitive value while deserializing/
    )
    var s2 = _.createSimpleSchema({
        "*": true,
        a: _.date(),
    })
    t.doesNotThrow(() => _.serialize(s2, { a: new Date(), d: 2 }))
    t.deepEqual(_.serialize(s2, { c: {}, d: 2 }), { a: undefined, d: 2 })

    t.doesNotThrow(() => _.deserialize(s2, { a: new Date().getTime() }), /bla/)
    t.throws(
        () => _.deserialize(s2, { c: {}, d: 2 }),
        /encountered non primitive value while deserializing/
    )

    // don't assign aliased attrs
    var s3 = _.createSimpleSchema({
        a: _.alias("b", true),
        "*": true,
    })
    t.deepEqual(_.deserialize(s3, { b: 4, a: 5 }), { a: 4 })

    t.end()
})

test("it should respect `*` : schema prop schemas", (t) => {
    var starPropSchema = _.object(
        _.createSimpleSchema({
            x: optional(primitive()),
        }),
        { pattern: /^\d.\d+$/ }
    )

    var s = _.createSimpleSchema({ "*": starPropSchema })
    t.deepEqual(_.serialize(s, { "1.0": { x: 42 }, "2.10": { x: 17 } }), {
        "1.0": { x: 42 },
        "2.10": { x: 17 },
    })
    t.deepEqual(_.deserialize(s, { "1.0": { x: 42 }, "2.10": { x: 17 } }), {
        "1.0": { x: 42 },
        "2.10": { x: 17 },
    })

    t.deepEqual(_.serialize(s, { a: new Date(), d: 2 }), {})
    t.deepEqual(_.serialize(s, { a: {}, "2.10": { x: 17 } }), { "2.10": { x: 17 } })

    t.deepEqual(_.deserialize(s, { "1.0": "not an object" }), { "1.0": null })

    var s2 = _.createSimpleSchema({
        "*": starPropSchema,
        "1.0": _.date(),
    })
    t.doesNotThrow(() => _.serialize(s2, { "1.0": new Date(), d: 2 }))
    t.deepEqual(_.serialize(s2, { c: {}, "2.0": { x: 2 } }), { "1.0": undefined, "2.0": { x: 2 } })

    // don't assign aliased attrs
    var s3 = _.createSimpleSchema({
        a: _.alias("1.0", true),
        "*": starPropSchema,
    })
    t.deepEqual(_.deserialize(s3, { b: 4, "1.0": 5, "2.0": { x: 2 } }), { a: 5, "2.0": { x: 2 } })

    t.end()
})

test("it should respect custom schemas", (t) => {
    var s = _.createSimpleSchema({
        a: _.custom(
            function (v) {
                return v + 2
            },
            function (v) {
                return v - 2
            }
        ),
    })
    t.deepEqual(_.serialize(s, { a: 4 }), { a: 6 })
    t.deepEqual(_.deserialize(s, { a: 6 }), { a: 4 })
    t.end()
})

test("it should not set values for custom serializers/deserializer that return SKIP", (t) => {
    t.equal(typeof _.SKIP, "symbol")
    var s = _.createSimpleSchema({
        a: _.custom(
            function (v) {
                return v
            },
            function () {
                return _.SKIP
            }
        ),
    })

    t.deepEqual(_.serialize(s, { a: 4 }), { a: 4 })
    t.deepEqual(_.deserialize(s, { a: 4 }), {})

    s = _.createSimpleSchema({
        a: _.custom(
            function () {
                return _.SKIP
            },
            function () {
                return undefined
            }
        ),
    })
    t.deepEqual(_.serialize(s, { a: 4 }), {})
    t.deepEqual(_.deserialize(s, { a: 4 }), { a: undefined })

    t.end()
})

test("it should not serialize values for optional properties", (t) => {
    var schema = {
        factory: () => ({}),
        props: {
            optionalProp: optional(primitive()),
            requiredProp: primitive(),
        },
    }
    var a = { y: 1337 }
    var s = serialize(schema, a)

    t.deepEqual(s, { requiredProp: undefined })
    // Note that this behavior is only one-way: it doesn't set props as undefined on the deserialized object.
    t.deepEqual(deserialize(schema, s), {})

    var d = { optionalProp: 1 }
    update(schema, a, d)
    t.deepEqual(a, {
        y: 1337,
        optionalProp: 1,
    })

    test("it should skip missing attrs", (t3) => {
        update(schema, a, {}, (err, res) => {
            t3.ok(res === a)
            t3.notOk(err)
            t3.equal(res.optionalProp, 1)
            t3.end()
        })
    })

    t.end()
})

test("it should pass key and object to custom schemas", (t) => {
    var s = _.createSimpleSchema({
        a: primitive(),
        b: _.custom(
            function (v, k, obj) {
                return k + String(v * obj.b)
            },
            function (v) {
                return v
            }
        ),
    })
    t.deepEqual(_.serialize(s, { a: 2, b: 4 }), { a: 2, b: "b16" })
    t.deepEqual(_.deserialize(s, { a: 6, b: 2 }), { a: 6, b: 2 })
    t.end()
})

test("it should pass context to custom schemas", (t) => {
    var s = _.createSimpleSchema({
        a: primitive(),
        b: _.custom(
            function (v) {
                return v
            },
            function (v, context) {
                return context.json.a
            }
        ),
    })
    t.deepEqual(_.serialize(s, { a: 4, b: 2 }), { a: 4, b: 2 })
    t.deepEqual(_.deserialize(s, { a: 4, b: 2 }), { a: 4, b: 4 })
    t.end()
})

test("it should respect extends", (t) => {
    var superSchema = _.createSimpleSchema({
        x: primitive(),
    })
    var subSchema = _.createSimpleSchema({
        y: _.alias("z", primitive()),
    })
    subSchema.extends = superSchema

    var source = { x: 7, y: 8 }
    var json = { x: 7, z: 8 }
    t.deepEqual(serialize(subSchema, source), json)
    t.deepEqual(deserialize(subSchema, json), source)

    t.end()
})

test("it should respect aliases", (t) => {
    var schema = _.createSimpleSchema({
        x: primitive(),
        y: _.alias("z", primitive()),
    })

    var source = { x: 7, y: 8 }
    var json = { x: 7, z: 8 }
    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    t.end()
})

test("it should respect lists", (t) => {
    var schema = _.createSimpleSchema({
        x: _.list(primitive()),
    })

    var source = { x: [7, 8, 9] }
    var json = source
    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    t.end()
})

test("it should respect lists when null", (t) => {
    var schema = _.createSimpleSchema({
        x: _.list(primitive()),
    })

    var source = { x: null }
    var json = source
    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    t.end()
})

test("it should respect childs", (t) => {
    var childSchema = _.createSimpleSchema({
        x: primitive(),
    })
    var parentSchema = _.createSimpleSchema({
        y: _.object(childSchema),
        z: _.object(childSchema),
    })

    var source = {
        y: { x: 42 },
        z: null,
    }
    var json = source

    t.deepEqual(serialize(parentSchema, source), json)
    t.deepEqual(deserialize(parentSchema, json), source)

    t.end()
})

test("it should respect references", (t) => {
    var objects = {
        mars: { y: 42, uuid: "mars" },
        twix: { y: 42, uuid: "twix" },
    }

    function lookup(uuid, cb) {
        return cb(null, objects[uuid])
    }

    var schema = _.createSimpleSchema({
        x: _.alias("z", _.list(_.reference("uuid", lookup))),
    })

    var source = {
        x: [objects.mars, objects.twix, objects.mars],
    }
    var json = {
        z: ["mars", "twix", "mars"],
    }

    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    t.end()
})

test("it should respect raw", (t) => {
    var rawData = {
        a: 1,
        b: [],
        c: new Date(),
    }
    var schema = _.createSimpleSchema({
        rawData: _.raw(),
    })
    var source = {
        rawData: rawData,
    }
    var json = source

    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    t.end()
})

test("it should support maps", (t) => {
    var schema = _.createSimpleSchema({
        x: _.map(),
    })

    var source = {
        x: {
            foo: 1,
            bar: 2,
        },
    }
    var json = source

    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    // recycle objects if possible
    update(schema, source, { x: { bar: 3, baz: 4 } })
    t.deepEqual(source, { x: { bar: 3, baz: 4 } })

    t.end()
})

test("it should support ES6 maps", (t) => {
    var factory = function () {
        return {
            x: new Map(),
        }
    }
    var schema = {
        factory: factory,
        props: {
            x: _.map(),
        },
    }

    var source = factory()
    source.x.set("foo", 1)
    source.x.set("bar", 2)
    var json = {
        x: {
            foo: 1,
            bar: 2,
        },
    }

    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    // recycle objects if possible
    var m = source.x
    update(schema, source, { x: { bar: 3, baz: 4 } })
    t.deepEqual(serialize(schema, source), { x: { bar: 3, baz: 4 } })
    t.ok(source.x === m)
    t.ok(source.x instanceof Map)

    t.end()
})

test("it should support mapAsArray", (t) => {
    var factory = function () {
        return {
            x: new Map(),
        }
    }
    var idAndNameSchema = _.createSimpleSchema({
        id: true,
        name: true,
    })
    var schema = {
        factory: factory,
        props: {
            x: _.mapAsArray(_.object(idAndNameSchema), "id"),
        },
    }

    var source = factory()
    source.x.set(1, { id: 1, name: "Darth Vader" })
    source.x.set(2, { id: 2, name: "Leia" })
    var json = {
        x: [
            { id: 1, name: "Darth Vader" },
            { id: 2, name: "Leia" },
        ],
    }

    t.deepEqual(serialize(schema, source), json)
    t.deepEqual(deserialize(schema, json), source)

    //recycle objects if possible
    var m = source.x
    update(schema, source, { x: [{ id: 3, name: "Luke" }] })
    t.deepEqual(serialize(schema, source), { x: [{ id: 3, name: "Luke" }] })
    t.ok(source.x === m)
    t.ok(source.x instanceof Map)

    t.end()
})

test("it should support dates", (t) => {
    var s = _.createSimpleSchema({
        d1: _.date(),
        d2: _.date(),
    })

    var now = Date.now()
    var a = _.deserialize(s, {
        d1: null,
        d2: now,
    })
    t.equal(a.d1, null)
    t.ok(a.d2 instanceof Date)
    t.equal(a.d2.getTime(), now)

    t.deepEqual(_.serialize(s, a), {
        d1: null,
        d2: now,
    })

    t.end()
})

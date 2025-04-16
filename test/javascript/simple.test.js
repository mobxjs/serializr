import {
    serializable,
    primitive,
    serialize,
    update,
    deserialize,
    list,
    object,
    reference,
    identifier,
    serializeAll,
    subSchema,
    createModelSchema,
    createSimpleSchema,
    alias,
    getDefaultModelSchema,
    DEFAULT_DISCRIMINATOR_ATTR,
    date,
    custom,
    mapAsArray,
    map,
    raw,
    optional,
    SKIP,
} from "../../src/serializr"

describe("Serialize simple object", (t1) => {
    var schema = {
        factory: () => ({}),
        props: {
            x: primitive(),
        },
    }

    it("should (de)serialize simple objects", () => {
        var a = { x: 42, y: 1337 }
        var s = serialize(schema, a)

        expect(s).toEqual({ x: 42 })
        expect(deserialize(schema, s)).toEqual({ x: 42 })

        var d = { x: 1 }
        update(schema, a, d)
        expect(a).toEqual({
            y: 1337,
            x: 1,
        })
    })

    it("should skip missing attrs", () => {
        var a = { x: 42, y: 1337 }
        var s = serialize(schema, a)

        expect(s).toEqual({ x: 42 })
        expect(deserialize(schema, s)).toEqual({ x: 42 })

        var d = { x: 1 }
        update(schema, a, d)
        expect(a).toEqual({
            y: 1337,
            x: 1,
        })

        update(schema, a, {}, (err, res) => {
            expect(res).toBe(a)
            expect(err).toBeFalsy()
            expect(res.x).toBe(1)
        })
    })

    it("should serialize all fields in the schema even if they're not defined on the object (existing behavior)", () => {
        var a = { y: 1337 }
        var s = serialize(schema, a)

        expect(s).toEqual({ x: undefined })
        // Note that this behavior is only one-way: it doesn't set props as undefined on the deserialized object.
        expect(deserialize(schema, s)).toEqual({})

        var d = { x: 1 }
        update(schema, a, d)
        expect(a).toEqual({
            y: 1337,
            x: 1,
        })
    })

    it("should skip missing attrs", () => {
        var a = { y: 1337 }
        var s = serialize(schema, a)

        expect(s).toEqual({ x: undefined })
        // Note that this behavior is only one-way: it doesn't set props as undefined on the deserialized object.
        expect(deserialize(schema, s)).toEqual({})

        var d = { x: 1 }
        update(schema, a, d)
        expect(a).toEqual({
            y: 1337,
            x: 1,
        })

        update(schema, a, {}, (err, res) => {
            expect(res).toBe(a)
            expect(err).toBeFalsy()
            expect(res.x).toBe(1)
        })
    })

    it("should (de)serialize arrays", () => {
        var data = [{ x: 1 }, { x: 2 }]

        expect(serialize(schema, data)).toEqual(data)
        expect(deserialize(schema, data)).toEqual(data)
    })

    it("should support 'false' and 'true' propSchemas", () => {
        var s = createSimpleSchema({
            x: true,
            y: false,
        })

        var a = { x: 1, y: 2 }
        expect(serialize(s, a)).toEqual({ x: 1 })

        update(s, a, { x: 4, y: 3 })
        expect(a.x).toBe(4)
        expect(a.y).toBe(2)
    })

    it("should respect `*` : true (primitive) prop schemas", () => {
        var s = createSimpleSchema({ "*": true })
        expect(serialize(s, { a: 42, b: 17 })).toEqual({ a: 42, b: 17 })
        expect(deserialize(s, { a: 42, b: 17 })).toEqual({ a: 42, b: 17 })

        expect(serialize(s, { a: new Date(), d: 2 })).toEqual({ d: 2 })
        expect(serialize(s, { a: {}, d: 2 })).toEqual({ d: 2 })

        expect(() => deserialize(s, { a: new Date() })).toThrow()
        expect(() => deserialize(s, { a: {} })).toThrow()

        var s2 = createSimpleSchema({
            "*": true,
            a: date(),
        })
        expect(() => serialize(s2, { a: new Date(), d: 2 })).not.toThrow()
        expect(serialize(s2, { c: {}, d: 2 })).toEqual({ a: undefined, d: 2 })

        expect(() => deserialize(s2, { a: new Date().getTime() })).not.toThrow()
        expect(() => deserialize(s2, { c: {}, d: 2 })).toThrow()

        // don't assign aliased attrs
        var s3 = createSimpleSchema({
            a: alias("b", true),
            "*": true,
        })
        expect(deserialize(s3, { b: 4, a: 5 })).toEqual({ a: 4 })
    })

    it("should respect `*` : schema prop schemas", () => {
        var starPropSchema = object(
            createSimpleSchema({
                x: optional(primitive()),
            }),
            { pattern: /^\d.\d+$/ }
        )

        var s = createSimpleSchema({ "*": starPropSchema })
        expect(serialize(s, { "1.0": { x: 42 }, "2.10": { x: 17 } })).toEqual({
            "1.0": { x: 42 },
            "2.10": { x: 17 },
        })
        expect(deserialize(s, { "1.0": { x: 42 }, "2.10": { x: 17 } })).toEqual({
            "1.0": { x: 42 },
            "2.10": { x: 17 },
        })

        expect(serialize(s, { a: new Date(), d: 2 })).toEqual({})
        expect(serialize(s, { a: {}, "2.10": { x: 17 } })).toEqual({ "2.10": { x: 17 } })

        expect(deserialize(s, { "1.0": "not an object" })).toEqual({ "1.0": null })

        var s2 = createSimpleSchema({
            "*": starPropSchema,
            "1.0": date(),
        })
        expect(() => serialize(s2, { "1.0": new Date(), d: 2 })).not.toThrow()
        expect(serialize(s2, { c: {}, "2.0": { x: 2 } })).toEqual({
            "1.0": undefined,
            "2.0": { x: 2 },
        })

        // don't assign aliased attrs
        var s3 = createSimpleSchema({
            a: alias("1.0", true),
            "*": starPropSchema,
        })
        expect(deserialize(s3, { b: 4, "1.0": 5, "2.0": { x: 2 } })).toEqual({
            a: 5,
            "2.0": { x: 2 },
        })
    })

    it("should respect custom schemas", () => {
        var s = createSimpleSchema({
            a: custom(
                function (v) {
                    return v + 2
                },
                function (v) {
                    return v - 2
                }
            ),
        })
        expect(serialize(s, { a: 4 })).toEqual({ a: 6 })
        expect(deserialize(s, { a: 6 })).toEqual({ a: 4 })
    })

    it("should not set values for custom serializers/deserializer that return SKIP", () => {
        expect(typeof SKIP).toBe("symbol")
        var s = createSimpleSchema({
            a: custom(
                function (v) {
                    return v
                },
                function () {
                    return SKIP
                }
            ),
        })

        expect(serialize(s, { a: 4 })).toEqual({ a: 4 })
        expect(deserialize(s, { a: 4 })).toEqual({})

        s = createSimpleSchema({
            a: custom(
                function () {
                    return SKIP
                },
                function () {
                    return undefined
                }
            ),
        })
        expect(serialize(s, { a: 4 })).toEqual({})
        expect(deserialize(s, { a: 4 })).toEqual({ a: undefined })
    })

    it("should not serialize values for optional properties", () => {
        var schema = {
            factory: () => ({}),
            props: {
                optionalProp: optional(primitive()),
                requiredProp: primitive(),
            },
        }
        var a = { y: 1337 }
        var s = serialize(schema, a)

        expect(s).toEqual({ requiredProp: undefined })
        // Note that this behavior is only one-way: it doesn't set props as undefined on the deserialized object.
        expect(deserialize(schema, s)).toEqual({})

        var d = { optionalProp: 1 }
        update(schema, a, d)
        expect(a).toEqual({
            y: 1337,
            optionalProp: 1,
        })

        update(schema, a, {}, (err, res) => {
            expect(res).toBe(a)
            expect(err).toBeFalsy()
            expect(res.optionalProp).toBe(1)
        })
    })

    it("should pass key and object to custom schemas", () => {
        var s = createSimpleSchema({
            a: primitive(),
            b: custom(
                function (v, k, obj) {
                    return k + String(v * obj.b)
                },
                function (v) {
                    return v
                }
            ),
        })
        expect(serialize(s, { a: 2, b: 4 })).toEqual({ a: 2, b: "b16" })
        expect(deserialize(s, { a: 6, b: 2 })).toEqual({ a: 6, b: 2 })
    })

    it("should pass context to custom schemas", () => {
        var s = createSimpleSchema({
            a: primitive(),
            b: custom(
                function (v) {
                    return v
                },
                function (v, context) {
                    return context.json.a
                }
            ),
        })
        expect(serialize(s, { a: 4, b: 2 })).toEqual({ a: 4, b: 2 })
        expect(deserialize(s, { a: 4, b: 2 })).toEqual({ a: 4, b: 4 })
    })

    it("should respect extends", () => {
        var superSchema = createSimpleSchema({
            x: primitive(),
        })
        var subSchema = createSimpleSchema({
            y: alias("z", primitive()),
        })
        subSchema.extends = superSchema

        var source = { x: 7, y: 8 }
        var json = { x: 7, z: 8 }
        expect(serialize(subSchema, source)).toEqual(json)
        expect(deserialize(subSchema, json)).toEqual(source)
    })

    it("should respect aliases", () => {
        var schema = createSimpleSchema({
            x: primitive(),
            y: alias("z", primitive()),
        })

        var source = { x: 7, y: 8 }
        var json = { x: 7, z: 8 }
        expect(serialize(schema, source)).toEqual(json)
        expect(deserialize(schema, json)).toEqual(source)
    })

    it("should respect lists", () => {
        var schema = createSimpleSchema({
            x: list(primitive()),
        })

        var source = { x: [7, 8, 9] }
        var json = source
        expect(serialize(schema, source)).toEqual(json)
        expect(deserialize(schema, json)).toEqual(source)
    })

    it("should respect lists when null", () => {
        var schema = createSimpleSchema({
            x: list(primitive()),
        })

        var source = { x: null }
        var json = source
        expect(serialize(schema, source)).toEqual(json)
        expect(deserialize(schema, json)).toEqual(source)
    })

    it("should respect childs", () => {
        var childSchema = createSimpleSchema({
            x: primitive(),
        })
        var parentSchema = createSimpleSchema({
            y: object(childSchema),
            z: object(childSchema),
        })

        var source = {
            y: { x: 42 },
            z: null,
        }
        var json = source

        expect(serialize(parentSchema, source)).toEqual(json)
        expect(deserialize(parentSchema, json)).toEqual(source)
    })

    it("should respect references", () => {
        var objects = {
            mars: { y: 42, uuid: "mars" },
            twix: { y: 42, uuid: "twix" },
        }

        function lookup(uuid, cb) {
            return cb(null, objects[uuid])
        }

        var schema = createSimpleSchema({
            x: alias("z", list(reference("uuid", lookup))),
        })

        var source = {
            x: [objects.mars, objects.twix, objects.mars],
        }
        var json = {
            z: ["mars", "twix", "mars"],
        }

        expect(serialize(schema, source)).toEqual(json)
        expect(deserialize(schema, json)).toEqual(source)
    })

    it("should respect raw", () => {
        var rawData = {
            a: 1,
            b: [],
            c: new Date(),
        }
        var schema = createSimpleSchema({
            rawData: raw(),
        })
        var source = {
            rawData: rawData,
        }
        var json = source

        expect(serialize(schema, source)).toEqual(json)
        expect(deserialize(schema, json)).toEqual(source)
    })

    it("should support maps", () => {
        var schema = createSimpleSchema({
            x: map(),
        })

        var source = {
            x: {
                foo: 1,
                bar: 2,
            },
        }
        var json = source

        expect(serialize(schema, source)).toEqual(json)
        expect(deserialize(schema, json)).toEqual(source)

        // recycle objects if possible
        update(schema, source, { x: { bar: 3, baz: 4 } })
        expect(source).toEqual({ x: { bar: 3, baz: 4 } })
    })

    it("should support ES6 maps", () => {
        var factory = function () {
            return {
                x: new Map(),
            }
        }
        var schema = {
            factory: factory,
            props: {
                x: map(),
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

        expect(serialize(schema, source)).toEqual(json)
        expect(deserialize(schema, json)).toEqual(source)

        // recycle objects if possible
        var m = source.x
        update(schema, source, { x: { bar: 3, baz: 4 } })
        expect(serialize(schema, source)).toEqual({ x: { bar: 3, baz: 4 } })
        expect(source.x).toBe(m)
        expect(source.x).toBeInstanceOf(Map)
    })

    it("should support mapAsArray", () => {
        var factory = function () {
            return {
                x: new Map(),
            }
        }
        var idAndNameSchema = createSimpleSchema({
            id: true,
            name: true,
        })
        var schema = {
            factory: factory,
            props: {
                x: mapAsArray(object(idAndNameSchema), "id"),
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

        expect(serialize(schema, source)).toEqual(json)
        expect(deserialize(schema, json)).toEqual(source)

        //recycle objects if possible
        var m = source.x
        update(schema, source, { x: [{ id: 3, name: "Luke" }] })
        expect(serialize(schema, source)).toEqual({ x: [{ id: 3, name: "Luke" }] })
        expect(source.x).toBe(m)
        expect(source.x).toBeInstanceOf(Map)
    })

    it("should support dates", () => {
        var s = createSimpleSchema({
            d1: date(),
            d2: date(),
        })

        var now = Date.now()
        var a = deserialize(s, {
            d1: null,
            d2: now,
        })
        expect(a.d1).toBe(null)
        expect(a.d2).toBeInstanceOf(Date)
        expect(a.d2.getTime()).toBe(now)

        expect(serialize(s, a)).toEqual({
            d1: null,
            d2: now,
        })
    })
})

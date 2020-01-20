const mobx = require("mobx")
const test = require("tape")
const {
    object,
    custom,
    createModelSchema,
    createSimpleSchema,
    serialize,
    deserialize,
} = require("../")

test("(de-)serialization for mobx observables", t => {
    class TodoList {
        constructor() {
            this.data = {
                list: []
            }
        }
    }

    class Todo {
        constructor(title) {
            this.title = title
        }
    }

    mobx.decorate(TodoList, {
        data: mobx.observable,
    })

    const asyncTodoResolver = (v, ctx, old, cb) => {
        setTimeout(() => cb(null, v.map(data => new Todo(data.title))), 0)
    }
    const syncTodoResolver = (v, ctx, old, cb) => {
        cb(null, v.map(title => { return new Todo(title) }))
    }

    const asyncModelSchema = createModelSchema(TodoList, {
        data: object(createSimpleSchema({
            list: custom(
                v => v.map(t => t.title),
                (v, ctx, old, cb) => asyncTodoResolver(v, ctx, old, cb)
            )
        }))
    })

    const syncModelSchema = createModelSchema(TodoList, {
        data: object(createSimpleSchema({
            list: custom(
                v => v.map(t => t.title),
                (v, ctx, old, cb) => syncTodoResolver(v, ctx, old, cb)
            )
        }))
    })

    test("serialize", t2 => {
        const todoList = new TodoList()
        todoList.data.list.push(
            new Todo("todo 1"),
            new Todo("todo 2"),
        )
        const json = serialize(syncModelSchema, todoList)

        t.deepEqual(json, {
            data: {
                list: [
                    "todo 1",
                    "todo 2"
                ]
            }
        })
        t2.end()
    })

    test("sync deserialize", t2 => {
        const json = {
            data: {
                list: [
                    "todo 1",
                    "todo 2"
                ]
            }
        }

        deserialize(syncModelSchema, json, (err, todoList) => {
            t.ok(todoList instanceof TodoList, "deserialized object is an instance of TodoList")
            t.notEqual(todoList.data, undefined, "TodoList.data is not undefined")
            const data = todoList.data || undefined
            t.ok(Array.isArray(todoList.data.list), "TodoList.data.list is an array")
            const list = data.list || undefined
            const listL = list ? list.length : undefined

            t.equal(list ? list.length : undefined, 2, "TodoList.data.list has two elements")
            t.equal(listL ? list[0].title : undefined, "todo 1", "TodoList's 1st todo has title todo 1")
            t.equal(listL ? list[1].title : undefined, "todo 2", "TodoList's 1st todo has title todo 2")
            t2.end()
        })
    })

    test("async deserialize", t2 => {
        const json = {
            data: {
                list: [
                    "todo 1",
                    "todo 2"
                ]
            }
        }

        deserialize(asyncModelSchema, json, (err, todoList) => {
            t.ok(todoList instanceof TodoList, "deserialized object is an instance of TodoList")
            t.notEqual(todoList.data, undefined, "TodoList.data is not undefined")
            const data = todoList.data || undefined
            t.ok(Array.isArray(todoList.data.list), "TodoList.data.list is an array")
            const list = data.list || undefined
            const listL = list ? list.length : undefined

            t.equal(list ? list.length : undefined, 2, "TodoList.data.list has two elements")
            t.equal(listL ? list[0].title : undefined, "todo 1", "TodoList's 1st todo has title todo 1")
            t.equal(listL ? list[1].title : undefined, "todo 2", "TodoList's 1st todo has title todo 2")
            t2.end()
        })
    })

    t.end()
})

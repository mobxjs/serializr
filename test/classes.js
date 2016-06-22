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
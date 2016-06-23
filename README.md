# Serializr

__Don't use this package yet, it is under development_

-------
# TODO

 * [ ] If MobX, use createTransformer, transaction
 * [ ] Typings
 * [ ] Docs
 * [ ] Test in Babel
 * [ ] Test in Typescript

-------

# Api

## ModelSchema

The driving concept behind (de)serialization is a ModelSchema.
The configuration for how to (de)serialize plain JS structures to objects.
See also the examples below

A model schema simple looks like this:

```javascript
const todoSchema = {
    factory: (context) => new Todo(),
    extends: ModelSchema,
    props: {
        modelfield: PropSchema 
    }
}
```

The `factory` tells how to construct new instances durint deserialization.
`PropSchema`'s describe how individual properties are (de)serialized.
The props map from _model_ fields, not from json fields 

_implementation details:_
The `context` parameter to the factory contains the `parent` field (see the `child` PropSchema`),
a `addDeserializationCallback` method (with synchronous functions that are run after the deserialization but before returning), 
and a `createCallback` funtion to create a new callback which will automatically be waited for until deserialization is completed.

## createModelSchema(constructorFunc, props): ModelSchema

Convenient method to create a `ModelSchema`.
The new modelschema will be returned, but also stored as static field on the constructor.
This allows to just pass class instances to `serialize` without expicitly defining a model schema.

## getDefaultModelSchema(modelObject | constructor): ModelSchema

## setDefaultModelSchema(modelObject | constructor, ModelSchema)

## serialize(modelSchema?, modelObject(s)): json(array)

Serializes an object according to the provided modelSchema, or the modelSchema that was stored on its constructor schema (see `createModelSchema`).

## deserialize(modelSchema, json(array), callback?): modelObject(s)

Deserialize directly returns the instantiated model objects for the root of the json. However, properties are allowed to 
deserialize asynchronous (for example to fetch additional data). The callback will be invoked once the modelObjects have been constructed completely
Note: fields not _present_ in json are also not updated

## update(modelSchema?, modelObject(array), json(array), callback?)


### Prop schema

A prop schema describes how a property should be (deserialized).
```
{
    serializer: propValue => jsonValue 
    deserializer: (jsonValue, cb(err, propvalue), context?, oldValue?) => void
    jsonname: aliased name
}
```
 Built in prop schema's are:

### primitive()

### child(ModelSchema)
For childs, the current object will be passed in as `context.parent` object to the factory

### ref(childAttribute, lookup: (id, cb: (err, res) => void, context) => void)
Serializes an object to just a reference. Note that for deserialization a `lookup` method needs to be provided to restore the reference.


### alias(PropSchema, jsonName)
Higher order propSchema, allows to use a different name in the json
TODO: or seperate field of a propSchema?

### list(PropSchema)
Higher order propSchema, indicates that this property is a list 

## @serializable[(PropSchema)]
Field decorator that adds a property to the ModelSchema of the current class

### Creating custom prop schema's

A PropSchema is just an object with two fields, a `serializer` and `deserializer`

#### serializer: (modelPropValue) => jsonValue

#### deserializer: (jsonValue) => modelValue

Deserializer should invoke the `done` method after deserialization. This allows the deserialization process to be asynchronous and perform additional data fetch if needed.
See also `deserialize`.



# Examples

## 1. Plain schema with plain objects

```javascript
const todoSchema = {
    factory: () => {},
    props: {
        task: primitive(),
        owner: ref("_userId", UserStore.findUserById) // attribute of the owner attribute of  a todo + lookup function
        subTasks: alias(list(child(todoSchema)), "children") // recurse schema
    }
}

const todo = deserialize(todoSchema, 
    { task: "grab coffee", owner: 17, children: [] },
    (err, todo) => { console.log("finished loading todos") }
);

const todoJson = serialize(todoSchema, todo)
```

## 2. Create schema and store it on constructor

```javascript
function Todo(parentTodo) {
    this.parent = parentTodo; // available in subTasks
}

const todoSchema = {
    factory: (context) => new Todo(context.parent),
    props: {
        task: primitive(),
        owner: ref("_userId", UserStore.findUserById) // attribute of the owner attribute of  a todo + lookup function
        subTasks: alias(list(child(todoSchema)), "children") // recurse schema
    }
}
setDefaultModelSchema(Todo, todoSchema)

const todo = deserialize(Todo, // just pass the constructor name, schema will be picked up 
    { task: "grab coffee", owner: 17, children: [] },
    (err, todos) => { console.log("finished loading todos") }
);

const todoJson = serialize(todo) // no need to pass schema explicitly
```

### 3. Create schema for simple argumentless constructors

```javascript
function Todo() {

}

// creates a default factory, () => new Todo(), stores the schema as default model schema
createModelSchema(Todo, {
    task: primitive()
})

const todo = deserialize(Todo, // just pass the constructor name, schema will be picked up 
    { task: "grab coffee", owner: 17, children: [] },
    (err, todos) => { console.log("finished loading todos") }
);

const todoJson = serialize(todo) // no need to pass schema explicitly
```

#### 4. Create schema for simple argumentless constructors using decorators

```
class Todo {
    @serializable(primitive())
    task = "Grab coffee";

    @serializable(ref("_userId", UserStore.findUserById))
    owner = null;

    @serializable(alias(list(child(todoSchema)), "children")
    subTasks = [];
}

// note that (de)serialize also accepts lists
const todos = deserialize(Todo, 
    [{
        task: "grab coffee", owner: 17, children: [] 
    }],
    (err, todos) => { console.log("finished loading todos") }
);

const todoJson = serialize(todos)

```

#### 5. use custom factory methods to reuse model object instances

```javascript
const someTodoStoreById = {}

getDefaultModelSchema(Todo).factory = (context, json) => {
  if (someTodoStoreById[json.id])
    return someTodoStoreById[json.id] // reuse instance 
  return someTodoStoreById[json.id] = new Todo()
};
```
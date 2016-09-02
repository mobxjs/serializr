# Serializr

_Serialize and deserialize complex object graphs to JSON_

[![Build Status](https://travis-ci.org/mobxjs/serializr.svg?branch=master)](https://travis-ci.org/mobxjs/serializr)
[![Coverage Status](https://coveralls.io/repos/github/mobxjs/serializr/badge.svg?branch=master)](https://coveralls.io/github/mobxjs/serializr?branch=master)
[![Join the chat at https://gitter.im/mobxjs/serializr](https://badges.gitter.im/mobxjs/serializr.svg)](https://gitter.im/mobxjs/serializr?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Introduction

Serializr is a utility library that helps converting json structures into complex object graphs and the other way around.
For a quick overview, read the [introduction blog post](https://medium.com/@mweststrate/introducing-serializr-serializing-and-deserializing-object-graphs-with-ease-8833c3fcea02#.ha9s8hkjk)

Features:

-   (De)serialize objects created with a constructor / class
-   (De)serialize primitive values
-   (De)serialize nested objects, maps and arrays
-   Resolve references asynchronously (during deserialization)
-   Supports inheritance
-   Works on any ES5 environment (if ES3 is needed file a feature request)
-   Convenience decorators for ESNext / Typescript
-   Ships with typescript / flow typings
-   Generic solution that works well with for example MobX out of the box

Non-features:

-   Serializr is not an ORM or data management library. It doesn't manage object instances, provided api's like fetch, search etc. If you are building such a thing though, serializr might definitely take care of the serialization part for you :-).
-   Serializr is not a MobX specific (de)serialization mechanism, it is generic and should fit work with any type of model objects

# Installation

From npm: `npm install serializr --save`

From CDN: <https://npmcdn.com/serializr> which declares the global `serializr` object.

# Quick example:

```javascript
import {
    createModelSchema, primitive, reference, list, object, identifier, serialize, deserialize
} from "serializr";

// Example model classes
class User {
    uuid = Math.random();
    displayName = "John Doe";
}

class Message {
    message = "Test";
    author = null;
    comments = [];
}

findUserById(uuid, callback) {
    callback(null, fetchUserSomewhere(uuid))
}

// Create model schemas
createModelSchema(Message, {
    message: primitive(),
    author: reference(User, findUserById),
    comments: list(object(Message))
})

createModelSchema(User, {
    uuid: identifier(),
    displayName: primitive()
})

// can now deserialize and serialize!
const message = deserialize(Message, {
    message: "Hello world",
    author: 17,
    comments: [{
        message: "Welcome!",
        author: 23
    }]
})

const json = serialize(message)
```

## Using decorators (optional)

With decorators (TypeScript or ESNext) building model schemas is even more trivial:

```javascript
import {
    createModelSchema, primitive, reference, list, object, identifier, serialize, deserialize,
    serializable
} from "serializr";

class User {
    @serializable(identifier())
    uuid = Math.random();

    @serializable
    displayName = "John Doe";
}

class Message {
    @serializable
    message = "Test";

    @serializable(reference(User, findUserById))
    author = null;

    @serializable(list(object(Message)))
    comments = [];
}

And then call `serialize` without the first argument. 
```

## Enabling decorators (optional)

**TypeScript**

Enable the compiler option `experimentalDecorators` in `tsconfig.json` or pass it as flag `--experimentalDecorators` to the compiler.

**Babel:**

Install support for decorators: `npm i --save-dev babel-plugin-transform-decorators-legacy`. And enable it in your `.babelrc` file:

```javascript
{
    "presets": ["es2015", "stage-1"],
    "plugins": ["transform-decorators-legacy"]
}
```

Probably you have more plugins and presets in your `.babelrc` already, note that the order is important and `transform-decorators-legacy` should come as first.

# Concepts

The two most important functions exposed by serializr are `serialize(modelschema?, object) -> json tree` and `deserialize(modelschema, json tree) -> object graph`.
What are those model schemas?

## ModelSchema

The driving concept behind (de)serialization is a ModelSchema.
It describes how model object instances can be (de)serialize to json.

A simple model schema looks like this:

```javascript
const todoSchema = {
    factory: (context) => new Todo(),
    extends: ModelSchema,
    props: {
        modelfield: PropSchema
    }
}
```

The `factory` tells how to construct new instances during deserialization.
The optional `extends` property denotes that this model schema inherits its props from another model schema.
The props section describes how individual model properties are to be (de)serialized. Their names match the model field names.
The combination `fieldname: true` is simply a shorthand for `fieldname: primitive()`

For convenience, model schemas can be stored on the constructor function of a class.
This allows you to pass in a class reference wherever a model schema is required.
See the examples below.

## PropSchema

Prop schemas contain the strategy on how individual fields should be serialized.
It denotes whether a field is a primitive, list, whether it needs to be aliased, refers to other model objects etc.
Propschemas are composable. See the API section below for the details, but these are the built-in property schemas:

-   `primitive()`: Serialize a field as primitive value
-   `identifier()`: Serialize a field as primitive value, use it as identifier when serializing references (see `reference`)
-   `date()`: Serializes dates (as epoch number)
-   `alias(name, propSchema)`: Serializes a field under a different name
-   `list(propSchema)`: Serializes an array based collection
-   `map(propSchema)`: Serializes an Map or string key based collection
-   `object(modelSchema)`: Serializes an child model element
-   `reference(modelSchema, lookupFunction?)`: Serializes a reference to another model element
-   `custom(serializeFunction, deserializeFunction)`: Create your own property serializer by providing two functions, one that converts modelValue to jsonValue, and one that does the inverse
-   There is a special prop schema: `"*": true` that serializes all enumerable, non mentioned values as primitive

It is possible to define your own prop schemas. You can define your own propSchema by creating a function that returns an object with the following signature:

```javascript
{
    serializer: (sourcePropertyValue: any) => jsonValue,
    deserializer: (jsonValue: any, callback: (err, targetPropertyValue: any) => void, context?, currentPropertyValue?) => void
}
```

For inspiration, take a look at the source code of the existing ones on how they work, it is pretty straightforward.

## Deserialization context

The context object is an advanced feature and can be used to obtain additional context-related information about the deserialization process.
`context` is available as:

1.  first argument of factory functions
2.  third argument of the lookup callback of `ref` prop schema's (see below)
3.  third argument of the `deserializer` of a custom propSchema

When deserializing a model elememt / property, the following fields are available on the context object:

-   `json`: Returns the complete current json object that is being deserialized
-   `target`: The object currently being deserialized. This is the object that is returned from the factory function.
-   `parentContext`: Returns the parent context of the current context. For example if a child element is being deserialized, the `context.target` refers to the current model object, and `context.parentContext.target` refers to the parent model object that owns the current model object.
-   `args`: If custom arguments were passed to the `deserialize` / `update` function, they are available as `context.args`.

# API

## createSimpleSchema

[serializr.js:79-86](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L79-L86 "Source code on GitHub")

Creates a model schema that (de)serializes from / to plain javascript objects.
Its factory method is: `() => ({})`

**Parameters**

-   `props` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** property mapping,

**Examples**

```javascript
var todoSchema = createSimpleSchema({
  title: true,
  done: true
};

var json = serialize(todoSchema, { title: "Test", done: false })
var todo = deserialize(todoSchema, json)
```

Returns **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** model schema

## createModelSchema

[serializr.js:112-130](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L112-L130 "Source code on GitHub")

Creates a model schema that (de)serializes an object created by a constructor function (class).
The created model schema is associated by the targeted type as default model schema, see setDefaultModelSchema.
Its factory method is `() => new clazz()` (unless overriden, see third arg).

**Parameters**

-   `clazz` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** class or constructor function
-   `props` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** property mapping
-   `factory` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** optional custom factory. Receives context as first arg.

**Examples**

```javascript
function Todo(title, done) {
  this.title = title;
  this.done = done;
}

createModelSchema(Todo, {
  title: true,
  done: true
})

var json = serialize(new Todo("Test", false))
var todo = deserialize(Todo, json)
```

Returns **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** model schema

## serializable

[serializr.js:158-168](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L158-L168 "Source code on GitHub")

Decorator that defines a new property mapping on the default model schema for the class
it is used in.

**Parameters**

-   `arg1`
-   `arg2`
-   `arg3`

**Examples**

```javascript
class Todo {
```

Returns **PropertyDescriptor**

## getDefaultModelSchema

[serializr.js:192-201](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L192-L201 "Source code on GitHub")

Returns the standard model schema associated with a class / constructor function

**Parameters**

-   `clazz` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** class or constructor function
-   `thing`

Returns **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** model schema

## setDefaultModelSchema

[serializr.js:214-217](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L214-L217 "Source code on GitHub")

Sets the default model schema for class / constructor function.
Wherever a model schema is required as argument, this class / constructor function
can be passed in as well (for example when using `object` or `reference`.

When passing an instance of this class to `serialize`, it is not required to pass the model schema
as first argument anymore, because the default schema will be inferred from the instance type.

**Parameters**

-   `clazz` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** class or constructor function
-   `modelSchema`

Returns **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** model schema

## serialize

[serializr.js:269-287](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L269-L287 "Source code on GitHub")

Serializes an object (graph) into json using the provided model schema.
The model schema can be omitted if the object type has a default model schema associated with it.
If a list of objects is provided, they should have an uniform type.

**Parameters**

-   `arg1`  modelschema to use. Optional
-   `arg2`  object(s) to serialize

Returns **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** serialized representation of the object

## deserialize

[serializr.js:341-359](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L341-L359 "Source code on GitHub")

Deserializes a json structor into an object graph.
This process might be asynchronous (for example if there are references with an asynchronous
lookup function). The function returns an object (or array of objects), but the returned object
might be incomplete until the callback has fired as well (which might happen immediately). 

**Parameters**

-   `schema`
-   `json` **[json](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON)** data to deserialize
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** node style callback that is invoked once the deserializaiton has finished.
    First argument is the optional error, second argument is the deserialized object (same as the return value)
-   `customArgs` **any** custom arguments that are available as `context.args` during the deserialization process. This can be used as dependency injection mechanism to pass in, for example, stores.

## update

[serializr.js:525-544](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L525-L544 "Source code on GitHub")

Similar to deserialize, but updates an existing object instance.
Properties will always updated entirely, but properties not present in the json will be kept as is.
Further this method behaves similar to deserialize.

**Parameters**

-   `modelSchema` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** , optional if it can be inferred from the instance type
-   `target` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** target instance to update
-   `json` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** the json to deserialize
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** the callback to invoke once deserialization has completed.
-   `customArgs` **any** custom arguments that are available as `context.args` during the deserialization process. This can be used as dependency injection mechanism to pass in, for example, stores.

## primitive

[serializr.js:566-578](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L566-L578 "Source code on GitHub")

Indicates that this field contains a primitive value (or Date) which should be serialized literally to json.

**Examples**

```javascript
createModelSchema(Todo, {
  title: primitive()
})

console.dir(serialize(new Todo("test")))
// outputs: { title : "test" }
```

Returns **PropSchema**

## identifier

[serializr.js:613-627](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L613-L627 "Source code on GitHub")

Similar to primitive, but this field will be marked as the identifier for the given Model type.
This is used by for example `reference()` to serialize the reference

Identifier accepts an optional `registerFn` with the signature:
`(id, target, context) => void`
that can be used to register this object in some store. note that not all fields of this object might have been deserialized yet. 

**Parameters**

-   `registerFn` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** optional function to register this object during creation.

**Examples**

```javascript
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
```

Returns **PropSchema**

## date

[serializr.js:638-653](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L638-L653 "Source code on GitHub")

Similar to primitive, serializes instances of Date objects

## alias

[serializr.js:672-683](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L672-L683 "Source code on GitHub")

Alias indicates that this model property should be named differently in the generated json.
Alias should be the outermost propschema.

**Parameters**

-   `alias` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** name of the json field to be used for this property
-   `name`
-   `propSchema` **PropSchema** propSchema to (de)serialize the contents of this field

**Examples**

```javascript
createModelSchema(Todo, {
  title: alias("task", primitive())
})

console.dir(serialize(new Todo("test")))
// { task : "test" }
```

Returns **PropSchema**

## custom

[serializr.js:702-711](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L702-L711 "Source code on GitHub")

Can be used to create simple custom propSchema.

**Parameters**

-   `serializer` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** function that takes a model value and turns it into a json value
-   `deserializer` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** function that takes a json value and turns it into a model value

**Examples**

```javascript
var schema = _.createSimpleSchema({
  a: _.custom(
    function(v) { return v + 2 },
    function(v) { return v - 2 }
  )
})
t.deepEqual(_.serialize(s, { a: 4 }), { a: 6 })
t.deepEqual(_.deserialize(s, { a: 6 }), { a: 4 })
```

Returns **propSchema**

## object

[serializr.js:738-756](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L738-L756 "Source code on GitHub")

`object` indicates that this property contains an object that needs to be (de)serialized
using its own model schema.

N.B. mind issues with circular dependencies when importing model schemas from other files! The module resolve algorithm might expose classes before `createModelSchema` is executed for the target class.

**Parameters**

-   `modelSchema` **modelSchema** to be used to (de)serialize the child

**Examples**

```javascript
createModelSchema(SubTask, {
  title: true
})
createModelSchema(Todo, {
  title: true
  subTask: object(SubTask)
})

const todo = deserialize(Todo, {
  title: "Task",
  subTask: {
    title: "Sub task"
  }
})
```

Returns **PropSchema**

## reference

[serializr.js:810-843](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L810-L843 "Source code on GitHub")

`reference` can be used to (de)serialize references that point to other models.

The first parameter should be either a ModelSchema that has an `identifier()` property (see identifier)
or a string that represents which attribute in the target object represents the identifier of the object.

The second parameter is a lookup function that is invoked during deserialization to resolve an identifier to
an object. Its signature should be as follows:

`lookupFunction(identifier, callback, context)` where:

1.  `identifier` is the identifier being resolved
2.  `callback` is a node style calblack function to be invoked with the found object (as second arg) or an error (first arg)
3.  `context` see context.

The lookupFunction is optional. If it is not provided, it will try to find an object of the expected type and required identifier within the same JSON document

N.B. mind issues with circular dependencies when importing model schema's from other files! The module resolve algorithm might expose classes before `createModelSchema` is executed for the target class.

**Parameters**

-   `target`  : ModelSchema or string
-   `lookup` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** function
-   `lookupFn`

**Examples**

```javascript
createModelSchema(User, {
  uuid: identifier(),
  displayname: primitive()
})

createModelSchema(Post, {
  author: reference(User, findUserById)
  message: primitive()
})

function findUserById(uuid, callback) {
  fetch("http://host/user/" + uuid)
    .then((userData) => {
      deserialize(User, userData, callback)
    })
    .catch(callback)
}

deserialize(
  Post,
  {
    message: "Hello World",
    author: 234
  },
  (err, post) => {
    console.log(post)
  }
)
```

Returns **PropSchema**

## list

[serializr.js:875-896](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L875-L896 "Source code on GitHub")

List indicates that this property contains a list of things.
Accepts a sub model schema to serialize the contents

**Parameters**

-   `propSchema` **PropSchema** to be used to (de)serialize the contents of the array

**Examples**

```javascript
createModelSchema(SubTask, {
  title: true
})
createModelSchema(Todo, {
  title: true
  subTask: list(child(SubTask))
})

const todo = deserialize(Todo, {
  title: "Task",
  subTask: [{
    title: "Sub task 1"
  }]
})
```

Returns **PropSchema**

## map

[serializr.js:910-959](https://github.com/mobxjs/serializr/blob/b2816013b5db08c83b814ceb437ad35e4592ab8f/serializr.js#L910-L959 "Source code on GitHub")

Similar to list, but map represents a string keyed dynamic collection.
This can be both plain objects (default) or ES6 Map like structures.
This will be inferred from the initial value of the targetted attribute.

**Parameters**

-   `propSchema` **any**

# Recipes and examples

## 1. Plain schema with plain objects

```javascript
const todoSchema = {
    factory: () => {},
    props: {
        task: primitive(),
        owner: reference("_userId", UserStore.findUserById) // attribute of the owner attribute of  a todo + lookup function
        subTasks: alias("children", list(object(todoSchema)))
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
        owner: reference("_userId", UserStore.findUserById) // attribute of the owner attribute of  a todo + lookup function
        subTasks: alias("children", list(object(todoSchema)))
    }
}
setDefaultModelSchema(Todo, todoSchema)

const todo = deserialize(Todo, // just pass the constructor name, schema will be picked up
    { task: "grab coffee", owner: 17, children: [] },
    (err, todos) => { console.log("finished loading todos") }
);

const todoJson = serialize(todo) // no need to pass schema explicitly
```

## 3. Create schema for simple argumentless constructors

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

## 4. Create schema for simple argumentless constructors using decorators

```javascript
class Todo {
    @serializable(primitive())
    task = "Grab coffee";

    @serializable(reference("_userId", UserStore.findUserById))
    owner = null;

    @serializable(alias("children", list(object(todoSchema)))
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

## 5. use custom factory methods to reuse model object instances

```javascript
const someTodoStoreById = {}

getDefaultModelSchema(Todo).factory = (context, json) => {
  if (someTodoStoreById[json.id])
    return someTodoStoreById[json.id] // reuse instance
  return someTodoStoreById[json.id] = new Todo()
};
```

## 6. use custom arguments to inject stores to models

This pattern is useful to avoid singletons but allow to pass context specific data to constructors. This can be done by passing custom data to `deserialize` / `update` as last argument,
which will be available as `context.args` on all places where context is available:

```javascript
class User {
    constructor(someStore) {
        // User needs access to someStore, for whatever reason
    }
}

// create model schema with custom factory
createModelSchema(User, { username: true }, context => {
    return new User(context.args.someStore)
})

// don't want singletons!
const someStore = new SomeStore()
// provide somestore through context of the deserialization process
const user = deserialize(
    User,
    someJson,
    (err, user) => { console.log("done") },
    {
        someStore: someStore
    }
)
```

## 7. Putting it together: MobX store with plain objects, classes and internal references

```javascript
// Box.js:
import {observable, computed} from 'mobx';
import {randomUuid} from '../utils';
import {serializable, identifier} from 'serializr';

export default class Box {
    @serializable(identifier()) id;
    @observable @serializable name = 'Box' + this.id;
    @serializable @observable x = 0;
    @serializable @observable y = 0;
    @computed get width() {
        return this.name.length * 15;
    }
}

// Store.js:
import {observable, transaction} from 'mobx';
import {createSimpleSchema, ref, identifier, child, list, serialize, deserialize, update} from 'serializr';
import Box from './box';

// The store that holds our domain: boxes and arrows
const store = observable({
    boxes: [],
    arrows: [],
    selection: null
});

// Model of an arrow
const arrowModel = createSimpleSchema({
    id: identifier(),
    from: reference(Box)
    to: reference(Box)
})

// Model of the store itself
const storeModel = createSimpleSchema({
    boxes: list(object(Box)),
    arrows: list(object(arrowModel)),
    // context.target is the current store being deserialized
    selection: ref(Box)
})

// example data
store.boxes.push(
    new Box('Rotterdam', 100, 100),
    new Box('Vienna', 650, 300)
);

store.arrows.push({
    id: randomUuid(),
    from: store.boxes[0],
    to: store.boxes[1]
});

// (de) serialize functions
function serializeState(store) {
    return serialize(storeModel, store);
}

function deserializeState = (store, json) {
    transaction(() => {
        update(storeModel, store, json);
    })
}
```

* * *

# Future ideas

-   [ ] If MobX, optimize by leveraging createTransformer and transactions
-   [ ] Support async serialization (future)
-   [ ] Support ImmutableJS out of the box
-   [ ] Make `"*": true` respect extends clauses

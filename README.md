# Serializr

_Serialize and deserialize complex object graphs to JSON_

[![Build Status](https://travis-ci.org/mobxjs/serializr.svg?branch=master)](https://travis-ci.org/mobxjs/serializr)
[![Coverage Status](https://coveralls.io/repos/github/mobxjs/serializr/badge.svg?branch=master)](https://coveralls.io/github/mobxjs/serializr?branch=master)
[![Join the chat at https://gitter.im/mobxjs/serializr](https://badges.gitter.im/mobxjs/serializr.svg)](https://gitter.im/mobxjs/serializr?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Introduction

Serializr is a utility library that helps converting json structures into complex object graphs and the other way around.


Features:
 * (De)serialize objects created with a constructor / class
 * (De)serialize primitive values
 * (De)serialize nested objects, maps and arrays
 * Resolve references asynchronously (during deserialization)
 * Supports inheritance
 * Works on any ES3+ environment.
 * Convenience decorators for ESNext / Typescript
 * Ships with typescript / flow(?) typings
 * Works well with MobX out of the box (but not limited too, the serialization mechanism is generic and MobX is not a dependency)

Non-features:
 * Serializr is not an ORM or data management library. It doesn't manage object instances, provided api's like fetch, search etc. If you are building such a thing though, serializr might definitely take care of the serialization part for you :-).

# Installation

`npm install serializr --save`

# Quick example:

```
import {
    createModelSchema, primitive, ref, list, child, identifier, serialize, deserialize
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
    author: ref(User, findUserById),
    comments: list(child(Message))
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
    createModelSchema, primitive, ref, list, child, identifier, serialize, deserialize,
    serializable
} from "serializr";

class User {
    @serializable(identifier())
    uuid = Math.random();

    @serializable(primitive())
    displayName = "John Doe";
}

class Message {
    @serializable(primitive())
    message = "Test";

    @serializable(ref(User, findUserById))
    author = null;

    @serializable(list(child(Message)))
    comments = [];
}
```

## Enabling decorators (optional)

**TypeScript**

Enable the compiler option `experimentalDecorators` in `tsconfig.json` or pass it as flag `--experimentalDecorators` to the compiler.

**Babel:**

Install support for decorators: `npm i --save-dev babel-plugin-transform-decorators-legacy`. And enable it in your `babelrc` file:

```
{
  "presets": [
    "es2015",
    "stage-1"
  ],
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
The optional `extends` property denotes that this model schema inherits it's props from another model schema.
The props section describe how individual model properties are to be (de)serialized. Their names match the model field names.
The combination `fieldname: true` is simply a shorthand for `fieldname: primitive()`

For convenience, model schemas can be stored on the constructor function of a class.
This allows you to pass in a class reference everywhere where a model schema is required.
See the examples below.

## PropSchema

Prop schemas contain the strategy on how individual fields should be serialized.
It denotes whether a field is a primitive, list, whether it needs to be aliased, refers to other model objects etc.
Propschemas are composable. See the API section below for all possibilities.
It is possible to define your own prop schemas.
For now take a look at the source code of the existing ones on how they work, it is pretty straight forward.

## (De)serialization context

TODO


# API



# Recipes and examples

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

## 5. use custom factory methods to reuse model object instances

```javascript
const someTodoStoreById = {}

getDefaultModelSchema(Todo).factory = (context, json) => {
  if (someTodoStoreById[json.id])
    return someTodoStoreById[json.id] // reuse instance
  return someTodoStoreById[json.id] = new Todo()
};
```



-------
# TODO

 * [ ] Explain context
 * [ ] Document/ Solve circular deps?
 * [ ] If MobX, use createTransformer, transaction (future)
 * [ ] Support async serialization (future)
 * [x] coverage, travis
 * [ ] Typings
 * [ ] Docs
 * [ ] Test in Babel
 * [ ] Test in Typescript

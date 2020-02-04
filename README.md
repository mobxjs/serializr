# Serializr

_Serialize and deserialize complex object graphs to JSON_

[![Build Status](https://travis-ci.org/mobxjs/serializr.svg?branch=master)](https://travis-ci.org/mobxjs/serializr)
[![Coverage Status](https://coveralls.io/repos/github/mobxjs/serializr/badge.svg?branch=master)](https://coveralls.io/github/mobxjs/serializr?branch=master)
[![Join the chat at https://gitter.im/mobxjs/serializr](https://badges.gitter.im/mobxjs/serializr.svg)](https://gitter.im/mobxjs/serializr?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

_Serializr is feature complete, and easily extendable. Since there are no active maintainers the project is frozen feature wise. Bug reports and well designed pull requests are welcome and will be addressed._

Want to maintain a small open source project or having great ideas for this project? We are looking for maintainers, so [apply](https://github.com/mobxjs/serializr/issues/46)!

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

From CDN: <https://unpkg.com/serializr> which declares the global `serializr` object.

# Quick example:

```javascript
import {
    createModelSchema,
    primitive,
    reference,
    list,
    object,
    identifier,
    serialize,
    deserialize,
} from 'serializr';

// Example model classes
class User {
    uuid = Math.floor(Math.random() * 10000);
    displayName = 'John Doe';
}

class Message {
    message = 'Test';
    author = null;
    comments = [];
}

function fetchUserSomewhere(uuid) {
    // Lets pretend to actually fetch a user; but not.
    // In a real app this might be a database query
    const user = new User();
    user.uuid = uuid;
    user.displayName = `John Doe ${uuid}`;
    return user;
}

function findUserById(uuid, callback, context) {
    // This is a lookup function
    // uuid is the identifier being resolved
    // callback is a node style callback function to be invoked with the found object (as second arg) or an error (first arg)
    // context is an object detailing the execution context of the serializer now
    callback(null, fetchUserSomewhere(uuid));
}

// Create model schemas
createModelSchema(Message, {
    message: primitive(),
    author: reference(User, findUserById),
    comments: list(object(Message)),
});

createModelSchema(User, {
    uuid: identifier(),
    displayName: primitive(),
});

// can now deserialize and serialize!
const message = deserialize(Message, {
    message: 'Hello world',
    author: 17,
    comments: [
        {
            message: 'Welcome!',
            author: 23,
        },
    ],
});

const json = serialize(message);

console.dir(message, { colors: true, depth: 10 });
```

## Using decorators (optional)

With decorators (TypeScript or ESNext) building model schemas is even more trivial:

```javascript
import {
    createModelSchema,
    primitive,
    reference,
    list,
    object,
    identifier,
    serialize,
    deserialize,
    getDefaultModelSchema,
    serializable,
} from 'serializr';

class User {
    @serializable(identifier())
    uuid = Math.random();

    @serializable displayName = 'John Doe';
}

class Message {
    @serializable message = 'Test';

    @serializable(object(User))
    author = null;

    // Self referencing decorators work in Babel 5.x and Typescript. See below for more.
    @serializable(list(object(Message)))
    comments = [];
}

// You can now deserialize and serialize!
const message = deserialize(Message, {
    message: 'Hello world',
    author: { uuid: 1, displayName: 'Alice' },
    comments: [
        {
            message: 'Welcome!',
            author: { uuid: 1, displayName: 'Bob' },
        },
    ],
});

console.dir(message, { colors: true, depth: 10 });

// We can call serialize without the first argument here
//because the schema can be inferred from the decorated classes

const json = serialize(message);
```

**Decorator: Caveats**

Babel 6.x does not allow decorators to self-reference during their creation, so the above code would not work for the Message class. Instead write:

```javascript
class Message {
    @serializable message = 'Test';

    @serializable(object(User))
    author = null;

    comments = [];

    constructor() {
        getDefaultModelSchema(Message).props['comments'] = list(
            object(Message)
        );
    }
}
```

## Enabling decorators (optional)

**TypeScript**

Enable the compiler option `experimentalDecorators` in `tsconfig.json` or pass it as flag `--experimentalDecorators` to the compiler.

**Babel 7.x:**

Install support for decorators: `npm i --save-dev @babel/plugin-proposal-class-properties @babel/plugin-proposal-decorators`. And enable it in your `.babelrc` file:

```json
{
    "presets": ["@babel/preset-env"],
    "plugins": [
        ["@babel/plugin-proposal-decorators", { "legacy": true}],
        ["@babel/plugin-proposal-class-properties", { "loose": true}]
    ]
}
```

**Babel 6.x:**

Install support for decorators: `npm i --save-dev babel-plugin-transform-decorators-legacy`. And enable it in your `.babelrc` file:

```json
{
    "presets": ["es2015", "stage-1"],
    "plugins": ["transform-decorators-legacy"]
}
```

**Babel 5.x**

```json
 {
   "stage": 1
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
    factory: context => new Todo(),
    extends: ModelSchema,
    props: {
        modelfield: PropSchema,
    },
};
```

The `factory` tells how to construct new instances during deserialization.
The optional `extends` property denotes that this model schema inherits its props from another model schema.
The props section describes how individual model properties are to be (de)serialized. Their names match the model field names.
The combination `fieldname: true` is simply a shorthand for `fieldname: primitive()`

For convenience, model schemas can be stored on the constructor function of a class.
This allows you to pass in a class reference wherever a model schema is required.
See the examples below.

## PropSchema

PropSchemas contain the strategy on how individual fields should be serialized.
It denotes whether a field is a primitive, list, whether it needs to be aliased, refers to other model objects etc.
PropSchemas are composable. See the API section below for the details, but these are the built-in property schemas:

-   `primitive()`: Serialize a field as primitive value
-   `identifier()`: Serialize a field as primitive value, use it as identifier when serializing references (see `reference`)
-   `date()`: Serializes dates (as epoch number)
-   `alias(name, propSchema)`: Serializes a field under a different name
-   `list(propSchema)`: Serializes an array based collection
-   `map(propSchema)`: Serializes an Map or string key based collection
-   `mapAsArray(propSchema, keyPropertyName)`: Serializes a map to an array of elements
-   `object(modelSchema)`: Serializes an child model element
-   `reference(modelSchema, lookupFunction?)`: Serializes a reference to another model element
-   `custom(serializeFunction, deserializeFunction)`: Create your own property serializer by providing two functions, one that converts modelValue to jsonValue, and one that does the inverse
-   There is a special prop schema: `"*": true` that serializes all enumerable, non mentioned values as primitive

It is possible to define your own prop schemas. You can define your own propSchema by creating a function that returns an object with the following signature:

```typings
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

## AdditionalPropArgs

A PropSchema can be further parameterized using AdditionalPropArgs. Currently, they can be used to specify lifecycle functions. During deserialization they can be useful, e.g. in case you want to

-   react to errors in the deserialization on a value level and retry with corrected value,
-   remove invalid items e.g. in arrays or maps,
-   react to changes in field names, e.g. due to schema migration (i.e. only one-directional changes that cannot be dealt with by alias operators).

It is possible to define those functions by passing them as additional property arguments to the propSchema during its creation.

```javascript
const myHandler = {
  beforeDeserialize: function (callback, jsonValue, jsonParentValue, propNameOrIndex, context, propDef) {
     if (typeof jsonValue === 'string') {
       callback(null, jsonValue)
     } else if (typeof jsonValue === 'number') {
       callback(null, jsonValue.toString())
     } else {
       callback(new Error('something went wrong before deserialization'))
     }  
  },
  afterDeserialize: function (callback, error, newValue, jsonValue, jsonParentValue, propNameOrIndex, context,
                                                                  propDef, numRetry) {
     if (!error && newValue !== 'needs change') {
       callback(null, newValue)
     } else if (!error && newValue === 'needs change') {
       callback(new Error(), 'changed value')
     } else {
       callback(error)
     }
  }
}

class MyData {
  @serializable(primitive(myHandler)) mySimpleField
}
```

A more detailed example can be found in [test/typescript/ts.ts](test/typescript/ts.ts).

# API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

## Table of Contents

# Recipes and examples

## 1. Plain schema with plain objects

```javascript
const todoSchema = {
    factory: () => {},
    props: {
        task: primitive(),
        owner: reference('_userId', UserStore.findUserById), // attribute of the owner attribute of  a todo + lookup function
        subTasks: alias('children', list(object(todoSchema))),
    },
};

const todo = deserialize(
    todoSchema,
    { task: 'grab coffee', owner: 17, children: [] },
    (err, todo) => {
        console.log('finished loading todos');
    }
);

const todoJson = serialize(todoSchema, todo);
```

## 2. Create schema and store it on constructor

```javascript
function Todo(parentTodo) {
    this.parent = parentTodo; // available in subTasks
}

const todoSchema = {
    factory: context => new Todo(context.parent),
    props: {
        task: primitive(),
        owner: reference('_userId', UserStore.findUserById), // attribute of the owner attribute of  a todo + lookup function
        subTasks: alias('children', list(object(todoSchema))),
    },
};
setDefaultModelSchema(Todo, todoSchema);

const todo = deserialize(
    Todo, // just pass the constructor name, schema will be picked up
    { task: 'grab coffee', owner: 17, children: [] },
    (err, todos) => {
        console.log('finished loading todos');
    }
);

const todoJson = serialize(todo); // no need to pass schema explicitly
```

## 3. Create schema for simple argumentless constructors

```javascript
function Todo() {}

// creates a default factory, () => new Todo(), stores the schema as default model schema
createModelSchema(Todo, {
    task: primitive(),
});

const todo = deserialize(
    Todo, // just pass the constructor name, schema will be picked up
    { task: 'grab coffee', owner: 17, children: [] },
    (err, todos) => {
        console.log('finished loading todos');
    }
);

const todoJson = serialize(todo); // no need to pass schema explicitly
```

## 4. Create schema for simple argumentless constructors using decorators

```javascript
class Todo {
    @serializable(primitive())
    task = 'Grab coffee';

    @serializable(reference('_userId', UserStore.findUserById))
    owner = null;

    @serializable(alias('children', list(object(todoSchema))))
    subTasks = [];
}

// note that (de)serialize also accepts lists
const todos = deserialize(
    Todo,
    [
        {
            task: 'grab coffee',
            owner: 17,
            children: [],
        },
    ],
    (err, todos) => {
        console.log('finished loading todos');
    }
);

const todoJson = serialize(todos);
```

## 5. use custom factory methods to reuse model object instances

```javascript
const someTodoStoreById = {};

getDefaultModelSchema(Todo).factory = context => {
    const json = context.json;
    if (someTodoStoreById[json.id]) return someTodoStoreById[json.id]; // reuse instance
    return (someTodoStoreById[json.id] = new Todo());
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
    return new User(context.args.someStore);
});

// don't want singletons!
const someStore = new SomeStore();
// provide somestore through context of the deserialization process
const user = deserialize(
    User,
    someJson,
    (err, user) => {
        console.log('done');
    },
    {
        someStore: someStore,
    }
);
```

## 7. Putting it together: MobX store with plain objects, classes and internal references

```javascript
// models.js:
import { observable, computed } from 'mobx';
import { serializable, identifier } from 'serializr';

function randomId() {
    return Math.floor(Math.random() * 100000);
}

export class Box {
    @serializable(identifier()) id = randomId();
    @serializable @observable x = 0;
    @serializable @observable y = 0;
    @serializable @observable location = 0;

    constructor(location, x, y) {
        this.location = location;
        this.x = x;
        this.y = y;
    }

    @serializable @computed get area() {
        return this.x * this.y;
    }
}

export class Arrow {
    @serializable(identifier()) id = randomId();
    @serializable(reference(Box)) from;
    @serializable(reference(Box)) to;
}

// store.js:
import { observable, transaction } from 'mobx';
import {
    createSimpleSchema,
    identifier,
    list,
    serialize,
    deserialize,
    update,
} from 'serializr';
import { Box, Arrow } from './models';

// The store that holds our domain: boxes and arrows
const store = observable({
    boxes: [],
    arrows: [],
    selection: null,
});

// Model of the store itself
const storeModel = createSimpleSchema({
    boxes: list(object(Box)),
    arrows: list(object(Arrow)),
    selection: reference(Box),
});

// Example Data
// You can push data in as a class
store.boxes.push(new Box('Rotterdam', 100, 100), new Box('Vienna', 650, 300));

// Or it can be an raw javascript object with the right properties
store.arrows.push({
    id: randomId(),
    from: store.boxes[0],
    to: store.boxes[1],
});

// (de) serialize functions
function serializeState(store) {
    return serialize(storeModel, store);
}

function deserializeState(store, json) {
    transaction(() => {
        update(storeModel, store, json);
    });
}

// Print ... out for debugging
console.dir(serializeState(store), { depth: 10, colors: true });
```

* * *

# Future ideas

-   [ ] If MobX, optimize by leveraging createTransformer and transactions
-   [ ] Support async serialization (future)
-   [ ] Support ImmutableJS out of the box
-   [ ] Make `"*": true` respect extends clauses

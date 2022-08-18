# Serializr

_Serialize and deserialize complex object graphs to JSON_

[![Build Status](https://travis-ci.org/mobxjs/serializr.svg?branch=master)](https://travis-ci.org/mobxjs/serializr)
[![Coverage Status](https://coveralls.io/repos/github/mobxjs/serializr/badge.svg?branch=master)](https://coveralls.io/github/mobxjs/serializr?branch=master)
[![Join the chat at https://gitter.im/mobxjs/serializr](https://badges.gitter.im/mobxjs/serializr.svg)](https://gitter.im/mobxjs/serializr?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![NPM](https://img.shields.io/npm/v/serializr)](https://www.npmjs.com/package/serializr)

_Serializr is feature complete, and easily extendable. Since there are no active maintainers the project is frozen feature wise. Bug reports and well designed pull requests are welcome and will be addressed._

Want to maintain a small open source project or having great ideas for this project? We are looking for maintainers, so [apply](https://github.com/mobxjs/serializr/issues/46)!

# Api Documentation

The auto-generated documentation for the APIs is published using gitpages at:
https://serializr.github.io/serializr/

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
} from "serializr";

// Example model classes
class User {
    uuid = Math.floor(Math.random() * 10000);
    displayName = "John Doe";
}

class Message {
    message = "Test";
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
    message: "Hello world",
    author: 17,
    comments: [
        {
            message: "Welcome!",
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

    @serializable(object(User))
    author = null;

    // Self referencing decorators work in Babel 5.x and Typescript. See below for more.
    @serializable(list(object(Message)))
    comments = [];
}

// You can now deserialize and serialize!
const message = deserialize(Message, {
    message: "Hello world",
    author: { uuid: 1, displayName: "Alice" },
    comments: [
        {
            message: "Welcome!",
            author: { uuid: 1, displayName: "Bob" },
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
    @serializable message = "Test";

    @serializable(object(User))
    author = null;

    comments = [];

    constructor() {
        getDefaultModelSchema(Message).props["comments"] = list(object(Message));
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
        ["@babel/plugin-proposal-decorators", { "legacy": true }],
        ["@babel/plugin-proposal-class-properties", { "loose": true }]
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
    factory: (context) => new Todo(),
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

```typescript
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
3.  second argument of the `deserializer` of a custom propSchema

When deserializing a model element / property, the following fields are available on the context object:

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
    beforeDeserialize: function (
        callback,
        jsonValue,
        jsonParentValue,
        propNameOrIndex,
        context,
        propDef
    ) {
        if (typeof jsonValue === "string") {
            callback(null, jsonValue);
        } else if (typeof jsonValue === "number") {
            callback(null, jsonValue.toString());
        } else {
            callback(new Error("something went wrong before deserialization"));
        }
    },
    afterDeserialize: function (
        callback,
        error,
        newValue,
        jsonValue,
        jsonParentValue,
        propNameOrIndex,
        context,
        propDef
    ) {
        if (!error && newValue !== "needs change") {
            callback(null, newValue);
        } else if (!error && newValue === "needs change") {
            callback(new Error(), "changed value");
        } else {
            callback(error);
        }
    },
};

class MyData {
    @serializable(primitive(myHandler))
    mySimpleField;
}
```

A more detailed example can be found in [test/typescript/ts.ts](test/typescript/ts.ts).

# Inheritance

When defining schemas or serializing Inheritance is automatically handled. When deserializing, to
deserialize into the right type based on a discriminator use the `@subSchema` decorator.

```ts
class Todo {
    @serializable
    id: string;

    @serializable
    text: string;
}

@subSchema("picture")
class PictureTodo extends Todo {
    @serializable
    pictureUrl: string;
}

const ser = serialize(
    Object.assign(new PictureTodo(), {
        id: "pic1",
        text: "Lorem Ipsum",
        pictureUrl: "foobar",
    })
);
// ser now holds an object like the following result
// {
//    id: "pic1",
//    _type: "picture"
//    text: "Lorem Ipsum",
//    pictureUrl:"foobar",
// }
const deser = deserialize(Todo, ser);
console.log(deser instanceof PictureTodo); // true
```

See https://serializr.github.io/serializr/docs/functions/subSchema.html for more information.

# Future ideas

-   [ ] If MobX, optimize by leveraging createTransformer and transactions
-   [ ] Support async serialization (future)
-   [ ] Support ImmutableJS out of the box
-   [ ] Make `"*": true` respect extends clauses

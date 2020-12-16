# Serializr

_Serialize and deserialize complex object graphs to JSON_

[![Build Status](https://travis-ci.org/mobxjs/serializr.svg?branch=master)](https://travis-ci.org/mobxjs/serializr)
[![Coverage Status](https://coveralls.io/repos/github/mobxjs/serializr/badge.svg?branch=master)](https://coveralls.io/github/mobxjs/serializr?branch=master)
[![Join the chat at https://gitter.im/mobxjs/serializr](https://badges.gitter.im/mobxjs/serializr.svg)](https://gitter.im/mobxjs/serializr?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![NPM](https://img.shields.io/npm/v/serializr)](https://www.npmjs.com/package/serializr)

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
    deserialize
} from "serializr"

// Example model classes
class User {
    uuid = Math.floor(Math.random() * 10000)
    displayName = "John Doe"
}

class Message {
    message = "Test"
    author = null
    comments = []
}

function fetchUserSomewhere(uuid) {
    // Lets pretend to actually fetch a user; but not.
    // In a real app this might be a database query
    const user = new User()
    user.uuid = uuid
    user.displayName = `John Doe ${uuid}`
    return user
}

function findUserById(uuid, callback, context) {
    // This is a lookup function
    // uuid is the identifier being resolved
    // callback is a node style callback function to be invoked with the found object (as second arg) or an error (first arg)
    // context is an object detailing the execution context of the serializer now
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
    comments: [
        {
            message: "Welcome!",
            author: 23
        }
    ]
})

const json = serialize(message)

console.dir(message, { colors: true, depth: 10 })
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
    serializable
} from "serializr"

class User {
    @serializable(identifier())
    uuid = Math.random()

    @serializable
    displayName = "John Doe"
}

class Message {
    @serializable
    message = "Test"

    @serializable(object(User))
    author = null

    // Self referencing decorators work in Babel 5.x and Typescript. See below for more.
    @serializable(list(object(Message)))
    comments = []
}

// You can now deserialize and serialize!
const message = deserialize(Message, {
    message: "Hello world",
    author: { uuid: 1, displayName: "Alice" },
    comments: [
        {
            message: "Welcome!",
            author: { uuid: 1, displayName: "Bob" }
        }
    ]
})

console.dir(message, { colors: true, depth: 10 })

// We can call serialize without the first argument here
//because the schema can be inferred from the decorated classes

const json = serialize(message)
```

**Decorator: Caveats**

Babel 6.x does not allow decorators to self-reference during their creation, so the above code would not work for the Message class. Instead write:

```javascript
class Message {
    @serializable message = "Test"

    @serializable(object(User))
    author = null

    comments = []

    constructor() {
        getDefaultModelSchema(Message).props["comments"] = list(object(Message))
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
    factory: context => new Todo(),
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
    beforeDeserialize: function(
        callback,
        jsonValue,
        jsonParentValue,
        propNameOrIndex,
        context,
        propDef
    ) {
        if (typeof jsonValue === "string") {
            callback(null, jsonValue)
        } else if (typeof jsonValue === "number") {
            callback(null, jsonValue.toString())
        } else {
            callback(new Error("something went wrong before deserialization"))
        }
    },
    afterDeserialize: function(
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
            callback(null, newValue)
        } else if (!error && newValue === "needs change") {
            callback(new Error(), "changed value")
        } else {
            callback(error)
        }
    }
}

class MyData {
    @serializable(primitive(myHandler))
    mySimpleField
}
```

A more detailed example can be found in [test/typescript/ts.ts](test/typescript/ts.ts).

<!-- START API AUTOGEN -->
<!-- THIS SECTION WAS AUTOGENERATED BY gendoc.tsx! DO NOT EDIT! -->
API
---

### _interface_ `ModelSchema`&lt;T&gt;<sub><a href="src/api/types.ts#L65">src</a></sub>

#### property `targetClass`?: [Clazz](#type-clazzt----src)&lt;any&gt;

#### property `factory`: (_context_: [Context](typedoc-id-undefined)) => T

#### property `props`: [Props](#type-propst----src)&lt;T&gt;

#### property `extends`?: [ModelSchema](#interface-modelschematsrc)&lt;any&gt;

### _interface_ `PropSchema`<sub><a href="src/api/types.ts#L22">src</a></sub>

#### property `serializer`: [PropSerializer](#type-propserializer--sourcepropertyvalue-any-key-string--number--symbol-sourceobject-any--any--typeof-skip-src)

#### property `deserializer`: [PropDeserializer](#type-propdeserializer--jsonvalue-any-callback-err-any-targetpropertyvalue-any--typeof-skip--void-context-context-currentpropertyvalue-any--void-src)

#### property `beforeDeserialize`?: [BeforeDeserializeFunc](#type-beforedeserializefunc--callback-err-any-value-any--void-jsonvalue-any-jsonparentvalue-any-propnameorindex-string--number-context-context-propdef-propschema--void-src)

#### property `afterDeserialize`?: [AfterDeserializeFunc](#type-afterdeserializefunc--callback-err-any-value-any--void-err-any-newvalue-any-jsonvalue-any-jsonparentvalue-any-propnameorindex-string--number--symbol-context-context-propdef-propschema--void-src)

#### property `pattern`?: undefined | { test: (_propName_: string) => boolean }

Filter properties to which this schema applies. Used with `ModelSchema.props["*"]`.

#### property `jsonname`?: undefined | string

#### property `identifier`?: undefined | true

#### property `paramNumber`?: undefined | number

### _type_ `AdditionalPropArgs` = [Pick](typedoc-id-undefined)&lt;[PropSchema](#interface-propschemasrc), `"beforeDeserialize"` | `"afterDeserialize"` | `"pattern"`&gt; <sub><a href="src/api/types.ts#L7">src</a></sub>

Can be passed to function which create `PropSchema`s to set additional properties.

### _type_ `AfterDeserializeFunc` = (_callback_: (_err_: any, _value_: any) => void, _err_: any, _newValue_: any, _jsonValue_: any, _jsonParentValue_: any, _propNameOrIndex_: string | number | symbol, _context_: [Context](typedoc-id-undefined), _propDef_: [PropSchema](#interface-propschemasrc)) => void <sub><a href="src/api/types.ts#L36">src</a></sub>

### _type_ `BeforeDeserializeFunc` = (_callback_: (_err_: any, _value_: any) => void, _jsonValue_: any, _jsonParentValue_: any, _propNameOrIndex_: string | number, _context_: [Context](typedoc-id-undefined), _propDef_: [PropSchema](#interface-propschemasrc)) => void <sub><a href="src/api/types.ts#L47">src</a></sub>

### _type_ `Clazz`&lt;T&gt; = { } <sub><a href="src/api/types.ts#L72">src</a></sub>

### _type_ `ClazzOrModelSchema`&lt;T&gt; = [ModelSchema](#interface-modelschematsrc)&lt;T&gt; | [Clazz](#type-clazzt----src)&lt;T&gt; <sub><a href="src/api/types.ts#L73">src</a></sub>

### _type_ `PropDef` = [PropSchema](#interface-propschemasrc) | boolean | undefined <sub><a href="src/api/types.ts#L63">src</a></sub>

### _type_ `PropDeserializer` = (_jsonValue_: any, _callback_: (_err_?: any, _targetPropertyValue_?: any | typeof [SKIP](typedoc-id-undefined)) => void, _context_: [Context](typedoc-id-undefined), _currentPropertyValue_?: any) => void <sub><a href="src/api/types.ts#L16">src</a></sub>

### _type_ `PropSerializer` = (_sourcePropertyValue_: any, _key_: string | number | symbol, _sourceObject_: any) => any | typeof [SKIP](typedoc-id-undefined) <sub><a href="src/api/types.ts#L11">src</a></sub>

### _type_ `Props`&lt;T&gt; = { } <sub><a href="src/api/types.ts#L60">src</a></sub>

true is shorthand for `primitive().` false/undefined will be ignored

### _type_ `RefLookupFunction` = (_id_: string, _callback_: (_err_: any, _result_: any) => void, _context_: [Context](typedoc-id-undefined)) => void <sub><a href="src/api/types.ts#L75">src</a></sub>

### _type_ `RegisterFunction` = (_id_: any, _object_: any, _context_: [Context](typedoc-id-undefined)) => void <sub><a href="src/api/types.ts#L80">src</a></sub>

### _const_ `SKIP`<sub><a href="src/constants.ts#L36">src</a></sub>

If you want to skip serialization or deserialization, you can use SKIP.

```ts
const schema = createSimpleSchema({
    a: custom(
        () => SKIP,
        v => v,
    ),
})
serialize(s, { a: 4 }) // {}
deserialize(s, { "a": 4 }) // { a: 4 }
```

```ts
// Skipping deserialization with computed mobx property.

class TodoState {
    // Todo.category is @serializable(reference(...))
    @serializable(list(object(Todo)))
    @observable
    todos: Todo[]

    // we want to serialize the categories, so that the references in
    // this.todos can be resolved, but we don't want to set this property
    @serializable(
        list(object(TodoCategory),
        { afterDeserialize: callback => callback(undefined, SKIP) }))
    @computed
    get categories() {
        return this.todos.map(todo => todo.category)
    }
}
```

### _function_ `alias`(_name_: string, _propSchema_?: [PropDef](#type-propdef--propschema--boolean--undefined-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/alias.ts#L24">src</a></sub>

Alias indicates that this model property should be named differently in the generated json. Alias should be the outermost propschema.

```ts
createModelSchema(Todo, {
    title: alias('task', primitive()),
})

serialize(new Todo('test')) // { "task": "test" }
```

### _function_ `cancelDeserialize`&lt;T&gt;(_instance_: T): void <sub><a href="src/core/cancelDeserialize.ts#L11">src</a></sub>

Cancels an asynchronous deserialization or update operation for the specified target object.

### _function_ `createModelSchema`&lt;T&gt;(_clazz_: [Clazz](#type-clazzt----src)&lt;T&gt;, _props_: [Props](#type-propst----src), _factory_?: undefined | ((_context_: [Context](typedoc-id-undefined)) => T)): [ModelSchema](#interface-modelschematsrc)&lt;T&gt; <sub><a href="src/api/createModelSchema.ts#L31">src</a></sub>

Creates a model schema that (de)serializes an object created by a constructor function (class). The created model schema is associated by the targeted type as default model schema, see setDefaultModelSchema. Its factory method is `() => new clazz()` (unless overriden, see third arg).

```ts
function Todo(title, done) {
    this.title = title
    this.done = done
}

createModelSchema(Todo, {
    title: true,
    done: true,
})

const json = serialize(new Todo('Test', false))
const todo = deserialize(Todo, json)
```

### _function_ `createSimpleSchema`&lt;T&gt;(_props_: [Props](#type-propst----src)): [ModelSchema](#interface-modelschematsrc)&lt;T&gt; <sub><a href="src/api/createSimpleSchema.ts#L19">src</a></sub>

Creates a model schema that (de)serializes from / to plain javascript objects. Its factory method is: `() => ({})`

```ts
const todoSchema = createSimpleSchema({
    title: true,
    done: true,
})

const json = serialize(todoSchema, { title: 'Test', done: false })
const todo = deserialize(todoSchema, json)
```

### _function_ `custom`(_serializer_: [PropSerializer](#type-propserializer--sourcepropertyvalue-any-key-string--number--symbol-sourceobject-any--any--typeof-skip-src), _deserializer_: (_jsonValue_: any, _context_: [Context](typedoc-id-undefined), _oldValue_: any, _callback_: (_err_: any, _result_: any | typeof [SKIP](typedoc-id-undefined)) => void) => void, _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/custom.ts#L64">src</a></sub>

Can be used to create simple custom propSchema. Multiple things can be done inside of a custom propSchema, like deserializing and serializing other (polymorphic) objects, skipping the serialization of something or checking the context of the obj being (de)serialized.

The `custom` function takes two parameters, the `serializer` function and the `deserializer` function.

The `serializer` function has the signature: `(value, key, obj) => void`

When serializing the object `{a: 1}` the `serializer` function will be called with `serializer(1, 'a', {a: 1})`.

The `deserializer` function has the following signature for synchronous processing `(value, context, oldValue) => void`

For asynchronous processing the function expects the following signature `(value, context, oldValue, callback) => void`

When deserializing the object `{b: 2}` the `deserializer` function will be called with `deserializer(2, contextObj)` ([contextObj reference](https://github.com/mobxjs/serializr#deserialization-context)).

```ts
const schemaDefault = createSimpleSchema({
    a: custom(
        v => v + 2,
        v => v - 2
    )
})
serialize(schemaDefault, { a: 4 }) // { "a": 6 }
deserialize(schemaDefault, { "a": 6 }) // { a: 4 }

const schemaWithAsyncProps = createSimpleSchema({
    a: custom(
        v => v + 2,
        (v, context, oldValue, callback) =>
            somePromise(v, context, oldValue)
                .then(result => callback(null, result - 2))
                .catch(err => callback(err))
    )
})
serialize(schemaWithAsyncProps, { a: 4 }) // { "a": 6 }
deserialize(schemaWithAsyncProps, { "a": 6 }, (err, res) => {
  res // { a: 4 }
}
```

### _function_ `custom`(_serializer_: [PropSerializer](#type-propserializer--sourcepropertyvalue-any-key-string--number--symbol-sourceobject-any--any--typeof-skip-src), _deserializer_: (_jsonValue_: any, _context_: [Context](typedoc-id-undefined), _oldValue_: any) => any | typeof [SKIP](typedoc-id-undefined), _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/custom.ts#L74">src</a></sub>

### _function_ `date`(_additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/date.ts#L9">src</a></sub>

Similar to primitive, serializes instances of Date objects

### _function_ `deserialize`&lt;T&gt;(_modelschema_: [ClazzOrModelSchema](#type-clazzormodelschemat--modelschemat--clazzt-src)&lt;T&gt;, _jsonArray_: any\[\], _callback_?: undefined | ((_err_: any, _result_: T\[\]) => void), _customArgs_?: any): T\[\] <sub><a href="src/core/deserialize.ts#L76">src</a></sub>

Deserializes a json structure into an object graph.

This process might be asynchronous (for example if there are references with an asynchronous lookup function). The function returns an object (or array of objects), but the returned object might be incomplete until the callback has fired as well (which might happen immediately)

### _function_ `deserialize`&lt;T&gt;(_modelschema_: [ClazzOrModelSchema](#type-clazzormodelschemat--modelschemat--clazzt-src)&lt;T&gt;, _json_: any, _callback_?: undefined | ((_err_: any, _result_: T) => void), _customArgs_?: any): T <sub><a href="src/core/deserialize.ts#L82">src</a></sub>

### _function_ `getDefaultModelSchema`&lt;T&gt;(_thing_: any): [ModelSchema](#interface-modelschematsrc)&lt;T&gt; | undefined <sub><a href="src/api/getDefaultModelSchema.ts#L8">src</a></sub>

Returns the standard model schema associated with a class / constructor function

### _function_ `identifier`(_arg1_?: [RegisterFunction](#type-registerfunction--id-any-object-any-context-context--void-src) | [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src), _arg2_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/identifier.ts#L48">src</a></sub>

### _function_ `list`(_propSchema_: [PropSchema](#interface-propschemasrc), _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/list.ts#L42">src</a></sub>

List indicates that this property contains a list of things. Accepts a sub model schema to serialize the contents

```ts
class SubTask {}
class Task {}
class Todo {}

createModelSchema(SubTask, {
    title: true,
})
createModelSchema(Todo, {
    title: true,
    subTask: list(object(SubTask)),
})

const todo = deserialize(Todo, {
    title: 'Task',
    subTask: [
        {
            title: 'Sub task 1',
        },
    ],
})
```

### _function_ `map`(_propSchema_: [PropSchema](#interface-propschemasrc), _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/map.ts#L19">src</a></sub>

Similar to list, but map represents a string keyed dynamic collection. This can be both plain objects (default) or ES6 Map like structures. This will be inferred from the initial value of the targetted attribute.

### _function_ `mapAsArray`(_propSchema_: [PropSchema](#interface-propschemasrc), _keyPropertyName_: string, _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/mapAsArray.ts#L18">src</a></sub>

Similar to map, mapAsArray can be used to serialize a map-like collection where the key is contained in the 'value object'. Example: consider Map<id: number, customer: Customer> where the Customer object has the id stored on itself. mapAsArray stores all values from the map into an array which is serialized. Deserialization returns a ES6 Map or plain object object where the `keyPropertyName` of each object is used for keys. For ES6 maps this has the benefit of being allowed to have non-string keys in the map. The serialized json also may be slightly more compact.

### _function_ `object`(_modelSchema_: [ClazzOrModelSchema](#type-clazzormodelschemat--modelschemat--clazzt-src)&lt;any&gt;, _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/object.ts#L35">src</a></sub>

`object` indicates that this property contains an object that needs to be (de)serialized using its own model schema.

N.B. mind issues with circular dependencies when importing model schema's from other files! The module resolve algorithm might expose classes before `createModelSchema` is executed for the target class.

```ts
class SubTask {}
class Todo {}

createModelSchema(SubTask, {
    title: true,
})
createModelSchema(Todo, {
    title: true,
    subTask: object(SubTask),
})

const todo = deserialize(Todo, {
    title: 'Task',
    subTask: {
        title: 'Sub task',
    },
})
```

### _function_ `optional`(_propSchema_?: [PropSchema](#interface-propschemasrc) | boolean): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/optional.ts#L23">src</a></sub>

Optional indicates that this model property shouldn't be serialized if it isn't present.

Note that if we use `optional` together with another prop schema such as `custom`, the prop schema for `custom` will be applied first and the result of that serialization will be used to feed into `optional`. As such, it might be better to just use `custom` with `SKIP` to achieve the same goal.

```ts
createModelSchema(Todo, {
    title: optional(primitive()),
    user: optional(custom(value => value?.name, () => SKIP))
})

serialize(new Todo()) // {}
```

### _function_ `primitive`(_additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/primitive.ts#L16">src</a></sub>

Indicates that this field contains a primitive value (or Date) which should be serialized literally to json.

```ts
createModelSchema(Todo, {
    title: primitive(),
})

serialize(new Todo('test')) // { "title": "test" }
```

### _function_ `raw`(_additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/raw.ts#L18">src</a></sub>

Indicates that this field is only need to putted in the serialized json or deserialized instance, without any transformations. Stay with its original value

```ts
createModelSchema(Model, {
    rawData: raw(),
})

serialize(new Model({ rawData: { a: 1, b: [], c: {} } } }))
// { "rawData": { a: 1, b: [], c: {} } } }
```

### _function_ `reference`(_modelSchema_: [ClazzOrModelSchema](#type-clazzormodelschemat--modelschemat--clazzt-src)&lt;any&gt;, _lookupFn_?: [RefLookupFunction](#type-reflookupfunction--id-string-callback-err-any-result-any--void-context-context--void-src), _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/reference.ts#L82">src</a></sub>

`reference` can be used to (de)serialize references that point to other models.

The first parameter should be either a ModelSchema that has an `identifier()` property (see identifier) or a string that represents which attribute in the target object represents the identifier of the object.

The second parameter is a lookup function that is invoked during deserialization to resolve an identifier to an object. Its signature should be as follows:

`lookupFunction(identifier, callback, context)` where: 1. `identifier` is the identifier being resolved 2. `callback` is a node style calblack function to be invoked with the found object (as second arg) or an error (first arg) 3. `context` see context.

The lookupFunction is optional. If it is not provided, it will try to find an object of the expected type and required identifier within the same JSON document

N.B. mind issues with circular dependencies when importing model schemas from other files! The module resolve algorithm might expose classes before `createModelSchema` is executed for the target class.

```ts
class User {}
class Post {}

createModelSchema(User, {
    uuid: identifier(),
    displayname: primitive(),
})

createModelSchema(Post, {
    author: reference(User, findUserById),
    message: primitive(),
})

function findUserById(uuid, callback) {
    fetch('http://host/user/' + uuid)
        .then(userData => {
            deserialize(User, userData, callback)
        })
        .catch(callback)
}

deserialize(
    Post,
    {
        message: 'Hello World',
        author: 234,
    },
    (err, post) => {
        console.log(post)
    }
)
```

### _function_ `reference`(_modelSchema_: [ClazzOrModelSchema](#type-clazzormodelschemat--modelschemat--clazzt-src)&lt;any&gt;, _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/reference.ts#L87">src</a></sub>

### _function_ `reference`(_identifierAttr_: string, _lookupFn_: [RefLookupFunction](#type-reflookupfunction--id-string-callback-err-any-result-any--void-context-context--void-src), _additionalArgs_?: [AdditionalPropArgs](#type-additionalpropargs--pickpropschema-beforedeserialize--afterdeserialize--pattern-src)): [PropSchema](#interface-propschemasrc) <sub><a href="src/types/reference.ts#L91">src</a></sub>

### _function_ `serializable`(_propSchema_: [PropDef](#type-propdef--propschema--boolean--undefined-src)): (_target_: any, _key_: string, _baseDescriptor_?: [PropertyDescriptor](typedoc-id-undefined)) => void <sub><a href="src/api/serializable.ts#L99">src</a></sub>

Decorator that defines a new property mapping on the default model schema for the class it is used in.

When using typescript, the decorator can also be used on fields declared as constructor arguments (using the `private` / `protected` / `public` keywords). The default factory will then invoke the constructor with the correct arguments as well.

```ts
class Todo {
    @serializable(primitive())
    title // shorthand for primitves

    @serializable
    done

    constructor(title, done) {
        this.title = title
        this.done = done
    }
}

const json = serialize(new Todo('Test', false))
const todo = deserialize(Todo, json)
```

### _function_ `serializable`(_target_: any, _key_: string, _baseDescriptor_?: [PropertyDescriptor](typedoc-id-undefined)): void <sub><a href="src/api/serializable.ts#L102">src</a></sub>

### _function_ `serialize`&lt;T&gt;(_modelSchema_: [ClazzOrModelSchema](#type-clazzormodelschemat--modelschemat--clazzt-src)&lt;T&gt;, _instance_: T): any <sub><a href="src/core/serialize.ts#L15">src</a></sub>

Serializes an object (graph) into json using the provided model schema. The model schema can be omitted if the object type has a default model schema associated with it. If a list of objects is provided, they should have an uniform type.

### _function_ `serialize`&lt;T&gt;(_instance_: T): any <sub><a href="src/core/serialize.ts#L16">src</a></sub>

### _function_ `serializeAll`&lt;T&gt;(_clazz_: [Clazz](#type-clazzt----src)&lt;T&gt;): [Clazz](#type-clazzt----src)&lt;T&gt; <sub><a href="src/core/serializeAll.ts#L43">src</a></sub>

The `serializeAll` decorator can used on a class to signal that all primitive properties, or complex properties with a name matching a `pattern`, should be serialized automatically.

```ts
@serializeAll
class Store {
    a = 3
    b
}

const store = new Store()
store.c = 5
store.d = {}
serialize(store) // { "c": 5 }
```

```ts
class DataType {
    @serializable
    x
    @serializable
    y
}

@serializeAll(/^[a-z]$/, DataType)
class ComplexStore {
}

const store = new ComplexStore()
store.a = {x: 1, y: 2}
store.b = {}
store.somethingElse = 5
serialize(store) // { a: {x: 1, y: 2}, b: { x: undefined, y: undefined } }
```

### _function_ `serializeAll`(_pattern_: [RegExp](typedoc-id-undefined), _propertyType_: [PropDef](#type-propdef--propschema--boolean--undefined-src) | [Clazz](#type-clazzt----src)&lt;any&gt;): (_clazz_: [Clazz](#type-clazzt----src)&lt;any&gt;) => [Clazz](#type-clazzt----src)&lt;any&gt; <sub><a href="src/core/serializeAll.ts#L44">src</a></sub>

### _function_ `setDefaultModelSchema`&lt;T&gt;(_clazz_: [Clazz](#type-clazzt----src)&lt;T&gt;, _modelSchema_: [ModelSchema](#interface-modelschematsrc)&lt;T&gt;): [ModelSchema](#interface-modelschematsrc)&lt;T&gt; <sub><a href="src/api/setDefaultModelSchema.ts#L16">src</a></sub>

Sets the default model schema for class / constructor function. Everywhere where a model schema is required as argument, this class / constructor function can be passed in as well (for example when using `object` or `ref`.

When passing an instance of this class to `serialize`, it is not required to pass the model schema as first argument anymore, because the default schema will be inferred from the instance type.

### _function_ `update`&lt;T&gt;(_modelschema_: [ClazzOrModelSchema](#type-clazzormodelschemat--modelschemat--clazzt-src)&lt;T&gt;, _instance_: T, _json_: any, _callback_?: undefined | ((_err_: any, _result_: T) => void), _customArgs_?: any): void <sub><a href="src/core/update.ts#L23">src</a></sub>

Similar to deserialize, but updates an existing object instance. Properties will always updated entirely, but properties not present in the json will be kept as is. Further this method behaves similar to deserialize.

### _function_ `update`&lt;T&gt;(_instance_: T, _json_: any, _callback_?: undefined | ((_err_: any, _result_: T) => void), _customArgs_?: any): void <sub><a href="src/core/update.ts#L30">src</a></sub><!-- END API AUTOGEN -->

# Recipes and examples

## 1. Plain schema with plain objects

```javascript
const todoSchema = {
    factory: () => {},
    props: {
        task: primitive(),
        owner: reference("_userId", UserStore.findUserById), // attribute of the owner attribute of  a todo + lookup function
        subTasks: alias("children", list(object(todoSchema)))
    }
}

const todo = deserialize(
    todoSchema,
    { task: "grab coffee", owner: 17, children: [] },
    (err, todo) => {
        console.log("finished loading todos")
    }
)

const todoJson = serialize(todoSchema, todo)
```

## 2. Create schema and store it on constructor

```javascript
function Todo(parentTodo) {
    this.parent = parentTodo // available in subTasks
}

const todoSchema = {
    factory: context => new Todo(context.parent),
    props: {
        task: primitive(),
        owner: reference("_userId", UserStore.findUserById), // attribute of the owner attribute of  a todo + lookup function
        subTasks: alias("children", list(object(todoSchema)))
    }
}
setDefaultModelSchema(Todo, todoSchema)

const todo = deserialize(
    Todo, // just pass the constructor name, schema will be picked up
    { task: "grab coffee", owner: 17, children: [] },
    (err, todos) => {
        console.log("finished loading todos")
    }
)

const todoJson = serialize(todo) // no need to pass schema explicitly
```

## 3. Create schema for simple argumentless constructors

```javascript
function Todo() {}

// creates a default factory, () => new Todo(), stores the schema as default model schema
createModelSchema(Todo, {
    task: primitive()
})

const todo = deserialize(
    Todo, // just pass the constructor name, schema will be picked up
    { task: "grab coffee", owner: 17, children: [] },
    (err, todos) => console.log("finished loading todos")
)

const todoJson = serialize(todo) // no need to pass schema explicitly
```

## 4. Create schema for simple argumentless constructors using decorators

```javascript
class Todo {
    @serializable(primitive())
    task = "Grab coffee"

    @serializable(reference("_userId", UserStore.findUserById))
    owner = null

    @serializable(alias("children", list(object(todoSchema))))
    subTasks = []
}

// note that (de)serialize also accepts lists
const todos = deserialize(
    Todo,
    [
        {
            task: "grab coffee",
            owner: 17,
            children: []
        }
    ],
    (err, todos) => console.log("finished loading todos")
)

const todoJson = serialize(todos)
```

## 5. use custom factory methods to reuse model object instances

```javascript
const someTodoStoreById = {}

getDefaultModelSchema(Todo).factory = context => {
    const json = context.json
    if (someTodoStoreById[json.id]) return someTodoStoreById[json.id] // reuse instance
    return (someTodoStoreById[json.id] = new Todo())
}
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
const user = deserialize(User, someJson, (err, user) => console.log("done"), {
    someStore: someStore
})
```

## 7. Putting it together: MobX store with plain objects, classes and internal references

```javascript
// models.js:
import { observable, computed } from "mobx"
import { serializable, identifier } from "serializr"

function randomId() {
    return Math.floor(Math.random() * 100000)
}

export class Box {
    @serializable(identifier())
    id = randomId()

    @serializable
    @observable
    x = 0

    @serializable
    @observable
    y = 0

    @serializable
    @observable
    location = 0

    constructor(location, x, y) {
        this.location = location
        this.x = x
        this.y = y
    }

    @serializable
    @computed
    get area() {
        return this.x * this.y
    }
}

export class Arrow {
    @serializable(identifier())
    id = randomId()

    @serializable(reference(Box))
    from

    @serializable(reference(Box))
    to
}

// store.js:
import { observable, transaction } from "mobx"
import { createSimpleSchema, identifier, list, serialize, deserialize, update } from "serializr"
import { Box, Arrow } from "./models"

// The store that holds our domain: boxes and arrows
const store = observable({
    boxes: [],
    arrows: [],
    selection: null
})

// Model of the store itself
const storeModel = createSimpleSchema({
    boxes: list(object(Box)),
    arrows: list(object(Arrow)),
    selection: reference(Box)
})

// Example Data
// You can push data in as a class
store.boxes.push(new Box("Rotterdam", 100, 100), new Box("Vienna", 650, 300))

// Or it can be an raw javascript object with the right properties
store.arrows.push({
    id: randomId(),
    from: store.boxes[0],
    to: store.boxes[1]
})

// (de) serialize functions
function serializeState(store) {
    return serialize(storeModel, store)
}

function deserializeState(store, json) {
    transaction(() => {
        update(storeModel, store, json)
    })
}

// Print ... out for debugging
console.dir(serializeState(store), { depth: 10, colors: true })
```

---

# Future ideas

-   [ ] If MobX, optimize by leveraging createTransformer and transactions
-   [ ] Support async serialization (future)
-   [ ] Support ImmutableJS out of the box
-   [ ] Make `"*": true` respect extends clauses

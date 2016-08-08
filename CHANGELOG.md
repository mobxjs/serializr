# 1.1.1

* Fixed package.json: d.ts files are now exported as well (#7)

# 1.1

_Which should have been called 1.0...:-)_

* the `lookupFunction` of `ref` is now optional, if it is not provided, serializr will try to resolve the reference within the current document. Types are respected while resolving
* `ref` has been renamed to `reference`
* `child` has been renamed to `object`
* `false` is now also an acceptable value for propSchema's
* the prop schema `"*": true` now has the special meaning that all enumerable, primitive fields will be serialized. Will throw on non-primitive fields
* introduced `custom(serializer, deserializer)`
* `identifier` now supports an optional callback that can be used to register new instances in some store
* circular dependency on default schema's for classes are now a bit better handled (but remain a fundamental JS problem, especially for classes)

# 1.0

Initial release

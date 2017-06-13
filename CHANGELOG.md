# 1.1.12

* Improved documentation examples, see #43 by @brikou
* Fixed `class constructor cannot be invoked without 'new'` error, see #42 by @pinksquidhat
* Introduced `mapAsArray`, to support maps that serialize to arrays with objects with identifiers. And vice versa. By @vonovak. See #22

# 1.1.11

* Introduced `serializr.SKIP`, the can be used to skip certain properties during deserialization when using `custom` serializers. #32 by @nathanstitt
* Fixed #27: Skip non primitive primitive properties instead of throwing for `*` decorator
* Introduced `@serializeAll` decorator, see #27

# 1.1.10

* Schema was not correctly picked up for classes passed as first arg to deserialize. Fixed. See #36

# 1.1.9

* Fixed typings of deserialize for arrays. by @Podlas29

# 1.1.8

* Fixed #21 wrong export of `setDefaultModelSchema` export, by @vonovak

# 1.1.7

* Added support for serializable constructor arguments (TypeScript only), by @bfsmith, see [#11](https://github.com/mobxjs/serializr/pull/11)

# 1.1.6

* Fixed issue where custom arguments passed to `update` where not correctly handled, see #12, by @robclouth

# 1.1.5

* Fixed issue when deserializing deeply nested objects, see #10

# 1.1.4

* Avoid implicit any in typings (by @bnaya)

# 1.1.2 / 1.1.3

* Fixed UMD build issues

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

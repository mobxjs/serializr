import { invariant } from "../utils/utils"

/**
 * Similar to primitive, serializes instances of Date objects
 *
 * @returns
 */
export default function date() {
  // TODO: add format option?
    return {
        serializer: function(value) {
            if (value === null || value === undefined)
                return value
            invariant(value instanceof Date, "Expected Date object")
            return value.getTime()
        },
        deserializer: function (jsonValue, done) {
            if (jsonValue === null || jsonValue === undefined)
                return void done(null, jsonValue)
            var newDate
            if (typeof jsonValue === "string") {
                var dateArr = jsonValue.split(/[^0-9]/)
                newDate = new Date(+dateArr[0], +dateArr[1] - 1, +dateArr[2], +dateArr[3], +dateArr[4], +dateArr[5], +dateArr[6])
            } else {
                newDate = new Date(jsonValue)
            }
            return void done(null, newDate)
        }
    }
}

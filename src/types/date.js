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
            var date;
            if(typeof jsonValue === "string") {
                var dateArray = jsonValue.split(/[^0-9]/)
                date = new Date(dateArray[0], dateArray[1] - 1, dateArray[2], dateArray[3], dateArray[4], dateArray[5])
            }
            else {
                date = new Date(jsonValue)
            }
            return void done(null, date)
        }
    }
}

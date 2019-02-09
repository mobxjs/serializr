var formatters = {
    j: function json(v) {
        try {
            return JSON.stringify(v)
        } catch (error) {
            return "[UnexpectedJSONParseError]: " + error.message
        }
    }
}

export default function invariant(condition, message) {
    if (!condition) {
        var variables = Array.prototype.slice.call(arguments, 2)
        var variablesToLog = []

        var index = 0
        var formattedMessage = message.replace(/%([a-zA-Z%])/g, function messageFormatter(match, format) {
            if (match === "%%") return match

            var formatter = formatters[format]

            if (typeof formatter === "function") {
                var variable = variables[index++]

                variablesToLog.push(variable)

                return formatter(variable)
            }

            return match
        })

        if (console && variablesToLog.length > 0) {
            // eslint-disable-next-line no-console
            console.log.apply(console, variablesToLog)
        }

        throw new Error("[serializr] " + (formattedMessage || "Illegal State"))
    }
}

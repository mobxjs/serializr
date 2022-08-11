const formatters: { [name: string]: (o: any) => string } = {
    j: function json(v) {
        try {
            return JSON.stringify(v);
        } catch (error) {
            return `[UnexpectedJSONParseError]: ${(error as any).message}`;
        }
    },
    l: function symbol(s) {
        return s.toString();
    },
};

export default function invariant(
    condition: any,
    message: string,
    ...variables: any[]
): asserts condition {
    if (!condition) {
        const variablesToLog: any[] = [];

        let index = 0;
        const formattedMessage = message.replace(/%([a-zA-Z%])/g, function (match, format) {
            if (match === "%%") return match;

            const formatter = formatters[format];

            if (typeof formatter === "function") {
                const variable = variables[index++];

                variablesToLog.push(variable);

                return formatter(variable);
            }

            return match;
        });

        if (console && variablesToLog.length > 0) {
            // eslint-disable-next-line no-console
            console.log(...variablesToLog);
        }

        throw new Error("[serializr] " + (formattedMessage || "Illegal State"));
    }
}

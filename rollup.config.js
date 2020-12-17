import typescriptPlugin from "@rollup/plugin-typescript"
import typescript from "typescript"
import { terser } from "rollup-plugin-terser"

const LICENSE = "/** serializr - (c) Michel Weststrate 2016 - MIT Licensed */"

export default {
    input: "src/serializr.ts",
    output: [
        ["es", false],
        ["es", true],
        ["umd", false],
        ["umd", true],
    ].map(([format, compress]) => ({
        format: format,
        entryFileNames: "[name].[format]" + (compress ? ".min" : "") + ".js",
        sourcemap: true,
        dir: "lib",
        name: "serializr",
        exports: "named",
        plugins: compress
            ? [
                terser({
                    compress: {
                        passes: 3,
                        unsafe: true,
                        ecma: 7
                    },
                    toplevel: true,
                    mangle: {
                        properties: { regex: /^_/ }
                    },
                    ie8: true,
                    output: {
                        preamble: LICENSE
                    }
                }),
            ]
            : [],
    })),
    plugins: [typescriptPlugin({ typescript })],
    onwarn: function (warning, warn) {
        if ("THIS_IS_UNDEFINED" === warning.code) return
        // if ('CIRCULAR_DEPENDENCY' === warning.code) return
        warn(warning)
    },
}

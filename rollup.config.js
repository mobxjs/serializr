import typescriptPlugin from "rollup-plugin-typescript2"
import typescript from "typescript"
import { terser } from "rollup-plugin-terser"

const LICENSE = "/** serializr - (c) Michel Weststrate 2016 - MIT Licensed */"

function config(format /* : "umd" | "es" */, compress /*: boolean */) {
    return {
        input: "src/serializr.ts",
        output: [
            {
                format: format,
                file:
                    "lib/" +
                    (format === "umd" ? "" : "es/") +
                    "serializr" +
                    (compress ? ".min" : "") +
                    ".js",
                sourcemap: true,
                name: "serializr",
                exports: "named"
            }
        ],
        plugins: [
            typescriptPlugin({
                typescript,
                tsconfig: __dirname + "/tsconfig.json",
                abortOnError: false,
                exclude: [], // don't exclude .d.ts files
                tsconfigOverride: {
                    compilerOptions: {
                    }
                },
                useTsconfigDeclarationDir: true
            }),
            compress &&
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
                })
        ].filter(x => x),
        onwarn: function(warning, warn) {
            if ("THIS_IS_UNDEFINED" === warning.code) return
            // if ('CIRCULAR_DEPENDENCY' === warning.code) return
            warn(warning)
        }
    }
}

export default [config("es", false), config("es", true), config("umd", false), config("umd", true)]

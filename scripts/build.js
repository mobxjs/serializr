const path = require("path")
const rollup = require("rollup")
const resolve = require("rollup-plugin-node-resolve")
const commonjs = require("rollup-plugin-commonjs")
const uglify = require("rollup-plugin-uglify")
const merge = require("lodash.merge")

const LICENSE = "/** serializr - (c) Michel Weststrate 2016 - MIT Licensed */"

function buildBundle(rollupConfig) {
    return rollup.rollup(rollupConfig.input).then((bundle) => {
        bundle.write(rollupConfig.output)
    })
}

const commonConfig = {
    input: {
        input: path.resolve(__dirname, "../src/serializr.js"),
        name: "serializr",
        plugins: [
            resolve(),
            commonjs()
        ]
    },
    output: {
        name: "serializr"
    }
}

const jsBundleConfig = merge({}, commonConfig, {
    output: {
        file: path.resolve(__dirname, "../lib/serializr.js"),
        format: "umd",
        amd: {
            id: "serializr"
        },
        banner: LICENSE
    }
})

const esBundleConfig = merge({}, commonConfig, {
    output: {
        file: path.resolve(__dirname, "../lib/es/serializr.js"),
        format: "es"
    }
})

/* bundle serializr.js */
buildBundle(jsBundleConfig)

/* bundle serializr.min.js, serializr.min.js.map */
buildBundle(merge({}, jsBundleConfig, {
    input: {
        plugins: [
            uglify({
                output: {
                    preamble: LICENSE
                },
                mangle: {
                    toplevel: true
                },
                ie8: true
            })
        ]
    },
    output: {
        file: path.resolve(__dirname, "../lib/serializr.min.js"),
        sourcemap: true
    }
}))

/* bundle es/serializr.js */
buildBundle(esBundleConfig)

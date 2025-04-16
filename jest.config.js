/** @type {import('jest').Config} */
const config = {
    projects: [
        {
            displayName: "babel-with-legacy-decorators",
            testMatch: ["<rootDir>/test/javascript/**/*.test.js"],
            transform: {
                "^.+\\.[t|j]sx?$": [
                    "babel-jest",
                    {
                        presets: ["@babel/preset-env", "@babel/preset-typescript"],
                        plugins: [["@babel/plugin-proposal-decorators", { version: "legacy" }]],
                    },
                ],
            },
        },
        // The following configuration si disabled as we don't support decorators in the 2023-11 version yet.
        // {
        //     displayName: "babel-with-2023-11-decorators",
        //     testMatch: ["<rootDir>/test/javascript/**/*.test.js"],
        //     transform: {
        //         "^.+\\.[t|j]sx?$": [
        //             "babel-jest",
        //             {
        //                 presets: ["@babel/preset-env", "@babel/preset-typescript"],
        //                 plugins: [["@babel/plugin-proposal-decorators", { version: "2023-11" }]],
        //             },
        //         ],
        //     },
        // },
        {
            displayName: "typescript",
            testMatch: ["<rootDir>/test/typescript/**/*.test.ts"],
            preset: "ts-jest",
            transform: {
                "^.+.tsx?$": [
                    "ts-jest",
                    {
                        tsconfig: "test/typescript/tsconfig.json",
                    },
                ],
            },
        },
    ],
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}"],
};

module.exports = config;

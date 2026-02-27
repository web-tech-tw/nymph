import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: [
            "node_modules",
            "dist",
            "build",
            ".git",
            "*.config.js",
            "export_openapi.js",
            "nodemon.json"
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            parser: tseslint.parser
        },
        rules: {
            "linebreak-style": 1,
            "indent": ["error", 4],
            "quotes": ["error", "double"],
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_"
                }
            ],
            "@typescript-eslint/no-explicit-any": "warn"
        }
    },
    {
        files: [
            "src/bridges/**/*.ts",
            "src/clients/**/*.ts",
            "src/init/**/*.ts",
            "src/listeners/**/*.ts",
            "src/middleware/**/*.ts",
            "src/models/**/*.ts",
            "src/routes/**/*.ts",
            "src/schemas/**/*.ts",
            "src/tools/**/*.ts",
            "src/utils/**/*.ts"
        ],
        rules: {
            "@typescript-eslint/no-explicit-any": "off"
        }
    }
];

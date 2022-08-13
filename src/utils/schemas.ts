import createModelSchema from "../api/createModelSchema";
import getDefaultModelSchema from "../api/getDefaultModelSchema";
import { ClazzOrModelSchema, ModelSchema } from "../api/types";
import { isModelSchema } from "./utils";

/**
 * A simple util that retrieve the existing schema or create a default one.
 * @param src
 * @returns
 */
export const getOrCreateSchema = <T extends object>(src: ClazzOrModelSchema<T>): ModelSchema<T> => {
    if (isModelSchema(src)) {
        return src;
    } else {
        let schema = getDefaultModelSchema<T>(src);
        if (!schema) {
            schema = createModelSchema(src, {});
        }
        return schema;
    }
};

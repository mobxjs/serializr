/*
 * Deserialization
 */
import { invariant } from "../utils/utils";
import { getTargetContext } from "./Context";

/**
 * Cancels an asynchronous deserialization or update operation for the specified target object.
 * @param instance object that was previously returned from deserialize or update method
 */
export default function cancelDeserialize<T>(instance: T): void {
    invariant(
        typeof instance === "object" && instance && !Array.isArray(instance),
        "cancelDeserialize needs an object"
    );
    const context = getTargetContext(instance);
    if (context) {
        context.cancelAwaits();
    }
}

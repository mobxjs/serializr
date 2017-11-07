
import { GUARDED_NOOP } from "../utils/utils";

export function BaseContext(parentContext, onReadyCb) {
    this.parentContext = parentContext
    this.onReadyCb = onReadyCb || GUARDED_NOOP;
    this.error = undefined;
    this.rootContext = this.parentContext && this.parentContext.rootContext || this;
    this.isRoot = !this.parentContext;
}

BaseContext.prototype.setError = function setError(newError) {
    this.error = newError;
};

BaseContext.prototype.finished = function finished(data) {
    if (typeof this.onReadyCb === "function") {
        if (this.error) {
            this.onReadyCb(this.error);
        } else {
            this.onReadyCb(undefined, data);
        }
    }
}

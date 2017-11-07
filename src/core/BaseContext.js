
import { GUARDED_NOOP } from "../utils/utils";

export function BaseContext(parentContext, onReadyCb) {
    this.parentContext = parentContext
    this.onFinishCallbacks = [];
    this.onReadyCb = onReadyCb || GUARDED_NOOP;
    this.error = undefined;
    this.rootContext = this.parentContext && this.parentContext.rootContext || this;
    this.isRoot = !this.parentContext;
}

BaseContext.prototype.addCallback = function addCallback(listenerFunction) {
    if (typeof listenerFunction === "function") {
        this.onFinishCallbacks = this.onFinishCallbacks || [];
        this.onFinishCallbacks.push(listenerFunction);
    }
};

BaseContext.prototype.setError = function setError(newError) {
    this.error = newError;
};

BaseContext.prototype.finished = function finished(data) {
    if (this.onFinishCallbacks && Array.isArray(this.onFinishCallbacks) && this.onFinishCallbacks.length > 0) {
        this.onFinishCallbacks.forEach(function (listener) {
            if (typeof listener === "function") {
                listener(this.error);
            }
        })
    }
    if (typeof this.onReadyCb === "function") {
        if (this.error) {
            this.onReadyCb(this.error);
        } else {
            this.onReadyCb(undefined, data);
        }
    }
}

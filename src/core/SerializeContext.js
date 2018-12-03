import { BaseContext } from "./BaseContext";

export default function SerializeContext(parentContext, modelSchema, json, onReadyCb, customArgs) {
    BaseContext.call(this, parentContext, onReadyCb);

}

SerializeContext.prototype = new BaseContext();

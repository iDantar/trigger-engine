import { BridgeSchemaInput } from "engine";
import { localize } from "foundry-helpers";

function loopAfterSchema(state?: string): BridgeSchemaInput {
    return {
        key: "after",
        label: localize.path("builtins.shared.loop.after.label"),
        tooltip: localize.path("builtins.shared.loop.after.tooltip"),
        state,
    };
}

function loopAfterSchemas(state?: string): BridgeSchemaInput[] {
    return [{ key: "out" }, loopAfterSchema(state)];
}

export { loopAfterSchema, loopAfterSchemas };

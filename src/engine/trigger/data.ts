import { zCollection, zDocument, zDocumentId } from "_zod";
import { NodeData, NodeDataSchema, zConnectionId, zNodeDataSchema } from "engine";
import { z } from "foundry-helpers";

class TriggerData extends zDocument<TriggerDataSchema> {
    static get defineSchema() {
        return zTriggerDataSchema;
    }

    static get collections() {
        return {
            nodes: NodeData,
        };
    }
}

interface TriggerData extends Omit<z.output<TriggerDataSchema>, "nodes"> {
    readonly _source: TriggerDataInput;
    readonly nodes: zCollection<TriggerData, NodeDataSchema, NodeData>;
}

const zTriggerVariable = z.object({
    isArray: z.boolean(),
    label: z.string().trim().min(1),
    type: z.string().trim().min(1),
});

const zTriggerDataSchema = z.object({
    id: zDocumentId,
    description: z.string().trim().default(""),
    folder: z.string().trim().default(""),
    name: z.string().trim().default(""),
    nodes: z.array(zNodeDataSchema).default(() => []),
    priority: z.number().default(0),
    tags: z.array(z.string().trim()).default(() => []),
    variables: z.record(zConnectionId, zTriggerVariable).default(() => ({})),
});

type TriggerDataInput = z.input<TriggerDataSchema>;
type TriggerDataOutput = z.output<TriggerDataSchema>;

type UpdateTriggerData = Omit<TriggerDataInput, "nodes" | "id">;

type TriggerDataSchema = typeof zTriggerDataSchema;

type TriggerVariable = z.input<typeof zTriggerVariable>;

export { TriggerData };
export type { TriggerDataInput, TriggerDataOutput, TriggerVariable, UpdateTriggerData };

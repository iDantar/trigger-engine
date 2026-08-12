import {
    CreateNodeData,
    EntryId,
    instantiateNode,
    isGateExitNode,
    isVariableGetterNode,
    NodeData,
    OpenTriggerNode,
    splitEntryId,
    Trigger,
    TriggerApplication,
    TriggerData,
    TriggerDataOutput,
    UpdateTriggerData,
} from "engine";
import { enrichHTML, MODULE, purgeObject, R } from "foundry-helpers";
import { mergeTwoWays, TwoWaysEntryId } from "triggers-menu";

class OpenTrigger extends Trigger<OpenTriggerNode> {
    #computed: boolean = false;
    #computedConnections: Record<EntryId, boolean> = {};
    #invalid: boolean = false;
    #linkedConnections: Set<TwoWaysEntryId> = new Set();
    #locked: boolean;
    #resolved: ResolvedTriggerNode[] = [];
    #updated: boolean = false;

    constructor(parent: TriggerApplication, data: TriggerData, locked: boolean = false) {
        super(parent, data);

        this.#locked = locked;

        const sequences: ((nodeData: NodeData) => boolean)[] = [
            (nodeData) => isGateExitNode(nodeData),
            (nodeData) => !isGateExitNode(nodeData) && !isVariableGetterNode(nodeData),
            (nodeData) => isVariableGetterNode(nodeData),
        ];

        for (const fn of sequences) {
            for (const nodeData of data.nodes) {
                if (!fn(nodeData)) continue;

                try {
                    const node = instantiateNode(this, nodeData, true);
                    if (!node || node.invalid) {
                        // only invalid if undefined or actually invalid
                        if (node !== false) {
                            this.#invalid = true;
                        }
                        continue;
                    }

                    this.nodes.set(node.id, node);
                } catch (error) {}
            }
        }
    }

    get invalid(): boolean {
        return this.#invalid;
    }

    get idPrefix(): "world" | "module" {
        return this.locked ? "module" : "world";
    }

    get fullId(): TriggerFullId {
        return `${this.idPrefix}:${this.id}`;
    }

    get linkedConnections(): Set<TwoWaysEntryId> {
        return this.#linkedConnections;
    }

    get description(): string {
        return this.data.description;
    }

    get enrichedDescription(): Promise<string> {
        return enrichHTML(this.description);
    }

    get folder(): string {
        return this.data.folder;
    }

    get label(): string {
        return this.name || this.id;
    }

    get priority(): number {
        return this.data.priority;
    }

    get tags(): string[] {
        return R.filter([...this.data.tags, this.folder], R.isTruthy);
    }

    get locked(): boolean {
        return this.#locked;
    }

    get updated(): boolean {
        return this.#updated;
    }

    setUpdated(updated = true) {
        this.#updated = updated;
    }

    getNode(id: string): OpenTriggerNode | undefined {
        return this.nodes.get(id);
    }

    update(data: DeepPartial<UpdateTriggerData> & { [k: string]: any }): TriggerData {
        this.setUpdated();
        return this.data.update(data);
    }

    duplicate(): TriggerDataOutput {
        let source: TriggerDataOutput;

        // we purge all invalid nodes and connections from data
        if (this.invalid) {
            const data = this.data.clone();

            data.update({
                nodes: R.filter(data._source.nodes ?? [], (node) => this.nodes.has(node.id as string)),
            });

            const clone = new OpenTrigger(this.application, data, this.locked);

            clone.computeConnections();
            source = clone.data.toObject();
        } else {
            source = this.data.toObject();
        }

        source.id = foundry.utils.randomID();
        source.name = this.name ? game.i18n.format("DOCUMENT.CopyOf", { name: this.name }) : "";

        return source;
    }

    addNode(source: CreateNodeData): OpenTriggerNode | undefined {
        try {
            const data = this.data.nodes.addFromSource(source);

            if (!data || data.invalid) {
                throw new Error("The provided NodeData source is invalid.");
            }

            const node = instantiateNode(this, data, true);

            if (node) {
                this.setUpdated();
                this.nodes.set(node.id, node);
                return node;
            }
        } catch (error: any) {
            MODULE.error(`an error ocurred while trying to add a TriggerNode.`, error);
        }
    }

    refreshNode(id: string) {
        const current = this.getNode(id);
        if (!current) return;

        try {
            const node = instantiateNode(this, current.data, true);

            if (node) {
                this.nodes.set(node.id, node);
            }
        } catch (error) {}
    }

    deleteNode(id: string) {
        this.data.nodes.delete(id);
        this.nodes.delete(id);
    }

    addComputedConnections(origin: EntryId, target: EntryId) {
        this.#computedConnections[origin] = true;
        this.#computedConnections[target] = true;
        this.#linkedConnections.add(mergeTwoWays(origin, target));
    }

    entryIsConnected(id: EntryId): boolean {
        return !!this.#computedConnections[id];
    }

    computeConnections(force?: boolean) {
        if (!force && this.#computed) return;

        this.#computed = true;
        this.#computedConnections = {};
        this.#linkedConnections.clear();

        for (const originNode of this.nodes) {
            const originConnections = R.pipe(
                [
                    ["outs", originNode.data.outs, originNode.entries.outs],
                    [
                        "inputs",
                        originNode.data.inputs,
                        isVariableGetterNode(originNode)
                            ? [] // we don't want to process variables getter input
                            : (originNode.exitGate?.entries.outputs ?? originNode.entries.inputs),
                    ],
                ] as const,
                R.flatMap(([category, records, entries]) => {
                    const schemas = entries.map((entry) => entry.schema);

                    return R.pipe(
                        R.entries(records),
                        R.map(([key, { connection }]) => {
                            if (!connection) return;

                            const entry = schemas.find((schema) => schema.key === key);
                            if (!entry) return;

                            const type = ("type" in entry ? entry.type : "bridge") as string;
                            return [category, type, key, connection] as const;
                        }),
                        R.filter(R.isTruthy),
                    );
                }),
            );

            for (const [category, originType, originKey, otherId] of originConnections) {
                const [otherNodeId, otherCategory, otherEntryKey] = splitEntryId(otherId);
                const otherNode = this.getNode(otherNodeId);

                /**
                 * we delete stale connections for next save, this way we don't have to manually
                 * update every node when connections are removed
                 */
                const deleteData = () => {
                    if (this.invalid) return; // we don't want to touch invalid triggers
                    for (const data of [originNode.data, originNode.data._source] as const) {
                        delete data[category]?.[originKey];
                    }
                };

                if (!otherNode) {
                    deleteData();
                    continue;
                }

                if (otherCategory === "ins") {
                    if (!otherNode.entries.in) {
                        deleteData();
                        continue;
                    }
                } else {
                    const output = otherNode.entries.outputs.find(({ schema: { key, type } }) => {
                        if (key !== otherEntryKey) return false;
                        return type === originType || !!this.application.getConvertor(type, originType);
                    });

                    if (!output) {
                        deleteData();
                        continue;
                    }
                }

                const inputCategory = otherCategory === "ins" ? "outs" : "inputs";
                const inputId: EntryId = `${originNode.id}:${inputCategory}:${originKey}`;

                this.addComputedConnections(inputId, otherId);
            }
        }
    }

    async resolve(...args: any[]): Promise<ResolvedOpenTrigger> {
        const resolved: Record<string, ResolvedTriggerNode[]> = {};
        const events = this.nodes.filter((node) => node.isEvent);

        for (const event of events) {
            this.#resolved = [];
            await event._execute(...args);
            resolved[event.type] = this.#resolved;
        }

        return {
            resolved,
            source: purgeObject(this.toObject()),
        };
    }

    addResolvedNode(data: ResolvedTriggerNode) {
        this.#resolved.push(data);
    }
}

interface OpenTrigger {
    get nodes(): Collection<string, OpenTriggerNode>;
}

type ResolvedTriggerNode = {
    inputs: ResolvedNodeEntry[];
    outputs: ResolvedNodeEntry[];
    type: string;
};

type ResolvedNodeEntry = {
    key: string;
    type: string;
    value: unknown;
};

type ResolvedOpenTrigger = {
    resolved: Record<string, ResolvedTriggerNode[]>;
    source: TriggerDataOutput;
};

type TriggerFullId = `${"world" | "module"}:${string}`;

export { OpenTrigger };
export type { ResolvedNodeEntry, ResolvedOpenTrigger, ResolvedTriggerNode, TriggerFullId };

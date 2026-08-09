import {
    BaseEntry,
    ConnectionId,
    EntryCategory,
    EntryId,
    NodeBridge,
    OpenNodeEntry,
    OpenTrigger,
    PreciseEntryCategory,
} from "engine";
import { confirmDialog, ContextMenuEntry, localize, R, waitDialog } from "foundry-helpers";
import { Blueprint, splitTwoWays } from "triggers-menu";
import { alignHorizontally, BlueprintNode, CustomEntryDialogData } from "..";

abstract class BaseBlueprintEntry<
    TEntry extends OpenNodeEntry | NodeBridge = OpenNodeEntry | NodeBridge,
> extends PIXI.Container<PIXI.Container> {
    #category: EntryCategory;
    #connector?: PIXI.Graphics;
    #entry: TEntry;
    #field?: PIXI.Container;
    #label?: PreciseText;
    #parent: BlueprintNode;

    constructor(parent: BlueprintNode, category: EntryCategory, entry: TEntry) {
        super();

        this.#category = category;
        this.#entry = entry;
        this.#parent = parent;
    }

    abstract get canConnect(): boolean;
    abstract get hasConnector(): boolean;
    abstract get isConnectionInitiator(): boolean;
    abstract get label(): string;

    get id(): EntryId {
        return `${this.node.id}:${this.preciseCategory}:${this.key}`;
    }

    get entry(): TEntry {
        return this.#entry;
    }

    get key(): string {
        return this.entry.key;
    }

    get category(): EntryCategory {
        return this.#category;
    }

    get connection(): ConnectionId | undefined {
        return this.entry.connection;
    }

    get color(): ColorSource {
        return 0xffffff;
    }

    get schema(): BaseEntry {
        return this.entry.schema;
    }

    get customSlug(): string | undefined {
        return this.schema.slug;
    }

    get preciseCategory(): PreciseEntryCategory {
        return this.category;
    }

    get oppositeCategory(): EntryCategory {
        return this.isInput ? "outputs" : "inputs";
    }

    get oppositePreciseCategory(): PreciseEntryCategory {
        return this.oppositeCategory;
    }

    get node(): BlueprintNode {
        return this.#parent;
    }

    get trigger(): OpenTrigger {
        return this.node.trigger;
    }

    get blueprint(): Blueprint {
        return this.node.blueprint;
    }

    get stage(): PIXI.Container {
        return this.blueprint.stage;
    }

    get isCustom(): boolean {
        return !!this.customSlug;
    }

    get isConnected(): boolean {
        return this.node.trigger.entryIsConnected(this.id);
    }

    get isInput(): boolean {
        return this.#category === "inputs";
    }

    get isOutput(): boolean {
        return !this.isInput;
    }

    get maxHeight(): number {
        return this.node.entryHeight - this.node.rowSpacing;
    }

    get connectorWidth(): number {
        return this.node.connectorWidth;
    }

    get connectorSpacing(): number {
        return this.node.connectorSpacing;
    }

    get connectorCenter(): Point {
        if (!this.#connector) {
            return { x: 0, y: 0 };
        }

        const bounds = this.#connector.getBounds();

        return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
        };
    }

    get connectorOffset(): Point {
        if (!this.#connector) {
            return { x: 0, y: 0 };
        }

        const center = this.connectorCenter;
        const bounds = this.node.getBounds();

        return {
            x: center.x - bounds.x,
            y: center.y - bounds.y,
        };
    }

    abstract _drawConnector(connector: PIXI.Graphics, isConnected: boolean): void;
    abstract _drawField(label: PreciseText): PIXI.Graphics | null;

    draw() {
        this.#clear();

        this.#connector = this.#drawConnector();
        this.#label = this.#drawLabel();
        this.#field = this._drawField(this.#label) || undefined;

        const content = [
            this.#connector,
            // if the label has been added to the field, we don't want to move it back at top level
            this.#label.parent ? undefined : this.#label,
            this.#field,
        ];

        alignHorizontally(this, content, {
            height: this.node.entryHeight,
            reverse: this.isOutput,
            spacing: this.connectorSpacing,
        });

        this.eventMode = "static";
        this.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);

        this.blueprint.addTooltip(
            this,
            () => this.entry.generateTooltip(this.label, this.isConnected),
            this.isInput ? "LEFT" : "RIGHT",
        );
    }

    redrawConnector(isConnected: boolean) {
        const connector = this.#connector;
        if (!connector) return;

        connector.clear();
        this._drawConnector(connector, isConnected);
    }

    canConnectTo(other: BaseBlueprintEntry<TEntry>) {
        return (
            this.hasConnector &&
            this.canConnect &&
            this.preciseCategory === other.oppositePreciseCategory &&
            // we don't want gates looping over each other, this is an easy exception to make
            (!this.node.isGate || !other.node.isGate || this.node.gateId !== other.node.gateId)
        );
    }

    disconnect() {
        const category = this.preciseCategory;

        if (this.isConnectionInitiator) {
            const connection = this.connection;
            if (!connection) return;

            this.node.removeConnection(category, this.key, connection);
        } else {
            const entryId = this.id;

            for (const twoWays of this.node.trigger.linkedConnections) {
                const [originId, targetId] = splitTwoWays(twoWays);
                const otherId = originId === entryId ? targetId : targetId === entryId ? originId : undefined;
                const otherEntry = otherId && this.blueprint.nodes.getEntryFromId(otherId);
                if (!otherEntry) continue;

                otherEntry.node.removeConnection(otherEntry.preciseCategory, otherEntry.key, entryId);
            }
        }

        this.blueprint.draw({ forceComputeConnections: true });
    }

    async remove() {
        const preciseCategory = this.preciseCategory;
        if (!this.isCustom || preciseCategory === "ins") return;

        // we want to update the exit gate if we are a return gate
        const updater = (this.node.isReturnGate && this.node.exitGate) || this.node;
        const nodes: (readonly [PreciseEntryCategory, BlueprintNode])[] = [[preciseCategory, updater]];

        // we want to disconnect all the entry-gates too
        if (this.node.isExitGate || this.node.isReturnGate) {
            const oppositeCategory = this.oppositePreciseCategory;

            nodes.push(
                ...this.node.parent
                    .getGateEntries(this.node.gateId as string, true)
                    .map((node) => [oppositeCategory, node] as const),
            );
        }

        for (const [category, node] of nodes) {
            node.update({
                custom: {
                    [category]: {
                        [this.key]: undefined,
                    },
                },
            });
        }

        // we remove the variable if any (and all the getters)
        this.blueprint.deleteVariable(this.id as ConnectionId, false);

        updater.refresh({
            forceComputeConnections: true,
            renderApplication: true,
            selectNodes: [this.node.id],
        });
    }

    _contextMenuOptions(): ContextMenuEntry[] {
        const isCustom = this.isCustom && !this.node.isEntryGate;

        return [
            {
                label: localize.path("blueprint.entry.disconnect"),
                icon: `<i class="fa-solid fa-link-horizontal-slash"></i>`,
                visible: this.isConnected,
                onClick: async () => {
                    this.disconnect();
                },
            },
            {
                label: localize.path("blueprint.entry.edit.label"),
                icon: `<i class="fa-solid fa-pen-to-square"></i>`,
                visible: isCustom,
                onClick: () => {
                    return this.#edit();
                },
            },
            {
                label: localize.path("blueprint.entry.remove.title"),
                icon: `<i class="fa-solid fa-trash fa-fw"></i>`,
                visible: isCustom,
                onClick: async () => {
                    const confirm = await confirmDialog("blueprint.entry.remove");
                    return confirm && this.remove();
                },
            },
        ];
    }

    async #edit() {
        const { input, slug, label } = this.schema;
        const category = this.preciseCategory;
        if (category === "ins" || R.isNullish(slug)) return;

        const node = this.node;
        const definedSchema = node.getCustomCategorySchemas(category).find((schema) => schema.slug === slug);
        if (!definedSchema) return;

        const title = node.customEntryLabel(category, definedSchema);

        const dialogInput: CustomEntryDialogData["input"] = definedSchema.input &&
            R.isNonNullish(input) && {
                label: node.customEntryInputLabel(category, definedSchema),
                placeholder: String(input),
                type: definedSchema.input.isNumber ? "number" : "text",
                value: input,
            };

        const dialogLabel: CustomEntryDialogData["label"] = !definedSchema.input?.replaceLabel &&
            R.isNonNullish(label) && {
                value: label,
                placeholder: label,
            };

        const dialogData: Pick<CustomEntryDialogData, "label" | "input"> = {
            input: dialogInput,
            label: dialogLabel,
        };

        const result = await waitDialog<{ label?: string; input?: string }>({
            content: "edit-entry",
            data: dialogData,
            i18n: "edit-entry",
            title: localize("blueprint.entry.edit.title", { label: title }),
            yes: {
                label: localize("edit-entry.yes.edit"),
            },
        });

        if (!result || !node.validateCustomEntryInput(dialogInput, definedSchema, result)) return;

        const update: { label?: string; input?: string } = {};

        if (result.label) {
            update.label = result.label;
        }

        if (result.input) {
            update.input = result.input;

            if (definedSchema.input?.replaceLabel) {
                update.label = result.input;
            }
        }

        // if we are a return gate, we actually update the exit gate
        const updater = (node.isReturnGate && node.exitGate) || node;

        updater.update({
            custom: {
                [category]: {
                    [this.key]: update,
                },
            },
        });

        updater.refresh({ selectNodes: [node.id] });
    }

    #clear() {
        this.removeChildren();

        this.#connector?.destroy(true);
        this.#label?.destroy(true);
        this.#field?.destroy(true);

        this.#connector = undefined;
        this.#label = undefined;
        this.#field = undefined;
    }

    #drawConnector(): PIXI.Graphics | undefined {
        if (!this.hasConnector) return;

        const connector = new PIXI.Graphics();

        this._drawConnector(connector, this.isConnected);

        connector.width = this.connectorWidth;
        connector.eventMode = "static";
        connector.hitArea = new PIXI.Rectangle(0, 0, this.connectorWidth, this.maxHeight);

        if (this.canConnect) {
            connector.cursor = "alias";
            connector.on("pointerdown", this.#onConnectorPointerDown, this);
        } else {
            connector.on("pointerdown", (event) => event.stopPropagation(), this);
        }

        connector.on("pointerup", this.#onConnectorPointerUp, this);

        return connector;
    }

    #drawLabel(): PreciseText {
        return this.node.preciseText(this.label, {
            lineHeight: this.node.entryHeight,
        });
    }

    #onConnectorPointerDown(event: PIXI.FederatedPointerEvent) {
        event.stopPropagation();

        if (event.button === 0) {
            this.blueprint.connections.start(event, this);
        }
    }

    #onConnectorPointerUp(event: PIXI.FederatedPointerEvent) {
        if (event.button !== 2) return;
        if (this.node.isLocked) return;

        const entries: ContextMenuEntry[] = this._contextMenuOptions();
        this.node.createContextMenu(event, entries);
    }
}

export { BaseBlueprintEntry };
export type { EntryCategory };

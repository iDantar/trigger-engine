import { ConnectionId, isVariableGetterNode, NodeEntry, NodeField, OpenNodeEntry, TriggerVariable } from "engine";
import { confirmDialog, ContextMenuEntry, localize } from "foundry-helpers";
import { editLabelDialog } from "triggers-menu";
import { BaseBlueprintEntry } from ".";
import { BlueprintNode } from "..";

class BlueprintEntry extends BaseBlueprintEntry<OpenNodeEntry> {
    constructor(parent: BlueprintNode, entry: OpenNodeEntry) {
        super(parent, entry.category, entry);
    }

    get type(): string {
        return this.entry.type;
    }

    get label(): string {
        const variable = this.trigger.data.variables[this.id as ConnectionId]?.label;
        if (variable) return variable;

        const { key, label } = this.entry;

        return label
            ? game.i18n.localize(label)
            : (this.node.localize(this.category, key, "title") ?? this.node.rootLocalize("entry", key, "title") ?? key);
    }

    get isArray(): boolean {
        return this.entry.isArray;
    }

    get isConnectionInitiator(): boolean {
        return this.isInput;
    }

    get color(): ColorSource {
        return this.entry.color;
    }

    get FieldCls(): typeof NodeField | undefined {
        const FieldCls = (this.entry.constructor as typeof NodeEntry).FieldClass as typeof NodeField;
        return FieldCls?.prototype instanceof NodeField ? FieldCls : undefined;
    }

    get hasConnector(): boolean {
        if (this.isOutput || !this.FieldCls) return true;
        if (this.node.isEvent || !this.node.inputsHaveConnector) return false;
        return this.FieldCls.entryHasConnector(this.entry.field);
    }

    get canConnect(): boolean {
        return !this.node.isLocked && (this.isOutput || !this.isConnected);
    }

    canConvertWith(other: BlueprintEntry): boolean {
        if (this.type === other.type) return true;

        const [input, output] = this.isInput ? [this.type, other.type] : [other.type, this.type];
        return !!this.blueprint.application.getConvertor(output, input);
    }

    canConnectTo(other: BlueprintEntry): boolean {
        return super.canConnectTo(other) && this.canConvertWith(other);
    }

    _drawConnector(connector: PIXI.Graphics, isConnected: boolean) {
        const color = this.color;
        const isArray = this.isArray;
        const isCustom = this.isCustom;

        if (isArray) {
            connector.lineStyle({ color, width: 1 });
            if (isCustom) {
                connector.drawRoundedRect(0, 0, 12.5, 14.5, 2.5);
            } else {
                connector.drawCircle(7, 7, 7.5);
            }
        }

        if (isConnected) {
            connector.beginFill(this.color);
        }

        connector.lineStyle({ color, width: isArray ? 1 : 2 });

        if (isCustom) {
            if (isArray) {
                connector.drawRoundedRect(2, 2, 8.5, 10, 2);
            } else {
                connector.drawRoundedRect(0, 0, 12.5, 14, 2.5);
            }
        } else if (isArray) {
            connector.drawCircle(7, 7, 5.5);
        } else {
            connector.drawCircle(7, 7, 7);
        }

        connector.endFill();
    }

    _drawField(label: PreciseText): PIXI.Graphics | null {
        if (!this.isInput || this.isArray || !this.node.inputsHaveField) return null;

        const entry = this.entry;
        const FieldCls = this.FieldCls;
        if (!FieldCls) return null;

        const processValue = (value: unknown): unknown => {
            const validValue = entry.isValidType(value) ? value : entry.default;
            return entry.processValue(validValue);
        };

        const node = this.node;
        const rawValue = entry.value;
        const defaultValue = entry.default;
        const isConnected = this.isConnected;
        const options: NodeFieldOptions = {
            baseFontSize: node.fontSize,
            default: defaultValue,
            field: entry.field as any,
            isConnected,
            label,
            maxHeight: this.maxHeight,
            value: processValue(rawValue),
        };

        const fieldElement = new FieldCls(node, entry, options);
        fieldElement.draw();

        if (isConnected || !this.canConnect) {
            return fieldElement;
        }

        fieldElement.eventMode = "static";
        fieldElement.hitArea = new PIXI.Rectangle(0, 0, fieldElement.width, fieldElement.height);

        fieldElement.on("pointerdown", (event) => {
            event.stopPropagation();
            this.node.selectOnly();
        });

        fieldElement.on("pointerup", async (event) => {
            if (event.button !== 0) return;

            this.blueprint.toggleLocked(true);
            const value = await fieldElement.onClick();
            this.blueprint.toggleLocked(false);

            if (value === rawValue) return;

            const newValue = processValue(value);
            if (newValue === rawValue) return;

            if (newValue === defaultValue) {
                this.node.update({
                    inputs: {
                        [this.key]: undefined,
                    },
                });
            } else {
                this.node.update({
                    inputs: {
                        [this.key]: {
                            connection: undefined,
                            value: newValue,
                        },
                    },
                });
            }

            this.node.refresh();
        });

        return fieldElement;
    }

    _contextMenuOptions(): ContextMenuEntry[] {
        const options = super._contextMenuOptions();

        if (this.preciseCategory !== "outputs" || isVariableGetterNode(this.node)) {
            return options;
        }

        const hasVariable = !!this.trigger.data.variables[this.id as ConnectionId];

        options.unshift(
            {
                label: localize.path("blueprint.entry.variable"),
                icon: `<i class="fa-solid fa-square-root-variable"></i>`,
                visible: !hasVariable,
                onClick: async () => {
                    const placeholder = this.label;
                    const label = await editLabelDialog("variable", { placeholder });
                    if (label === null) return;

                    this.trigger.update({
                        variables: {
                            [this.id]: {
                                isArray: this.isArray,
                                label: label || placeholder,
                                type: this.type,
                            } satisfies TriggerVariable,
                        },
                    });

                    this.node.refresh({
                        forceComputeConnections: true,
                        renderApplication: true,
                    });
                },
            },
            {
                label: localize.path("blueprint.variable.edit"),
                icon: `<i class="fa-solid fa-pen-to-square"></i>`,
                visible: hasVariable,
                onClick: async () => {
                    return this.blueprint.editVariable(this.id as ConnectionId);
                },
            },
            {
                label: localize.path("blueprint.variable.delete.title"),
                icon: `<i class="fa-solid fa-trash fa-fw"></i>`,
                visible: hasVariable,
                onClick: async () => {
                    const confirm = await confirmDialog("blueprint.variable.delete");
                    return confirm && this.blueprint.deleteVariable(this.id as ConnectionId);
                },
            },
        );

        return options;
    }
}

function isBlueprintEntry(entry: BaseBlueprintEntry): entry is BlueprintEntry {
    return entry instanceof BlueprintEntry;
}

type NodeFieldOptions = {
    baseFontSize: number;
    default: unknown;
    field: Record<string, any>;
    isConnected: boolean;
    label: PreciseText;
    maxHeight: number;
    value: unknown;
};

export { BlueprintEntry, isBlueprintEntry };
export type { NodeFieldOptions };

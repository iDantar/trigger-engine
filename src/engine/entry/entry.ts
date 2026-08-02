import { BaseEntrySchemaOutput, ConnectionId, EntryCategory, NodeData, NodeField, TriggerNode } from "engine";
import { LocalizeArgs, MODULE, R } from "foundry-helpers";

/**
 * IMPORTANT an entry can never represent an array as the module always provides an array
 * version of every connection type.
 */
class NodeEntry<TValue extends unknown = unknown, TFieldSchema extends Record<string, any> | undefined = undefined> {
    #category: EntryCategory;
    #data: NodeData;
    #field: TFieldSchema;
    #parent: TriggerNode;
    #schema: BaseEntrySchemaOutput;

    /** @private You musn't use constructor in your child class */
    constructor(
        parent: TriggerNode,
        category: EntryCategory,
        nodeData: NodeData,
        entrySchema: BaseEntrySchemaOutput,
        entryField: Record<string, any>,
    ) {
        this.#category = category;
        this.#data = nodeData;
        this.#field = entryField as TFieldSchema;
        this.#parent = parent;
        this.#schema = entrySchema;

        // foundry.utils.deepFreeze(this.#field as any);
        // foundry.utils.deepFreeze(this.#schema);

        // from private methods
        Object.defineProperties(
            this,
            R.fromKeys(["localize", "rootLocalize"] as const, (property) => {
                return {
                    value: parent[property].bind(parent),
                    configurable: false,
                    enumerable: false,
                    writable: false,
                };
            }),
        );
    }

    /**
     * @abstract
     * Must be an unique key among your registered module's entries (including the builtins)
     *
     * Localization path:
     * `<module-id>.<application-id>.entry.<type>.title`
     */
    static get type(): string {
        throw MODULE.Error("'type' accessor not implemented.");
    }

    /**
     * @abstract
     * The default value for this input.
     */
    static get default(): unknown {
        throw MODULE.Error("'default' accessor not implemented.");
    }

    /** Class inheriting `NodeField` to represent the input field of this entry. */
    static get FieldClass(): typeof NodeField<unknown, Record<string, any>> | null {
        return null;
    }

    /** The color of the node connection. */
    static get color(): ColorSource {
        return 0x000000;
    }

    /**
     * Cast the value from a different type.
     *
     * This is not equivalent to `EntryConvertor`, it doesn't necessarily expect `TValue`, but when setting an output
     * value using {@link TriggerNode#setOutputValue}, it allows to provide a different type that will be cast here.
     */
    static castValue(value: unknown): unknown {
        return value;
    }

    /**
     * @abstract
     * @returns true if the provided value is of type `TValue` excluding `undefined`.
     */
    static isValidType(value: unknown): boolean {
        throw MODULE.Error("'isValidType' method not implemented.");
    }

    /**
     * @abstract
     * Convert the value into something that stringifiable.
     */
    static toJSON(value: any): JSONValue {
        throw MODULE.Error("'isValidType' method not implemented.");
    }

    /**
     * @abstract
     * Convert the value back from its stringifiable version.
     */
    static fromJSON(value: JSONValue): Promise<any> | any {
        throw MODULE.Error("'isValidType' method not implemented.");
    }

    /**
     * @see {@link NodeEntry.default}
     *
     * The default value of this instance. Should be modified by {@link NodeEntry#field}.
     */
    get default(): TValue {
        return (this.constructor as typeof NodeEntry).default as TValue;
    }

    /** Tooltip to display when the entry is hovered over. */
    generateTooltip(label: string, isConnected: boolean): string | undefined {
        if (this.tooltip === false) return;

        if (R.isString(this.tooltip)) {
            return game.i18n.localize(this.tooltip);
        }

        const customTooltip = this.slug && this.localize("customs", this.category, this.slug, "tooltip");

        return (
            customTooltip ??
            this.localize(this.category, this.key, "tooltip") ??
            this.rootLocalize("entry", this.key, "tooltip")
        );
    }

    /**
     * Make the necessary modifications to the value to be used by the nodes.
     *
     * This is called at the end of the chain and is mostly there to use {@link NodeEntry#field}.
     */
    processValue(value: TValue): TValue {
        return value;
    }

    /**
     * *************************************************************
     * Stuff that is not meant to be overridden, don't be an idiot!
     * *************************************************************
     */

    /**
     * @private
     *
     * The entry category.
     */
    get category(): EntryCategory {
        return this.#category;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry.color}
     */
    get color(): ColorSource {
        return (this.constructor as typeof NodeEntry).color;
    }

    /**
     * @private
     *
     * The connection path of this entry.
     */
    get connection(): ConnectionId | undefined {
        return this.category === "inputs" ? this.#data.inputs[this.#schema.key]?.connection : undefined;
    }

    /**
     * @private
     *
     * @see {@link NodeField.defineSchema} The field data for this instance.
     */
    get field(): TFieldSchema {
        return this.#field;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry#schema}
     */
    get input(): string | number | undefined {
        return this.#schema.input;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry#schema}
     */
    get isArray(): boolean {
        return this.#schema.isArray;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry#schema}
     */
    get key(): string {
        return this.#schema.key;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry#schema}
     */
    get label(): string | undefined {
        return this.#schema.label;
    }

    /**
     * @private
     *
     * The schema defined in {@link TriggerNode}
     */
    get schema(): BaseEntrySchemaOutput {
        return this.#schema;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry#schema}
     */
    get slug(): string | undefined {
        return this.#schema.slug;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry#schema}
     */
    get tooltip(): string | boolean {
        return this.#schema.tooltip;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry.type}
     */
    get type(): string {
        return (this.constructor as typeof NodeEntry).type;
    }

    /**
     * @private
     *
     * The local value of this entry.
     */
    get value(): TValue | undefined {
        return this.category === "inputs"
            ? (this.#data.inputs[this.#schema.key]?.value as TValue | undefined)
            : undefined;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry.castValue}
     */
    castValue(value: unknown): unknown {
        return (this.constructor as typeof NodeEntry).castValue(value);
    }

    /**
     * @private
     *
     * @see {@link NodeEntry.fromJSON}
     */
    fromJSON(value: JSONValue): Promise<any> | any {
        return (this.constructor as typeof NodeEntry).fromJSON(value);
    }

    /**
     * @private
     *
     * @see {@link NodeEntry.isValidType}
     */
    isValidType(value: unknown): value is Exclude<TValue, undefined> {
        return (this.constructor as typeof NodeEntry).isValidType(value);
    }

    /**
     * @private
     *
     * @see {@link TriggerNode#localize}
     */
    localize(...args: LocalizeArgs): string | undefined {
        return this.#parent.localize(...args);
    }

    /**
     * @private
     *
     * @see {@link TriggerNode#rootLocalize}
     */
    rootLocalize(...args: LocalizeArgs): string | undefined {
        return this.#parent.rootLocalize(...args);
    }

    /**
     * @private
     *
     * @see {@link NodeEntry.toJSON}
     */
    toJSON(value: TValue): JSONValue {
        return (this.constructor as typeof NodeEntry).toJSON(value);
    }
}

export { NodeEntry };

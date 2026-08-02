import { IconObject } from "_zod";
import { NodeEntry, TriggerNode } from "engine";
import { drawRectangleMask, LocalizeArgs, MODULE, z } from "foundry-helpers";
import { BlueprintNode, NodeFieldOptions, PreciseTextOptions } from "triggers-menu";

class NodeField<TValue extends unknown = unknown, TFieldSchema extends Record<string, any> = Record<string, any>>
    extends PIXI.Graphics
{
    #entry: NodeEntry<TValue, TFieldSchema>;
    #options: NodeFieldOptions;
    #node: BlueprintNode;

    /** @private You musn't use constructor in your child class */
    constructor(node: BlueprintNode, parent: NodeEntry, options: NodeFieldOptions) {
        super();

        this.#entry = parent as unknown as NodeEntry<TValue, TFieldSchema>;
        this.#options = options;
        this.#node = node;
    }

    /**
     * @abstract
     * Defines the DataSchema for the input field that will be used in the triggers menu.
     */
    static get defineSchema(): NodeFieldSchema {
        throw MODULE.Error("'defineSchema' accessor not implemented.");
    }

    /** The cursor when hovering over the field. */
    get cursor(): PIXI.Cursor {
        return "default";
    }

    /**
     * @abstract
     * Draw the actual field.
     */
    draw(): void {
        throw MODULE.Error("'draw' method not implemented.");
    }

    /**
     * @abstract
     * Event listener called when the field is clicked on. It is only registered if the entry isn't connected.
     */
    onClick(): Promise<TValue> {
        throw MODULE.Error("'onClick' method not implemented.");
    }

    /**
     * *************************************************************
     * Stuff that is not meant to be overridden, don't be an idiot!
     * *************************************************************
     */

    /**
     * @private
     *
     * The base font size of nodes in 'px'.
     */
    get baseFontSize(): number {
        return this.#options.baseFontSize;
    }

    /**
     * @private
     *
     * The parent entry instance.
     */
    get entry(): NodeEntry<TValue, TFieldSchema> {
        return this.#entry;
    }

    /**
     * @private
     *
     * @see {@link NodeEntry.default}
     */
    get default(): TValue {
        return this.#options.default as TValue;
    }

    /**
     * @private
     *
     * @see {@link NodeField.defineSchema} The field data for this instance.
     */
    get field(): TFieldSchema {
        return this.#options.field as TFieldSchema;
    }

    /**
     * @private
     *
     * Is this entry currently connected to another node.
     */
    get isConnected(): boolean {
        return this.#options.isConnected;
    }

    /**
     * @private
     *
     * The already generated entry label element in case you want to manipulate it.
     */
    get label(): PreciseText {
        return this.#options.label;
    }

    /**
     * @private
     *
     * The max height of an entry row. You should make sure everything fits in it to avoid overlapping between rows.
     */
    get maxHeight(): number {
        return this.#options.maxHeight;
    }

    /**
     * The current value of this input after going through {@link NodeEntry#isValidType}
     * & {@link NodeEntry#processValue}
     */
    get value(): TValue {
        return this.#options.value as TValue;
    }

    /**
     * @private
     *
     * Creates a PIXI mask and applies it directly onto `parent`.
     */
    addRectangleMask(
        parent: PIXI.Container,
        x: number,
        y: number,
        width: number,
        height: number,
        radius?: number | undefined,
    ): void {
        const mask = drawRectangleMask(x, y, width, height, radius);

        parent.addChild(mask);
        parent.mask = mask;
    }

    /**
     * @private
     *
     * Creates a font-awesome icon in a canvas compatible form.
     */
    createFontAwesomeIcon(icon: IconObject): PreciseText {
        return this.#node.fontAwesomeIcon(icon);
    }

    /**
     * @private
     *
     * Creates a text element in a canvas compatible form.
     */
    createPreciseText(text: string, options?: PreciseTextOptions): PreciseText {
        return this.#node.preciseText(text, options);
    }

    /**
     * @private
     *
     * The bounds of the field in the viewport.
     */
    getGlobalBounds(): PIXI.Rectangle {
        return this.#node.blueprint.getGlobalBounds(this);
    }

    /**
     * @private
     *
     * @see {@link TriggerNode#localize}
     */
    localize(...args: LocalizeArgs): string | undefined {
        return this.#node.localize(...args);
    }

    /**
     * @private
     *
     * @see {@link TriggerNode#rootLocalize}
     */
    rootLocalize(...args: LocalizeArgs): string | undefined {
        return this.#node.rootLocalize(...args);
    }
}

type NodeFieldSchema = Record<string, z.core.JSONSchema.JSONSchema>;

export { NodeField };
export type { NodeFieldSchema };

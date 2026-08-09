import { R, roundToStep } from "foundry-helpers";
import { BuiltInNodeEntry, PointField, PointFieldSchema } from ".";

class PointEntry extends BuiltInNodeEntry<Point, PointFieldSchema> {
    static get type(): "point" {
        return "point";
    }

    static get default(): Point {
        return { x: 0, y: 0 };
    }

    static get color(): ColorSource {
        return 0xedea15;
    }

    static get FieldClass(): typeof PointField {
        return PointField;
    }

    static isValidType(value: unknown): value is Point {
        return R.isPlainObject(value) && R.isNumber(value.x) && R.isNumber(value.y);
    }

    static toJSON(value: Point): Point {
        return value;
    }

    static fromJSON(value: JSONValue): Point {
        return this.isValidType(value) ? value : this.default;
    }

    get default(): Point {
        return {
            x: this.field.x ?? 0,
            y: this.field.y ?? 0,
        };
    }

    generateTooltip(label: string, isConnected: boolean): string | undefined {
        if (this.tooltip === false) return;

        const tooltip = super.generateTooltip(label, isConnected);

        if (this.category === "outputs") {
            return tooltip;
        }

        return tooltip ? `<div class="title">${label}</div><hr>${tooltip}` : label;
    }

    processValue(value: Point): Point {
        const step = this.field.step;
        const hasStep = R.isNumber(step) && step !== 0;

        return {
            x: hasStep ? roundToStep(value.x, step) : value.x,
            y: hasStep ? roundToStep(value.y, step) : value.y,
        };
    }
}

export { PointEntry };

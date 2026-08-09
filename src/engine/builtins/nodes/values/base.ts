import { TriggerNode } from "engine";

abstract class BaseValueNode<
    TValue,
    TInputs extends Record<string, any> = Record<string, any>,
    TState extends string | never = string,
> extends TriggerNode<never, TInputs, never, never, never, TState> {
    #cached: TValue | null = null;

    static get category(): "value" {
        return "value";
    }

    static get hasIn(): boolean {
        return false;
    }

    static get defineOuts(): null {
        return null;
    }

    static get inputsHaveConnector(): boolean {
        return false;
    }

    get subtitle(): null {
        return null;
    }

    get headerColor(): ColorSource {
        return "#6b5646";
    }

    abstract _getValue(): Promise<TValue>;

    async _query(): Promise<TValue> {
        return this.#cached === null ? (this.#cached = await this._getValue()) : this.#cached;
    }
}

export { BaseValueNode };

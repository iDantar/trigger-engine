import { BaseActionNode } from "engine";
import { ActorPF2e, EffectPF2e, findItemWithSourceId, ItemPF2e } from "foundry-helpers";
import {
    DoubleUuidInputs,
    doubleUuidSchemas,
    getDoubleUuidValue,
    getLocalItemFromSourceUuid,
    PF2eInputEntry,
} from "pf2e";

abstract class BaseEffectActionNode<
    TOutputs extends Record<string, any> | never = Record<string, any>,
> extends BaseActionNode<"out", Inputs, TOutputs, never, never, "item" | "uuid"> {
    static get tags(): string[] {
        return ["effect", "item"];
    }

    static get states(): string[] {
        return ["item", "uuid"];
    }

    static get aliases(): string[] {
        return ["decrease", "increase"];
    }

    static get defineInputs(): PF2eInputEntry[] {
        return [
            { key: "target", type: "target", state: "uuid" },
            ...doubleUuidSchemas("uuid"),
            { key: "effect", type: "item", state: "item" },
            { key: "by", type: "number" },
        ];
    }

    get dynamicTitle(): string | null {
        const value = this.getLocalValue("by");
        return this.localize(
            value > 0 ? "alias.increase.title" : value < 0 ? "alias.decrease.title" : "title",
        ) as string;
    }

    get title(): string | null {
        return getLocalItemFromSourceUuid.call(this)?.name ?? this.dynamicTitle;
    }

    get subtitle(): string | null {
        return getLocalItemFromSourceUuid.call(this) ? this.dynamicTitle : super.subtitle;
    }

    async getEffect(): Promise<EffectPF2e<ActorPF2e> | null> {
        const returnEffect = (effect: EffectPF2e | null): EffectPF2e<ActorPF2e> | null => {
            return effect?.actor && !effect.pack ? (effect as EffectPF2e<ActorPF2e>) : null;
        };

        if (this.state === "item") {
            const item = await this.getInputValue("effect");
            return item?.isOfType("effect") ? returnEffect(item) : null;
        }

        const actor = (await this.getInputValue("target"))?.actor;
        if (!actor) return null;

        const uuid = await getDoubleUuidValue.call(this);
        const item = findItemWithSourceId(actor, uuid, "effect");
        return returnEffect(item);
    }
}

type Inputs = DoubleUuidInputs & {
    by: number;
    effect?: ItemPF2e;
    target?: TargetDocuments;
};

export { BaseEffectActionNode };

import { TriggerNode } from "engine";
import { ActorPF2e, ConditionKey, ConditionSlug, R, recordToSelectOptions } from "foundry-helpers";
import { PF2eInputEntry } from "pf2e";

let CONDITIONS: ConditionOptions | undefined;
let VALUED_CONDITIONS: ConditionOptions | undefined;

function getConditionOptions(): ConditionOptions {
    return (CONDITIONS ??= recordToSelectOptions(
        R.omit(CONFIG.PF2E.conditionTypes, ["persistent-damage"]),
    ) as ConditionOptions);
}

function getValuedConditions(): ConditionOptions {
    return (VALUED_CONDITIONS ??= R.filter(getConditionOptions(), ({ value }) => {
        const condition = game.pf2e.ConditionManager.conditions.get(value);
        return !!condition?.system.value.isValued;
    }));
}

function conditionsSchemas(targetIsArray: boolean = false): PF2eInputEntry[] {
    return [
        { key: "target", type: "target", isArray: targetIsArray },
        {
            key: "condition",
            type: "text",
            tooltip: false,
            field: {
                type: "select",
                options: getConditionOptions(),
            },
        },
        {
            key: "value",
            type: "number",
            field: {
                default: 1,
                min: 1,
            },
        },
    ];
}

function valuedConditionsSchemas(): PF2eInputEntry[] {
    return [
        { key: "target", type: "target" },
        {
            key: "condition",
            type: "text",
            tooltip: false,
            field: {
                type: "select",
                options: getValuedConditions(),
            },
        },
        {
            key: "value",
            type: "number",
            field: {
                default: 1,
                min: 0,
            },
        },
    ];
}

async function getConditionsData(this: TriggerNode<any, ValuedConditionsInputs>): Promise<ConditionsData | undefined> {
    const actor = (await this.getInputValue("target"))?.actor;
    if (!actor) return;

    return {
        actor,
        slug: await this.getInputValue("condition"),
        value: Math.max(await this.getInputValue("value"), 0),
    };
}

async function getValuedConditionsData(
    this: TriggerNode<any, ValuedConditionsInputs>,
): Promise<ValuedConditionsData | undefined> {
    return getConditionsData.call(this);
}

type ConditionOptions = { value: ConditionType; label: string }[];

type ConditionType = Exclude<ConditionKey, `persistent-damage-${string}`>;

type ConditionsInputs<T extends TargetDocuments | undefined | TargetDocuments[] = TargetDocuments | undefined> = {
    condition: ConditionSlug;
    target: T;
    value: number;
};

type ConditionsData = {
    actor: ActorPF2e;
    slug: ConditionSlug;
    value: number;
};

type ValuedConditionsInputs = ConditionsInputs;

type ValuedConditionsData = ConditionsData;

export { conditionsSchemas, getConditionsData, getValuedConditionsData, valuedConditionsSchemas };
export type { ConditionsInputs, ValuedConditionsInputs };

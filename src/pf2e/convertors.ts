import { EntryConvertor } from "engine";
import {
    degreeOfSuccessNumber,
    DegreeOfSuccessString,
    degreeOfSuccessString,
    getItemFromUuid,
    getItemSourceId,
    isDegreeOfSuccessValue,
    ItemPF2e,
} from "foundry-helpers";
import { OutcomeEntryType } from ".";

const pf2eConvertors = [
    {
        output: "number",
        input: "rank",
        convertToInput: (value: number): number => {
            return value;
        },
    },
    {
        output: "rank",
        input: "number",
        convertToInput: (value: number): number => {
            return value;
        },
    },
    {
        output: "number",
        input: "outcome",
        convertToInput: (value: number): DegreeOfSuccessString | undefined => {
            return degreeOfSuccessString(value);
        },
    },
    {
        output: "outcome",
        input: "number",
        convertToInput: (outcome: DegreeOfSuccessString | null): number => {
            return degreeOfSuccessNumber(outcome) ?? -1;
        },
    },
    {
        output: "outcome",
        input: "text",
        convertToInput: (outcome: OutcomeEntryType): string => {
            return outcome;
        },
    },
    {
        output: "text",
        input: "outcome",
        convertToInput: (value: string): OutcomeEntryType => {
            return isDegreeOfSuccessValue(value) ? value : "null";
        },
    },
    {
        output: "target",
        input: "text",
        convertToInput: (target: TargetDocuments): string => {
            return target.actor.signature;
        },
    },
    {
        output: "item",
        input: "text",
        convertToInput: (item: ItemPF2e | undefined): string => {
            return item ? getItemSourceId(item) : "";
        },
    },
    {
        output: "text",
        input: "item",
        convertToInput: async (uuid: string): Promise<ItemPF2e | undefined> => {
            return (await getItemFromUuid(uuid)) ?? undefined;
        },
    },
] as const satisfies EntryConvertor[];

export { pf2eConvertors };

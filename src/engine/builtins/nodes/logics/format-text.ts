import {
    BaseLogicNode,
    BuiltinsCustomEntry,
    BuiltinsInputEntry,
    BuiltinsOutputEntry,
    DescriptionInputs,
    DescriptionState,
    descriptionSchemas,
    descriptionStates,
    getDescriptionData,
} from "engine";
import { localize, R } from "foundry-helpers";

class FormatTextLogicNode extends BaseLogicNode<
    "out",
    Inputs,
    { result: string },
    "variable",
    never,
    DescriptionState
> {
    static get type(): "format-text" {
        return "format-text";
    }

    static get tags(): string[] {
        return ["text"];
    }

    static get states(): string[] {
        return descriptionStates;
    }

    static get defineInputs(): BuiltinsInputEntry[] {
        const inputs = descriptionSchemas(localize.path("builtins.shared.variables.tooltip"));
        delete inputs.at(-1)?.tooltip;
        return inputs;
    }

    static get defineOutputs(): BuiltinsOutputEntry[] {
        return [{ key: "result", type: "text" }];
    }

    static get defineCustomInputs(): BuiltinsCustomEntry[] {
        return [
            {
                slug: "variable",
                array: false,
                types: ["text"],
                input: {
                    replaceLabel: true,
                    validation: "^[a-z]+$",
                },
            },
        ];
    }

    async _execute(): Promise<boolean> {
        const { content, key, plain } = await getDescriptionData.call(this);
        const variables = await this.getCustomInputs("variable");

        if (key) {
            const data = R.pullObject(variables, R.prop("label"), R.prop("value"));
            const result = game.i18n.format(key, data);
            this.setOutputValue("result", result);
        } else {
            let result = plain ?? content ?? "";

            for (const { label, value } of variables) {
                const regex = new RegExp(`@${label}`, "gm");
                result = result.replace(regex, value);
            }

            this.setOutputValue("result", result);
        }

        return this.executeNext("out");
    }
}

type Inputs = DescriptionInputs;

export { FormatTextLogicNode };

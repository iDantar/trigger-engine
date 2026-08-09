import { BaseBooleanLogicNode } from "engine";
import { PF2eInputEntry } from "pf2e";

class MathPredicateLogicNode extends BaseBooleanLogicNode<Inputs> {
    static get type(): "match-predicate" {
        return "match-predicate";
    }

    static get defineInputs(): PF2eInputEntry[] {
        return [
            { key: "options", type: "text", isArray: true },
            {
                key: "predicate",
                type: "text",
                field: {
                    type: "json",
                    default: "[\n  \n]",
                },
            },
        ];
    }

    async _execute(): Promise<boolean> {
        const options = await this.getInputValue("options");
        const predicate = await this.getInputValue("predicate");

        let matches = false;

        try {
            const parsed = JSON.parse(predicate);
            matches = new game.pf2e.Predicate(parsed).test(options);
        } catch {}

        return this.executeNextIf(matches);
    }
}

type Inputs = {
    options: string[];
    predicate: string;
};

export { MathPredicateLogicNode };

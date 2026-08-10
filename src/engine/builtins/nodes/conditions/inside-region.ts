import { BuiltinsInputEntry } from "engine";
import { PF2eOutputEntry } from "pf2e";
import { BaseConditionNodeWithAfter } from ".";

class InsideRegionConditionNode extends BaseConditionNodeWithAfter<InsideRegionInputs, InsideRegionOutputs> {
    static get type() {
        return "inside-region";
    }

    static get tags(): string[] {
        return ["region"];
    }

    static get defineInputs(): BuiltinsInputEntry[] {
        return [
            { key: "target", type: "target" },
            { key: "name", type: "text" },
            { key: "once", type: "boolean" },
        ];
    }

    static get defineOutputs(): PF2eOutputEntry[] {
        return [...BaseConditionNodeWithAfter.defineOutputs, { key: "region", type: "region" }];
    }

    get isLoop(): boolean {
        return true;
    }

    async _execute(): Promise<boolean> {
        const target = await this.getInputValue("target");
        const token = this.getTargetToken(target);

        if (!token?.regions.size) {
            return this.excuteFalse();
        }

        const regionCallback = await this._testRegionCallback();
        const regions = token.regions.filter((region) => regionCallback(region));

        if (!regions.size) {
            return this.excuteFalse();
        }

        const once = await this.getInputValue("once");

        for (const region of regions) {
            this.setOutputValue("region", region);

            const keepExecuting = await this.execute("true");
            if (once || !keepExecuting) break;
        }

        return this.executeNext("after");
    }

    async _testRegionCallback(): Promise<(region: RegionDocument) => boolean> {
        const name = await this.getInputValue("name");

        return (region: RegionDocument) => {
            return region.name === name;
        };
    }
}

type InsideRegionInputs = {
    name: string;
    once: boolean;
    target?: TargetDocuments;
};

type InsideRegionOutputs = {
    boolean: boolean;
    region?: RegionDocument;
};

export { InsideRegionConditionNode };
export type { InsideRegionInputs };

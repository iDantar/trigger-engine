import { R, z } from "foundry-helpers";
import { zDocument, zDocumentInstance, zDocumentSource } from ".";

class zCollection<
    TParent extends zDocument = zDocument,
    TSchema extends zDocumentSource = zDocumentSource,
    TDocument extends zDocumentInstance<TSchema> = zDocumentInstance<TSchema>,
> extends Collection<string, TDocument> {
    #name: string;
    #parent: TParent;
    #document: ConstructorOf<TDocument>;

    constructor(name: string, parent: TParent, DocumentCls: ConstructorOf<TDocument>) {
        super();

        this.#name = name;
        this.#document = DocumentCls;
        this.#parent = parent;
    }

    get source(): z.input<TSchema>[] {
        return this.#parent._source[this.#name] ?? [];
    }

    _initialize() {
        const sources = this.source;
        const removed = R.difference(
            this.map((x) => x.id),
            sources.map((x) => x.id),
        );

        for (const id of removed) {
            id && this.delete(id);
        }

        for (const source of sources) {
            try {
                const exist = source.id && this.get(source.id);

                if (exist) {
                    exist._initialize();
                } else {
                    const entry = new this.#document(source);
                    super.set(entry.id, entry);
                }
            } catch (error) {}
        }
    }

    add(entry: TDocument): this {
        return this.set(entry.id, entry);
    }

    addFromSource(source: z.input<TSchema>): TDocument | undefined {
        try {
            const entry = new this.#document(source);
            this.set(entry.id, entry);
            return entry;
        } catch (error) {}
    }

    set(key: string, entry: TDocument): this {
        const sources = this.source;
        const entrySource = entry._source as z.input<TSchema>;

        if (this.has(key)) {
            sources.findSplice((entry) => entry.id === key, entrySource);
        } else {
            sources.push(entrySource);
        }

        return super.set(key, entry);
    }

    delete(key: string): boolean {
        if (!this.has(key)) return false;
        this.source.findSplice((entry) => entry.id === key);
        return super.delete(key);
    }
}

export { zCollection };

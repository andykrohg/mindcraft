import { cosineSimilarity } from './math.js';
import { stringifyTurns } from './text.js';

export class Examples {
    constructor(model, select_num=2) {
        this.examples = [];
        this.model = model;
        this.select_num = select_num;
    }

    turnsToText(turns) {
        let messages = '';
        for (let turn of turns) {
            if (turn.role !== 'assistant')
                messages += turn.content.substring(turn.content.indexOf(':')+1).trim() + '\n';
        }
        return messages.trim();
    }

    getWords(text) {
        return text.replace(/[^a-zA-Z ]/g, '').toLowerCase().split(' ');
    }

    wordOverlapScore(text1, text2) {
        const words1 = this.getWords(text1);
        const words2 = this.getWords(text2);
        const intersection = words1.filter(word => words2.includes(word));
        return intersection.length / (words1.length + words2.length - intersection.length);
    }

    async load(examples) {
        this.examples = examples;
        if (this.model !== null) {
            const embeddingPromises = this.examples.map(async (example) => {
                let turn_text = this.turnsToText(example);

                let document = {
                    pageContent: turn_text,
                    metadata: {
                        example: example
                    }
                }
                this.model.addToVectorDatabase(document);
            });
            await Promise.all(embeddingPromises);
        }
    }

    async getRelevant(turns) {
        let turn_text = this.turnsToText(turns);
        let documents = await this.model.searchVectorDatabase(turn_text);
        let selectedExamples = [];
        documents.map(doc => 
            selectedExamples.push(doc[0].metadata.example)
        );

        return JSON.parse(JSON.stringify(selectedExamples)); // deep copy
    }

    async createExampleMessage(turns) {
        let selected_examples = await this.getRelevant(turns);

        console.log('selected examples:');
        for (let example of selected_examples) {
            console.log(example[0].content)
        }

        let msg = 'Examples of how to respond:\n';
        for (let i=0; i<selected_examples.length; i++) {
            let example = selected_examples[i];
            msg += `Example ${i+1}:\n${stringifyTurns(example)}\n\n`;
        }
        return msg;
    }
}
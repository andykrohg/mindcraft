import { readFileSync, mkdirSync, writeFileSync} from 'fs';
import { Examples } from '../utils/examples.js';
import { getCommandDocs } from './commands/index.js';
import { getSkillDocs } from './library/index.js';
import { stringifyTurns } from '../utils/text.js';
import { getCommand } from './commands/index.js';

import { GPT } from '../clients/gpt.js';
import { Custom } from '../clients/custom.js';


export class Prompter {
    constructor(agent, fp) {
        this.agent = agent;
        this.profile = JSON.parse(readFileSync(fp, 'utf8'));
        this.convo_examples = null;
        this.coding_examples = null;
        let matches = process.env.HOSTNAME.matchAll(/-(.[a-z0-9]+)$/g);
        // this.name = `${process.env.USERNAME}_${matches.next().value[1]}`;
        this.name = process.env.USERNAME.slice(0, 16)

        // Initialize chat properties
        let chat = {
            modelName: process.env.CHAT_MODEL_NAME,
            server: process.env.CHAT_MODEL_SERVER,
            apiKey: process.env.CHAT_MODEL_API_KEY
        };

        let embedding = {
            modelName: process.env.EMBEDDING_MODEL_NAME,
            server: process.env.EMBEDDING_MODEL_SERVER,
            apiKey: process.env.EMBEDDING_MODEL_API_KEY
        }

        let elastic = {
            server: process.env.ELASTICSEARCH_SERVER,
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD
        }

        this.client = new Custom(chat.server, chat.modelName, chat.apiKey, embedding.server, embedding.modelName, embedding.apiKey, elastic.server, elastic.username, elastic.password);

        mkdirSync(`./bots/${this.name}`, { recursive: true });
        writeFileSync(`./bots/${this.name}/last_profile.json`, JSON.stringify(this.profile, null, 4), (err) => {
            if (err) {
                throw err;
            }
            console.log("Copy profile saved.");
        });
    }

    getName() {
        return this.name;
    }

    getInitModes() {
        return this.profile.modes;
    }

    async initExamples() {
        // Using Promise.all to implement concurrent processing
        // Create Examples instances
        this.convo_examples = new Examples(this.client);
        this.coding_examples = new Examples(this.client);
        // Use Promise.all to load examples concurrently
        await Promise.all([
            this.convo_examples.load(this.profile.conversation_examples),
            this.coding_examples.load(this.profile.coding_examples),
        ]);
    }

    async replaceStrings(prompt, messages, examples=null, prev_memory=null, to_summarize=[], last_goals=null) {
        prompt = prompt.replaceAll('$NAME', this.agent.name);

        if (prompt.includes('$STATS')) {
            let stats = await getCommand('!stats').perform(this.agent);
            prompt = prompt.replaceAll('$STATS', stats);
        }
        if (prompt.includes('$INVENTORY')) {
            let inventory = await getCommand('!inventory').perform(this.agent);
            prompt = prompt.replaceAll('$INVENTORY', inventory);
        }
        if (prompt.includes('$COMMAND_DOCS'))
            prompt = prompt.replaceAll('$COMMAND_DOCS', getCommandDocs());
        if (prompt.includes('$CODE_DOCS'))
            prompt = prompt.replaceAll('$CODE_DOCS', getSkillDocs());
        if (prompt.includes('$EXAMPLES') && examples !== null)
            prompt = prompt.replaceAll('$EXAMPLES', await examples.createExampleMessage(messages));
        if (prompt.includes('$MEMORY'))
            prompt = prompt.replaceAll('$MEMORY', prev_memory ? prev_memory : 'None.');
        if (prompt.includes('$TO_SUMMARIZE'))
            prompt = prompt.replaceAll('$TO_SUMMARIZE', stringifyTurns(to_summarize));
        if (prompt.includes('$CONVO'))
            prompt = prompt.replaceAll('$CONVO', 'Recent conversation:\n' + stringifyTurns(messages));
        if (prompt.includes('$SELF_PROMPT')) {
            let self_prompt = this.agent.self_prompter.on ? `Use this self-prompt to guide your behavior: "${this.agent.self_prompter.prompt}"\n` : '';
            prompt = prompt.replaceAll('$SELF_PROMPT', self_prompt);
        }
        if (prompt.includes('$LAST_GOALS')) {
            let goal_text = '';
            for (let goal in last_goals) {
                if (last_goals[goal])
                    goal_text += `You recently successfully completed the goal ${goal}.\n`
                else
                    goal_text += `You recently failed to complete the goal ${goal}.\n`
            }
            prompt = prompt.replaceAll('$LAST_GOALS', goal_text.trim());
        }
        if (prompt.includes('$BLUEPRINTS')) {
            if (this.agent.npc.constructions) {
                let blueprints = '';
                for (let blueprint in this.agent.npc.constructions) {
                    blueprints += blueprint + ', ';
                }
                prompt = prompt.replaceAll('$BLUEPRINTS', blueprints.slice(0, -2));
            }
        }

        // check if there are any remaining placeholders with syntax $<word>
        let remaining = prompt.match(/\$[A-Z_]+/g);
        if (remaining !== null) {
            console.warn('Unknown prompt placeholders:', remaining.join(', '));
        }
        return prompt;
    }

    async promptConvo(messages) {
        let prompt = this.profile.conversing;
        prompt = await this.replaceStrings(prompt, messages, this.convo_examples);
        return await this.client.sendRequest(messages, prompt);
    }

    async promptCoding(messages) {
        let prompt = this.profile.coding;
        prompt = await this.replaceStrings(prompt, messages, this.coding_examples);
        return await this.client.sendRequest(messages, prompt);
    }

    async promptMemSaving(prev_mem, to_summarize) {
        let prompt = this.profile.saving_memory;
        prompt = await this.replaceStrings(prompt, null, null, prev_mem, to_summarize);
        return await this.client.sendRequest([], prompt);
    }

    async promptGoalSetting(messages, last_goals) {
        let system_message = this.profile.goal_setting;
        system_message = await this.replaceStrings(system_message, messages);

        let user_message = 'Use the below info to determine what goal to target next\n\n';
        user_message += '$LAST_GOALS\n$STATS\n$INVENTORY\n$CONVO'
        user_message = await this.replaceStrings(user_message, messages, null, null, null, last_goals);
        let user_messages = [{role: 'user', content: user_message}];

        let res = await this.client.sendRequest(user_messages, system_message);

        let goal = null;
        try {
            let data = res.split('```')[1].replace('json', '').trim();
            goal = JSON.parse(data);
        } catch (err) {
            console.log('Failed to parse goal:', res, err);
        }
        if (!goal || !goal.name || !goal.quantity || isNaN(parseInt(goal.quantity))) {
            console.log('Failed to set goal:', res);
            return null;
        }
        goal.quantity = parseInt(goal.quantity);
        return goal;
    }
}

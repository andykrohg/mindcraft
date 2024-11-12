import OpenAIApi from 'openai';
import { getKey, hasKey } from '../utils/keys.js';
import {
    ElasticVectorSearch,
} from "@langchain/community/vectorstores/elasticsearch";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Client } from '@elastic/elasticsearch';

export class Custom {
    constructor(chatModelServer, chatModelName, chatModelApiKey, embeddingModelServer, embeddingModelName, embeddingModelApiKey) {
        this.chatModelServer = chatModelServer;
        this.chatModelName = chatModelName;
        this.chatModelApiKey = chatModelApiKey;
        this.embeddingModelServer = embeddingModelServer;
        this.embeddingModelName = embeddingModelName;
        this.embeddingModelApiKey = embeddingModelApiKey;

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

        this.chatClient = new OpenAIApi({
            baseURL: this.chatModelServer,
            apiKey: this.chatModelApiKey
        });

        let embeddingClient = new OpenAIEmbeddings({
            apiKey: this.embeddingModelApiKey,
            model: this.embeddingModelName,
            configuration: {
                baseURL: this.embeddingModelServer,
            }
        });

        this.elasticClient = new Client({
            node: 'https://localhost:9200',
            auth: {
                username: 'elastic',
                password: 'FPW7Z33bTu6Eax3V5L61n6I7'
            }
        });

        this.vectorStore = new ElasticVectorSearch(embeddingClient, {
            client: this.elasticClient,
            indexName: 'minecraft',
        });
    }

    async sendRequest(turns, systemMessage, stop_seq = '***') {
        let messages = [{ 'role': 'system', 'content': systemMessage }].concat(turns);

        let res = null;
        try {
            console.log('Awaiting openai api response...')
            let completion = await this.openai.chat.completions.create({
                model: this.model_name || "gpt-3.5-turbo",
                messages: messages,
                stop: stop_seq,
            });
            if (completion.choices[0].finish_reason == 'length')
                throw new Error('Context length exceeded');
            console.log('Received.')
            res = completion.choices[0].message.content;
        }
        catch (err) {
            if ((err.message == 'Context length exceeded' || err.code == 'context_length_exceeded') && turns.length > 1) {
                console.log('Context length exceeded, trying again with shorter context.');
                return await sendRequest(turns.slice(1), systemMessage, stop_seq);
            } else {
                console.log(err);
                res = 'My brain disconnected, try again.';
            }
        }
        return res;
    }

    async addToVectorDatabase(document) {
        let ids = await this.vectorStore.addDocuments([document]);

        console.log(ids);
    }

    async searchVectorDatabase(query) {
        const similaritySearchResults = await this.vectorStore.similaritySearchWithScore(query, 2);
        return similaritySearchResults;
    }
}




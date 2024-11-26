import OpenAIApi from 'openai';
import {
    ElasticVectorSearch,
} from "@langchain/community/vectorstores/elasticsearch";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Client } from '@elastic/elasticsearch';
import  crypto  from 'crypto';

export class Custom {
    constructor(chatModelServer, chatModelName, chatModelApiKey, embeddingModelServer, embeddingModelName, embeddingModelApiKey, elasticServer, elasticUsername, elasticPassword) {
        this.chatModelServer = chatModelServer;
        this.chatModelName = chatModelName;
        this.chatModelApiKey = chatModelApiKey;
        this.embeddingModelServer = embeddingModelServer;
        this.embeddingModelName = embeddingModelName;
        this.embeddingModelApiKey = embeddingModelApiKey;

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
            node: elasticServer,
            auth: {
                username: elasticUsername,
                password: elasticPassword
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
            let completion = await this.chatClient.chat.completions.create({
                model: this.chatModelName,
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
        let id = crypto.createHash('md5').update(document.pageContent).digest('hex');
        this.vectorStore.addDocuments([document],{ids:[id]});
    }

    async searchVectorDatabase(query, filter) {
        const similaritySearchResults = await this.vectorStore.similaritySearchWithScore(query, 2, filter);
        return similaritySearchResults;
    }
}




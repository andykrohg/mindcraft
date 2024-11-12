import OpenAIApi from 'openai';
import { getKey, hasKey } from '../utils/keys.js';
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { Client } from '@elastic/elasticsearch';

export class VLLM {
    constructor(model_name, url, apiKey) {
        this.model_name = model_name;

        let config = {};
        if (url)
            config.baseURL = url;

        config.apiKey = apiKey;

        this.openai = new OpenAIApi(config);
    }

    async sendRequest(turns, systemMessage, stop_seq='***') {

        let messages = [{'role': 'system', 'content': systemMessage}].concat(turns);

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

    async embed(text) {
        const embeddings = new HuggingFaceInferenceEmbeddings({
            apiKey: "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", // In Node.js defaults to process.env.HUGGINGFACEHUB_API_KEY
        });    
        const embedding = await embeddings.embedQuery(text);

        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

        const client = new Client({
            node: 'https://localhost:9200',
            auth: {
                username: 'elastic',
                password: 'FPW7Z33bTu6Eax3V5L61n6I7'
            },
            ssl: {
                rejectUnauthorized: false
            }
        })
        // await client.index({
        //     index: 'minecraft-stuff',
        //     id: '1',
        //     document: {}
        //   })
        //   await client.update({
        //     index: 'game-of-thrones',
        //     id: '1',
        //     script: {
        //       lang: 'painless',
        //       source: 'ctx._source.times++'
        //       // you can also use parameters
        //       // source: 'ctx._source.times += params.count',
        //       // params: { count: 1 }
        //     }
        //   })
        
          const document = await client.get({
            index: 'game-of-thrones',
            id: '1'
          })
        
          console.log(document)
        return embedding;
    }
}




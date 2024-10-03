FROM registry.access.redhat.com/ubi8/nodejs-18:1-127

COPY . /app
WORKDIR /app
USER root
RUN npm install

ENV MINECRAFT_SERVER_HOST=localhost \ 
    MINECRAFT_SERVER_PORT=8080 \
    MODEL_SERVER_ENDPOINT=http://openshift.com:8080 \
    PROFILE=llama
    
ENTRYPOINT ["npm", "start"]

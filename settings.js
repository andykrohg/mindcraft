export default 
{
    "minecraft_version": process.env.MINECRAFT_SERVER_VERSION || "1.20.4", // supports up to 1.20.4
    "host": process.env.MINECRAFT_SERVER_HOST || "localhost", //minecraft server host 
    "port": process.env.MINECRAFT_SERVER_PORT || 8080, //minecraft server port
    "auth": "offline", // or "microsoft"
    "demogorgon": true, // enable demogorgon mode
    
    "profiles": [
        `./profiles/${process.env.PROFILE || "demojam"}.json`,
        // add more profiles here, check ./profiles/ for more
        // more than 1 profile will require you to /msg each bot indivually
    ],
    "load_memory": false, // load memory from previous session
    "init_message": "Say hello world and your name", // sends to all on spawn

    "allow_insecure_coding": true, // allows newAction command and model can write/run code on your computer. enable at own risk
    "code_timeout_mins": 10, // minutes code is allowed to run. -1 for no timeout
    
    "max_commands": -1, // max number of commands to use in a response. -1 for no limit
    "verbose_commands": false, // show full command syntax
    "narrate_behavior": true, // chat simple automatic actions ('Picking up item!')
}
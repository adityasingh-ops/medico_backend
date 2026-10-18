declare global {
    namespace NodeJS {
        interface ProcessEnv {
            MONGODB_URI: string;
            PORT: string;
            JWT_SECRET: string;
            NODE_ENV: 'development' | 'production';
            CLIENT_URL: string;
            ANTHROPIC_API_KEY: string;
        }
    }
}

export { };
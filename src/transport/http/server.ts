import Fastify, {FastifyInstance} from "fastify";
import cors from '@fastify/cors';
import { staticRoutes } from './routes/static.js';
import { Config } from '../../config/env.js';


export function newServer(cfg: Config): FastifyInstance {
    const app = Fastify({logger: true});

    app.register(cors, {
        origin: cfg.minio.allowedOrigins,   // CORS DOMAIN = minio cors, yeah for this project, they are same...
        credentials: true
    })

    app.register(staticRoutes);
    return app
}
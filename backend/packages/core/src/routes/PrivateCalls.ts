import { q } from "../db.js";
import type { FastifyInstance } from "fastify";

// Error Code Syntax for future ref:
// 421: Missing caller paramter
// 422: Missing callid Paramater


export async function CallRoutes(app: FastifyInstance) { 

    app.post("/call/get_status",  { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
        const userId = req.user.sub as string;
        const body = req.body;
        
        const caller = req.body.caller;

        const call_id = req.body.callid;

        if (!caller) {
            return rep.send({'error': true, 'code': 421} )
        }
        if (!call_id) {
            return rep.send({'error': true, 'code': 422} )
        }

    });
}
import { q } from "../db.js";
import type { FastifyInstance } from "fastify";
import { ulidLike } from "@ods/shared/ids.js";

// Error Code Syntax for future ref:
// 420: Database Error
// 421: Missing caller paramter
// 422: Missing callid Paramater
// 509: Not friends with person trying to call


export async function CallRoutes(app: FastifyInstance,   broadcastToUser?: (targetUserId: string, t: string, d: any) => Promise<void>) {

    app.post("/call/get_status",  { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
        const userId = req.user.sub as string;
        const body = req.body;

        const caller = req.body.caller;

        const call_id = req.body.callid;

        const status = false

        if (!caller) {
            return rep.send({'error': true, 'code': 421} )
        }
        if (!call_id) {
            return rep.send({'error': true, 'code': 422} )
        }

        // Preety simple db handalling should probably improve later
        const existing = await q<{ status: boolean }>(
            `SELECT status FROM private_calls WHERE caller=$1 AND call_id=$2`,
            [caller, call_id]
        );
        // this might make up for it, is good enough for right now
        if (existing.length) {
            const status = existing[0].status;
            return rep.send({'success': true, 'status': status})
        } else {
            return rep.send({'success': false, 'error': true, 'code': 420})
        }

    });

  app.post("/call/by_id", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const body = req.body

    const target_id = body.id
    const userId = req.user.sub as string;


    if (!userId) {
      return rep.send({'success': false, 'error': true, 'code': 512})
    }
    if (!target_id) {
      return rep.send({'success': false, 'error': true, 'code': 510})
    }
    const rows = await q<{ id: string; username: string; display_name: string | null; pfp_url: string | null; status: string }>(
      `SELECT u.id, u.username, u.display_name, u.pfp_url, COALESCE(p.status, 'offline') AS status
       FROM friendships f
       JOIN users u ON u.id=f.friend_user_id
       LEFT JOIN presence p ON p.user_id=u.id
       WHERE f.user_id=:userId
       ORDER BY f.created_at DESC`,
      { userId }
    );
    const targetExists = rows.some(row => row.id === target_id);

    if (!targetExists) {
      return rep.send({'success': false, 'error': true, 'code': 509})
    };
    let thread = await q<{ id: string; user_a: string; user_b: string }>(
      `SELECT id,user_a,user_b
       FROM social_dm_threads
       WHERE (user_a=:userId AND user_b=:targetId)
          OR (user_a=:targetId AND user_b=:userId)
       LIMIT 1`,
      { userId, targetId: target_id }
    );
    if (!thread.length) {
      const newThreadId = ulidLike();

      await q(
        `INSERT INTO social_dm_threads (id,user_a,user_b,last_message_at)
         VALUES (:id,:userA,:userB,NOW())`,
        { id: newThreadId, userA: userId, userB: target_id }
      );

      thread = [{ id: newThreadId, user_a: userId, user_b: target_id }];
    }
    const messageId = ulidLike();
    const content = "__CALL_REQUEST__"; // Will need to add frontend parsing

    await q(
      `INSERT INTO social_dm_messages (id,thread_id,sender_user_id,content)
       VALUES (:id,:threadId,:userId,:content)`,
      {
        id: messageId,
        threadId: thread[0].id,
        userId,
        content
      }
    );

    await q(
      `UPDATE social_dm_threads
       SET last_message_at=NOW()
       WHERE id=:threadId`,
      { threadId: thread[0].id }
    );
    if (broadcastToUser) {
      const createdAt = new Date().toISOString();

      const payload = {
        threadId: thread[0].id,
        message: {
          id: messageId,
          authorId: userId,
          content,
          createdAt,
          attachments: []
        }
      };

      await broadcastToUser(userId, "SOCIAL_DM_MESSAGE_CREATE", payload);
      await broadcastToUser(target_id, "SOCIAL_DM_MESSAGE_CREATE", payload);

      // Add thing to gen the call_id for the frontend to parse and join.

      const call_id = ""

      return rep.send({'success': true, 'message': 'Successfully created call request', 'call_id': call_id})
    }
  });
}

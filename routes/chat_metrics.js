import express from 'express';
import { supabase } from '../utils/supabaseAdmin.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { userId, agentId, range } = req.query;
  console.log('🔍 GET chat_metrics for', { userId, agentId, range });
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  let fromDate = null;
  if (range === '7d') fromDate = new Date(Date.now() - 7 * 86400000);
  else if (range === '30d') fromDate = new Date(Date.now() - 30 * 86400000);

  let query = supabase.from('chat_metrics').select('date, total_messages, satisfaction_score, avg_response_time_ms, positive, neutral, negative')
    .eq('user_id', userId);
  if (agentId) query = query.eq('agent_id', agentId);
  if (fromDate) query = query.gte('date', fromDate.toISOString());

  const { data, error } = await query.order('date', { ascending: true });
  if (error) {
	console.log('📈 chat_metrics returned', data?.length, 'rows');
    console.error('❌ Supabase query error:', error);
    return res.status(500).json({ error });
  }
  res.json({ data });
});

export default router;

import express from 'express';
import { supabase } from '../utils/supabaseAdmin.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { userId, agentId, start_date, end_date } = req.query;

  console.log('🔍 GET sentiments for', { userId, agentId, start_date, end_date });

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  let query = supabase
    .from('chat_sentiments')
    .select('created_at, message, sentiment_score, sentiment_label')
    .eq('user_id', userId);

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }

  // Apply optional date filtering
  if (start_date && end_date) {
    query = query
      .gte('created_at', `${start_date}T00:00:00.000Z`)
      .lte('created_at', `${end_date}T23:59:59.999Z`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Supabase error:', error);
    return res.status(500).json({ error: 'Failed to fetch sentiments' });
  }

  console.log('📦 Sentiments returned:', data.length);
  res.json({ data });
});

export default router;

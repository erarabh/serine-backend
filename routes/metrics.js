import express from 'express';
import { supabase } from '../utils/supabaseAdmin.js';
const router = express.Router();

router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const { data, error } = await supabase
    .from('chat_metrics')
    .select('timestamp, duration_ms, lang')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true })
    .limit(500);
  if (error) return res.status(500).json({ error });
  res.json({ data });
});

export default router;

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Verify World ID and check redemption status
app.post('/api/auth/verify-world-id', async (req, res) => {
  const { worldIdHash, campaignId } = req.body;
  try {
    const existingRedemption = await pool.query(
      'SELECT * FROM redemptions WHERE world_id_hash = $1 AND campaign_id = $2',
      [worldIdHash, campaignId]
    );

    if (existingRedemption.rows.length > 0) {
      return res.status(400).json({ message: 'Already redeemed in this campaign' });
    }

    res.status(200).json({ message: 'Eligible for redemption' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await pool.query('SELECT * FROM campaigns WHERE NOW() BETWEEN start_date AND end_date');
    res.status(200).json(campaigns.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add new campaign (Admin Only)
app.post('/api/campaigns', async (req, res) => {
  const { name, itemName, startDate, endDate } = req.body;
  try {
    await pool.query(
      'INSERT INTO campaigns (name, item_name, start_date, end_date) VALUES ($1, $2, $3, $4)',
      [name, itemName, startDate, endDate]
    );
    res.status(201).json({ message: 'Campaign added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Redeem item
app.post('/api/redeem', async (req, res) => {
  const { worldIdHash, campaignId } = req.body;
  try {
    const existingRedemption = await pool.query(
      'SELECT * FROM redemptions WHERE world_id_hash = $1 AND campaign_id = $2',
      [worldIdHash, campaignId]
    );

    if (existingRedemption.rows.length > 0) {
      return res.status(400).json({ message: 'Already redeemed in this campaign' });
    }

    await pool.query(
      'INSERT INTO redemptions (world_id_hash, campaign_id) VALUES ($1, $2)',
      [worldIdHash, campaignId]
    );

    res.status(201).json({ message: 'Redemption successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

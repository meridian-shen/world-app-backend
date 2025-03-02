import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;
import IDKit from '@worldcoin/idkit-standalone';

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

// Initialize IDKit for World ID verification
const idKit = new IDKit({
  app_id: process.env.WORLD_ID_APP_ID,
  action: 'redeem_campaign'
});

// Vendor login using World ID
app.post('/api/vendors/login', async (req, res) => {
  const { verificationResponse } = req.body;
  try {
    const isValid = await idKit.verify(verificationResponse);
    if (!isValid.success) {
      return res.status(400).json({ message: 'Invalid World ID proof' });
    }

    const nullifierHash = isValid.nullifier_hash;
    const existingVendor = await pool.query('SELECT * FROM vendors WHERE world_id_hash = $1', [nullifierHash]);
    if (existingVendor.rows.length > 0) {
      return res.status(200).json({ message: 'Vendor authenticated', vendorId: existingVendor.rows[0].id });
    }

    const newVendor = await pool.query('INSERT INTO vendors (world_id_hash) VALUES ($1) RETURNING id', [nullifierHash]);
    res.status(201).json({ message: 'Vendor registered', vendorId: newVendor.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Redeem an item using World ID
app.post('/api/redeem', async (req, res) => {
  const { verificationResponse, campaignId, itemId } = req.body;
  try {
    const isValid = await idKit.verify(verificationResponse);
    if (!isValid.success) {
      return res.status(400).json({ message: 'Invalid World ID proof' });
    }

    const nullifierHash = isValid.nullifier_hash;
    const existingRedemption = await pool.query(
      'SELECT * FROM redemptions WHERE world_id_hash = $1 AND campaign_id = $2',
      [nullifierHash, campaignId]
    );

    if (existingRedemption.rows.length > 0) {
      return res.status(400).json({ message: 'Already redeemed in this campaign' });
    }

    await pool.query(
      'INSERT INTO redemptions (world_id_hash, campaign_id, item_id) VALUES ($1, $2, $3)',
      [nullifierHash, campaignId, itemId]
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

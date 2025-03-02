import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { WorldID } from '@worldcoin/id';

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

// Initialize World ID verifier
const worldID = new WorldID({
  appId: process.env.WORLD_ID_APP_ID, // Your World ID app ID
  actionName: 'vendor_login',
  signal: null,
});

// Vendor login using World ID
app.post('/api/vendors/login', async (req, res) => {
  const { worldIdProof, merkleRoot, nullifierHash, verificationResponse } = req.body;
  try {
    // Verify World ID proof
    const isValid = await worldID.verifyProof({
      merkle_root: merkleRoot,
      nullifier_hash: nullifierHash,
      proof: worldIdProof,
      verification_response: verificationResponse,
    });

    if (!isValid.success) {
      return res.status(400).json({ message: 'Invalid World ID proof' });
    }

    // Check if vendor exists
    const existingVendor = await pool.query('SELECT * FROM vendors WHERE world_id_hash = $1', [nullifierHash]);
    if (existingVendor.rows.length > 0) {
      return res.status(200).json({ message: 'Vendor authenticated', vendorId: existingVendor.rows[0].id });
    }

    // Create new vendor
    const newVendor = await pool.query('INSERT INTO vendors (world_id_hash) VALUES ($1) RETURNING id', [nullifierHash]);
    res.status(201).json({ message: 'Vendor registered', vendorId: newVendor.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all vendors
app.get('/api/vendors', async (req, res) => {
  try {
    const vendors = await pool.query('SELECT * FROM vendors');
    res.status(200).json(vendors.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a campaign
app.post('/api/campaigns', async (req, res) => {
  const { vendorId, name, startDate, endDate } = req.body;
  try {
    await pool.query(
      'INSERT INTO campaigns (vendor_id, name, start_date, end_date) VALUES ($1, $2, $3, $4)',
      [vendorId, name, startDate, endDate]
    );
    res.status(201).json({ message: 'Campaign created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await pool.query('SELECT * FROM campaigns');
    res.status(200).json(campaigns.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add an item to a campaign
app.post('/api/items', async (req, res) => {
  const { campaignId, name } = req.body;
  try {
    await pool.query('INSERT INTO items (campaign_id, name) VALUES ($1, $2)', [campaignId, name]);
    res.status(201).json({ message: 'Item added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get items for a campaign
app.get('/api/items/:campaignId', async (req, res) => {
  const { campaignId } = req.params;
  try {
    const items = await pool.query('SELECT * FROM items WHERE campaign_id = $1', [campaignId]);
    res.status(200).json(items.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Redeem an item using World ID
app.post('/api/redeem', async (req, res) => {
  const { worldIdProof, merkleRoot, nullifierHash, verificationResponse, campaignId, itemId } = req.body;
  try {
    // Verify World ID proof
    const isValid = await worldID.verifyProof({
      merkle_root: merkleRoot,
      nullifier_hash: nullifierHash,
      proof: worldIdProof,
      verification_response: verificationResponse,
    });

    if (!isValid.success) {
      return res.status(400).json({ message: 'Invalid World ID proof' });
    }

    // Check if already redeemed
    const existingRedemption = await pool.query(
      'SELECT * FROM redemptions WHERE world_id_hash = $1 AND campaign_id = $2',
      [nullifierHash, campaignId]
    );

    if (existingRedemption.rows.length > 0) {
      return res.status(400).json({ message: 'Already redeemed in this campaign' });
    }

    // Log redemption
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

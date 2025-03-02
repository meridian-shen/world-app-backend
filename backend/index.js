import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ✅ Vendor Login (Receives `nullifier_hash` from Frontend)
app.post("/api/vendors/login", async (req, res) => {
  const { nullifier_hash } = req.body; // Received from frontend

  try {
    // Check if vendor exists
    const existingVendor = await pool.query(
      "SELECT * FROM vendors WHERE world_id_hash = $1",
      [nullifier_hash]
    );

    if (existingVendor.rows.length > 0) {
      return res.status(200).json({ message: "Vendor authenticated", vendorId: existingVendor.rows[0].id });
    }

    // Register vendor
    const newVendor = await pool.query(
      "INSERT INTO vendors (world_id_hash) VALUES ($1) RETURNING id",
      [nullifier_hash]
    );

    res.status(201).json({ message: "Vendor registered", vendorId: newVendor.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Redemption Endpoint (Checks if Already Redeemed)
app.post("/api/redeem", async (req, res) => {
  const { nullifier_hash, campaignId, itemId } = req.body; // Received from frontend

  try {
    // Check if already redeemed
    const existingRedemption = await pool.query(
      "SELECT * FROM redemptions WHERE world_id_hash = $1 AND campaign_id = $2",
      [nullifier_hash, campaignId]
    );

    if (existingRedemption.rows.length > 0) {
      return res.status(400).json({ message: "Already redeemed in this campaign" });
    }

    // Log redemption
    await pool.query(
      "INSERT INTO redemptions (world_id_hash, campaign_id, item_id) VALUES ($1, $2, $3)",
      [nullifier_hash, campaignId, itemId]
    );

    res.status(201).json({ message: "Redemption successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
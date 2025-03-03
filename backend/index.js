import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = "https://okoagzrvuxozbqximeri.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Fetch all campaigns from Supabase
app.get("/api/campaigns", async (req, res) => {
  try {
    const { data, error } = await supabase.from("campaigns").select("*");
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Vendor Login (Receives `nullifier_hash` from Frontend)
app.post("/api/vendors/login", async (req, res) => {
  const { nullifier_hash } = req.body;

  try {
    const { data: existingVendor, error: findError } = await supabase
      .from("vendors")
      .select("*")
      .eq("world_id_hash", nullifier_hash)
      .single();

    if (findError && findError.code !== "PGRST116") throw findError;

    if (existingVendor) {
      return res.status(200).json({ message: "Vendor authenticated", vendorId: existingVendor.id });
    }

    const { data: newVendor, error: insertError } = await supabase
      .from("vendors")
      .insert([{ world_id_hash: nullifier_hash }])
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json({ message: "Vendor registered", vendorId: newVendor.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Redemption Endpoint (Checks if Already Redeemed)
app.post("/api/redeem", async (req, res) => {
  const { nullifier_hash, campaignId, itemId } = req.body;

  try {
    const { data: existingRedemption, error: checkError } = await supabase
      .from("redemptions")
      .select("*")
      .eq("world_id_hash", nullifier_hash)
      .eq("campaign_id", campaignId)
      .single();

    if (checkError && checkError.code !== "PGRST116") throw checkError;

    if (existingRedemption) {
      return res.status(400).json({ message: "Already redeemed in this campaign" });
    }

    const { data: newRedemption, error: insertError } = await supabase
      .from("redemptions")
      .insert([{ world_id_hash: nullifier_hash, campaign_id: campaignId, item_id: itemId }])
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json({ message: "Redemption successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

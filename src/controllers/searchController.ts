import { Medicine } from "../models/Product";
import { Store } from "../models/Store";
import { Request, Response } from "express";
const express = require("express");

export class searchController {
     async search(req: Request, res: Response) {
        try {
            // Accept the common aliases so the endpoint isn't sensitive to which
            // param name the caller uses.
            const query = req.query.query || req.query.q || req.query.search;

            if (!query) {
                return res.status(400).json({ message: "Search query is required" });
            }
    
            const regex = new RegExp(query.toString(), "i"); // Case-insensitive search
    
            // Find products and shops that match the query
            const products = await Medicine.find({ name: regex }).limit(10);
            const shops = await Store.find({ name: regex }).limit(10);
    
            res.json({ products, shops });
        } catch (error) {
            console.error("Search Error:", error);
            res.status(500).json({ message: "Server error" });
        }
    }

}
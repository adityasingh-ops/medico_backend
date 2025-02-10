import { Schema } from "mongoose";

const categorySchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    backgroundImage: String,
    image: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });
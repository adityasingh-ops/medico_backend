import { Router } from "express";
import { searchController } from "../controllers/searchController";

const router = Router();
const controller = new searchController();

router.get("/", controller.search);

export default router;
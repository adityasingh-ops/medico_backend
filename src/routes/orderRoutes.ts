import { OrderController } from "../controllers/orderController";
import { authenticateUser } from "../middleware/authMiddleware";

const express = require('express');
const router = express.Router();

const controller = new OrderController();

router.post('/',authenticateUser, controller.createOrder);
router.get('/',authenticateUser, controller.getUserOrders);
router.get('/order/:id',authenticateUser, controller.getOrderById);
router.put('/order/:orderId',authenticateUser, controller.updateOrderStatus);

export default router;


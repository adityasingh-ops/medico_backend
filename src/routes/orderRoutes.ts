import { OrderController } from "../controllers/orderController";
import { authenticateUser } from "../middleware/authMiddleware";

const express = require('express');
const router = express.Router();

const controller = new OrderController();

router.get('/store/:storeId',controller.getStoreOrders);
router.get('/store/orderDetail/:id',controller.getOrderById);
router.post('/',authenticateUser, controller.createOrder);
router.get('/',authenticateUser, controller.getUserOrders);
router.get('/order/:id',authenticateUser, controller.getOrderById);
router.put('/order/:orderId',authenticateUser, controller.updateOrderStatus);

export default router;


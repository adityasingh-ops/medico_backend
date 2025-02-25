import { OrderController } from "../controllers/orderController";

const express = require('express');
const router = express.Router();

const controller = new OrderController();

router.post('/', controller.createOrder);
router.get('/:userId', controller.getUserOrders);
router.get('/order/:orderId', controller.getOrderById);
router.put('/order/:orderId', controller.updateOrderStatus);

export default router;


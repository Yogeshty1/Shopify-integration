const express = require("express");
const axios = require("axios");
const multer = require("multer");
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const SHOP = process.env.SHOP;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

router.post("/create-draft-order", upload.array('images[]', 5), async (req, res) => {
    const { product, size, custom_size, notes, name, email, phone, address } = req.body;

    //this is  for file name 
    const uploadedImages = req.files ? req.files.map(f => f.originalname) : [];

    let lineItem = {
        variant_id: product,
        quantity: 1,
        properties: [
            { name: "Size", value: size },
            { name: "Custom Size", value: custom_size || "" },
            { name: "Additional Requirements", value: notes || "" },
            { name: "Reference Image", value: uploadedImages.join(", ") || "" }
        ]
    };
    // FOR CUSTOMER DETAIL
    const customerDetails = `
                    Customer: ${name}
                    Email: ${email}
                    Phone: ${phone}
                    Address: ${address}
                    ${notes}`;

    const draftOrderPayload = {
        draft_order: {
            line_items: [lineItem],
            email: email,
            customer: {
                first_name: name,
                last_name: name,
                email: email
            },
            billing_address: {
                first_name: name,
                last_name: name,
                address1: address,
                phone: phone
            },
            shipping_address: {
                first_name: name,
                last_name: name,
                address1: address,
                phone: phone
            },
            note: customerDetails
        }
    };

    const response = await axios.post(`https://${SHOP}/admin/api/2024-07/draft_orders.json`,
        draftOrderPayload,
        {
            headers: {
                "X-Shopify-Access-Token": ACCESS_TOKEN,
                "Content-Type": "application/json"
            }
        }
    );

    const draftOrderId = response.data.draft_order.id;

    const invoiceResponse = await axios.post(`https://${SHOP}/admin/api/2024-07/draft_orders/${draftOrderId}/send_invoice.json`,
        {
            draft_order_invoice: {
                to: email,
                subject: "Your Custom Order Invoice",
                custom_message: `Hi ${name},\n\nThank you for your custom order!!`
            }
        },
        {
            headers: {
                "X-Shopify-Access-Token": ACCESS_TOKEN,
                "Content-Type": "application/json"
            }
        }
    );

    res.status(201).json({
        success: true,
        draftOrder: response.data.draft_order,
        invoice: invoiceResponse.data.draft_order_invoice
    });
});

module.exports = router;




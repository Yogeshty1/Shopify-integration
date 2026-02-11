const express = require("express");
const axios = require("axios");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const SHOP = process.env.SHOP;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

//  to upload file to Cloudinary
async function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        // Create upload stream
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "shopify-orders", // Organize images in a folder
                resource_type: "auto", // Automatically detect file type
                public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}` // Unique filename
            },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary upload error:", error);
                    reject(error);
                } else {
                    resolve(result.secure_url);
                }
            }
        );

        // Write buffer to stream
        uploadStream.end(file.buffer);
    });
}

router.post("/create-draft-order", upload.array('images[]', 5), async (req, res) => {
    const { product, size, custom_size, notes, name, email, phone, address } = req.body;

    // Upload images to Cloudinary and get URLs
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map(file => uploadToCloudinary(file));
        imageUrls = await Promise.all(uploadPromises);
    }

    let lineItem = {
        variant_id: product,
        quantity: 1,
        properties: [
            { name: "Size", value: size },
            { name: "Custom Size", value: custom_size || "" },
            { name: "Additional Requirements", value: notes || "" },
            { name: "Reference Image URLs", value: imageUrls.join(", ") || "No images uploaded" }
        ]
    };

    // FOR CUSTOMER DETAIL
    const customerDetails = `
                    Customer: ${name}
                    Email: ${email}
                    Phone: ${phone}
                    Address: ${address}
                    ${notes}
                    
                    Reference Images:
                    ${imageUrls.length > 0 ? imageUrls.map((url, i) => `Image ${i + 1}: ${url}`).join('\n                    ') : 'No images uploaded'}`;

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
        invoice: invoiceResponse.data.draft_order_invoice,
        uploadedImages: imageUrls
    });
});

module.exports = router;

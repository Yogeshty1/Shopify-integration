const express = require('express');
const cors = require('cors');
const path = require('path');
const envPath = path.resolve(__dirname, '.env');

require('dotenv').config({ path: envPath });

const draftOrderRoutes = require('./controllers/Draft_order.js');



const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send("Shopify App Server Running");
});

app.use('/api', draftOrderRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

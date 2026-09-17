const mongoose = require('mongoose');

// MongoDB is used for the product catalog because product attributes vary
// wildly across categories (a t-shirt has size/color, a laptop has RAM/CPU),
// so a flexible/document schema avoids constant relational migrations, and
// catalog reads/writes scale horizontally well as the catalog grows.
async function connect() {
  const uri = process.env.MONGO_URI || 'mongodb://mongodb:27017/productdb';
  await mongoose.connect(uri);
}

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: String,
  attributes: mongoose.Schema.Types.Mixed,
  stock: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Product = mongoose.model('Product', productSchema);

module.exports = { connect, Product };

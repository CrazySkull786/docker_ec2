// server.js
// Express + MySQL CRUD API for the `products` table (with CORS + rate limiting)
//
// Setup:
//   npm init -y
//   npm install express mysql2 cors express-rate-limit
//   node server.js

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Rate Limiting ----------
// Global limiter – protects all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // max 100 requests per IP per window
  standardHeaders: true,    // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests, please try again later." },
});

// Stricter limiter for write operations (POST / PUT / DELETE)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                  // max 30 write requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many write requests, please try again later." },
});

// ---------- Middleware ----------
app.use(cors()); // allow requests from any origin (restrict this in production)
app.use(express.json());
app.use(globalLimiter); // apply global rate limiting to every route

// ---------- MySQL connection pool ----------
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "bakeshop",
  waitForConnections: true,
  connectionLimit: 10,
});

// Create the table on startup if it doesn't exist yet
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      product_id INT PRIMARY KEY AUTO_INCREMENT,
      name       VARCHAR(100) NOT NULL,
      category   VARCHAR(50),
      price      DECIMAL(6,2) NOT NULL,
      stock      INT DEFAULT 0
    )
  `);
}

// Simple input check used by create and update
function validateProduct(body) {
  const { name, price, stock } = body;
  if (!name || typeof name !== "string") return "name is required";
  if (price === undefined || isNaN(Number(price)) || Number(price) < 0)
    return "price must be a non-negative number";
  if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0))
    return "stock must be a non-negative integer";
  return null;
}

// ---------- Routes ----------

// CREATE  -> POST /products
app.post("/products", writeLimiter, async (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ error });

  const { name, category = null, price, stock = 0 } = req.body;
  try {
    const [result] = await pool.execute(
      "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
      [name, category, price, stock]
    );
    res.status(201).json({ product_id: result.insertId, name, category, price, stock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// READ ALL  -> GET /products
app.get("/products", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM products ORDER BY product_id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// READ ONE  -> GET /products/:id
app.get("/products/:id", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM products WHERE product_id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// UPDATE  -> PUT /products/:id
app.put("/products/:id", writeLimiter, async (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ error });

  const { name, category = null, price, stock = 0 } = req.body;
  try {
    const [result] = await pool.execute(
      "UPDATE products SET name = ?, category = ?, price = ?, stock = ? WHERE product_id = ?",
      [name, category, price, stock, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ product_id: Number(req.params.id), name, category, price, stock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE  -> DELETE /products/:id
app.delete("/products/:id", writeLimiter, async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM products WHERE product_id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Fallback for unknown routes
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ---------- Start server ----------
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Could not connect to MySQL:", err.message);
    process.exit(1);
  });
CREATE TABLE IF NOT EXISTS products (
    product_id INT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    category   VARCHAR(50),
    price      DECIMAL(6,2) NOT NULL,
    stock      INT DEFAULT 0
);

INSERT INTO products (name, category, price, stock) VALUES
('Country Sourdough',       'Bread',  8.00, 20),
('Butter Croissant',        'Pastry', 4.50, 40),
('Vanilla Bean Layer Cake', 'Cake',   6.00, 15),
('Strawberry Custard Tart', 'Tart',   6.50, 12),
('Brown Butter Cookie',     'Cookie', 3.50, 60);

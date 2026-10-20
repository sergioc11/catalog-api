const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = '/catalog-management/v1';   // Ruta base versionada: dominio + versión

app.use(cors());
app.use(express.json());

// ===== OPCIÓN A: datos en un arreglo (comenta este bloque para usar la OPCIÓN B) =====
let categories = [
    { id: 1, name: 'Tecnología' },
    { id: 2, name: 'Hogar' },
    { id: 3, name: 'Ropa' }
];

let products = [
    { id: 1, name: 'Teclado', price: 50, stock: 10, categoryId: 1 },
    { id: 2, name: 'Ratón', price: 20, stock: 15, categoryId: 1 },
    { id: 3, name: 'Licuadora', price: 80, stock: 5, categoryId: 2 },
    { id: 4, name: 'Camiseta', price: 15, stock: 30, categoryId: 3 }
];

// ===== OPCIÓN B: datos desde data.json (descomenta estas 3 líneas y comenta la OPCIÓN A) =====
// const data = require('./data.json');
// let categories = data.categories;
// let products = data.products;

let nextId = Math.max(...products.map(p => p.id)) + 1;

// ---------- Respuesta estándar ----------
// Todas las respuestas tienen la misma forma: { success, message, data, error, errors }
const successResponse = (message, data = null) => ({ success: true, message, data, error: false, errors: [] });
const errorResponse = (message, errors = []) => ({ success: false, message, data: null, error: true, errors });

// ---------- Endpoints ----------
// Todas las rutas cuelgan de BASE_PATH (ver app.use más abajo)
const router = express.Router();

// GET /categories -> 200
router.get('/categories', (req, res) => {
    res.status(200).json(successResponse('La consulta de categorías fue exitosa', categories));
});

// GET /products?categoryId=1&name=tec -> 200 (filtros opcionales; una lista vacía también es 200)
router.get('/products', (req, res) => {
    const { categoryId, name } = req.query;
    let result = products;
    if (categoryId) result = result.filter(p => p.categoryId === Number(categoryId));
    if (name) result = result.filter(p => p.name.toLowerCase().includes(String(name).toLowerCase()));

    const message = result.length
        ? 'La consulta al catálogo de productos fue exitosa'
        : 'No se encontraron productos con los filtros enviados';
    res.status(200).json(successResponse(message, result));
});

// GET /products/:id -> 200 | 404
router.get('/products/:id', (req, res) => {
    const product = products.find(p => p.id === Number(req.params.id));
    if (!product) {
        return res.status(404).json(errorResponse(`No existe un producto con id ${req.params.id}`));
    }
    res.status(200).json(successResponse('Producto encontrado', product));
});

// POST /products -> 201 | 400
router.post('/products', (req, res) => {
    const { name, price, stock, categoryId } = req.body ?? {};
    const errors = [];
    if (!name) errors.push('El campo name es obligatorio');
    if (price == null) errors.push('El campo price es obligatorio');
    if (!categoryId) errors.push('El campo categoryId es obligatorio');
    else if (!categories.some(c => c.id === Number(categoryId))) errors.push(`La categoría ${categoryId} no existe`);
    if (errors.length) {
        return res.status(400).json(errorResponse('Los datos del producto no son válidos', errors));
    }

    const newProduct = { id: nextId++, name, price: Number(price), stock: Number(stock ?? 0), categoryId: Number(categoryId) };
    products.push(newProduct);
    res.status(201).json(successResponse('Producto creado correctamente', newProduct));
});

// PUT /products/:id -> 200 | 400 | 404   (solo actualiza los campos enviados)
router.put('/products/:id', (req, res) => {
    const product = products.find(p => p.id === Number(req.params.id));
    if (!product) {
        return res.status(404).json(errorResponse(`No existe un producto con id ${req.params.id}`));
    }

    const { name, price, stock, categoryId } = req.body ?? {};
    if (categoryId != null && !categories.some(c => c.id === Number(categoryId))) {
        return res.status(400).json(errorResponse('Los datos del producto no son válidos', [`La categoría ${categoryId} no existe`]));
    }

    if (name != null) product.name = name;
    if (price != null) product.price = Number(price);
    if (stock != null) product.stock = Number(stock);
    if (categoryId != null) product.categoryId = Number(categoryId);
    res.status(200).json(successResponse('Producto actualizado correctamente', product));
});

// DELETE /products/:id -> 200 | 404
router.delete('/products/:id', (req, res) => {
    const index = products.findIndex(p => p.id === Number(req.params.id));
    if (index === -1) {
        return res.status(404).json(errorResponse(`No existe un producto con id ${req.params.id}`));
    }
    const deleted = products.splice(index, 1)[0];
    res.status(200).json(successResponse('Producto eliminado correctamente', deleted));
});

app.use(BASE_PATH, router);

// ---------- Errores generales (siempre al final) ----------
// 404: ninguna ruta coincidió
app.use((req, res) => {
    res.status(404).json(errorResponse(`La ruta ${req.method} ${req.originalUrl} no existe`));
});

// 400 / 500: JSON mal escrito en el body o cualquier error inesperado
app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || 500;   // express.json() marca el JSON mal escrito con status 400
    const message = status === 400 ? 'El body de la petición no es un JSON válido' : 'Error interno del servidor';
    res.status(status).json(errorResponse(message));
});

app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}${BASE_PATH}`);
});

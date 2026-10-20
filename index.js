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

// ---------- Errores ----------
// Error con código HTTP. Se lanza con throw y lo responde el manejador global (al final del archivo).
class AppError extends Error {
    constructor(status, message, errors = []) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

// Busca un producto por el id de la URL: 400 si el id no es numérico, 404 si no existe
function findProduct(idParam) {
    const id = Number(idParam);
    if (!Number.isInteger(id)) throw new AppError(400, 'El id debe ser numérico', [`id recibido: ${idParam}`]);

    const product = products.find(p => p.id === id);
    if (!product) throw new AppError(404, `No existe un producto con id ${id}`);
    return product;
}

// ---------- Validación (middlewares) ----------
// Reglas de formato: aplican a crear y a actualizar, solo sobre los campos que llegan
function checkFormat({ name, price, stock, categoryId }) {
    const errors = [];
    if (name !== undefined && !String(name).trim()) errors.push('El campo name no puede estar vacío');
    if (price !== undefined && (isNaN(price) || price < 0)) errors.push('El campo price debe ser un número mayor o igual a 0');
    if (stock !== undefined && (isNaN(stock) || stock < 0)) errors.push('El campo stock debe ser un número mayor o igual a 0');
    if (categoryId && !categories.some(c => c.id === Number(categoryId))) errors.push(`La categoría ${categoryId} no existe`);
    return errors;
}

// POST: campos obligatorios + formato
function validateCreate(req, res, next) {
    const body = req.body ?? {};
    const errors = [];
    if (body.name === undefined) errors.push('El campo name es obligatorio');
    if (body.price === undefined) errors.push('El campo price es obligatorio');
    if (!body.categoryId) errors.push('El campo categoryId es obligatorio');
    errors.push(...checkFormat(body));

    if (errors.length) throw new AppError(400, 'Los datos del producto no son válidos', errors);
    next();
}

// PUT: al menos un campo + formato (los campos son opcionales)
function validateUpdate(req, res, next) {
    const body = req.body ?? {};
    if (!Object.keys(body).length) throw new AppError(400, 'Debes enviar al menos un campo para actualizar');

    const errors = checkFormat(body);
    if (errors.length) throw new AppError(400, 'Los datos del producto no son válidos', errors);
    next();
}

// ---------- Endpoints ----------
// Todas las rutas cuelgan de BASE_PATH (ver app.use más abajo)
//   GET    /categories      -> 200
//   GET    /products        -> 200 (lista vacía también es 200) | 400 (filtro inválido)
//   GET    /products/:id    -> 200 | 400 | 404
//   POST   /products        -> 201 | 400
//   PUT    /products/:id    -> 200 | 400 | 404
//   DELETE /products/:id    -> 200 | 400 | 404
const router = express.Router();

router.get('/categories', (req, res) => {
    res.status(200).json(successResponse('La consulta de categorías fue exitosa', categories));
});

// Filtros opcionales: ?categoryId=1&name=tec
router.get('/products', (req, res) => {
    const { categoryId, name } = req.query;
    if (categoryId !== undefined && !Number.isInteger(Number(categoryId))) throw new AppError(400, 'El filtro categoryId debe ser numérico');
    if (name !== undefined && typeof name !== 'string') throw new AppError(400, 'El filtro name debe ser un texto');

    let result = products;
    if (categoryId) result = result.filter(p => p.categoryId === Number(categoryId));
    if (name) result = result.filter(p => p.name.toLowerCase().includes(name.toLowerCase()));

    const message = result.length
        ? 'La consulta al catálogo de productos fue exitosa'
        : 'No se encontraron productos con los filtros enviados';
    res.status(200).json(successResponse(message, result));
});

router.get('/products/:id', (req, res) => {
    const product = findProduct(req.params.id);
    res.status(200).json(successResponse('Producto encontrado', product));
});

router.post('/products', validateCreate, (req, res) => {
    const { name, price, stock, categoryId } = req.body;
    const newProduct = { id: nextId++, name, price: Number(price), stock: Number(stock ?? 0), categoryId: Number(categoryId) };
    products.push(newProduct);
    res.status(201).json(successResponse('Producto creado correctamente', newProduct));
});

router.put('/products/:id', validateUpdate, (req, res) => {
    const product = findProduct(req.params.id);
    const { name, price, stock, categoryId } = req.body;
    if (name !== undefined) product.name = name;
    if (price !== undefined) product.price = Number(price);
    if (stock !== undefined) product.stock = Number(stock);
    if (categoryId !== undefined) product.categoryId = Number(categoryId);
    res.status(200).json(successResponse('Producto actualizado correctamente', product));
});

router.delete('/products/:id', (req, res) => {
    const product = findProduct(req.params.id);
    products.splice(products.indexOf(product), 1);
    res.status(200).json(successResponse('Producto eliminado correctamente', product));
});

app.use(BASE_PATH, router);

// ---------- Manejo global de errores (siempre al final) ----------
// 404: ninguna ruta coincidió
app.use((req, res) => {
    throw new AppError(404, `La ruta ${req.method} ${req.originalUrl} no existe`);
});

// Todos los errores lanzados llegan aquí (4 parámetros = manejador de errores)
app.use((err, req, res, next) => {
    // Errores esperados: los que lanzamos con AppError
    if (err instanceof AppError) {
        return res.status(err.status).json(errorResponse(err.message, err.errors));
    }
    // JSON mal formado en el body (lo detecta express.json)
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json(errorResponse('El body de la petición no es un JSON válido'));
    }
    // Errores inesperados: el detalle solo se registra en el servidor, nunca se envía al cliente
    console.error(err);
    res.status(500).json(errorResponse('Error interno del servidor'));
});

app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}${BASE_PATH}`);
});

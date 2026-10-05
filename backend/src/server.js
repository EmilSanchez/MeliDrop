require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const pricePacksRoutes = require('./routes/pricePacks');
const calcularRoutes = require('./routes/calcular');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/price-packs', pricePacksRoutes);
app.use('/api/calcular-precio', calcularRoutes);

// Manejo de errores genérico (para no tumbar el servidor por un error no previsto)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend corriendo en http://localhost:${PORT}`));

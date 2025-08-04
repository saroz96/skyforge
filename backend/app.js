const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const cors = require('cors');
const passport = require('passport');
const initializePassport = require('./config/passport-config');
const MongoStore = require('connect-mongo');
const path = require('path');

const app = express();
const _dirname = path.resolve();

// Import routes
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/company');
const itemRoutes = require('./routes/retailer/items');
const categoryRoutes = require('./routes/retailer/category');
const itemsCompanyRoutes = require('./routes/retailer/itemsCompany');
const unitRoutes = require('./routes/retailer/unit');
const mainUnitRoutes = require('./routes/retailer/mainUnit');
const compositionRroutes = require('./routes/retailer/composition');
const accountRoutes = require('./routes/retailer/account');
const accountGroupRoutes = require('./routes/retailer/companyGroup');
const purchaseRoutes = require('./routes/retailer/purchase');
const salesRoutes = require('./routes/retailer/sales');
const purchaseReturnRoutes = require('./routes/retailer/purchaseReturn');
const salesReturnRoutes = require('./routes/retailer/salesReturn');
const miscRoutes = require('./routes/retailer/miscellaneous');
const paymentRoutes = require('./routes/retailer/payment');
const receiptRoutes = require('./routes/retailer/receipt');
const stockAdjustmentRoutes = require('./routes/retailer/stockAdjustments');

// Initialize Passport
initializePassport(passport);

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("✅ Database connected");
});

// Middleware
app.use(cors({
    origin: 'https://skyforge-6fyh.onrender.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Session config
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
};

app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Flash middleware
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.messages = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Routes
app.use('/api/auth', userRoutes);
app.use('/api', companyRoutes);

// Retailer routes
app.use('/api/retailer', itemRoutes);
app.use('/api/retailer', categoryRoutes);
app.use('/api/retailer', itemsCompanyRoutes);
app.use('/api/retailer', unitRoutes);
app.use('/api/retailer', mainUnitRoutes);
app.use('/api/retailer', compositionRroutes);
app.use('/api/retailer', accountRoutes);
app.use('/api/retailer', accountGroupRoutes);
app.use('/api/retailer', purchaseRoutes);
app.use('/api/retailer', salesRoutes);
app.use('/api/retailer', purchaseReturnRoutes);
app.use('/api/retailer', salesReturnRoutes);
app.use('/api/retailer', miscRoutes);
app.use('/api/retailer', paymentRoutes);
app.use('/api/retailer', receiptRoutes);
app.use('/api/retailer', stockAdjustmentRoutes);

// ✅ Serve frontend build (React)
app.use(express.static(path.join(_dirname, 'frontend/build')));

// ✅ Catch-all route to handle React routing
app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(_dirname, 'frontend', 'build', 'index.html'));
});

// Default route
app.get('/', (req, res) => {
    res.send('🌐 Backend is running');
});

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

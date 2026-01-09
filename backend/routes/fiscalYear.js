const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../middleware/auth');
const { ensureTradeType } = require('../middleware/tradeType');
const Company = require('../models/Company');
const NepaliDate = require('nepali-date');
const FiscalYear = require('../models/FiscalYear');
const ensureFiscalYear = require('../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../middleware/checkFiscalYearDateRange');
const Item = require('../models/retailer/Item');
const Transaction = require('../models/retailer/Transaction');
const Account = require('../models/retailer/Account');
const BillCounter = require('../models/retailer/billCounter');
const CompanyGroup = require('../models/retailer/CompanyGroup');
const Settings = require('../models/retailer/Settings');
const itemsCompany = require('../models/retailer/itemsCompany');
const SalesQuotation = require('../models/retailer/SalesQuotation');
const Category = require('../models/retailer/Category');
const MainUnit = require('../models/retailer/MainUnit');
const Unit = require('../models/retailer/Unit');
const User = require('../models/User');
const Composition = require('../models/retailer/Composition');

let progress = 0; // 0 to 100

// Route to get all fiscal years for the current company as JSON
router.get('/switch-fiscal-year', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Fetch all fiscal years for the company
        const fiscalYears = await FiscalYear.find({ company: companyId });
        const initialCurrentFiscalYear = company.fiscalYear;

        // If no current fiscal year is set in session, set the last one as current
        let currentFiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;

        if (!currentFiscalYear && fiscalYears.length > 0) {
            const lastFiscalYear = fiscalYears[fiscalYears.length - 1];
            currentFiscalYear = lastFiscalYear._id.toString();
            req.session.currentFiscalYear = {
                id: currentFiscalYear,
                startDate: lastFiscalYear.startDate,
                endDate: lastFiscalYear.endDate,
                name: lastFiscalYear.name,
                dateFormat: lastFiscalYear.dateFormat,
                isActive: lastFiscalYear.isActive
            };
        }

        // Return JSON response for React components
        res.json({
            success: true,
            data: {
                company: {
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    fiscalYear: company.fiscalYear
                },
                currentFiscalYear,
                initialCurrentFiscalYear,
                fiscalYears,
                currentCompanyName,
                user: {
                    id: req.user._id,
                    preferences: {
                        theme: req.user.preferences?.theme || 'light'
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            }
        });
    } catch (err) {
        console.error('Error fetching fiscal years:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to fetch fiscal years data'
        });
    }
});

// Route to change the current fiscal year
router.post('/switch-fiscal-year', ensureAuthenticated, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    try {
        const { fiscalYearId } = req.body;
        const companyId = req.session.currentCompany;

        // Validate request body
        if (!fiscalYearId) {
            return res.status(400).json({
                success: false,
                error: 'Fiscal Year ID is required'
            });
        }

        // Fetch the selected fiscal year
        const fiscalYear = await FiscalYear.findOne({
            _id: fiscalYearId,
            company: companyId
        });

        if (!fiscalYear) {
            return res.status(404).json({
                success: false,
                error: 'Fiscal Year not found'
            });
        }

        // // Check if fiscal year is active
        // if (!fiscalYear.isActive) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Cannot switch to an inactive fiscal year'
        //     });
        // }

        // Update the session with the new fiscal year
        req.session.currentFiscalYear = {
            id: fiscalYear._id.toString(),
            startDate: fiscalYear.startDate,
            endDate: fiscalYear.endDate,
            name: fiscalYear.name,
            dateFormat: fiscalYear.dateFormat,
            isActive: fiscalYear.isActive
        };

        // Save the session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update session'
                });
            }

            // Return success response
            res.status(200).json({
                success: true,
                message: 'Fiscal year switched successfully',
                data: {
                    fiscalYear: {
                        _id: fiscalYear._id,
                        name: fiscalYear.name,
                        startDate: fiscalYear.startDate,
                        endDate: fiscalYear.endDate,
                        dateFormat: fiscalYear.dateFormat,
                        isActive: fiscalYear.isActive
                    },
                    sessionUpdated: true
                }
            });
        });

    } catch (err) {
        console.error('Error switching fiscal year:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: err.message
        });
    }
});

//route to get for change new fiscalyear
router.get('/change-fiscal-year', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Fiscal year logic (your existing code remains the same)
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;
                req.session.currentFiscalYear = {
                    id: currentFiscalYear._id.toString(),
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                };
                fiscalYear = req.session.currentFiscalYear.id;
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            let nextFiscalYearStartDate = null;
            if (currentFiscalYear) {
                const currentEndDate = currentFiscalYear.endDate;
                if (currentEndDate instanceof Date) {
                    const nextDate = new Date(currentEndDate);
                    nextDate.setDate(nextDate.getDate() + 1);
                    nextFiscalYearStartDate = nextDate.toISOString().split('T')[0];
                } else if (typeof currentEndDate === 'string') {
                    const [year, month, day] = currentEndDate.split('-').map(Number);
                    nextFiscalYearStartDate = `${year}-${String(month).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`;
                } else {
                    throw new Error('Unsupported date format for currentFiscalYear.endDate');
                }
            }

            // Return JSON response instead of rendering template
            return res.status(200).json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    nextFiscalYearStartDate,
                    currentFiscalYear: currentFiscalYear ? {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    } : null,
                    currentCompanyName,
                    nepaliDate,
                    companyDateFormat,
                    user: {
                        _id: req.user._id,
                        username: req.user.username,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });

        } catch (err) {
            console.error('Error fetching fiscal year:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to load fiscal year data.',
                message: err.message
            });
        }
    } else {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});


// router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
//         return res.end();
//     }

//     // Set headers for SSE
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//     });

//     // Function to send events
//     const sendEvent = (type, data) => {
//         res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
//     };

//     const session = await mongoose.startSession();
//     let transactionCommitted = false;
//     let transactionAborted = false;

//     // Helper function to safely abort transaction
//     const safeAbortTransaction = async () => {
//         if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
//             try {
//                 await session.abortTransaction();
//                 transactionAborted = true;
//             } catch (abortError) {
//                 // Ignore errors when aborting already aborted transaction
//                 if (!abortError.message.includes('abortTransaction twice')) {
//                     console.error('Error aborting transaction:', abortError);
//                 }
//             }
//         }
//     };

//     try {
//         // Start transaction with extended timeout and retry options
//         const transactionOptions = {
//             readConcern: { level: 'snapshot' },
//             writeConcern: { w: 'majority' },
//             maxTimeMS: 600000, // 10 minute timeout
//             retryWrites: true
//         };

//         await session.withTransaction(async () => {
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;

//             // Get parameters from query string
//             const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

//             let startDate, endDate;
//             if (dateFormat === 'nepali') {
//                 startDate = startDateNepali;
//                 endDate = endDateNepali;
//             } else if (dateFormat === 'english') {
//                 startDate = startDateEnglish;
//                 endDate = endDateEnglish;
//             } else {
//                 sendEvent('error', { message: 'Invalid date format' });
//                 throw new Error('Invalid date format');
//             }

//             if (!endDate) {
//                 endDate = new Date(startDate);
//                 endDate.setFullYear(endDate.getFullYear() + 1);
//                 endDate.setDate(endDate.getDate() - 1);
//             }

//             const startDateObject = new Date(startDate);
//             const endDateObject = new Date(endDate);
//             const startYear = startDateObject.getFullYear();
//             const endYear = endDateObject.getFullYear();
//             const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

//             // Step 1: Create fiscal year
//             sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
//             sendEvent('progress', { value: 10 });

//             const existingFiscalYear = await FiscalYear.findOne({
//                 name: fiscalYearName,
//                 company: companyId
//             }).session(session);

//             if (existingFiscalYear) {
//                 sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
//                 throw new Error('Fiscal year already exists');
//             }

//             // Process in batches to avoid transaction timeouts
//             const processInBatches = async (items, processFn, batchSize = 50) => {
//                 for (let i = 0; i < items.length; i += batchSize) {
//                     const batch = items.slice(i, i + batchSize);
//                     await Promise.all(batch.map(item => processFn(item)));

//                     // Send progress updates
//                     const progress = 33 + (i / items.length * 33);
//                     sendEvent('progress', { value: Math.min(progress, 66) });
//                 }
//             };

//             const newFiscalYear = (await FiscalYear.create([{
//                 name: fiscalYearName,
//                 startDate: startDateObject,
//                 endDate: endDateObject,
//                 dateFormat,
//                 company: companyId
//             }], { session }))[0];

//             sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
//             sendEvent('progress', { value: 33 });

//             // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
//             sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

//             // Check if settings already exist for this user and company in new fiscal year
//             const existingSettings = await Settings.findOne({
//                 company: companyId,
//                 fiscalYear: newFiscalYear._id,
//                 userId: req.user.id
//             }).session(session);

//             if (existingSettings) {
//                 sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
//             } else {
//                 const currentSettings = await Settings.findOne({
//                     company: companyId,
//                     fiscalYear: currentFiscalYear,
//                     userId: req.user.id
//                 }).session(session);

//                 if (currentSettings) {
//                     // Create new settings with unique _id and proper fiscal year reference
//                     const newSettingsData = {
//                         ...currentSettings.toObject(),
//                         _id: new mongoose.Types.ObjectId(), // Generate new unique ID
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     };
//                     // Remove any existing _id to ensure new one is used
//                     delete newSettingsData._id;

//                     await Settings.create([newSettingsData], { session });
//                     sendEvent('log', { message: 'Settings cloned successfully' });
//                 } else {
//                     // Create default settings
//                     await Settings.create([{
//                         company: companyId,
//                         userId: req.user.id,
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     }], { session });
//                     sendEvent('log', { message: 'Created default settings for new fiscal year' });
//                 }
//             }

//             // Step 2: Process items in batches
//             sendEvent('log', { message: 'Creating items for new fiscal year...' });
//             const items = await Item.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             await processInBatches(items, async (item) => {
//                 try {
//                     // Get ALL transactions that affect stock for this item
//                     const stockTransactions = await Transaction.find({
//                         item: item._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
//                     }).sort({ date: 1 }).session(session);

//                     // Calculate current stock by processing all transactions
//                     let currentStock = item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock || 0;
//                     let totalPurchases = 0;
//                     let totalSales = 0;
//                     let totalPurchaseReturns = 0;
//                     let totalSalesReturns = 0;
//                     let totalAdjustments = 0;

//                     for (const transaction of stockTransactions) {
//                         switch (transaction.type) {
//                             case 'Purc': // Purchase
//                                 currentStock += transaction.quantity;
//                                 totalPurchases += transaction.quantity;
//                                 break;
//                             case 'Sale': // Sale
//                                 currentStock -= transaction.quantity;
//                                 totalSales += transaction.quantity;
//                                 break;
//                             case 'PrRt': // Purchase Return
//                                 currentStock -= transaction.quantity;
//                                 totalPurchaseReturns += transaction.quantity;
//                                 break;
//                             case 'SlRt': // Sales Return
//                                 currentStock += transaction.quantity;
//                                 totalSalesReturns += transaction.quantity;
//                                 break;
//                             case 'StockAdjustment': // Stock Adjustment
//                                 currentStock += transaction.adjustmentQuantity;
//                                 totalAdjustments += transaction.adjustmentQuantity;
//                                 break;
//                         }
//                     }

//                     // Calculate weighted average purchase price from stockEntries
//                     let totalQuantityFromEntries = 0;
//                     let totalPriceFromEntries = 0;
//                     let totalSalesPriceFromEntries = 0;

//                     for (const entry of item.stockEntries) {
//                         if (entry.puPrice && entry.quantity) {
//                             totalQuantityFromEntries += entry.quantity;
//                             totalPriceFromEntries += entry.quantity * entry.puPrice;
//                             totalSalesPriceFromEntries += entry.quantity * entry.price;
//                         }
//                     }

//                     let purchasePrice = 0;
//                     let salesPrice = 0;
//                     if (totalQuantityFromEntries > 0) {
//                         purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
//                         salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
//                     } else {
//                         // Fallback to transaction-based calculation
//                         const purchases = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Purc',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalQuantity = 0;
//                         let totalPrice = 0;
//                         for (let purchase of purchases) {
//                             totalQuantity += purchase.quantity;
//                             totalPrice += purchase.quantity * purchase.puPrice;
//                         }
//                         purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : item.puPrice;

//                         const salesTransactions = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Sale',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalSalesQuantity = 0;
//                         let totalSalesPrice = 0;
//                         for (let sale of salesTransactions) {
//                             if (sale.salesPrice && sale.quantity) {
//                                 totalSalesQuantity += sale.quantity;
//                                 totalSalesPrice += sale.quantity * sale.salesPrice;
//                             }
//                         }
//                         if (totalSalesQuantity > 0) {
//                             salesPrice = totalSalesPrice / totalSalesQuantity;
//                         }
//                     }

//                     const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
//                     const openingStock = openingStockFromEntries > 0 ? openingStockFromEntries : currentStock;
//                     const openingStockValue = purchasePrice * openingStock;

//                     sendEvent('log', {
//                         message: `Item ${item.name} - ` +
//                             `Stock from Entries: ${openingStockFromEntries}, ` +
//                             `Purchases: ${totalPurchases}, ` +
//                             `Sales: ${totalSales}, ` +
//                             `Purchase Returns: ${totalPurchaseReturns}, ` +
//                             `Sales Returns: ${totalSalesReturns}, ` +
//                             `Adjustments: ${totalAdjustments},` +
//                             `Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
//                     });

//                     if (!item.fiscalYear.includes(newFiscalYear._id)) {
//                         item.fiscalYear.push(newFiscalYear._id);
//                     }

//                     // Remove existing opening stock entry for this fiscal year if it exists
//                     item.openingStockByFiscalYear = item.openingStockByFiscalYear.filter(
//                         f => !f.fiscalYear.equals(newFiscalYear._id)
//                     );

//                     item.openingStockByFiscalYear.push({
//                         fiscalYear: newFiscalYear._id,
//                         openingStock: openingStock,
//                         openingStockValue: openingStockValue,
//                         purchasePrice: purchasePrice,
//                         salesPrice: salesPrice,
//                     });

//                     // Remove existing closing stock entry for current fiscal year if it exists
//                     item.closingStockByFiscalYear = item.closingStockByFiscalYear.filter(
//                         f => !f.fiscalYear.equals(currentFiscalYear)
//                     );

//                     item.closingStockByFiscalYear.push({
//                         fiscalYear: currentFiscalYear,
//                         closingStock: openingStock,
//                         closingStockValue: openingStockValue,
//                         purchasePrice: purchasePrice,
//                         salesPrice: salesPrice,
//                     });

//                     item.stock = openingStock;
//                     item.openingStock = openingStock;

//                     await item.save({ session });
//                     sendEvent('log', { message: `Created item: ${item.name} with stock: ${item.stock}` });
//                 } catch (saveError) {
//                     console.error(`Error processing item ${item.name}:`, saveError);
//                     throw saveError;
//                 }
//             });

//             // Step 3: Process accounts in batches
//             sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
//             const accounts = await Account.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Define account groups that should have zero opening balance (except cash accounts)
//             const zeroBalanceGroups = await CompanyGroup.find({
//                 name: {
//                     $in: ['Purchase', 'Sale', 'Fixed Assets',
//                         'Reserves & Surplus',
//                         'Secured Loans',
//                         'Securities & Deposits',
//                         'Stock in hand',
//                         'Unsecured Loans',
//                         'Expenses (Direct/Mfg.)',
//                         'Expenses (Indirect/Admn.)',
//                         'Income (Direct/Opr.)',
//                         'Income (Indirect)',
//                         'Loans & Advances',
//                         'Provisions/Expenses Payable',
//                         'Profit & Loss',
//                         'Current Assets',
//                     ]
//                 },
//                 company: companyId
//             }).select('_id').session(session);

//             const zeroBalanceGroupIds = zeroBalanceGroups.map(g => g._id);

//             // Get special account group IDs
//             const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup] = await Promise.all([
//                 CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session)
//             ]);

//             const cashInHandGroupId = cashInHandGroup?._id;
//             const sundryDebtorsGroupId = sundryDebtorsGroup?._id;
//             const sundryCreditorsGroupId = sundryCreditorsGroup?._id;

//             const processAccountBatch = async (batch) => {
//                 return Promise.all(batch.map(async (account) => {
//                     try {
//                         // Determine account type
//                         const isCashAccount = account.companyGroups?.equals(cashInHandGroupId) ||
//                             account.name === 'Cash in Hand';
//                         const isSundryAccount = account.companyGroups?.equals(sundryDebtorsGroupId) ||
//                             account.companyGroups?.equals(sundryCreditorsGroupId);
//                         const isZeroBalanceAccount = account.companyGroups &&
//                             zeroBalanceGroupIds.some(id => id.equals(account.companyGroups));

//                         // Build transaction query
//                         let transactionQuery = {
//                             account: account._id,
//                             company: companyId,
//                             fiscalYear: currentFiscalYear,
//                             type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] }
//                         };

//                         if (isSundryAccount) {
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } }
//                             ];
//                         }

//                         // Get transactions for balance calculation
//                         const transactions = await Transaction.find(transactionQuery).session(session);

//                         // Calculate new opening balance - USING openingBalanceByFiscalYear
//                         let newOpeningBalance;
//                         if (isZeroBalanceAccount) {
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Resetting balance to zero for ${account.name} (special account)` });
//                         } else {
//                             // Get opening balance from openingBalanceByFiscalYear for current fiscal year
//                             const currentFiscalYearOpeningBalance = account.openingBalanceByFiscalYear?.find(
//                                 f => f.fiscalYear.equals(currentFiscalYear)
//                             );

//                             let runningBalance = 0;
//                             let startingBalanceType = 'Dr';

//                             if (currentFiscalYearOpeningBalance) {
//                                 runningBalance = currentFiscalYearOpeningBalance.amount;
//                                 startingBalanceType = currentFiscalYearOpeningBalance.type;
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using opening balance from openingBalanceByFiscalYear for ${account.name}: ${currentFiscalYearOpeningBalance.amount} ${currentFiscalYearOpeningBalance.type}` });
//                             } else {
//                                 // Fallback to current openingBalance if no fiscal year entry found
//                                 runningBalance = account.openingBalance.amount;
//                                 startingBalanceType = account.openingBalance.type;
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using current openingBalance for ${account.name}: ${account.openingBalance.amount} ${account.openingBalance.type} (fallback)` });
//                             }

//                             // Process all transactions to calculate running balance
//                             for (const transaction of transactions) {
//                                 if (transaction.debit > 0) runningBalance += transaction.debit;
//                                 if (transaction.credit > 0) runningBalance -= transaction.credit;
//                             }

//                             newOpeningBalance = {
//                                 amount: Math.abs(runningBalance),
//                                 type: runningBalance >= 0 ? 'Dr' : 'Cr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                         }

//                         // Update account for new fiscal year
//                         if (!account.fiscalYear.includes(newFiscalYear._id)) {
//                             account.fiscalYear.push(newFiscalYear._id);
//                         }

//                         // Remove existing opening balance entry for this fiscal year if it exists
//                         account.openingBalanceByFiscalYear = account.openingBalanceByFiscalYear.filter(
//                             f => !f.fiscalYear.equals(newFiscalYear._id)
//                         );

//                         account.openingBalanceByFiscalYear.push({
//                             fiscalYear: newFiscalYear._id,
//                             amount: newOpeningBalance.amount,
//                             type: newOpeningBalance.type,
//                             date: new Date()
//                         });

//                         account.openingBalance = {
//                             fiscalYear: newFiscalYear._id,
//                             amount: newOpeningBalance.amount,
//                             type: newOpeningBalance.type
//                         };

//                         // Remove existing closing balance entry for current fiscal year if it exists
//                         account.closingBalanceByFiscalYear = account.closingBalanceByFiscalYear.filter(
//                             f => !f.fiscalYear.equals(currentFiscalYear)
//                         );

//                         account.closingBalanceByFiscalYear.push({
//                             fiscalYear: currentFiscalYear,
//                             amount: newOpeningBalance.amount,
//                             type: newOpeningBalance.type,
//                             date: new Date()
//                         });

//                         await account.save({ session });
//                         sendEvent('log', {
//                             message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
//                                 (isZeroBalanceAccount ? ' (reset to zero)' : '') +
//                                 (isCashAccount ? ' (cash account)' : '') +
//                                 (isSundryAccount ? ' (sundry account)' : '')
//                         });
//                     } catch (saveError) {
//                         console.error(`Error processing account ${account.name}:`, saveError);
//                         throw saveError;
//                     }
//                 }));
//             };

//             // Process accounts in batches of 50
//             const BATCH_SIZE = 50;
//             let accountsProcessed = 0;
//             const totalAccounts = accounts.length;

//             for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
//                 const batch = accounts.slice(i, i + BATCH_SIZE);
//                 await processAccountBatch(batch);
//                 accountsProcessed += batch.length;

//                 // Update progress
//                 const progress = 66 + (accountsProcessed / totalAccounts * 34);
//                 sendEvent('progress', { value: Math.min(progress, 100) });
//             }

//             sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

//             // Initialize bill counters - Check for existing ones first
//             sendEvent('log', { message: 'Initializing bill counters...' });
//             const transactionTypes = [
//                 'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
//                 'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment'
//             ];

//             for (const transactionType of transactionTypes) {
//                 const existingCounter = await BillCounter.findOne({
//                     company: companyId,
//                     fiscalYear: newFiscalYear._id,
//                     transactionType
//                 }).session(session);

//                 if (!existingCounter) {
//                     await BillCounter.create([{
//                         company: companyId,
//                         fiscalYear: newFiscalYear._id,
//                         transactionType,
//                         currentBillNumber: 0
//                     }], { session });
//                 }
//             }

//             // Update session
//             req.session.currentFiscalYear = {
//                 id: newFiscalYear._id.toString(),
//                 startDate: newFiscalYear.startDate,
//                 endDate: newFiscalYear.endDate,
//                 name: newFiscalYear.name,
//                 dateFormat: newFiscalYear.dateFormat,
//                 isActive: true
//             };

//             // Mark transaction as committed
//             transactionCommitted = true;

//             sendEvent('progress', { value: 100 });
//             sendEvent('complete', { message: `Fiscal year ${fiscalYearName} created successfully!` });
//         }, transactionOptions);

//     } catch (err) {
//         console.error('Error in fiscal year creation:', err);

//         // Only abort if transaction wasn't committed
//         await safeAbortTransaction();

//         sendEvent('error', {
//             message: `Failed to create fiscal year: ${err.message}`,
//             details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     } finally {
//         try {
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session:', sessionError);
//         }
//         res.end();
//     }

//     // Handle client disconnect
//     req.on('close', async () => {
//         await safeAbortTransaction();
//         try {
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session on close:', sessionError);
//         }
//     });
// });

// router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
//         return res.end();
//     }

//     // Set headers for SSE
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//     });

//     // Function to send events
//     const sendEvent = (type, data) => {
//         res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
//     };

//     const session = await mongoose.startSession();
//     let transactionCommitted = false;
//     let transactionAborted = false;

//     // Helper function to safely abort transaction
//     const safeAbortTransaction = async () => {
//         if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
//             try {
//                 await session.abortTransaction();
//                 transactionAborted = true;
//             } catch (abortError) {
//                 // Ignore errors when aborting already aborted transaction
//                 if (!abortError.message.includes('abortTransaction twice')) {
//                     console.error('Error aborting transaction:', abortError);
//                 }
//             }
//         }
//     };

//     try {
//         // Start transaction with extended timeout and retry options
//         const transactionOptions = {
//             readConcern: { level: 'snapshot' },
//             writeConcern: { w: 'majority' },
//             maxTimeMS: 600000, // 10 minute timeout
//             retryWrites: true
//         };

//         await session.withTransaction(async () => {
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;

//             // Get parameters from query string
//             const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

//             let startDate, endDate;
//             if (dateFormat === 'nepali') {
//                 startDate = startDateNepali;
//                 endDate = endDateNepali;
//             } else if (dateFormat === 'english') {
//                 startDate = startDateEnglish;
//                 endDate = endDateEnglish;
//             } else {
//                 sendEvent('error', { message: 'Invalid date format' });
//                 throw new Error('Invalid date format');
//             }

//             if (!endDate) {
//                 // If endDate is not provided, calculate it as one year minus one day from startDate
//                 endDate = new Date(startDate);
//                 endDate.setFullYear(endDate.getFullYear() + 1);
//                 endDate.setDate(endDate.getDate() - 1);
//             }

//             const startDateObject = new Date(startDate);
//             const endDateObject = new Date(endDate);
//             const startYear = startDateObject.getFullYear();
//             const endYear = endDateObject.getFullYear();
//             const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

//             // Step 1: Create fiscal year
//             sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
//             sendEvent('progress', { value: 10 });

//             const existingFiscalYear = await FiscalYear.findOne({
//                 name: fiscalYearName,
//                 company: companyId
//             }).session(session);

//             if (existingFiscalYear) {
//                 sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
//                 throw new Error('Fiscal year already exists');
//             }

//             // Process in batches to avoid transaction timeouts
//             const processInBatches = async (items, processFn, batchSize = 50) => {
//                 for (let i = 0; i < items.length; i += batchSize) {
//                     const batch = items.slice(i, i + batchSize);
//                     await Promise.all(batch.map(item => processFn(item)));

//                     // Send progress updates
//                     const progress = 33 + (i / items.length * 33);
//                     sendEvent('progress', { value: Math.min(progress, 66) });
//                 }
//             };

//             const newFiscalYear = (await FiscalYear.create([{
//                 name: fiscalYearName,
//                 startDate: startDateObject,
//                 endDate: endDateObject,
//                 dateFormat,
//                 company: companyId
//             }], { session }))[0];

//             sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
//             sendEvent('progress', { value: 33 });

//             // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
//             sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

//             // Check if settings already exist for this user and company in new fiscal year
//             const existingSettings = await Settings.findOne({
//                 company: companyId,
//                 fiscalYear: newFiscalYear._id,
//                 userId: req.user.id
//             }).session(session);

//             if (existingSettings) {
//                 sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
//             } else {
//                 const currentSettings = await Settings.findOne({
//                     company: companyId,
//                     fiscalYear: currentFiscalYear,
//                     userId: req.user.id
//                 }).session(session);

//                 if (currentSettings) {
//                     // Create new settings with unique _id and proper fiscal year reference
//                     const newSettingsData = {
//                         ...currentSettings.toObject(),
//                         _id: new mongoose.Types.ObjectId(), // Generate new unique ID
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     };
//                     // Remove any existing _id to ensure new one is used
//                     delete newSettingsData._id;

//                     await Settings.create([newSettingsData], { session });
//                     sendEvent('log', { message: 'Settings cloned successfully' });
//                 } else {
//                     // Create default settings
//                     await Settings.create([{
//                         company: companyId,
//                         userId: req.user.id,
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     }], { session });
//                     sendEvent('log', { message: 'Created default settings for new fiscal year' });
//                 }
//             }

//             // Step 2: Process items in batches
//             sendEvent('log', { message: 'Creating items for new fiscal year...' });
//             const items = await Item.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             await processInBatches(items, async (item) => {
//                 try {
//                     // Get ALL transactions that affect stock for this item
//                     const stockTransactions = await Transaction.find({
//                         item: item._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
//                     }).sort({ date: 1 }).session(session);

//                     // Calculate current stock by processing all transactions
//                     let currentStock = Number(item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock) || 0;
//                     let totalPurchases = 0;
//                     let totalSales = 0;
//                     let totalPurchaseReturns = 0;
//                     let totalSalesReturns = 0;
//                     let totalAdjustments = 0;

//                     for (const transaction of stockTransactions) {
//                         const quantity = Number(transaction.quantity) || 0;
//                         const adjustmentQuantity = Number(transaction.adjustmentQuantity) || 0;

//                         switch (transaction.type) {
//                             case 'Purc': // Purchase
//                                 currentStock += quantity;
//                                 totalPurchases += quantity;
//                                 break;
//                             case 'Sale': // Sale
//                                 currentStock -= quantity;
//                                 totalSales += quantity;
//                                 break;
//                             case 'PrRt': // Purchase Return
//                                 currentStock -= quantity;
//                                 totalPurchaseReturns += quantity;
//                                 break;
//                             case 'SlRt': // Sales Return
//                                 currentStock += quantity;
//                                 totalSalesReturns += quantity;
//                                 break;
//                             case 'StockAdjustment': // Stock Adjustment
//                                 currentStock += adjustmentQuantity;
//                                 totalAdjustments += adjustmentQuantity;
//                                 break;
//                         }
//                     }

//                     // Calculate weighted average purchase price from stockEntries
//                     let totalQuantityFromEntries = 0;
//                     let totalPriceFromEntries = 0;
//                     let totalSalesPriceFromEntries = 0;

//                     for (const entry of item.stockEntries) {
//                         const entryPuPrice = Number(entry.puPrice) || 0;
//                         const entryQuantity = Number(entry.quantity) || 0;
//                         const entryPrice = Number(entry.price) || 0;

//                         if (entryPuPrice > 0 && entryQuantity > 0) {
//                             totalQuantityFromEntries += entryQuantity;
//                             totalPriceFromEntries += entryQuantity * entryPuPrice;
//                             totalSalesPriceFromEntries += entryQuantity * entryPrice;
//                         }
//                     }

//                     let purchasePrice = 0;
//                     let salesPrice = 0;

//                     if (totalQuantityFromEntries > 0) {
//                         purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
//                         salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
//                     } else {
//                         // Fallback to transaction-based calculation if no valid stock entries
//                         const purchases = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Purc',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalQuantity = 0;
//                         let totalPrice = 0;
//                         for (let purchase of purchases) {
//                             const purchaseQuantity = Number(purchase.quantity) || 0;
//                             const purchasePuPrice = Number(purchase.puPrice) || 0;
//                             if (purchaseQuantity > 0 && purchasePuPrice > 0) {
//                                 totalQuantity += purchaseQuantity;
//                                 totalPrice += purchaseQuantity * purchasePuPrice;
//                             }
//                         }

//                         // Ensure item.puPrice is also a number for fallback
//                         purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : (Number(item.puPrice) || 0);

//                         const salesTransactions = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Sale',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalSalesQuantity = 0;
//                         let totalSalesPrice = 0;
//                         for (let sale of salesTransactions) {
//                             const saleSalesPrice = Number(sale.salesPrice) || 0;
//                             const saleQuantity = Number(sale.quantity) || 0;
//                             if (saleSalesPrice > 0 && saleQuantity > 0) {
//                                 totalSalesQuantity += saleQuantity;
//                                 totalSalesPrice += saleQuantity * saleSalesPrice;
//                             }
//                         }
//                         salesPrice = totalSalesQuantity > 0 ? (totalSalesPrice / totalSalesQuantity) : (Number(item.price) || 0); // Use item.price as fallback if no sales transactions
//                     }

//                     // Ensure all final values are numbers, defaulting to 0 if NaN
//                     purchasePrice = Number(purchasePrice) || 0;
//                     salesPrice = Number(salesPrice) || 0;

//                     const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
//                     const openingStock = Number(openingStockFromEntries > 0 ? openingStockFromEntries : currentStock) || 0;
//                     const openingStockValue = Number(purchasePrice * openingStock) || 0; // Ensure this is a number

//                     sendEvent('log', {
//                         message: `Item ${item.name} - ` +
//                             `Stock from Entries: ${openingStockFromEntries}, ` +
//                             `Purchases: ${totalPurchases}, ` +
//                             `Sales: ${totalSales}, ` +
//                             `Purchase Returns: ${totalPurchaseReturns}, ` +
//                             `Sales Returns: ${totalSalesReturns}, ` +
//                             `Adjustments: ${totalAdjustments},` +
//                             `Calculated Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
//                     });

//                     if (!item.fiscalYear.includes(newFiscalYear._id)) {
//                         item.fiscalYear.push(newFiscalYear._id);
//                     }

//                     // Remove existing opening stock entry for this fiscal year if it exists
//                     item.openingStockByFiscalYear = item.openingStockByFiscalYear.filter(
//                         f => !f.fiscalYear.equals(newFiscalYear._id)
//                     );

//                     item.openingStockByFiscalYear.push({
//                         fiscalYear: newFiscalYear._id,
//                         openingStock: openingStock,
//                         openingStockValue: openingStockValue,
//                         purchasePrice: purchasePrice,
//                         salesPrice: salesPrice,
//                     });

//                     // Remove existing closing stock entry for current fiscal year if it exists
//                     item.closingStockByFiscalYear = item.closingStockByFiscalYear.filter(
//                         f => !f.fiscalYear.equals(currentFiscalYear)
//                     );

//                     item.closingStockByFiscalYear.push({
//                         fiscalYear: currentFiscalYear,
//                         // The closing stock for the current fiscal year is the calculated opening stock for the NEW fiscal year
//                         closingStock: openingStock,
//                         closingStockValue: openingStockValue, // The value for current fiscal year's closing stock
//                         purchasePrice: purchasePrice, // Use the calculated purchase price
//                         salesPrice: salesPrice,       // Use the calculated sales price
//                     });

//                     // Update main stock fields of the item for the new fiscal year
//                     item.stock = openingStock;
//                     item.openingStock = openingStock;

//                     await item.save({ session });
//                     sendEvent('log', { message: `Updated item: ${item.name} with new opening stock: ${item.stock} and value: ${openingStockValue}` });
//                 } catch (saveError) {
//                     console.error(`Error processing item ${item.name}:`, saveError);
//                     throw saveError;
//                 }
//             });

//             // Step 3: Process accounts in batches
//             sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
//             const accounts = await Account.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Define account groups that should have zero opening balance (except cash accounts)
//             const zeroBalanceGroups = await CompanyGroup.find({
//                 name: {
//                     $in: ['Purchase', 'Sale', 'Fixed Assets', // Fixed Assets should actually carry balance, review this list
//                         'Reserves & Surplus', // These are usually P&L related and reset or adjusted
//                         'Secured Loans',      // Should carry balance
//                         'Securities & Deposits', // Should carry balance
//                         'Stock in hand',      // Handled by Item stock, typically zero for account
//                         'Unsecured Loans',    // Should carry balance
//                         'Expenses (Direct/Mfg.)', // Reset
//                         'Expenses (Indirect/Admn.)', // Reset
//                         'Income (Direct/Opr.)',     // Reset
//                         'Income (Indirect)',        // Reset
//                         'Loans & Advances',         // Should carry balance
//                         'Provisions/Expenses Payable', // Should carry balance
//                         'Profit & Loss',            // Reset/Adjusted
//                         'Current Assets',           // THIS IS TOO BROAD, many current assets carry balance (e.g., Debtors, Cash, Bank).
//                         // Re-evaluate your zeroBalanceGroups list carefully.
//                         // For demonstration, I'm assuming you intend these to be reset.
//                     ]
//                 },
//                 company: companyId
//             }).select('_id').session(session);

//             const zeroBalanceGroupIds = zeroBalanceGroups.map(g => g._id.toString()); // Convert to string for easier comparison

//             // Get special account group IDs
//             const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup] = await Promise.all([
//                 CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session)
//             ]);

//             const cashInHandGroupId = cashInHandGroup?._id.toString();
//             const sundryDebtorsGroupId = sundryDebtorsGroup?._id.toString();
//             const sundryCreditorsGroupId = sundryCreditorsGroup?._id.toString();

//             const processAccountBatch = async (batch) => {
//                 return Promise.all(batch.map(async (account) => {
//                     try {
//                         const accountCompanyGroupId = account.companyGroups ? account.companyGroups.toString() : null;

//                         // Determine account type based on their company group
//                         const isCashAccount = accountCompanyGroupId === cashInHandGroupId;
//                         const isSundryAccount = accountCompanyGroupId === sundryDebtorsGroupId || accountCompanyGroupId === sundryCreditorsGroupId;
//                         const isZeroBalanceAccount = zeroBalanceGroupIds.includes(accountCompanyGroupId);

//                         // Build transaction query
//                         let transactionQuery = {
//                             account: account._id,
//                             company: companyId,
//                             fiscalYear: currentFiscalYear,
//                             type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt', 'BnkDep', 'BnkWtd'] } // Added Bank Deposit/Withdrawal
//                         };

//                         // For Sundry Debtors/Creditors, filter out cash transactions from 'Sale'/'Purc' etc.
//                         if (isSundryAccount) {
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } }, // Only non-cash
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } } // Other types always affect
//                             ];
//                         } else if (isCashAccount) {
//                             // For cash accounts, only consider transactions that involve cash
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: 'cash' },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'BnkWtd', 'BnkDep'] } } // Payment/Receipt, Jrnl, Bank Withdrawals/Deposits
//                             ];
//                         }

//                         // Get transactions for balance calculation
//                         const transactions = await Transaction.find(transactionQuery).session(session);

//                         // Calculate new opening balance - USING openingBalanceByFiscalYear
//                         let newOpeningBalance;
//                         if (isZeroBalanceAccount) {
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr', // Default to Dr, though 0 has no type
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Resetting balance to zero for ${account.name} (Zero Balance Group)` });
//                         } else {
//                             // Get opening balance from openingBalanceByFiscalYear for current fiscal year
//                             const currentFiscalYearOpeningBalanceEntry = account.openingBalanceByFiscalYear?.find(
//                                 f => f.fiscalYear.equals(currentFiscalYear)
//                             );

//                             let runningBalance = 0;
//                             let startingBalanceType = 'Dr';

//                             if (currentFiscalYearOpeningBalanceEntry) {
//                                 runningBalance = Number(currentFiscalYearOpeningBalanceEntry.amount) || 0;
//                                 startingBalanceType = currentFiscalYearOpeningBalanceEntry.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance; // Represent Cr as negative for calculation
//                                 }
//                                 sendEvent('log', { message: `Using opening balance from openingBalanceByFiscalYear for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'}` });
//                             } else {
//                                 // Fallback to current openingBalance if no fiscal year entry found
//                                 runningBalance = Number(account.openingBalance?.amount) || 0;
//                                 startingBalanceType = account.openingBalance?.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using current account.openingBalance for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'} (fallback)` });
//                             }

//                             // Process all transactions to calculate running balance
//                             for (const transaction of transactions) {
//                                 const debit = Number(transaction.debit) || 0;
//                                 const credit = Number(transaction.credit) || 0;
//                                 if (debit > 0) runningBalance += debit;
//                                 if (credit > 0) runningBalance -= credit;
//                             }

//                             newOpeningBalance = {
//                                 amount: Math.abs(runningBalance),
//                                 type: runningBalance >= 0 ? 'Dr' : 'Cr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                         }

//                         // Update account for new fiscal year
//                         if (!account.fiscalYear.includes(newFiscalYear._id)) {
//                             account.fiscalYear.push(newFiscalYear._id);
//                         }

//                         // Remove existing opening balance entry for this fiscal year if it exists
//                         account.openingBalanceByFiscalYear = account.openingBalanceByFiscalYear.filter(
//                             f => !f.fiscalYear.equals(newFiscalYear._id)
//                         );

//                         account.openingBalanceByFiscalYear.push({
//                             fiscalYear: newFiscalYear._id,
//                             amount: Number(newOpeningBalance.amount) || 0, // Ensure it's a number
//                             type: newOpeningBalance.type,
//                             date: new Date()
//                         });

//                         // Also update the main 'openingBalance' field of the account for the current active fiscal year
//                         account.openingBalance = {
//                             fiscalYear: newFiscalYear._id,
//                             amount: Number(newOpeningBalance.amount) || 0, // Ensure it's a number
//                             type: newOpeningBalance.type
//                         };

//                         // Remove existing closing balance entry for current fiscal year if it exists
//                         account.closingBalanceByFiscalYear = account.closingBalanceByFiscalYear.filter(
//                             f => !f.fiscalYear.equals(currentFiscalYear)
//                         );

//                         account.closingBalanceByFiscalYear.push({
//                             fiscalYear: currentFiscalYear,
//                             amount: Number(newOpeningBalance.amount) || 0, // Closing for current is opening for new
//                             type: newOpeningBalance.type,
//                             date: new Date() // Closing date of current fiscal year
//                         });

//                         await account.save({ session });
//                         sendEvent('log', {
//                             message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
//                                 (isZeroBalanceAccount ? ' (reset to zero)' : '') +
//                                 (isCashAccount ? ' (cash account)' : '') +
//                                 (isSundryAccount ? ' (sundry account)' : '')
//                         });
//                     } catch (saveError) {
//                         console.error(`Error processing account ${account.name}:`, saveError);
//                         throw saveError;
//                     }
//                 }));
//             };

//             // Process accounts in batches of 50
//             const BATCH_SIZE = 50;
//             let accountsProcessed = 0;
//             const totalAccounts = accounts.length;

//             for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
//                 const batch = accounts.slice(i, i + BATCH_SIZE);
//                 await processAccountBatch(batch);
//                 accountsProcessed += batch.length;

//                 // Update progress
//                 const progress = 66 + (accountsProcessed / totalAccounts * 34);
//                 sendEvent('progress', { value: Math.min(progress, 100) });
//             }

//             sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

//             // Initialize bill counters - Check for existing ones first
//             sendEvent('log', { message: 'Initializing bill counters...' });
//             const transactionTypes = [
//                 'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
//                 'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment', 'BankDeposit', 'BankWithdrawal'
//             ];

//             for (const transactionType of transactionTypes) {
//                 const existingCounter = await BillCounter.findOne({
//                     company: companyId,
//                     fiscalYear: newFiscalYear._id,
//                     transactionType
//                 }).session(session);

//                 if (!existingCounter) {
//                     await BillCounter.create([{
//                         company: companyId,
//                         fiscalYear: newFiscalYear._id,
//                         transactionType,
//                         currentBillNumber: 0
//                     }], { session });
//                 }
//             }

//             // Update session
//             req.session.currentFiscalYear = {
//                 id: newFiscalYear._id.toString(),
//                 startDate: newFiscalYear.startDate,
//                 endDate: newFiscalYear.endDate,
//                 name: newFiscalYear.name,
//                 dateFormat: newFiscalYear.dateFormat,
//                 isActive: true
//             };

//             // Mark transaction as committed
//             transactionCommitted = true;

//             sendEvent('progress', { value: 100 });
//             sendEvent('complete', { message: `Fiscal year ${fiscalYearName} created successfully! Current fiscal year set to ${fiscalYearName}.` });
//         }, transactionOptions); // End of withTransaction

//     } catch (err) {
//         console.error('Error in fiscal year creation:', err);

//         // Only abort if transaction wasn't committed
//         await safeAbortTransaction();

//         sendEvent('error', {
//             message: `Failed to create fiscal year: ${err.message}`,
//             details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     } finally {
//         try {
//             if (session.inTransaction()) { // Ensure session is not left hanging if transaction failed without explicit abort
//                 await safeAbortTransaction();
//             }
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session:', sessionError);
//         }
//         res.end(); // Always end the response
//     }

//     // Handle client disconnect
//     req.on('close', async () => {
//         // Ensure that if the client disconnects mid-transaction, it's aborted
//         await safeAbortTransaction();
//         try {
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session on client close:', sessionError);
//         }
//     });
// });

//from this profit is not calculating or not trnsafering to capital
// router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
//         return res.end();
//     }

//     // Set headers for SSE
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//     });

//     // Function to send events
//     const sendEvent = (type, data) => {
//         res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
//     };

//     const session = await mongoose.startSession();
//     let transactionCommitted = false;
//     let transactionAborted = false;

//     // Helper function to safely abort transaction
//     const safeAbortTransaction = async () => {
//         if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
//             try {
//                 await session.abortTransaction();
//                 transactionAborted = true;
//             } catch (abortError) {
//                 // Ignore errors when aborting already aborted transaction
//                 if (!abortError.message.includes('abortTransaction twice')) {
//                     console.error('Error aborting transaction:', abortError);
//                 }
//             }
//         }
//     };

//     try {
//         // Start transaction with extended timeout and retry options
//         const transactionOptions = {
//             readConcern: { level: 'snapshot' },
//             writeConcern: { w: 'majority' },
//             maxTimeMS: 600000, // 10 minute timeout
//             retryWrites: true
//         };

//         await session.withTransaction(async () => {
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;

//             // Get parameters from query string
//             const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

//             let startDate, endDate;
//             if (dateFormat === 'nepali') {
//                 startDate = startDateNepali;
//                 endDate = endDateNepali;
//             } else if (dateFormat === 'english') {
//                 startDate = startDateEnglish;
//                 endDate = endDateEnglish;
//             } else {
//                 sendEvent('error', { message: 'Invalid date format' });
//                 throw new Error('Invalid date format');
//             }

//             if (!endDate) {
//                 // If endDate is not provided, calculate it as one year minus one day from startDate
//                 endDate = new Date(startDate);
//                 endDate.setFullYear(endDate.getFullYear() + 1);
//                 endDate.setDate(endDate.getDate() - 1);
//             }

//             const startDateObject = new Date(startDate);
//             const endDateObject = new Date(endDate);
//             const startYear = startDateObject.getFullYear();
//             const endYear = endDateObject.getFullYear();
//             const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

//             // Step 1: Create fiscal year
//             sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
//             sendEvent('progress', { value: 10 });

//             const existingFiscalYear = await FiscalYear.findOne({
//                 name: fiscalYearName,
//                 company: companyId
//             }).session(session);

//             if (existingFiscalYear) {
//                 sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
//                 throw new Error('Fiscal year already exists');
//             }

//             // Process in batches to avoid transaction timeouts
//             const processInBatches = async (items, processFn, batchSize = 50) => {
//                 for (let i = 0; i < items.length; i += batchSize) {
//                     const batch = items.slice(i, i + batchSize);
//                     await Promise.all(batch.map(item => processFn(item)));

//                     // Send progress updates
//                     const progress = 33 + (i / items.length * 33);
//                     sendEvent('progress', { value: Math.min(progress, 66) });
//                 }
//             };

//             const newFiscalYear = (await FiscalYear.create([{
//                 name: fiscalYearName,
//                 startDate: startDateObject,
//                 endDate: endDateObject,
//                 dateFormat,
//                 company: companyId
//             }], { session }))[0];

//             sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
//             sendEvent('progress', { value: 33 });

//             // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
//             sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

//             // Check if settings already exist for this user and company in new fiscal year
//             const existingSettings = await Settings.findOne({
//                 company: companyId,
//                 fiscalYear: newFiscalYear._id,
//                 userId: req.user.id
//             }).session(session);

//             if (existingSettings) {
//                 sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
//             } else {
//                 const currentSettings = await Settings.findOne({
//                     company: companyId,
//                     fiscalYear: currentFiscalYear,
//                     userId: req.user.id
//                 }).session(session);

//                 if (currentSettings) {
//                     // Create new settings with unique _id and proper fiscal year reference
//                     const newSettingsData = {
//                         ...currentSettings.toObject(),
//                         _id: new mongoose.Types.ObjectId(), // Generate new unique ID
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     };
//                     // Remove any existing _id to ensure new one is used
//                     delete newSettingsData._id;

//                     await Settings.create([newSettingsData], { session });
//                     sendEvent('log', { message: 'Settings cloned successfully' });
//                 } else {
//                     // Create default settings
//                     await Settings.create([{
//                         company: companyId,
//                         userId: req.user.id,
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     }], { session });
//                     sendEvent('log', { message: 'Created default settings for new fiscal year' });
//                 }
//             }

//             // Step 2: Process items in batches
//             sendEvent('log', { message: 'Creating items for new fiscal year...' });
//             const items = await Item.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Store total stock value for stock account update
//             let totalStockValue = 0;

//             await processInBatches(items, async (item) => {
//                 try {
//                     // Get ALL transactions that affect stock for this item
//                     const stockTransactions = await Transaction.find({
//                         item: item._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
//                     }).sort({ date: 1 }).session(session);

//                     // Calculate current stock by processing all transactions
//                     let currentStock = Number(item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock) || 0;
//                     let totalPurchases = 0;
//                     let totalSales = 0;
//                     let totalPurchaseReturns = 0;
//                     let totalSalesReturns = 0;
//                     let totalAdjustments = 0;

//                     for (const transaction of stockTransactions) {
//                         const quantity = Number(transaction.quantity) || 0;
//                         const adjustmentQuantity = Number(transaction.adjustmentQuantity) || 0;

//                         switch (transaction.type) {
//                             case 'Purc': // Purchase
//                                 currentStock += quantity;
//                                 totalPurchases += quantity;
//                                 break;
//                             case 'Sale': // Sale
//                                 currentStock -= quantity;
//                                 totalSales += quantity;
//                                 break;
//                             case 'PrRt': // Purchase Return
//                                 currentStock -= quantity;
//                                 totalPurchaseReturns += quantity;
//                                 break;
//                             case 'SlRt': // Sales Return
//                                 currentStock += quantity;
//                                 totalSalesReturns += quantity;
//                                 break;
//                             case 'StockAdjustment': // Stock Adjustment
//                                 currentStock += adjustmentQuantity;
//                                 totalAdjustments += adjustmentQuantity;
//                                 break;
//                         }
//                     }

//                     // Calculate weighted average purchase price from stockEntries
//                     let totalQuantityFromEntries = 0;
//                     let totalPriceFromEntries = 0;
//                     let totalSalesPriceFromEntries = 0;

//                     for (const entry of item.stockEntries) {
//                         const entryPuPrice = Number(entry.puPrice) || 0;
//                         const entryQuantity = Number(entry.quantity) || 0;
//                         const entryPrice = Number(entry.price) || 0;

//                         if (entryPuPrice > 0 && entryQuantity > 0) {
//                             totalQuantityFromEntries += entryQuantity;
//                             totalPriceFromEntries += entryQuantity * entryPuPrice;
//                             totalSalesPriceFromEntries += entryQuantity * entryPrice;
//                         }
//                     }

//                     let purchasePrice = 0;
//                     let salesPrice = 0;

//                     if (totalQuantityFromEntries > 0) {
//                         purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
//                         salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
//                     } else {
//                         // Fallback to transaction-based calculation if no valid stock entries
//                         const purchases = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Purc',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalQuantity = 0;
//                         let totalPrice = 0;
//                         for (let purchase of purchases) {
//                             const purchaseQuantity = Number(purchase.quantity) || 0;
//                             const purchasePuPrice = Number(purchase.puPrice) || 0;
//                             if (purchaseQuantity > 0 && purchasePuPrice > 0) {
//                                 totalQuantity += purchaseQuantity;
//                                 totalPrice += purchaseQuantity * purchasePuPrice;
//                             }
//                         }

//                         // Ensure item.puPrice is also a number for fallback
//                         purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : (Number(item.puPrice) || 0);

//                         const salesTransactions = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Sale',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalSalesQuantity = 0;
//                         let totalSalesPrice = 0;
//                         for (let sale of salesTransactions) {
//                             const saleSalesPrice = Number(sale.salesPrice) || 0;
//                             const saleQuantity = Number(sale.quantity) || 0;
//                             if (saleSalesPrice > 0 && saleQuantity > 0) {
//                                 totalSalesQuantity += saleQuantity;
//                                 totalSalesPrice += saleQuantity * saleSalesPrice;
//                             }
//                         }
//                         salesPrice = totalSalesQuantity > 0 ? (totalSalesPrice / totalSalesQuantity) : (Number(item.price) || 0); // Use item.price as fallback if no sales transactions
//                     }

//                     // Ensure all final values are numbers, defaulting to 0 if NaN
//                     purchasePrice = Number(purchasePrice) || 0;
//                     salesPrice = Number(salesPrice) || 0;

//                     const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
//                     const openingStock = Number(openingStockFromEntries > 0 ? openingStockFromEntries : currentStock) || 0;
//                     const openingStockValue = Number(purchasePrice * openingStock) || 0; // Ensure this is a number

//                     sendEvent('log', {
//                         message: `Item ${item.name} - ` +
//                             `Stock from Entries: ${openingStockFromEntries}, ` +
//                             `Purchases: ${totalPurchases}, ` +
//                             `Sales: ${totalSales}, ` +
//                             `Purchase Returns: ${totalPurchaseReturns}, ` +
//                             `Sales Returns: ${totalSalesReturns}, ` +
//                             `Adjustments: ${totalAdjustments},` +
//                             `Calculated Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
//                     });

//                     if (!item.fiscalYear.includes(newFiscalYear._id)) {
//                         item.fiscalYear.push(newFiscalYear._id);
//                     }

//                     // Remove existing opening stock entry for this fiscal year if it exists
//                     item.openingStockByFiscalYear = item.openingStockByFiscalYear.filter(
//                         f => !f.fiscalYear.equals(newFiscalYear._id)
//                     );

//                     item.openingStockByFiscalYear.push({
//                         fiscalYear: newFiscalYear._id,
//                         openingStock: openingStock,
//                         openingStockValue: openingStockValue,
//                         purchasePrice: purchasePrice,
//                         salesPrice: salesPrice,
//                     });

//                     // Remove existing closing stock entry for current fiscal year if it exists
//                     item.closingStockByFiscalYear = item.closingStockByFiscalYear.filter(
//                         f => !f.fiscalYear.equals(currentFiscalYear)
//                     );

//                     item.closingStockByFiscalYear.push({
//                         fiscalYear: currentFiscalYear,
//                         // The closing stock for the current fiscal year is the calculated opening stock for the NEW fiscal year
//                         closingStock: openingStock,
//                         closingStockValue: openingStockValue, // The value for current fiscal year's closing stock
//                         purchasePrice: purchasePrice, // Use the calculated purchase price
//                         salesPrice: salesPrice,       // Use the calculated sales price
//                     });

//                     // Update main stock fields of the item for the new fiscal year
//                     item.stock = openingStock;
//                     item.openingStock = openingStock;

//                     await item.save({ session });
//                     sendEvent('log', { message: `Updated item: ${item.name} with new opening stock: ${item.stock} and value: ${openingStockValue}` });
//                 } catch (saveError) {
//                     console.error(`Error processing item ${item.name}:`, saveError);
//                     throw saveError;
//                 }
//             });

//             // STEP 2.5: CALCULATE TOTAL STOCK VALUE FROM STOCK ENTRIES AND UPDATE STOCK ACCOUNT
//             sendEvent('log', { message: 'Calculating total stock value from stock entries...' });

//             // Recalculate total stock value from ALL stock entries (quantity * puPrice)
//             totalStockValue = 0;

//             // Process each item to calculate stock value from stockEntries
//             for (const item of items) {
//                 let itemStockValue = 0;

//                 // Calculate stock value from stockEntries (quantity * puPrice)
//                 item.stockEntries.forEach(entry => {
//                     const quantity = Number(entry.quantity) || 0;
//                     const puPrice = Number(entry.puPrice) || 0;
//                     const stockValue = quantity * puPrice;
//                     itemStockValue += stockValue;
//                 });

//                 totalStockValue += itemStockValue;

//                 sendEvent('log', { 
//                     message: `Item ${item.name}: ${item.stockEntries.length} stock entries, Stock Value: ${itemStockValue.toFixed(2)}` 
//                 });
//             }

//             sendEvent('log', { message: `Total stock value from all items: ${totalStockValue.toFixed(2)}` });

//             // Find the Stock in hand company group
//             const stockGroup = await CompanyGroup.findOne({
//                 name: 'Stock in hand',
//                 company: companyId
//             }).session(session);

//             // Declare stockAccount variable at the proper scope
//             let stockAccount = null;

//             if (!stockGroup) {
//                 sendEvent('log', { message: 'Warning: Stock in hand company group not found' });
//             } else {
//                 // Find the Stock account
//                 stockAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: stockGroup._id,
//                     isActive: true
//                 }).session(session);

//                 if (!stockAccount) {
//                     sendEvent('log', { message: 'Warning: Stock account not found under Stock in hand group' });
//                 } else {
//                     sendEvent('log', { message: `Found Stock account: ${stockAccount.name}, updating with total stock value: ${totalStockValue.toFixed(2)}` });

//                     // Ensure stock account has the new fiscal year
//                     if (!stockAccount.fiscalYear.includes(newFiscalYear._id)) {
//                         stockAccount.fiscalYear.push(newFiscalYear._id);
//                     }

//                     // Update openingBalanceByFiscalYear for NEW fiscal year
//                     stockAccount.openingBalanceByFiscalYear = stockAccount.openingBalanceByFiscalYear.filter(
//                         f => !f.fiscalYear.equals(newFiscalYear._id)
//                     );

//                     stockAccount.openingBalanceByFiscalYear.push({
//                         fiscalYear: newFiscalYear._id,
//                         amount: totalStockValue,
//                         type: 'Dr', // Stock is an asset, so debit balance
//                         date: new Date()
//                     });

//                     // Update closingBalanceByFiscalYear for CURRENT fiscal year
//                     stockAccount.closingBalanceByFiscalYear = stockAccount.closingBalanceByFiscalYear.filter(
//                         f => !f.fiscalYear.equals(currentFiscalYear)
//                     );

//                     stockAccount.closingBalanceByFiscalYear.push({
//                         fiscalYear: currentFiscalYear,
//                         amount: totalStockValue,
//                         type: 'Dr', // Stock is an asset, so debit balance
//                         date: new Date()
//                     });

//                     // Also update the main openingBalance field for the new fiscal year
//                     stockAccount.openingBalance = {
//                         fiscalYear: newFiscalYear._id,
//                         amount: totalStockValue,
//                         type: 'Dr'
//                     };

//                     await stockAccount.save({ session });
//                     sendEvent('log', { message: `Successfully updated Stock account with total stock value: ${totalStockValue.toFixed(2)}` });
//                 }
//             }

//             sendEvent('progress', { value: 66 });

//             // Step 3: Process accounts in batches
//             sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
//             const accounts = await Account.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Define account groups that should have zero opening balance (except cash accounts)
//             const zeroBalanceGroups = await CompanyGroup.find({
//                 name: {
//                     $in: ['Purchase', 'Sale', 'Fixed Assets',
//                         'Reserves & Surplus',
//                         'Secured Loans',
//                         'Securities & Deposits',
//                         'Stock in hand',      // Already handled above, skip in regular processing
//                         'Unsecured Loans',
//                         'Expenses (Direct/Mfg.)',
//                         'Expenses (Indirect/Admn.)',
//                         'Income (Direct/Opr.)',
//                         'Income (Indirect)',
//                         'Loans & Advances',
//                         'Provisions/Expenses Payable',
//                         'Profit & Loss',
//                         'Current Assets',
//                     ]
//                 },
//                 company: companyId
//             }).select('_id').session(session);

//             const zeroBalanceGroupIds = zeroBalanceGroups.map(g => g._id.toString()); // Convert to string for easier comparison

//             // Get special account group IDs
//             const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup] = await Promise.all([
//                 CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session)
//             ]);

//             const cashInHandGroupId = cashInHandGroup?._id.toString();
//             const sundryDebtorsGroupId = sundryDebtorsGroup?._id.toString();
//             const sundryCreditorsGroupId = sundryCreditorsGroup?._id.toString();

//             const processAccountBatch = async (batch) => {
//                 return Promise.all(batch.map(async (account) => {
//                     try {
//                         // Skip stock account as it's already processed (only if stockAccount exists)
//                         if (stockAccount && account._id.equals(stockAccount._id)) {
//                             sendEvent('log', { message: `Skipping Stock account ${account.name} as it was already processed` });
//                             return;
//                         }

//                         const accountCompanyGroupId = account.companyGroups ? account.companyGroups.toString() : null;

//                         // Determine account type based on their company group
//                         const isCashAccount = accountCompanyGroupId === cashInHandGroupId;
//                         const isSundryAccount = accountCompanyGroupId === sundryDebtorsGroupId || accountCompanyGroupId === sundryCreditorsGroupId;
//                         const isZeroBalanceAccount = zeroBalanceGroupIds.includes(accountCompanyGroupId);

//                         // Build transaction query
//                         let transactionQuery = {
//                             account: account._id,
//                             company: companyId,
//                             fiscalYear: currentFiscalYear,
//                             type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt', 'BnkDep', 'BnkWtd'] }
//                         };

//                         // For Sundry Debtors/Creditors, filter out cash transactions from 'Sale'/'Purc' etc.
//                         if (isSundryAccount) {
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } }
//                             ];
//                         } else if (isCashAccount) {
//                             // For cash accounts, only consider transactions that involve cash
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: 'cash' },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'BnkWtd', 'BnkDep'] } }
//                             ];
//                         }

//                         // Get transactions for balance calculation
//                         const transactions = await Transaction.find(transactionQuery).session(session);

//                         // Calculate new opening balance - USING openingBalanceByFiscalYear
//                         let newOpeningBalance;
//                         if (isZeroBalanceAccount) {
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Resetting balance to zero for ${account.name} (Zero Balance Group)` });
//                         } else {
//                             // Get opening balance from openingBalanceByFiscalYear for current fiscal year
//                             const currentFiscalYearOpeningBalanceEntry = account.openingBalanceByFiscalYear?.find(
//                                 f => f.fiscalYear.equals(currentFiscalYear)
//                             );

//                             let runningBalance = 0;
//                             let startingBalanceType = 'Dr';

//                             if (currentFiscalYearOpeningBalanceEntry) {
//                                 runningBalance = Number(currentFiscalYearOpeningBalanceEntry.amount) || 0;
//                                 startingBalanceType = currentFiscalYearOpeningBalanceEntry.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using opening balance from openingBalanceByFiscalYear for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'}` });
//                             } else {
//                                 // Fallback to current openingBalance if no fiscal year entry found
//                                 runningBalance = Number(account.openingBalance?.amount) || 0;
//                                 startingBalanceType = account.openingBalance?.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using current account.openingBalance for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'} (fallback)` });
//                             }

//                             // Process all transactions to calculate running balance
//                             for (const transaction of transactions) {
//                                 const debit = Number(transaction.debit) || 0;
//                                 const credit = Number(transaction.credit) || 0;
//                                 if (debit > 0) runningBalance += debit;
//                                 if (credit > 0) runningBalance -= credit;
//                             }

//                             newOpeningBalance = {
//                                 amount: Math.abs(runningBalance),
//                                 type: runningBalance >= 0 ? 'Dr' : 'Cr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                         }

//                         // Update account for new fiscal year
//                         if (!account.fiscalYear.includes(newFiscalYear._id)) {
//                             account.fiscalYear.push(newFiscalYear._id);
//                         }

//                         // Remove existing opening balance entry for this fiscal year if it exists
//                         account.openingBalanceByFiscalYear = account.openingBalanceByFiscalYear.filter(
//                             f => !f.fiscalYear.equals(newFiscalYear._id)
//                         );

//                         account.openingBalanceByFiscalYear.push({
//                             fiscalYear: newFiscalYear._id,
//                             amount: Number(newOpeningBalance.amount) || 0,
//                             type: newOpeningBalance.type,
//                             date: new Date()
//                         });

//                         // Also update the main 'openingBalance' field of the account for the current active fiscal year
//                         account.openingBalance = {
//                             fiscalYear: newFiscalYear._id,
//                             amount: Number(newOpeningBalance.amount) || 0,
//                             type: newOpeningBalance.type
//                         };

//                         // Remove existing closing balance entry for current fiscal year if it exists
//                         account.closingBalanceByFiscalYear = account.closingBalanceByFiscalYear.filter(
//                             f => !f.fiscalYear.equals(currentFiscalYear)
//                         );

//                         account.closingBalanceByFiscalYear.push({
//                             fiscalYear: currentFiscalYear,
//                             amount: Number(newOpeningBalance.amount) || 0,
//                             type: newOpeningBalance.type,
//                             date: new Date()
//                         });

//                         await account.save({ session });
//                         sendEvent('log', {
//                             message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
//                                 (isZeroBalanceAccount ? ' (reset to zero)' : '') +
//                                 (isCashAccount ? ' (cash account)' : '') +
//                                 (isSundryAccount ? ' (sundry account)' : '')
//                         });
//                     } catch (saveError) {
//                         console.error(`Error processing account ${account.name}:`, saveError);
//                         throw saveError;
//                     }
//                 }));
//             };

//             // Process accounts in batches of 50
//             const BATCH_SIZE = 50;
//             let accountsProcessed = 0;
//             const totalAccounts = accounts.length;

//             for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
//                 const batch = accounts.slice(i, i + BATCH_SIZE);
//                 await processAccountBatch(batch);
//                 accountsProcessed += batch.length;

//                 // Update progress
//                 const progress = 66 + (accountsProcessed / totalAccounts * 34);
//                 sendEvent('progress', { value: Math.min(progress, 100) });
//             }

//             sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

//             // Initialize bill counters - Check for existing ones first
//             sendEvent('log', { message: 'Initializing bill counters...' });
//             const transactionTypes = [
//                 'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
//                 'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment', 'BankDeposit', 'BankWithdrawal'
//             ];

//             for (const transactionType of transactionTypes) {
//                 const existingCounter = await BillCounter.findOne({
//                     company: companyId,
//                     fiscalYear: newFiscalYear._id,
//                     transactionType
//                 }).session(session);

//                 if (!existingCounter) {
//                     await BillCounter.create([{
//                         company: companyId,
//                         fiscalYear: newFiscalYear._id,
//                         transactionType,
//                         currentBillNumber: 0
//                     }], { session });
//                 }
//             }

//             // Update session
//             req.session.currentFiscalYear = {
//                 id: newFiscalYear._id.toString(),
//                 startDate: newFiscalYear.startDate,
//                 endDate: newFiscalYear.endDate,
//                 name: newFiscalYear.name,
//                 dateFormat: newFiscalYear.dateFormat,
//                 isActive: true
//             };

//             // Mark transaction as committed
//             transactionCommitted = true;

//             sendEvent('progress', { value: 100 });
//             sendEvent('complete', { message: `Fiscal year ${fiscalYearName} created successfully! Current fiscal year set to ${fiscalYearName}.` });
//         }, transactionOptions); // End of withTransaction

//     } catch (err) {
//         console.error('Error in fiscal year creation:', err);

//         // Only abort if transaction wasn't committed
//         await safeAbortTransaction();

//         sendEvent('error', {
//             message: `Failed to create fiscal year: ${err.message}`,
//             details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     } finally {
//         try {
//             if (session.inTransaction()) { // Ensure session is not left hanging if transaction failed without explicit abort
//                 await safeAbortTransaction();
//             }
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session:', sessionError);
//         }
//         res.end(); // Always end the response
//     }

//     // Handle client disconnect
//     req.on('close', async () => {
//         // Ensure that if the client disconnects mid-transaction, it's aborted
//         await safeAbortTransaction();
//         try {
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session on client close:', sessionError);
//         }
//     });
// });


// router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
//         return res.end();
//     }

//     // Set headers for SSE
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//     });

//     // Function to send events
//     const sendEvent = (type, data) => {
//         res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
//     };

//     const session = await mongoose.startSession();
//     let transactionCommitted = false;
//     let transactionAborted = false;

//     // Helper function to safely abort transaction
//     const safeAbortTransaction = async () => {
//         if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
//             try {
//                 await session.abortTransaction();
//                 transactionAborted = true;
//             } catch (abortError) {
//                 // Ignore errors when aborting already aborted transaction
//                 if (!abortError.message.includes('abortTransaction twice')) {
//                     console.error('Error aborting transaction:', abortError);
//                 }
//             }
//         }
//     };

//     try {
//         // Start transaction with extended timeout and retry options
//         const transactionOptions = {
//             readConcern: { level: 'snapshot' },
//             writeConcern: { w: 'majority' },
//             maxTimeMS: 600000, // 10 minute timeout
//             retryWrites: true
//         };

//         await session.withTransaction(async () => {
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;

//             // Get parameters from query string
//             const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

//             let startDate, endDate;
//             if (dateFormat === 'nepali') {
//                 startDate = startDateNepali;
//                 endDate = endDateNepali;
//             } else if (dateFormat === 'english') {
//                 startDate = startDateEnglish;
//                 endDate = endDateEnglish;
//             } else {
//                 sendEvent('error', { message: 'Invalid date format' });
//                 throw new Error('Invalid date format');
//             }

//             if (!endDate) {
//                 // If endDate is not provided, calculate it as one year minus one day from startDate
//                 endDate = new Date(startDate);
//                 endDate.setFullYear(endDate.getFullYear() + 1);
//                 endDate.setDate(endDate.getDate() - 1);
//             }

//             const startDateObject = new Date(startDate);
//             const endDateObject = new Date(endDate);
//             const startYear = startDateObject.getFullYear();
//             const endYear = endDateObject.getFullYear();
//             const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

//             // Step 1: Create fiscal year
//             sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
//             sendEvent('progress', { value: 10 });

//             const existingFiscalYear = await FiscalYear.findOne({
//                 name: fiscalYearName,
//                 company: companyId
//             }).session(session);

//             if (existingFiscalYear) {
//                 sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
//                 throw new Error('Fiscal year already exists');
//             }

//             // Process in batches to avoid transaction timeouts
//             const processInBatches = async (items, processFn, batchSize = 50) => {
//                 for (let i = 0; i < items.length; i += batchSize) {
//                     const batch = items.slice(i, i + batchSize);
//                     await Promise.all(batch.map(item => processFn(item)));

//                     // Send progress updates
//                     const progress = 33 + (i / items.length * 33);
//                     sendEvent('progress', { value: Math.min(progress, 66) });
//                 }
//             };

//             const newFiscalYear = (await FiscalYear.create([{
//                 name: fiscalYearName,
//                 startDate: startDateObject,
//                 endDate: endDateObject,
//                 dateFormat,
//                 company: companyId
//             }], { session }))[0];

//             sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
//             sendEvent('progress', { value: 33 });

//             // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
//             sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

//             // Check if settings already exist for this user and company in new fiscal year
//             const existingSettings = await Settings.findOne({
//                 company: companyId,
//                 fiscalYear: newFiscalYear._id,
//                 userId: req.user.id
//             }).session(session);

//             if (existingSettings) {
//                 sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
//             } else {
//                 const currentSettings = await Settings.findOne({
//                     company: companyId,
//                     fiscalYear: currentFiscalYear,
//                     userId: req.user.id
//                 }).session(session);

//                 if (currentSettings) {
//                     // Create new settings with unique _id and proper fiscal year reference
//                     const newSettingsData = {
//                         ...currentSettings.toObject(),
//                         _id: new mongoose.Types.ObjectId(), // Generate new unique ID
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     };
//                     // Remove any existing _id to ensure new one is used
//                     delete newSettingsData._id;

//                     await Settings.create([newSettingsData], { session });
//                     sendEvent('log', { message: 'Settings cloned successfully' });
//                 } else {
//                     // Create default settings
//                     await Settings.create([{
//                         company: companyId,
//                         userId: req.user.id,
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     }], { session });
//                     sendEvent('log', { message: 'Created default settings for new fiscal year' });
//                 }
//             }

//             // Step 2: Process items in batches
//             sendEvent('log', { message: 'Creating items for new fiscal year...' });
//             const items = await Item.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Store total stock value for stock account update
//             let totalStockValue = 0;

//             await processInBatches(items, async (item) => {
//                 try {
//                     // Get ALL transactions that affect stock for this item
//                     const stockTransactions = await Transaction.find({
//                         item: item._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
//                     }).sort({ date: 1 }).session(session);

//                     // Calculate current stock by processing all transactions
//                     let currentStock = Number(item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock) || 0;
//                     let totalPurchases = 0;
//                     let totalSales = 0;
//                     let totalPurchaseReturns = 0;
//                     let totalSalesReturns = 0;
//                     let totalAdjustments = 0;

//                     for (const transaction of stockTransactions) {
//                         const quantity = Number(transaction.quantity) || 0;
//                         const adjustmentQuantity = Number(transaction.adjustmentQuantity) || 0;

//                         switch (transaction.type) {
//                             case 'Purc': // Purchase
//                                 currentStock += quantity;
//                                 totalPurchases += quantity;
//                                 break;
//                             case 'Sale': // Sale
//                                 currentStock -= quantity;
//                                 totalSales += quantity;
//                                 break;
//                             case 'PrRt': // Purchase Return
//                                 currentStock -= quantity;
//                                 totalPurchaseReturns += quantity;
//                                 break;
//                             case 'SlRt': // Sales Return
//                                 currentStock += quantity;
//                                 totalSalesReturns += quantity;
//                                 break;
//                             case 'StockAdjustment': // Stock Adjustment
//                                 currentStock += adjustmentQuantity;
//                                 totalAdjustments += adjustmentQuantity;
//                                 break;
//                         }
//                     }

//                     // Calculate weighted average purchase price from stockEntries
//                     let totalQuantityFromEntries = 0;
//                     let totalPriceFromEntries = 0;
//                     let totalSalesPriceFromEntries = 0;

//                     for (const entry of item.stockEntries) {
//                         const entryPuPrice = Number(entry.puPrice) || 0;
//                         const entryQuantity = Number(entry.quantity) || 0;
//                         const entryPrice = Number(entry.price) || 0;

//                         if (entryPuPrice > 0 && entryQuantity > 0) {
//                             totalQuantityFromEntries += entryQuantity;
//                             totalPriceFromEntries += entryQuantity * entryPuPrice;
//                             totalSalesPriceFromEntries += entryQuantity * entryPrice;
//                         }
//                     }

//                     let purchasePrice = 0;
//                     let salesPrice = 0;

//                     if (totalQuantityFromEntries > 0) {
//                         purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
//                         salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
//                     } else {
//                         // Fallback to transaction-based calculation if no valid stock entries
//                         const purchases = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Purc',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalQuantity = 0;
//                         let totalPrice = 0;
//                         for (let purchase of purchases) {
//                             const purchaseQuantity = Number(purchase.quantity) || 0;
//                             const purchasePuPrice = Number(purchase.puPrice) || 0;
//                             if (purchaseQuantity > 0 && purchasePuPrice > 0) {
//                                 totalQuantity += purchaseQuantity;
//                                 totalPrice += purchaseQuantity * purchasePuPrice;
//                             }
//                         }

//                         // Ensure item.puPrice is also a number for fallback
//                         purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : (Number(item.puPrice) || 0);

//                         const salesTransactions = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Sale',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalSalesQuantity = 0;
//                         let totalSalesPrice = 0;
//                         for (let sale of salesTransactions) {
//                             const saleSalesPrice = Number(sale.salesPrice) || 0;
//                             const saleQuantity = Number(sale.quantity) || 0;
//                             if (saleSalesPrice > 0 && saleQuantity > 0) {
//                                 totalSalesQuantity += saleQuantity;
//                                 totalSalesPrice += saleQuantity * saleSalesPrice;
//                             }
//                         }
//                         salesPrice = totalSalesQuantity > 0 ? (totalSalesPrice / totalSalesQuantity) : (Number(item.price) || 0); // Use item.price as fallback if no sales transactions
//                     }

//                     // Ensure all final values are numbers, defaulting to 0 if NaN
//                     purchasePrice = Number(purchasePrice) || 0;
//                     salesPrice = Number(salesPrice) || 0;

//                     const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
//                     const openingStock = Number(openingStockFromEntries > 0 ? openingStockFromEntries : currentStock) || 0;
//                     const openingStockValue = Number(purchasePrice * openingStock) || 0; // Ensure this is a number

//                     sendEvent('log', {
//                         message: `Item ${item.name} - ` +
//                             `Stock from Entries: ${openingStockFromEntries}, ` +
//                             `Purchases: ${totalPurchases}, ` +
//                             `Sales: ${totalSales}, ` +
//                             `Purchase Returns: ${totalPurchaseReturns}, ` +
//                             `Sales Returns: ${totalSalesReturns}, ` +
//                             `Adjustments: ${totalAdjustments},` +
//                             `Calculated Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
//                     });

//                     // Prepare fiscal year array
//                     const updatedFiscalYear = item.fiscalYear.includes(newFiscalYear._id) 
//                         ? item.fiscalYear 
//                         : [...item.fiscalYear, newFiscalYear._id];

//                     // Prepare openingStockByFiscalYear array
//                     const updatedOpeningStockByFiscalYear = item.openingStockByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             openingStock: openingStock,
//                             openingStockValue: openingStockValue,
//                             purchasePrice: purchasePrice,
//                             salesPrice: salesPrice,
//                         }]);

//                     // Prepare closingStockByFiscalYear array
//                     const updatedClosingStockByFiscalYear = item.closingStockByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             closingStock: openingStock,
//                             closingStockValue: openingStockValue,
//                             purchasePrice: purchasePrice,
//                             salesPrice: salesPrice,
//                         }]);

//                     // Update item using findOneAndUpdate to avoid version conflicts
//                     await Item.findOneAndUpdate(
//                         { _id: item._id },
//                         {
//                             $set: {
//                                 fiscalYear: updatedFiscalYear,
//                                 openingStockByFiscalYear: updatedOpeningStockByFiscalYear,
//                                 closingStockByFiscalYear: updatedClosingStockByFiscalYear,
//                                 stock: openingStock,
//                                 openingStock: openingStock
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { message: `Updated item: ${item.name} with new opening stock: ${openingStock} and value: ${openingStockValue}` });
//                 } catch (saveError) {
//                     console.error(`Error processing item ${item.name}:`, saveError);
//                     throw saveError;
//                 }
//             });

//             // STEP 2.5: CALCULATE TOTAL STOCK VALUE FROM STOCK ENTRIES AND UPDATE STOCK ACCOUNT
//             sendEvent('log', { message: 'Calculating total stock value from stock entries...' });

//             // Recalculate total stock value from ALL stock entries (quantity * puPrice)
//             totalStockValue = 0;

//             // Process each item to calculate stock value from stockEntries
//             for (const item of items) {
//                 let itemStockValue = 0;

//                 // Calculate stock value from stockEntries (quantity * puPrice)
//                 item.stockEntries.forEach(entry => {
//                     const quantity = Number(entry.quantity) || 0;
//                     const puPrice = Number(entry.puPrice) || 0;
//                     const stockValue = quantity * puPrice;
//                     itemStockValue += stockValue;
//                 });

//                 totalStockValue += itemStockValue;

//                 sendEvent('log', { 
//                     message: `Item ${item.name}: ${item.stockEntries.length} stock entries, Stock Value: ${itemStockValue.toFixed(2)}` 
//                 });
//             }

//             sendEvent('log', { message: `Total stock value from all items: ${totalStockValue.toFixed(2)}` });

//             // Find the Stock in hand company group
//             const stockGroup = await CompanyGroup.findOne({
//                 name: 'Stock in hand',
//                 company: companyId
//             }).session(session);

//             // Declare stockAccount variable at the proper scope
//             let stockAccount = null;

//             if (!stockGroup) {
//                 sendEvent('log', { message: 'Warning: Stock in hand company group not found' });
//             } else {
//                 // Find the Stock account
//                 stockAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: stockGroup._id,
//                     isActive: true
//                 }).session(session);

//                 if (!stockAccount) {
//                     sendEvent('log', { message: 'Warning: Stock account not found under Stock in hand group' });
//                 } else {
//                     sendEvent('log', { message: `Found Stock account: ${stockAccount.name}, updating with total stock value: ${totalStockValue.toFixed(2)}` });

//                     // Prepare fiscal year array
//                     const updatedFiscalYear = stockAccount.fiscalYear.includes(newFiscalYear._id) 
//                         ? stockAccount.fiscalYear 
//                         : [...stockAccount.fiscalYear, newFiscalYear._id];

//                     // Prepare openingBalanceByFiscalYear array
//                     const updatedOpeningBalanceByFiscalYear = stockAccount.openingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             amount: totalStockValue,
//                             type: 'Dr', // Stock is an asset, so debit balance
//                             date: new Date()
//                         }]);

//                     // Prepare closingBalanceByFiscalYear array
//                     const updatedClosingBalanceByFiscalYear = stockAccount.closingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             amount: totalStockValue,
//                             type: 'Dr', // Stock is an asset, so debit balance
//                             date: new Date()
//                         }]);

//                     // Update stock account using findOneAndUpdate to avoid version conflicts
//                     await Account.findOneAndUpdate(
//                         { _id: stockAccount._id },
//                         {
//                             $set: {
//                                 fiscalYear: updatedFiscalYear,
//                                 openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                                 closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                                 openingBalance: {
//                                     fiscalYear: newFiscalYear._id,
//                                     amount: totalStockValue,
//                                     type: 'Dr'
//                                 }
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { message: `Successfully updated Stock account with total stock value: ${totalStockValue.toFixed(2)}` });
//                 }
//             }

//             sendEvent('progress', { value: 66 });

//             // Step 3: Process accounts in batches
//             sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
//             const accounts = await Account.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Define account groups that should have zero opening balance (except cash accounts)
//             const zeroBalanceGroups = await CompanyGroup.find({
//                 name: {
//                     $in: ['Purchase', 'Sale', 'Fixed Assets',
//                         'Reserves & Surplus',
//                         'Secured Loans',
//                         'Securities & Deposits',
//                         'Stock in hand',      // Already handled above, skip in regular processing
//                         'Unsecured Loans',
//                         'Expenses (Direct/Mfg.)',
//                         'Expenses (Indirect/Admn.)',
//                         'Income (Direct/Opr.)',
//                         'Income (Indirect)',
//                         'Loans & Advances',
//                         'Provisions/Expenses Payable',
//                         'Current Assets',
//                     ]
//                 },
//                 company: companyId
//             }).select('_id').session(session);

//             const zeroBalanceGroupIds = zeroBalanceGroups.map(g => g._id.toString()); // Convert to string for easier comparison

//             // Get special account group IDs
//             const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup, profitLossGroup] = await Promise.all([
//                 CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Profit & Loss', company: companyId }).select('_id').session(session)
//             ]);

//             const cashInHandGroupId = cashInHandGroup?._id.toString();
//             const sundryDebtorsGroupId = sundryDebtorsGroup?._id.toString();
//             const sundryCreditorsGroupId = sundryCreditorsGroup?._id.toString();
//             const profitLossGroupId = profitLossGroup?._id.toString();

//             // Find Profit & Loss account
//             let profitLossAccount = null;
//             if (profitLossGroupId) {
//                 profitLossAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: profitLossGroupId,
//                     isActive: true
//                 }).session(session);
//             }

//             // Variables to track total debit and credit balances
//             let totalDebitBalance = 0;
//             let totalCreditBalance = 0;

//             const processAccountBatch = async (batch) => {
//                 return Promise.all(batch.map(async (account) => {
//                     try {
//                         // Skip stock account as it's already processed (only if stockAccount exists)
//                         if (stockAccount && account._id.equals(stockAccount._id)) {
//                             sendEvent('log', { message: `Skipping Stock account ${account.name} as it was already processed` });
//                             return;
//                         }

//                         const accountCompanyGroupId = account.companyGroups ? account.companyGroups.toString() : null;

//                         // Determine account type based on their company group
//                         const isCashAccount = accountCompanyGroupId === cashInHandGroupId;
//                         const isSundryAccount = accountCompanyGroupId === sundryDebtorsGroupId || accountCompanyGroupId === sundryCreditorsGroupId;
//                         const isZeroBalanceAccount = zeroBalanceGroupIds.includes(accountCompanyGroupId);
//                         const isProfitLossAccount = profitLossAccount && account._id.equals(profitLossAccount._id);

//                         // Build transaction query
//                         let transactionQuery = {
//                             account: account._id,
//                             company: companyId,
//                             fiscalYear: currentFiscalYear,
//                             type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt', 'BnkDep', 'BnkWtd'] }
//                         };

//                         // For Sundry Debtors/Creditors, filter out cash transactions from 'Sale'/'Purc' etc.
//                         if (isSundryAccount) {
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } }
//                             ];
//                         } else if (isCashAccount) {
//                             // For cash accounts, only consider transactions that involve cash
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: 'cash' },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'BnkWtd', 'BnkDep'] } }
//                             ];
//                         }

//                         // Get transactions for balance calculation
//                         const transactions = await Transaction.find(transactionQuery).session(session);

//                         // Calculate new opening balance - USING openingBalanceByFiscalYear
//                         let newOpeningBalance;
//                         if (isZeroBalanceAccount) {
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Resetting balance to zero for ${account.name} (Zero Balance Group)` });
//                         } else {
//                             // Get opening balance from openingBalanceByFiscalYear for current fiscal year
//                             const currentFiscalYearOpeningBalanceEntry = account.openingBalanceByFiscalYear?.find(
//                                 f => f.fiscalYear.equals(currentFiscalYear)
//                             );

//                             let runningBalance = 0;
//                             let startingBalanceType = 'Dr';

//                             if (currentFiscalYearOpeningBalanceEntry) {
//                                 runningBalance = Number(currentFiscalYearOpeningBalanceEntry.amount) || 0;
//                                 startingBalanceType = currentFiscalYearOpeningBalanceEntry.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using opening balance from openingBalanceByFiscalYear for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'}` });
//                             } else {
//                                 // Fallback to current openingBalance if no fiscal year entry found
//                                 runningBalance = Number(account.openingBalance?.amount) || 0;
//                                 startingBalanceType = account.openingBalance?.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using current account.openingBalance for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'} (fallback)` });
//                             }

//                             // Process all transactions to calculate running balance
//                             for (const transaction of transactions) {
//                                 const debit = Number(transaction.debit) || 0;
//                                 const credit = Number(transaction.credit) || 0;
//                                 if (debit > 0) runningBalance += debit;
//                                 if (credit > 0) runningBalance -= credit;
//                             }

//                             newOpeningBalance = {
//                                 amount: Math.abs(runningBalance),
//                                 type: runningBalance >= 0 ? 'Dr' : 'Cr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                         }

//                         // Track total balances for Profit & Loss calculation
//                         if (newOpeningBalance.type === 'Dr') {
//                             totalDebitBalance += newOpeningBalance.amount;
//                         } else {
//                             totalCreditBalance += newOpeningBalance.amount;
//                         }

//                         // Prepare fiscal year array
//                         const updatedFiscalYear = account.fiscalYear.includes(newFiscalYear._id) 
//                             ? account.fiscalYear 
//                             : [...account.fiscalYear, newFiscalYear._id];

//                         // Prepare openingBalanceByFiscalYear array
//                         const updatedOpeningBalanceByFiscalYear = account.openingBalanceByFiscalYear
//                             .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                             .concat([{
//                                 fiscalYear: newFiscalYear._id,
//                                 amount: Number(newOpeningBalance.amount) || 0,
//                                 type: newOpeningBalance.type,
//                                 date: new Date()
//                             }]);

//                         // Prepare closingBalanceByFiscalYear array
//                         const updatedClosingBalanceByFiscalYear = account.closingBalanceByFiscalYear
//                             .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                             .concat([{
//                                 fiscalYear: currentFiscalYear,
//                                 amount: Number(newOpeningBalance.amount) || 0,
//                                 type: newOpeningBalance.type,
//                                 date: new Date()
//                             }]);

//                         // Update account using findOneAndUpdate to avoid version conflicts
//                         await Account.findOneAndUpdate(
//                             { _id: account._id },
//                             {
//                                 $set: {
//                                     fiscalYear: updatedFiscalYear,
//                                     openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                                     closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                                     openingBalance: {
//                                         fiscalYear: newFiscalYear._id,
//                                         amount: Number(newOpeningBalance.amount) || 0,
//                                         type: newOpeningBalance.type
//                                     }
//                                 }
//                             },
//                             { session, new: true }
//                         );

//                         sendEvent('log', {
//                             message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
//                                 (isZeroBalanceAccount ? ' (reset to zero)' : '') +
//                                 (isCashAccount ? ' (cash account)' : '') +
//                                 (isSundryAccount ? ' (sundry account)' : '')
//                         });
//                     } catch (saveError) {
//                         console.error(`Error processing account ${account.name}:`, saveError);
//                         throw saveError;
//                     }
//                 }));
//             };

//             // Process accounts in batches of 50
//             const BATCH_SIZE = 50;
//             let accountsProcessed = 0;
//             const totalAccounts = accounts.length;

//             for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
//                 const batch = accounts.slice(i, i + BATCH_SIZE);
//                 await processAccountBatch(batch);
//                 accountsProcessed += batch.length;

//                 // Update progress
//                 const progress = 66 + (accountsProcessed / totalAccounts * 34);
//                 sendEvent('progress', { value: Math.min(progress, 100) });
//             }

//             sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

//             // STEP 4: CALCULATE AND UPDATE PROFIT & LOSS ACCOUNT
//             sendEvent('log', { message: 'Calculating Profit & Loss adjustment...' });

//             // Calculate the difference between total debit and credit balances
//             const balanceDifference = Math.abs(totalDebitBalance - totalCreditBalance);
//             const isProfit = totalCreditBalance > totalDebitBalance; // Credit > Debit = Profit
//             const isLoss = totalDebitBalance > totalCreditBalance;   // Debit > Credit = Loss

//             sendEvent('log', { 
//                 message: `Total Debit Balance: ${totalDebitBalance.toFixed(2)}, Total Credit Balance: ${totalCreditBalance.toFixed(2)}, Difference: ${balanceDifference.toFixed(2)} (${isProfit ? 'Profit' : 'Loss'})` 
//             });

//             // Update Profit & Loss account with the difference
//             if (profitLossAccount && balanceDifference > 0) {
//                 sendEvent('log', { message: `Updating Profit & Loss account with ${isProfit ? 'profit' : 'loss'} amount: ${balanceDifference.toFixed(2)}` });

//                 // Prepare fiscal year array
//                 const updatedFiscalYear = profitLossAccount.fiscalYear.includes(newFiscalYear._id) 
//                     ? profitLossAccount.fiscalYear 
//                     : [...profitLossAccount.fiscalYear, newFiscalYear._id];

//                 // Prepare openingBalanceByFiscalYear array
//                 const updatedOpeningBalanceByFiscalYear = profitLossAccount.openingBalanceByFiscalYear
//                     .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                     .concat([{
//                         fiscalYear: newFiscalYear._id,
//                         amount: balanceDifference,
//                         type: isProfit ? 'Cr' : 'Dr', // Profit is Credit, Loss is Debit
//                         date: new Date()
//                     }]);

//                 // Prepare closingBalanceByFiscalYear array
//                 const updatedClosingBalanceByFiscalYear = profitLossAccount.closingBalanceByFiscalYear
//                     .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                     .concat([{
//                         fiscalYear: currentFiscalYear,
//                         amount: balanceDifference,
//                         type: isProfit ? 'Cr' : 'Dr', // Profit is Credit, Loss is Debit
//                         date: new Date()
//                     }]);

//                 // Update Profit & Loss account using findOneAndUpdate to avoid version conflicts
//                 await Account.findOneAndUpdate(
//                     { _id: profitLossAccount._id },
//                     {
//                         $set: {
//                             fiscalYear: updatedFiscalYear,
//                             openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                             closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                             openingBalance: {
//                                 fiscalYear: newFiscalYear._id,
//                                 amount: balanceDifference,
//                                 type: isProfit ? 'Cr' : 'Dr'
//                             }
//                         }
//                     },
//                     { session, new: true }
//                 );

//                 sendEvent('log', { message: `Successfully updated Profit & Loss account with ${isProfit ? 'profit' : 'loss'} amount: ${balanceDifference.toFixed(2)}` });
//             } else if (!profitLossAccount) {
//                 sendEvent('log', { message: 'Warning: Profit & Loss account not found, skipping P&L adjustment' });
//             }

//             // Initialize bill counters - Check for existing ones first
//             sendEvent('log', { message: 'Initializing bill counters...' });
//             const transactionTypes = [
//                 'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
//                 'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment', 'BankDeposit', 'BankWithdrawal'
//             ];

//             for (const transactionType of transactionTypes) {
//                 const existingCounter = await BillCounter.findOne({
//                     company: companyId,
//                     fiscalYear: newFiscalYear._id,
//                     transactionType
//                 }).session(session);

//                 if (!existingCounter) {
//                     await BillCounter.create([{
//                         company: companyId,
//                         fiscalYear: newFiscalYear._id,
//                         transactionType,
//                         currentBillNumber: 0
//                     }], { session });
//                 }
//             }

//             // Update session
//             req.session.currentFiscalYear = {
//                 id: newFiscalYear._id.toString(),
//                 startDate: newFiscalYear.startDate,
//                 endDate: newFiscalYear.endDate,
//                 name: newFiscalYear.name,
//                 dateFormat: newFiscalYear.dateFormat,
//                 isActive: true
//             };

//             // Mark transaction as committed
//             transactionCommitted = true;

//             sendEvent('progress', { value: 100 });
//             sendEvent('complete', { message: `Fiscal year ${fiscalYearName} created successfully! Current fiscal year set to ${fiscalYearName}.` });
//         }, transactionOptions); // End of withTransaction

//     } catch (err) {
//         console.error('Error in fiscal year creation:', err);

//         // Only abort if transaction wasn't committed
//         await safeAbortTransaction();

//         sendEvent('error', {
//             message: `Failed to create fiscal year: ${err.message}`,
//             details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     } finally {
//         try {
//             if (session.inTransaction()) { // Ensure session is not left hanging if transaction failed without explicit abort
//                 await safeAbortTransaction();
//             }
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session:', sessionError);
//         }
//         res.end(); // Always end the response
//     }

//     // Handle client disconnect
//     req.on('close', async () => {
//         // Ensure that if the client disconnects mid-transaction, it's aborted
//         await safeAbortTransaction();
//         try {
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session on client close:', sessionError);
//         }
//     });
// });

// router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
//         return res.end();
//     }

//     // Set headers for SSE
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//     });

//     // Function to send events
//     const sendEvent = (type, data) => {
//         res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
//     };

//     const session = await mongoose.startSession();
//     let transactionCommitted = false;
//     let transactionAborted = false;

//     // Helper function to safely abort transaction
//     const safeAbortTransaction = async () => {
//         if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
//             try {
//                 await session.abortTransaction();
//                 transactionAborted = true;
//             } catch (abortError) {
//                 // Ignore errors when aborting already aborted transaction
//                 if (!abortError.message.includes('abortTransaction twice')) {
//                     console.error('Error aborting transaction:', abortError);
//                 }
//             }
//         }
//     };

//     try {
//         // Start transaction with extended timeout and retry options
//         const transactionOptions = {
//             readConcern: { level: 'snapshot' },
//             writeConcern: { w: 'majority' },
//             maxTimeMS: 600000, // 10 minute timeout
//             retryWrites: true
//         };

//         await session.withTransaction(async () => {
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;

//             // Get parameters from query string
//             const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

//             let startDate, endDate;
//             if (dateFormat === 'nepali') {
//                 startDate = startDateNepali;
//                 endDate = endDateNepali;
//             } else if (dateFormat === 'english') {
//                 startDate = startDateEnglish;
//                 endDate = endDateEnglish;
//             } else {
//                 sendEvent('error', { message: 'Invalid date format' });
//                 throw new Error('Invalid date format');
//             }

//             if (!endDate) {
//                 // If endDate is not provided, calculate it as one year minus one day from startDate
//                 endDate = new Date(startDate);
//                 endDate.setFullYear(endDate.getFullYear() + 1);
//                 endDate.setDate(endDate.getDate() - 1);
//             }

//             const startDateObject = new Date(startDate);
//             const endDateObject = new Date(endDate);
//             const startYear = startDateObject.getFullYear();
//             const endYear = endDateObject.getFullYear();
//             const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

//             // Step 1: Create fiscal year
//             sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
//             sendEvent('progress', { value: 10 });

//             const existingFiscalYear = await FiscalYear.findOne({
//                 name: fiscalYearName,
//                 company: companyId
//             }).session(session);

//             if (existingFiscalYear) {
//                 sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
//                 throw new Error('Fiscal year already exists');
//             }

//             // Process in batches to avoid transaction timeouts
//             const processInBatches = async (items, processFn, batchSize = 50) => {
//                 for (let i = 0; i < items.length; i += batchSize) {
//                     const batch = items.slice(i, i + batchSize);
//                     await Promise.all(batch.map(item => processFn(item)));

//                     // Send progress updates
//                     const progress = 33 + (i / items.length * 33);
//                     sendEvent('progress', { value: Math.min(progress, 66) });
//                 }
//             };

//             const newFiscalYear = (await FiscalYear.create([{
//                 name: fiscalYearName,
//                 startDate: startDateObject,
//                 endDate: endDateObject,
//                 dateFormat,
//                 company: companyId
//             }], { session }))[0];

//             sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
//             sendEvent('progress', { value: 33 });

//             // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
//             sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

//             // Check if settings already exist for this user and company in new fiscal year
//             const existingSettings = await Settings.findOne({
//                 company: companyId,
//                 fiscalYear: newFiscalYear._id,
//                 userId: req.user.id
//             }).session(session);

//             if (existingSettings) {
//                 sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
//             } else {
//                 const currentSettings = await Settings.findOne({
//                     company: companyId,
//                     fiscalYear: currentFiscalYear,
//                     userId: req.user.id
//                 }).session(session);

//                 if (currentSettings) {
//                     // Create new settings with unique _id and proper fiscal year reference
//                     const newSettingsData = {
//                         ...currentSettings.toObject(),
//                         _id: new mongoose.Types.ObjectId(), // Generate new unique ID
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     };
//                     // Remove any existing _id to ensure new one is used
//                     delete newSettingsData._id;

//                     await Settings.create([newSettingsData], { session });
//                     sendEvent('log', { message: 'Settings cloned successfully' });
//                 } else {
//                     // Create default settings
//                     await Settings.create([{
//                         company: companyId,
//                         userId: req.user.id,
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     }], { session });
//                     sendEvent('log', { message: 'Created default settings for new fiscal year' });
//                 }
//             }

//             // Step 2: Process items in batches
//             sendEvent('log', { message: 'Creating items for new fiscal year...' });
//             const items = await Item.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Store total stock value for stock account update
//             let totalStockValue = 0;

//             await processInBatches(items, async (item) => {
//                 try {
//                     // Get ALL transactions that affect stock for this item
//                     const stockTransactions = await Transaction.find({
//                         item: item._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
//                     }).sort({ date: 1 }).session(session);

//                     // Calculate current stock by processing all transactions
//                     let currentStock = Number(item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock) || 0;
//                     let totalPurchases = 0;
//                     let totalSales = 0;
//                     let totalPurchaseReturns = 0;
//                     let totalSalesReturns = 0;
//                     let totalAdjustments = 0;

//                     for (const transaction of stockTransactions) {
//                         const quantity = Number(transaction.quantity) || 0;
//                         const adjustmentQuantity = Number(transaction.adjustmentQuantity) || 0;

//                         switch (transaction.type) {
//                             case 'Purc': // Purchase
//                                 currentStock += quantity;
//                                 totalPurchases += quantity;
//                                 break;
//                             case 'Sale': // Sale
//                                 currentStock -= quantity;
//                                 totalSales += quantity;
//                                 break;
//                             case 'PrRt': // Purchase Return
//                                 currentStock -= quantity;
//                                 totalPurchaseReturns += quantity;
//                                 break;
//                             case 'SlRt': // Sales Return
//                                 currentStock += quantity;
//                                 totalSalesReturns += quantity;
//                                 break;
//                             case 'StockAdjustment': // Stock Adjustment
//                                 currentStock += adjustmentQuantity;
//                                 totalAdjustments += adjustmentQuantity;
//                                 break;
//                         }
//                     }

//                     // Calculate weighted average purchase price from stockEntries
//                     let totalQuantityFromEntries = 0;
//                     let totalPriceFromEntries = 0;
//                     let totalSalesPriceFromEntries = 0;

//                     for (const entry of item.stockEntries) {
//                         const entryPuPrice = Number(entry.puPrice) || 0;
//                         const entryQuantity = Number(entry.quantity) || 0;
//                         const entryPrice = Number(entry.price) || 0;

//                         if (entryPuPrice > 0 && entryQuantity > 0) {
//                             totalQuantityFromEntries += entryQuantity;
//                             totalPriceFromEntries += entryQuantity * entryPuPrice;
//                             totalSalesPriceFromEntries += entryQuantity * entryPrice;
//                         }
//                     }

//                     let purchasePrice = 0;
//                     let salesPrice = 0;

//                     if (totalQuantityFromEntries > 0) {
//                         purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
//                         salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
//                     } else {
//                         // Fallback to transaction-based calculation if no valid stock entries
//                         const purchases = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Purc',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalQuantity = 0;
//                         let totalPrice = 0;
//                         for (let purchase of purchases) {
//                             const purchaseQuantity = Number(purchase.quantity) || 0;
//                             const purchasePuPrice = Number(purchase.puPrice) || 0;
//                             if (purchaseQuantity > 0 && purchasePuPrice > 0) {
//                                 totalQuantity += purchaseQuantity;
//                                 totalPrice += purchaseQuantity * purchasePuPrice;
//                             }
//                         }

//                         // Ensure item.puPrice is also a number for fallback
//                         purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : (Number(item.puPrice) || 0);

//                         const salesTransactions = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Sale',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalSalesQuantity = 0;
//                         let totalSalesPrice = 0;
//                         for (let sale of salesTransactions) {
//                             const saleSalesPrice = Number(sale.salesPrice) || 0;
//                             const saleQuantity = Number(sale.quantity) || 0;
//                             if (saleSalesPrice > 0 && saleQuantity > 0) {
//                                 totalSalesQuantity += saleQuantity;
//                                 totalSalesPrice += saleQuantity * saleSalesPrice;
//                             }
//                         }
//                         salesPrice = totalSalesQuantity > 0 ? (totalSalesPrice / totalSalesQuantity) : (Number(item.price) || 0); // Use item.price as fallback if no sales transactions
//                     }

//                     // Ensure all final values are numbers, defaulting to 0 if NaN
//                     purchasePrice = Number(purchasePrice) || 0;
//                     salesPrice = Number(salesPrice) || 0;

//                     const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
//                     const openingStock = Number(openingStockFromEntries > 0 ? openingStockFromEntries : currentStock) || 0;
//                     const openingStockValue = Number(purchasePrice * openingStock) || 0; // Ensure this is a number

//                     sendEvent('log', {
//                         message: `Item ${item.name} - ` +
//                             `Stock from Entries: ${openingStockFromEntries}, ` +
//                             `Purchases: ${totalPurchases}, ` +
//                             `Sales: ${totalSales}, ` +
//                             `Purchase Returns: ${totalPurchaseReturns}, ` +
//                             `Sales Returns: ${totalSalesReturns}, ` +
//                             `Adjustments: ${totalAdjustments},` +
//                             `Calculated Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
//                     });

//                     // Prepare fiscal year array
//                     const updatedFiscalYear = item.fiscalYear.includes(newFiscalYear._id) 
//                         ? item.fiscalYear 
//                         : [...item.fiscalYear, newFiscalYear._id];

//                     // Prepare openingStockByFiscalYear array
//                     const updatedOpeningStockByFiscalYear = item.openingStockByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             openingStock: openingStock,
//                             openingStockValue: openingStockValue,
//                             purchasePrice: purchasePrice,
//                             salesPrice: salesPrice,
//                         }]);

//                     // Prepare closingStockByFiscalYear array
//                     const updatedClosingStockByFiscalYear = item.closingStockByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             closingStock: openingStock,
//                             closingStockValue: openingStockValue,
//                             purchasePrice: purchasePrice,
//                             salesPrice: salesPrice,
//                         }]);

//                     // Update item using findOneAndUpdate to avoid version conflicts
//                     await Item.findOneAndUpdate(
//                         { _id: item._id },
//                         {
//                             $set: {
//                                 fiscalYear: updatedFiscalYear,
//                                 openingStockByFiscalYear: updatedOpeningStockByFiscalYear,
//                                 closingStockByFiscalYear: updatedClosingStockByFiscalYear,
//                                 stock: openingStock,
//                                 openingStock: openingStock
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { message: `Updated item: ${item.name} with new opening stock: ${openingStock} and value: ${openingStockValue}` });
//                 } catch (saveError) {
//                     console.error(`Error processing item ${item.name}:`, saveError);
//                     throw saveError;
//                 }
//             });

//             // STEP 2.5: CALCULATE TOTAL STOCK VALUE FROM STOCK ENTRIES AND UPDATE STOCK ACCOUNT
//             sendEvent('log', { message: 'Calculating total stock value from stock entries...' });

//             // Recalculate total stock value from ALL stock entries (quantity * puPrice)
//             totalStockValue = 0;

//             // Process each item to calculate stock value from stockEntries
//             for (const item of items) {
//                 let itemStockValue = 0;

//                 // Calculate stock value from stockEntries (quantity * puPrice)
//                 item.stockEntries.forEach(entry => {
//                     const quantity = Number(entry.quantity) || 0;
//                     const puPrice = Number(entry.puPrice) || 0;
//                     const stockValue = quantity * puPrice;
//                     itemStockValue += stockValue;
//                 });

//                 totalStockValue += itemStockValue;

//                 sendEvent('log', { 
//                     message: `Item ${item.name}: ${item.stockEntries.length} stock entries, Stock Value: ${itemStockValue.toFixed(2)}` 
//                 });
//             }

//             sendEvent('log', { message: `Total stock value from all items: ${totalStockValue.toFixed(2)}` });

//             // Find the Stock in hand company group
//             const stockGroup = await CompanyGroup.findOne({
//                 name: 'Stock in hand',
//                 company: companyId
//             }).session(session);

//             // Declare stockAccount variable at the proper scope
//             let stockAccount = null;

//             if (!stockGroup) {
//                 sendEvent('log', { message: 'Warning: Stock in hand company group not found' });
//             } else {
//                 // Find the Stock account
//                 stockAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: stockGroup._id,
//                     isActive: true
//                 }).session(session);

//                 if (!stockAccount) {
//                     sendEvent('log', { message: 'Warning: Stock account not found under Stock in hand group' });
//                 } else {
//                     sendEvent('log', { message: `Found Stock account: ${stockAccount.name}, updating with total stock value: ${totalStockValue.toFixed(2)}` });

//                     // Prepare fiscal year array
//                     const updatedFiscalYear = stockAccount.fiscalYear.includes(newFiscalYear._id) 
//                         ? stockAccount.fiscalYear 
//                         : [...stockAccount.fiscalYear, newFiscalYear._id];

//                     // Prepare openingBalanceByFiscalYear array
//                     const updatedOpeningBalanceByFiscalYear = stockAccount.openingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             amount: totalStockValue,
//                             type: 'Dr', // Stock is an asset, so debit balance
//                             date: new Date()
//                         }]);

//                     // Prepare closingBalanceByFiscalYear array
//                     const updatedClosingBalanceByFiscalYear = stockAccount.closingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             amount: totalStockValue,
//                             type: 'Dr', // Stock is an asset, so debit balance
//                             date: new Date()
//                         }]);

//                     // Update stock account using findOneAndUpdate to avoid version conflicts
//                     await Account.findOneAndUpdate(
//                         { _id: stockAccount._id },
//                         {
//                             $set: {
//                                 fiscalYear: updatedFiscalYear,
//                                 openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                                 closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                                 openingBalance: {
//                                     fiscalYear: newFiscalYear._id,
//                                     amount: totalStockValue,
//                                     type: 'Dr'
//                                 }
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { message: `Successfully updated Stock account with total stock value: ${totalStockValue.toFixed(2)}` });
//                 }
//             }

//             sendEvent('progress', { value: 66 });

//             // Step 3: Process accounts in batches
//             sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
//             const accounts = await Account.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Define account groups that should have zero opening balance (except cash accounts)
//             const zeroBalanceGroups = await CompanyGroup.find({
//                 name: {
//                     $in: ['Purchase', 'Sale', 'Fixed Assets',
//                         'Reserves & Surplus',
//                         'Secured Loans',
//                         'Securities & Deposits',
//                         'Stock in hand',      // Already handled above, skip in regular processing
//                         'Unsecured Loans',
//                         'Expenses (Direct/Mfg.)',
//                         'Expenses (Indirect/Admn.)',
//                         'Income (Direct/Opr.)',
//                         'Income (Indirect)',
//                         'Loans & Advances',
//                         'Provisions/Expenses Payable',
//                         'Current Assets',
//                     ]
//                 },
//                 company: companyId
//             }).select('_id').session(session);

//             const zeroBalanceGroupIds = zeroBalanceGroups.map(g => g._id.toString()); // Convert to string for easier comparison

//             // Get special account group IDs
//             const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup, profitLossGroup, capitalGroup] = await Promise.all([
//                 CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Profit & Loss', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Capital Account', company: companyId }).select('_id').session(session)
//             ]);

//             const cashInHandGroupId = cashInHandGroup?._id.toString();
//             const sundryDebtorsGroupId = sundryDebtorsGroup?._id.toString();
//             const sundryCreditorsGroupId = sundryCreditorsGroup?._id.toString();
//             const profitLossGroupId = profitLossGroup?._id.toString();
//             const capitalGroupId = capitalGroup?._id.toString();

//             // Find Profit & Loss account and Capital Account
//             let profitLossAccount = null;
//             let capitalAccount = null;

//             if (profitLossGroupId) {
//                 profitLossAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: profitLossGroupId,
//                     isActive: true
//                 }).session(session);
//             }

//             if (capitalGroupId) {
//                 capitalAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: capitalGroupId,
//                     isActive: true
//                 }).session(session);
//             }

//             // Variables to track total debit and credit balances
//             let totalDebitBalance = 0;
//             let totalCreditBalance = 0;

//             const processAccountBatch = async (batch) => {
//                 return Promise.all(batch.map(async (account) => {
//                     try {
//                         // Skip stock account as it's already processed (only if stockAccount exists)
//                         if (stockAccount && account._id.equals(stockAccount._id)) {
//                             sendEvent('log', { message: `Skipping Stock account ${account.name} as it was already processed` });
//                             return;
//                         }

//                         const accountCompanyGroupId = account.companyGroups ? account.companyGroups.toString() : null;

//                         // Determine account type based on their company group
//                         const isCashAccount = accountCompanyGroupId === cashInHandGroupId;
//                         const isSundryAccount = accountCompanyGroupId === sundryDebtorsGroupId || accountCompanyGroupId === sundryCreditorsGroupId;
//                         const isZeroBalanceAccount = zeroBalanceGroupIds.includes(accountCompanyGroupId);
//                         const isProfitLossAccount = profitLossAccount && account._id.equals(profitLossAccount._id);
//                         const isCapitalAccount = capitalAccount && account._id.equals(capitalAccount._id);

//                         // Build transaction query
//                         let transactionQuery = {
//                             account: account._id,
//                             company: companyId,
//                             fiscalYear: currentFiscalYear,
//                             type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt', 'BnkDep', 'BnkWtd'] }
//                         };

//                         // For Sundry Debtors/Creditors, filter out cash transactions from 'Sale'/'Purc' etc.
//                         if (isSundryAccount) {
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } }
//                             ];
//                         } else if (isCashAccount) {
//                             // For cash accounts, only consider transactions that involve cash
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: 'cash' },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'BnkWtd', 'BnkDep'] } }
//                             ];
//                         }

//                         // Get transactions for balance calculation
//                         const transactions = await Transaction.find(transactionQuery).session(session);

//                         // Calculate new opening balance - USING openingBalanceByFiscalYear
//                         let newOpeningBalance;
//                         if (isZeroBalanceAccount) {
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Resetting balance to zero for ${account.name} (Zero Balance Group)` });
//                         } else if (isProfitLossAccount) {
//                             // For Profit & Loss, we'll calculate the balance separately later
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Setting P&L account ${account.name} to zero initially` });
//                         } else {
//                             // Get opening balance from openingBalanceByFiscalYear for current fiscal year
//                             const currentFiscalYearOpeningBalanceEntry = account.openingBalanceByFiscalYear?.find(
//                                 f => f.fiscalYear.equals(currentFiscalYear)
//                             );

//                             let runningBalance = 0;
//                             let startingBalanceType = 'Dr';

//                             if (currentFiscalYearOpeningBalanceEntry) {
//                                 runningBalance = Number(currentFiscalYearOpeningBalanceEntry.amount) || 0;
//                                 startingBalanceType = currentFiscalYearOpeningBalanceEntry.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using opening balance from openingBalanceByFiscalYear for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'}` });
//                             } else {
//                                 // Fallback to current openingBalance if no fiscal year entry found
//                                 runningBalance = Number(account.openingBalance?.amount) || 0;
//                                 startingBalanceType = account.openingBalance?.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using current account.openingBalance for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'} (fallback)` });
//                             }

//                             // Process all transactions to calculate running balance
//                             for (const transaction of transactions) {
//                                 const debit = Number(transaction.debit) || 0;
//                                 const credit = Number(transaction.credit) || 0;
//                                 if (debit > 0) runningBalance += debit;
//                                 if (credit > 0) runningBalance -= credit;
//                             }

//                             newOpeningBalance = {
//                                 amount: Math.abs(runningBalance),
//                                 type: runningBalance >= 0 ? 'Dr' : 'Cr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                         }

//                         // Track total balances for Profit & Loss calculation (skip P&L account itself for now)
//                         if (!isProfitLossAccount && !isCapitalAccount) {
//                             if (newOpeningBalance.type === 'Dr') {
//                                 totalDebitBalance += newOpeningBalance.amount;
//                             } else {
//                                 totalCreditBalance += newOpeningBalance.amount;
//                             }
//                         }

//                         // Prepare fiscal year array
//                         const updatedFiscalYear = account.fiscalYear.includes(newFiscalYear._id) 
//                             ? account.fiscalYear 
//                             : [...account.fiscalYear, newFiscalYear._id];

//                         // Prepare openingBalanceByFiscalYear array
//                         const updatedOpeningBalanceByFiscalYear = account.openingBalanceByFiscalYear
//                             .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                             .concat([{
//                                 fiscalYear: newFiscalYear._id,
//                                 amount: Number(newOpeningBalance.amount) || 0,
//                                 type: newOpeningBalance.type,
//                                 date: new Date()
//                             }]);

//                         // Prepare closingBalanceByFiscalYear array
//                         const updatedClosingBalanceByFiscalYear = account.closingBalanceByFiscalYear
//                             .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                             .concat([{
//                                 fiscalYear: currentFiscalYear,
//                                 amount: Number(newOpeningBalance.amount) || 0,
//                                 type: newOpeningBalance.type,
//                                 date: new Date()
//                             }]);

//                         // Update account using findOneAndUpdate to avoid version conflicts
//                         await Account.findOneAndUpdate(
//                             { _id: account._id },
//                             {
//                                 $set: {
//                                     fiscalYear: updatedFiscalYear,
//                                     openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                                     closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                                     openingBalance: {
//                                         fiscalYear: newFiscalYear._id,
//                                         amount: Number(newOpeningBalance.amount) || 0,
//                                         type: newOpeningBalance.type
//                                     }
//                                 }
//                             },
//                             { session, new: true }
//                         );

//                         sendEvent('log', {
//                             message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
//                                 (isZeroBalanceAccount ? ' (reset to zero)' : '') +
//                                 (isCashAccount ? ' (cash account)' : '') +
//                                 (isSundryAccount ? ' (sundry account)' : '') +
//                                 (isProfitLossAccount ? ' (P&L account)' : '') +
//                                 (isCapitalAccount ? ' (capital account)' : '')
//                         });
//                     } catch (saveError) {
//                         console.error(`Error processing account ${account.name}:`, saveError);
//                         throw saveError;
//                     }
//                 }));
//             };

//             // Process accounts in batches of 50
//             const BATCH_SIZE = 50;
//             let accountsProcessed = 0;
//             const totalAccounts = accounts.length;

//             for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
//                 const batch = accounts.slice(i, i + BATCH_SIZE);
//                 await processAccountBatch(batch);
//                 accountsProcessed += batch.length;

//                 // Update progress
//                 const progress = 66 + (accountsProcessed / totalAccounts * 34);
//                 sendEvent('progress', { value: Math.min(progress, 100) });
//             }

//             sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

//             // STEP 4: CALCULATE AND UPDATE PROFIT & LOSS ACCOUNT
//             sendEvent('log', { message: 'Calculating Profit & Loss adjustment...' });

//             // Calculate the difference between total debit and credit balances
//             // This gives us the net profit/loss for the year
//             const netProfitLoss = Math.abs(totalCreditBalance - totalDebitBalance);
//             const isProfit = totalCreditBalance > totalDebitBalance; // Credit > Debit = Profit
//             const isLoss = totalDebitBalance > totalCreditBalance;   // Debit > Credit = Loss

//             sendEvent('log', { 
//                 message: `Total Debit Balance: ${totalDebitBalance.toFixed(2)}, Total Credit Balance: ${totalCreditBalance.toFixed(2)}, Net ${isProfit ? 'Profit' : 'Loss'}: ${netProfitLoss.toFixed(2)}` 
//             });

//             // Update Profit & Loss account with the net profit/loss
//             if (profitLossAccount && netProfitLoss > 0) {
//                 sendEvent('log', { message: `Updating Profit & Loss account with net ${isProfit ? 'profit' : 'loss'} amount: ${netProfitLoss.toFixed(2)}` });

//                 // For P&L account:
//                 // Profit = Credit balance (added to Equity)
//                 // Loss = Debit balance (deducted from Equity)
//                 const pnlBalanceType = isProfit ? 'Cr' : 'Dr';

//                 // Prepare fiscal year array
//                 const updatedFiscalYear = profitLossAccount.fiscalYear.includes(newFiscalYear._id) 
//                     ? profitLossAccount.fiscalYear 
//                     : [...profitLossAccount.fiscalYear, newFiscalYear._id];

//                 // Prepare openingBalanceByFiscalYear array
//                 const updatedOpeningBalanceByFiscalYear = profitLossAccount.openingBalanceByFiscalYear
//                     .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                     .concat([{
//                         fiscalYear: newFiscalYear._id,
//                         amount: netProfitLoss,
//                         type: pnlBalanceType,
//                         date: new Date()
//                     }]);

//                 // Prepare closingBalanceByFiscalYear array
//                 const updatedClosingBalanceByFiscalYear = profitLossAccount.closingBalanceByFiscalYear
//                     .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                     .concat([{
//                         fiscalYear: currentFiscalYear,
//                         amount: netProfitLoss,
//                         type: pnlBalanceType,
//                         date: new Date()
//                     }]);

//                 // Update Profit & Loss account
//                 await Account.findOneAndUpdate(
//                     { _id: profitLossAccount._id },
//                     {
//                         $set: {
//                             fiscalYear: updatedFiscalYear,
//                             openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                             closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                             openingBalance: {
//                                 fiscalYear: newFiscalYear._id,
//                                 amount: netProfitLoss,
//                                 type: pnlBalanceType
//                             }
//                         }
//                     },
//                     { session, new: true }
//                 );

//                 sendEvent('log', { message: `Successfully updated Profit & Loss account with net ${isProfit ? 'profit' : 'loss'} amount: ${netProfitLoss.toFixed(2)}` });

//                 // STEP 5: TRANSFER PROFIT/LOSS TO CAPITAL ACCOUNT
//                 if (capitalAccount) {
//                     sendEvent('log', { message: 'Transferring Profit/Loss to Capital Account...' });

//                     // Get current capital balance
//                     const currentCapitalBalanceEntry = capitalAccount.openingBalanceByFiscalYear?.find(
//                         f => f.fiscalYear.equals(currentFiscalYear)
//                     );

//                     let capitalRunningBalance = 0;
//                     let capitalStartingBalanceType = 'Cr'; // Capital is normally Credit balance

//                     if (currentCapitalBalanceEntry) {
//                         capitalRunningBalance = Number(currentCapitalBalanceEntry.amount) || 0;
//                         capitalStartingBalanceType = currentCapitalBalanceEntry.type || 'Cr';
//                         if (capitalStartingBalanceType === 'Dr') {
//                             capitalRunningBalance = -capitalRunningBalance;
//                         }
//                     }

//                     // Get capital account transactions for the year
//                     const capitalTransactions = await Transaction.find({
//                         account: capitalAccount._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Jrnl', 'DrNt', 'CrNt', 'Pymt', 'Rcpt'] }
//                     }).session(session);

//                     // Calculate current capital balance
//                     for (const transaction of capitalTransactions) {
//                         const debit = Number(transaction.debit) || 0;
//                         const credit = Number(transaction.credit) || 0;
//                         if (debit > 0) capitalRunningBalance -= debit;
//                         if (credit > 0) capitalRunningBalance += credit;
//                     }

//                     // Adjust capital for profit/loss
//                     if (isProfit) {
//                         // Profit increases capital (credit balance)
//                         capitalRunningBalance += netProfitLoss;
//                     } else {
//                         // Loss decreases capital (credit balance gets smaller)
//                         capitalRunningBalance -= netProfitLoss;
//                     }

//                     // Calculate new capital opening balance
//                     const newCapitalOpeningBalance = {
//                         amount: Math.abs(capitalRunningBalance),
//                         type: capitalRunningBalance >= 0 ? 'Cr' : 'Dr',
//                         fiscalYear: newFiscalYear._id
//                     };

//                     // Update capital account with adjusted balance
//                     const capitalUpdatedFiscalYear = capitalAccount.fiscalYear.includes(newFiscalYear._id) 
//                         ? capitalAccount.fiscalYear 
//                         : [...capitalAccount.fiscalYear, newFiscalYear._id];

//                     const capitalUpdatedOpeningBalanceByFiscalYear = capitalAccount.openingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             amount: Number(newCapitalOpeningBalance.amount) || 0,
//                             type: newCapitalOpeningBalance.type,
//                             date: new Date()
//                         }]);

//                     const capitalUpdatedClosingBalanceByFiscalYear = capitalAccount.closingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             amount: Number(newCapitalOpeningBalance.amount) || 0,
//                             type: newCapitalOpeningBalance.type,
//                             date: new Date()
//                         }]);

//                     await Account.findOneAndUpdate(
//                         { _id: capitalAccount._id },
//                         {
//                             $set: {
//                                 fiscalYear: capitalUpdatedFiscalYear,
//                                 openingBalanceByFiscalYear: capitalUpdatedOpeningBalanceByFiscalYear,
//                                 closingBalanceByFiscalYear: capitalUpdatedClosingBalanceByFiscalYear,
//                                 openingBalance: {
//                                     fiscalYear: newFiscalYear._id,
//                                     amount: Number(newCapitalOpeningBalance.amount) || 0,
//                                     type: newCapitalOpeningBalance.type
//                                 }
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { 
//                         message: `Updated Capital Account with new balance: ${newCapitalOpeningBalance.amount} ${newCapitalOpeningBalance.type} ` +
//                                 `(includes ${isProfit ? 'profit' : 'loss'} transfer of ${netProfitLoss.toFixed(2)})` 
//                     });
//                 } else {
//                     sendEvent('log', { message: 'Warning: Capital Account not found, skipping profit/loss transfer' });
//                 }
//             } else if (!profitLossAccount) {
//                 sendEvent('log', { message: 'Warning: Profit & Loss account not found, skipping P&L adjustment' });
//             }

//             // Initialize bill counters - Check for existing ones first
//             sendEvent('log', { message: 'Initializing bill counters...' });
//             const transactionTypes = [
//                 'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
//                 'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment', 'BankDeposit', 'BankWithdrawal'
//             ];

//             for (const transactionType of transactionTypes) {
//                 const existingCounter = await BillCounter.findOne({
//                     company: companyId,
//                     fiscalYear: newFiscalYear._id,
//                     transactionType
//                 }).session(session);

//                 if (!existingCounter) {
//                     await BillCounter.create([{
//                         company: companyId,
//                         fiscalYear: newFiscalYear._id,
//                         transactionType,
//                         currentBillNumber: 0
//                     }], { session });
//                 }
//             }

//             // Update session
//             req.session.currentFiscalYear = {
//                 id: newFiscalYear._id.toString(),
//                 startDate: newFiscalYear.startDate,
//                 endDate: newFiscalYear.endDate,
//                 name: newFiscalYear.name,
//                 dateFormat: newFiscalYear.dateFormat,
//                 isActive: true
//             };

//             // Mark transaction as committed
//             transactionCommitted = true;

//             sendEvent('progress', { value: 100 });
//             sendEvent('complete', { message: `Fiscal year ${fiscalYearName} created successfully! Current fiscal year set to ${fiscalYearName}.` });
//         }, transactionOptions); // End of withTransaction

//     } catch (err) {
//         console.error('Error in fiscal year creation:', err);

//         // Only abort if transaction wasn't committed
//         await safeAbortTransaction();

//         sendEvent('error', {
//             message: `Failed to create fiscal year: ${err.message}`,
//             details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     } finally {
//         try {
//             if (session.inTransaction()) { // Ensure session is not left hanging if transaction failed without explicit abort
//                 await safeAbortTransaction();
//             }
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session:', sessionError);
//         }
//         res.end(); // Always end the response
//     }

//     // Handle client disconnect
//     req.on('close', async () => {
//         // Ensure that if the client disconnects mid-transaction, it's aborted
//         await safeAbortTransaction();
//         try {
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session on client close:', sessionError);
//         }
//     });
// });

// router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
//         return res.end();
//     }

//     // Set headers for SSE
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//     });

//     // Function to send events
//     const sendEvent = (type, data) => {
//         res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
//     };

//     const session = await mongoose.startSession();
//     let transactionCommitted = false;
//     let transactionAborted = false;

//     // Helper function to safely abort transaction
//     const safeAbortTransaction = async () => {
//         if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
//             try {
//                 await session.abortTransaction();
//                 transactionAborted = true;
//             } catch (abortError) {
//                 // Ignore errors when aborting already aborted transaction
//                 if (!abortError.message.includes('abortTransaction twice')) {
//                     console.error('Error aborting transaction:', abortError);
//                 }
//             }
//         }
//     };

//     try {
//         // Start transaction with extended timeout and retry options
//         const transactionOptions = {
//             readConcern: { level: 'snapshot' },
//             writeConcern: { w: 'majority' },
//             maxTimeMS: 600000, // 10 minute timeout
//             retryWrites: true
//         };

//         await session.withTransaction(async () => {
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;

//             // Get parameters from query string
//             const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

//             let startDate, endDate;
//             if (dateFormat === 'nepali') {
//                 startDate = startDateNepali;
//                 endDate = endDateNepali;
//             } else if (dateFormat === 'english') {
//                 startDate = startDateEnglish;
//                 endDate = endDateEnglish;
//             } else {
//                 sendEvent('error', { message: 'Invalid date format' });
//                 throw new Error('Invalid date format');
//             }

//             if (!endDate) {
//                 // If endDate is not provided, calculate it as one year minus one day from startDate
//                 endDate = new Date(startDate);
//                 endDate.setFullYear(endDate.getFullYear() + 1);
//                 endDate.setDate(endDate.getDate() - 1);
//             }

//             const startDateObject = new Date(startDate);
//             const endDateObject = new Date(endDate);
//             const startYear = startDateObject.getFullYear();
//             const endYear = endDateObject.getFullYear();
//             const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

//             // Step 1: Create fiscal year
//             sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
//             sendEvent('progress', { value: 10 });

//             const existingFiscalYear = await FiscalYear.findOne({
//                 name: fiscalYearName,
//                 company: companyId
//             }).session(session);

//             if (existingFiscalYear) {
//                 sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
//                 throw new Error('Fiscal year already exists');
//             }

//             // Process in batches to avoid transaction timeouts
//             const processInBatches = async (items, processFn, batchSize = 50) => {
//                 for (let i = 0; i < items.length; i += batchSize) {
//                     const batch = items.slice(i, i + batchSize);
//                     await Promise.all(batch.map(item => processFn(item)));

//                     // Send progress updates
//                     const progress = 33 + (i / items.length * 33);
//                     sendEvent('progress', { value: Math.min(progress, 66) });
//                 }
//             };

//             const newFiscalYear = (await FiscalYear.create([{
//                 name: fiscalYearName,
//                 startDate: startDateObject,
//                 endDate: endDateObject,
//                 dateFormat,
//                 company: companyId
//             }], { session }))[0];

//             sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
//             sendEvent('progress', { value: 33 });

//             // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
//             sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

//             // Check if settings already exist for this user and company in new fiscal year
//             const existingSettings = await Settings.findOne({
//                 company: companyId,
//                 fiscalYear: newFiscalYear._id,
//                 userId: req.user.id
//             }).session(session);

//             if (existingSettings) {
//                 sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
//             } else {
//                 const currentSettings = await Settings.findOne({
//                     company: companyId,
//                     fiscalYear: currentFiscalYear,
//                     userId: req.user.id
//                 }).session(session);

//                 if (currentSettings) {
//                     // Create new settings with unique _id and proper fiscal year reference
//                     const newSettingsData = {
//                         ...currentSettings.toObject(),
//                         _id: new mongoose.Types.ObjectId(), // Generate new unique ID
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     };
//                     // Remove any existing _id to ensure new one is used
//                     delete newSettingsData._id;

//                     await Settings.create([newSettingsData], { session });
//                     sendEvent('log', { message: 'Settings cloned successfully' });
//                 } else {
//                     // Create default settings
//                     await Settings.create([{
//                         company: companyId,
//                         userId: req.user.id,
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     }], { session });
//                     sendEvent('log', { message: 'Created default settings for new fiscal year' });
//                 }
//             }

//             // Step 2: Process items in batches
//             sendEvent('log', { message: 'Creating items for new fiscal year...' });
//             const items = await Item.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Store total stock value for stock account update
//             let totalStockValue = 0;

//             await processInBatches(items, async (item) => {
//                 try {
//                     // Get ALL transactions that affect stock for this item
//                     const stockTransactions = await Transaction.find({
//                         item: item._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
//                     }).sort({ date: 1 }).session(session);

//                     // Calculate current stock by processing all transactions
//                     let currentStock = Number(item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock) || 0;
//                     let totalPurchases = 0;
//                     let totalSales = 0;
//                     let totalPurchaseReturns = 0;
//                     let totalSalesReturns = 0;
//                     let totalAdjustments = 0;

//                     for (const transaction of stockTransactions) {
//                         const quantity = Number(transaction.quantity) || 0;
//                         const adjustmentQuantity = Number(transaction.adjustmentQuantity) || 0;

//                         switch (transaction.type) {
//                             case 'Purc': // Purchase
//                                 currentStock += quantity;
//                                 totalPurchases += quantity;
//                                 break;
//                             case 'Sale': // Sale
//                                 currentStock -= quantity;
//                                 totalSales += quantity;
//                                 break;
//                             case 'PrRt': // Purchase Return
//                                 currentStock -= quantity;
//                                 totalPurchaseReturns += quantity;
//                                 break;
//                             case 'SlRt': // Sales Return
//                                 currentStock += quantity;
//                                 totalSalesReturns += quantity;
//                                 break;
//                             case 'StockAdjustment': // Stock Adjustment
//                                 currentStock += adjustmentQuantity;
//                                 totalAdjustments += adjustmentQuantity;
//                                 break;
//                         }
//                     }

//                     // Calculate weighted average purchase price from stockEntries
//                     let totalQuantityFromEntries = 0;
//                     let totalPriceFromEntries = 0;
//                     let totalSalesPriceFromEntries = 0;

//                     for (const entry of item.stockEntries) {
//                         const entryPuPrice = Number(entry.puPrice) || 0;
//                         const entryQuantity = Number(entry.quantity) || 0;
//                         const entryPrice = Number(entry.price) || 0;

//                         if (entryPuPrice > 0 && entryQuantity > 0) {
//                             totalQuantityFromEntries += entryQuantity;
//                             totalPriceFromEntries += entryQuantity * entryPuPrice;
//                             totalSalesPriceFromEntries += entryQuantity * entryPrice;
//                         }
//                     }

//                     let purchasePrice = 0;
//                     let salesPrice = 0;

//                     if (totalQuantityFromEntries > 0) {
//                         purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
//                         salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
//                     } else {
//                         // Fallback to transaction-based calculation if no valid stock entries
//                         const purchases = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Purc',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalQuantity = 0;
//                         let totalPrice = 0;
//                         for (let purchase of purchases) {
//                             const purchaseQuantity = Number(purchase.quantity) || 0;
//                             const purchasePuPrice = Number(purchase.puPrice) || 0;
//                             if (purchaseQuantity > 0 && purchasePuPrice > 0) {
//                                 totalQuantity += purchaseQuantity;
//                                 totalPrice += purchaseQuantity * purchasePuPrice;
//                             }
//                         }

//                         // Ensure item.puPrice is also a number for fallback
//                         purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : (Number(item.puPrice) || 0);

//                         const salesTransactions = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Sale',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalSalesQuantity = 0;
//                         let totalSalesPrice = 0;
//                         for (let sale of salesTransactions) {
//                             const saleSalesPrice = Number(sale.salesPrice) || 0;
//                             const saleQuantity = Number(sale.quantity) || 0;
//                             if (saleSalesPrice > 0 && saleQuantity > 0) {
//                                 totalSalesQuantity += saleQuantity;
//                                 totalSalesPrice += saleQuantity * saleSalesPrice;
//                             }
//                         }
//                         salesPrice = totalSalesQuantity > 0 ? (totalSalesPrice / totalSalesQuantity) : (Number(item.price) || 0); // Use item.price as fallback if no sales transactions
//                     }

//                     // Ensure all final values are numbers, defaulting to 0 if NaN
//                     purchasePrice = Number(purchasePrice) || 0;
//                     salesPrice = Number(salesPrice) || 0;

//                     const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
//                     const openingStock = Number(openingStockFromEntries > 0 ? openingStockFromEntries : currentStock) || 0;
//                     const openingStockValue = Number(purchasePrice * openingStock) || 0; // Ensure this is a number

//                     sendEvent('log', {
//                         message: `Item ${item.name} - ` +
//                             `Stock from Entries: ${openingStockFromEntries}, ` +
//                             `Purchases: ${totalPurchases}, ` +
//                             `Sales: ${totalSales}, ` +
//                             `Purchase Returns: ${totalPurchaseReturns}, ` +
//                             `Sales Returns: ${totalSalesReturns}, ` +
//                             `Adjustments: ${totalAdjustments},` +
//                             `Calculated Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
//                     });

//                     // Prepare fiscal year array
//                     const updatedFiscalYear = item.fiscalYear.includes(newFiscalYear._id)
//                         ? item.fiscalYear
//                         : [...item.fiscalYear, newFiscalYear._id];

//                     // Prepare openingStockByFiscalYear array
//                     const updatedOpeningStockByFiscalYear = item.openingStockByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             openingStock: openingStock,
//                             openingStockValue: openingStockValue,
//                             purchasePrice: purchasePrice,
//                             salesPrice: salesPrice,
//                         }]);

//                     // Prepare closingStockByFiscalYear array
//                     const updatedClosingStockByFiscalYear = item.closingStockByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             closingStock: openingStock,
//                             closingStockValue: openingStockValue,
//                             purchasePrice: purchasePrice,
//                             salesPrice: salesPrice,
//                         }]);

//                     // Update item using findOneAndUpdate to avoid version conflicts
//                     await Item.findOneAndUpdate(
//                         { _id: item._id },
//                         {
//                             $set: {
//                                 fiscalYear: updatedFiscalYear,
//                                 openingStockByFiscalYear: updatedOpeningStockByFiscalYear,
//                                 closingStockByFiscalYear: updatedClosingStockByFiscalYear,
//                                 stock: openingStock,
//                                 openingStock: openingStock
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { message: `Updated item: ${item.name} with new opening stock: ${openingStock} and value: ${openingStockValue}` });
//                 } catch (saveError) {
//                     console.error(`Error processing item ${item.name}:`, saveError);
//                     throw saveError;
//                 }
//             });

//             // STEP 2.5: CALCULATE TOTAL STOCK VALUE FROM STOCK ENTRIES AND UPDATE STOCK ACCOUNT
//             sendEvent('log', { message: 'Calculating total stock value from stock entries...' });

//             // Recalculate total stock value from ALL stock entries (quantity * puPrice)
//             totalStockValue = 0;

//             // Process each item to calculate stock value from stockEntries
//             for (const item of items) {
//                 let itemStockValue = 0;

//                 // Calculate stock value from stockEntries (quantity * puPrice)
//                 item.stockEntries.forEach(entry => {
//                     const quantity = Number(entry.quantity) || 0;
//                     const puPrice = Number(entry.puPrice) || 0;
//                     const stockValue = quantity * puPrice;
//                     itemStockValue += stockValue;
//                 });

//                 totalStockValue += itemStockValue;

//                 sendEvent('log', {
//                     message: `Item ${item.name}: ${item.stockEntries.length} stock entries, Stock Value: ${itemStockValue.toFixed(2)}`
//                 });
//             }

//             sendEvent('log', { message: `Total stock value from all items: ${totalStockValue.toFixed(2)}` });

//             // Find the Stock in hand company group
//             const stockGroup = await CompanyGroup.findOne({
//                 name: 'Stock in hand',
//                 company: companyId
//             }).session(session);

//             // Declare stockAccount variable at the proper scope
//             let stockAccount = null;

//             if (!stockGroup) {
//                 sendEvent('log', { message: 'Warning: Stock in hand company group not found' });
//             } else {
//                 // Find the Stock account
//                 stockAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: stockGroup._id,
//                     isActive: true
//                 }).session(session);

//                 if (!stockAccount) {
//                     sendEvent('log', { message: 'Warning: Stock account not found under Stock in hand group' });
//                 } else {
//                     sendEvent('log', { message: `Found Stock account: ${stockAccount.name}, updating with total stock value: ${totalStockValue.toFixed(2)}` });

//                     // Prepare fiscal year array
//                     const updatedFiscalYear = stockAccount.fiscalYear.includes(newFiscalYear._id)
//                         ? stockAccount.fiscalYear
//                         : [...stockAccount.fiscalYear, newFiscalYear._id];

//                     // Prepare openingBalanceByFiscalYear array
//                     const updatedOpeningBalanceByFiscalYear = stockAccount.openingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             amount: totalStockValue,
//                             type: 'Dr', // Stock is an asset, so debit balance
//                             date: new Date()
//                         }]);

//                     // Prepare closingBalanceByFiscalYear array
//                     const updatedClosingBalanceByFiscalYear = stockAccount.closingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             amount: totalStockValue,
//                             type: 'Dr', // Stock is an asset, so debit balance
//                             date: new Date()
//                         }]);

//                     // Update stock account using findOneAndUpdate to avoid version conflicts
//                     await Account.findOneAndUpdate(
//                         { _id: stockAccount._id },
//                         {
//                             $set: {
//                                 fiscalYear: updatedFiscalYear,
//                                 openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                                 closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                                 openingBalance: {
//                                     fiscalYear: newFiscalYear._id,
//                                     amount: totalStockValue,
//                                     type: 'Dr'
//                                 }
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { message: `Successfully updated Stock account with total stock value: ${totalStockValue.toFixed(2)}` });
//                 }
//             }

//             sendEvent('progress', { value: 66 });

//             // Step 3: Process accounts in batches
//             sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
//             const accounts = await Account.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Define account groups that should have zero opening balance (revenue/expense accounts)
//             const revenueExpenseGroups = await CompanyGroup.find({
//                 name: {
//                     $in: ['Purchase', 'Sale', 'Expenses (Direct/Mfg.)', 'Expenses (Indirect/Admn.)',
//                         'Income (Direct/Opr.)', 'Income (Indirect)']
//                 },
//                 company: companyId
//             }).select('_id').session(session);

//             const revenueExpenseGroupIds = revenueExpenseGroups.map(g => g._id.toString());

//             // Get special account group IDs
//             const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup, profitLossGroup, capitalGroup] = await Promise.all([
//                 CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Profit & Loss', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Capital Account', company: companyId }).select('_id').session(session)
//             ]);

//             const cashInHandGroupId = cashInHandGroup?._id.toString();
//             const sundryDebtorsGroupId = sundryDebtorsGroup?._id.toString();
//             const sundryCreditorsGroupId = sundryCreditorsGroup?._id.toString();
//             const profitLossGroupId = profitLossGroup?._id.toString();
//             const capitalGroupId = capitalGroup?._id.toString();

//             // Find Profit & Loss account and Capital Account
//             let profitLossAccount = null;
//             let capitalAccount = null;

//             if (profitLossGroupId) {
//                 profitLossAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: profitLossGroupId,
//                     isActive: true
//                 }).session(session);
//             }

//             if (capitalGroupId) {
//                 capitalAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: capitalGroupId,
//                     isActive: true
//                 }).session(session);
//             }

//             // Variables to track balances for ALL accounts (including assets, liabilities)
//             let totalAllDebits = totalStockValue; // Start with stock value
//             let totalAllCredits = 0;
//             let totalRevenueExpenseDebits = 0;
//             let totalRevenueExpenseCredits = 0;

//             // Store account balances for later use
//             const accountBalances = new Map();

//             const processAccountBatch = async (batch) => {
//                 return Promise.all(batch.map(async (account) => {
//                     try {
//                         // Skip stock account as it's already processed (only if stockAccount exists)
//                         if (stockAccount && account._id.equals(stockAccount._id)) {
//                             sendEvent('log', { message: `Skipping Stock account ${account.name} as it was already processed` });
//                             // But we need to include it in totals
//                             if (stockAccount.openingBalance) {
//                                 const amount = Number(stockAccount.openingBalance.amount) || 0;
//                                 const type = stockAccount.openingBalance.type || 'Dr';
//                                 if (type === 'Dr') {
//                                     totalAllDebits += amount;
//                                 } else {
//                                     totalAllCredits += amount;
//                                 }
//                             }
//                             return;
//                         }

//                         const accountCompanyGroupId = account.companyGroups ? account.companyGroups.toString() : null;

//                         // Determine account type based on their company group
//                         const isCashAccount = accountCompanyGroupId === cashInHandGroupId;
//                         const isSundryAccount = accountCompanyGroupId === sundryDebtorsGroupId || accountCompanyGroupId === sundryCreditorsGroupId;
//                         const isRevenueExpenseAccount = revenueExpenseGroupIds.includes(accountCompanyGroupId);
//                         const isProfitLossAccount = profitLossAccount && account._id.equals(profitLossAccount._id);
//                         const isCapitalAccount = capitalAccount && account._id.equals(capitalAccount._id);

//                         // Build transaction query
//                         let transactionQuery = {
//                             account: account._id,
//                             company: companyId,
//                             fiscalYear: currentFiscalYear,
//                             type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt', 'BnkDep', 'BnkWtd'] }
//                         };

//                         // For Sundry Debtors/Creditors, filter out cash transactions from 'Sale'/'Purc' etc.
//                         if (isSundryAccount) {
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } }
//                             ];
//                         } else if (isCashAccount) {
//                             // For cash accounts, only consider transactions that involve cash
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: 'cash' },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'BnkWtd', 'BnkDep'] } }
//                             ];
//                         }

//                         // Get transactions for balance calculation
//                         const transactions = await Transaction.find(transactionQuery).session(session);

//                         // Calculate new opening balance - USING openingBalanceByFiscalYear
//                         let newOpeningBalance;
//                         let currentYearEndingBalance = 0;
//                         let currentYearEndingType = 'Dr';

//                         if (isRevenueExpenseAccount) {
//                             // Revenue/Expense accounts reset to zero for new fiscal year
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };

//                             // Calculate current year ending balance for P&L
//                             const currentFiscalYearOpeningBalanceEntry = account.openingBalanceByFiscalYear?.find(
//                                 f => f.fiscalYear.equals(currentFiscalYear)
//                             );

//                             if (currentFiscalYearOpeningBalanceEntry) {
//                                 currentYearEndingBalance = Number(currentFiscalYearOpeningBalanceEntry.amount) || 0;
//                                 currentYearEndingType = currentFiscalYearOpeningBalanceEntry.type || 'Dr';
//                                 if (currentYearEndingType === 'Cr') {
//                                     currentYearEndingBalance = -currentYearEndingBalance;
//                                 }
//                             }

//                             // Add transactions for current year
//                             for (const transaction of transactions) {
//                                 const debit = Number(transaction.debit) || 0;
//                                 const credit = Number(transaction.credit) || 0;
//                                 if (debit > 0) currentYearEndingBalance += debit;
//                                 if (credit > 0) currentYearEndingBalance -= credit;
//                             }

//                             // Track revenue/expense balances separately
//                             if (currentYearEndingBalance >= 0) {
//                                 totalRevenueExpenseDebits += Math.abs(currentYearEndingBalance);
//                             } else {
//                                 totalRevenueExpenseCredits += Math.abs(currentYearEndingBalance);
//                             }

//                             sendEvent('log', { message: `Revenue/Expense Account ${account.name}: Year-end balance ${Math.abs(currentYearEndingBalance).toFixed(2)} ${currentYearEndingBalance >= 0 ? 'Dr' : 'Cr'}` });
//                         } else if (isProfitLossAccount) {
//                             // For Profit & Loss, we'll calculate the balance separately later
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Setting P&L account ${account.name} to zero initially` });
//                         } else {
//                             // Get opening balance from openingBalanceByFiscalYear for current fiscal year
//                             const currentFiscalYearOpeningBalanceEntry = account.openingBalanceByFiscalYear?.find(
//                                 f => f.fiscalYear.equals(currentFiscalYear)
//                             );

//                             let runningBalance = 0;
//                             let startingBalanceType = 'Dr';

//                             if (currentFiscalYearOpeningBalanceEntry) {
//                                 runningBalance = Number(currentFiscalYearOpeningBalanceEntry.amount) || 0;
//                                 startingBalanceType = currentFiscalYearOpeningBalanceEntry.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                             } else {
//                                 // Fallback to current openingBalance if no fiscal year entry found
//                                 runningBalance = Number(account.openingBalance?.amount) || 0;
//                                 startingBalanceType = account.openingBalance?.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                             }

//                             // Process all transactions to calculate running balance
//                             for (const transaction of transactions) {
//                                 const debit = Number(transaction.debit) || 0;
//                                 const credit = Number(transaction.credit) || 0;
//                                 if (debit > 0) runningBalance += debit;
//                                 if (credit > 0) runningBalance -= credit;
//                             }

//                             newOpeningBalance = {
//                                 amount: Math.abs(runningBalance),
//                                 type: runningBalance >= 0 ? 'Dr' : 'Cr',
//                                 fiscalYear: newFiscalYear._id
//                             };

//                             // Track total balances for ALL accounts (except P&L and Capital)
//                             if (!isProfitLossAccount && !isCapitalAccount) {
//                                 if (runningBalance >= 0) {
//                                     totalAllDebits += Math.abs(runningBalance);
//                                 } else {
//                                     totalAllCredits += Math.abs(runningBalance);
//                                 }
//                             }
//                         }

//                         // Store account balance for later use
//                         accountBalances.set(account._id.toString(), {
//                             account,
//                             balance: newOpeningBalance.amount,
//                             type: newOpeningBalance.type,
//                             isRevenueExpenseAccount,
//                             isProfitLossAccount,
//                             isCapitalAccount,
//                             currentYearEndingBalance: Math.abs(currentYearEndingBalance),
//                             currentYearEndingType: currentYearEndingBalance >= 0 ? 'Dr' : 'Cr'
//                         });

//                         // Prepare fiscal year array
//                         const updatedFiscalYear = account.fiscalYear.includes(newFiscalYear._id)
//                             ? account.fiscalYear
//                             : [...account.fiscalYear, newFiscalYear._id];

//                         // Prepare openingBalanceByFiscalYear array
//                         const updatedOpeningBalanceByFiscalYear = account.openingBalanceByFiscalYear
//                             .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                             .concat([{
//                                 fiscalYear: newFiscalYear._id,
//                                 amount: Number(newOpeningBalance.amount) || 0,
//                                 type: newOpeningBalance.type,
//                                 date: new Date()
//                             }]);

//                         // Prepare closingBalanceByFiscalYear array
//                         const updatedClosingBalanceByFiscalYear = account.closingBalanceByFiscalYear
//                             .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                             .concat([{
//                                 fiscalYear: currentFiscalYear,
//                                 amount: Number(newOpeningBalance.amount) || 0,
//                                 type: newOpeningBalance.type,
//                                 date: new Date()
//                             }]);

//                         // Update account using findOneAndUpdate to avoid version conflicts
//                         await Account.findOneAndUpdate(
//                             { _id: account._id },
//                             {
//                                 $set: {
//                                     fiscalYear: updatedFiscalYear,
//                                     openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                                     closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                                     openingBalance: {
//                                         fiscalYear: newFiscalYear._id,
//                                         amount: Number(newOpeningBalance.amount) || 0,
//                                         type: newOpeningBalance.type
//                                     }
//                                 }
//                             },
//                             { session, new: true }
//                         );

//                         sendEvent('log', {
//                             message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
//                                 (isRevenueExpenseAccount ? ' (reset to zero)' : '') +
//                                 (isCashAccount ? ' (cash account)' : '') +
//                                 (isSundryAccount ? ' (sundry account)' : '') +
//                                 (isProfitLossAccount ? ' (P&L account)' : '') +
//                                 (isCapitalAccount ? ' (capital account)' : '')
//                         });
//                     } catch (saveError) {
//                         console.error(`Error processing account ${account.name}:`, saveError);
//                         throw saveError;
//                     }
//                 }));
//             };

//             // Process accounts in batches of 50
//             const BATCH_SIZE = 50;
//             let accountsProcessed = 0;
//             const totalAccounts = accounts.length;

//             for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
//                 const batch = accounts.slice(i, i + BATCH_SIZE);
//                 await processAccountBatch(batch);
//                 accountsProcessed += batch.length;

//                 // Update progress
//                 const progress = 66 + (accountsProcessed / totalAccounts * 34);
//                 sendEvent('progress', { value: Math.min(progress, 100) });
//             }

//             sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

//             // STEP 4: CALCULATE AND UPDATE PROFIT & LOSS ACCOUNT
//             sendEvent('log', { message: 'Calculating Profit & Loss adjustment...' });

//             // METHOD 1: Calculate profit from revenue/expense accounts
//             // Net Profit = Total Revenue (Credit) - Total Expenses (Debit)
//             const profitFromRevenueExpense = totalRevenueExpenseCredits - totalRevenueExpenseDebits;

//             // METHOD 2: Calculate profit as balancing figure from trial balance
//             // Total Debits (all accounts except P&L and Capital) should equal Total Credits (all accounts except P&L and Capital)
//             // If not, the difference is the profit/loss

//             sendEvent('log', {
//                 message: `Profit Calculation Methods:
//                 Method 1 - From Revenue/Expense:
//                 Total Revenue (Credit): ${totalRevenueExpenseCredits.toFixed(2)}
//                 Total Expenses (Debit): ${totalRevenueExpenseDebits.toFixed(2)}
//                 Net Profit/Loss: ${profitFromRevenueExpense.toFixed(2)} ${profitFromRevenueExpense >= 0 ? 'Cr' : 'Dr'}

//                 Method 2 - From Trial Balance:
//                 Total All Debits (Assets/Expenses): ${totalAllDebits.toFixed(2)}
//                 Total All Credits (Liabilities/Revenue): ${totalAllCredits.toFixed(2)}
//                 Difference: ${(totalAllCredits - totalAllDebits).toFixed(2)}`
//             });

//             // Use Method 2 as it's more reliable - profit is what's needed to balance the trial balance
//             const netProfitLoss = Math.abs(totalAllCredits - totalAllDebits);
//             const isProfit = totalAllCredits > totalAllDebits;

//             sendEvent('log', {
//                 message: `Selected Method 2 (Trial Balance):
//                 Net ${isProfit ? 'Profit' : 'Loss'}: ${netProfitLoss.toFixed(2)} ${isProfit ? 'Cr' : 'Dr'}`
//             });

//             // Update Profit & Loss account with the net profit/loss
//             if (profitLossAccount) {
//                 sendEvent('log', { message: `Updating Profit & Loss account with net ${isProfit ? 'profit' : 'loss'} amount: ${netProfitLoss.toFixed(2)}` });

//                 // For P&L account:
//                 // Profit = Credit balance (added to Equity)
//                 // Loss = Debit balance (deducted from Equity)
//                 const pnlBalanceType = isProfit ? 'Cr' : 'Dr';

//                 // Prepare fiscal year array
//                 const updatedFiscalYear = profitLossAccount.fiscalYear.includes(newFiscalYear._id)
//                     ? profitLossAccount.fiscalYear
//                     : [...profitLossAccount.fiscalYear, newFiscalYear._id];

//                 // Prepare openingBalanceByFiscalYear array (start new year at zero)
//                 const updatedOpeningBalanceByFiscalYear = profitLossAccount.openingBalanceByFiscalYear
//                     .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                     .concat([{
//                         fiscalYear: newFiscalYear._id,
//                         amount: 0,
//                         type: 'Dr',
//                         date: new Date()
//                     }]);

//                 // Prepare closingBalanceByFiscalYear array (closing balance for current year)
//                 const updatedClosingBalanceByFiscalYear = profitLossAccount.closingBalanceByFiscalYear
//                     .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                     .concat([{
//                         fiscalYear: currentFiscalYear,
//                         amount: netProfitLoss,
//                         type: pnlBalanceType,
//                         date: new Date()
//                     }]);

//                 // Update Profit & Loss account
//                 await Account.findOneAndUpdate(
//                     { _id: profitLossAccount._id },
//                     {
//                         $set: {
//                             fiscalYear: updatedFiscalYear,
//                             openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                             closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                             openingBalance: {
//                                 fiscalYear: newFiscalYear._id,
//                                 amount: 0,
//                                 type: 'Dr'
//                             }
//                         }
//                     },
//                     { session, new: true }
//                 );

//                 sendEvent('log', { message: `Successfully updated Profit & Loss account with net ${isProfit ? 'profit' : 'loss'} amount: ${netProfitLoss.toFixed(2)}` });

//                 // STEP 5: TRANSFER PROFIT/LOSS TO CAPITAL ACCOUNT
//                 // if (capitalAccount) {
//                 //     sendEvent('log', { message: 'Transferring Profit/Loss to Capital Account...' });

//                 //     // Get the current capital account data from our stored balances
//                 //     const capitalAccountData = accountBalances.get(capitalAccount._id.toString());

//                 //     let capitalBalance = 0;
//                 //     let capitalBalanceType = 'Cr'; // Capital is normally Credit balance

//                 //     if (capitalAccountData) {
//                 //         capitalBalance = capitalAccountData.balance;
//                 //         capitalBalanceType = capitalAccountData.type;
//                 //         if (capitalBalanceType === 'Dr') {
//                 //             capitalBalance = -capitalBalance;
//                 //         }
//                 //     } else {
//                 //         // Fallback to opening balance
//                 //         if (capitalAccount.openingBalance) {
//                 //             capitalBalance = Number(capitalAccount.openingBalance.amount) || 0;
//                 //             capitalBalanceType = capitalAccount.openingBalance.type || 'Cr';
//                 //             if (capitalBalanceType === 'Dr') {
//                 //                 capitalBalance = -capitalBalance;
//                 //             }
//                 //         }
//                 //     }

//                 //     // Adjust capital for profit/loss
//                 //     if (isProfit) {
//                 //         // Profit increases capital (credit balance)
//                 //         capitalBalance += netProfitLoss;
//                 //     } else {
//                 //         // Loss decreases capital (credit balance gets smaller)
//                 //         capitalBalance -= netProfitLoss;
//                 //     }

//                 //     // Calculate new capital opening balance for next year
//                 //     const newCapitalOpeningBalance = {
//                 //         amount: Math.abs(capitalBalance),
//                 //         type: capitalBalance >= 0 ? 'Cr' : 'Dr',
//                 //         fiscalYear: newFiscalYear._id
//                 //     };

//                 //     // Update capital account with adjusted balance
//                 //     const capitalUpdatedFiscalYear = capitalAccount.fiscalYear.includes(newFiscalYear._id)
//                 //         ? capitalAccount.fiscalYear
//                 //         : [...capitalAccount.fiscalYear, newFiscalYear._id];

//                 //     const capitalUpdatedOpeningBalanceByFiscalYear = capitalAccount.openingBalanceByFiscalYear
//                 //         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                 //         .concat([{
//                 //             fiscalYear: newFiscalYear._id,
//                 //             amount: Number(newCapitalOpeningBalance.amount) || 0,
//                 //             type: newCapitalOpeningBalance.type,
//                 //             date: new Date()
//                 //         }]);

//                 //     const capitalUpdatedClosingBalanceByFiscalYear = capitalAccount.closingBalanceByFiscalYear
//                 //         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                 //         .concat([{
//                 //             fiscalYear: currentFiscalYear,
//                 //             amount: Number(newCapitalOpeningBalance.amount) || 0,
//                 //             type: newCapitalOpeningBalance.type,
//                 //             date: new Date()
//                 //         }]);

//                 //     await Account.findOneAndUpdate(
//                 //         { _id: capitalAccount._id },
//                 //         {
//                 //             $set: {
//                 //                 fiscalYear: capitalUpdatedFiscalYear,
//                 //                 openingBalanceByFiscalYear: capitalUpdatedOpeningBalanceByFiscalYear,
//                 //                 closingBalanceByFiscalYear: capitalUpdatedClosingBalanceByFiscalYear,
//                 //                 openingBalance: {
//                 //                     fiscalYear: newFiscalYear._id,
//                 //                     amount: Number(newCapitalOpeningBalance.amount) || 0,
//                 //                     type: newCapitalOpeningBalance.type
//                 //                 }
//                 //             }
//                 //         },
//                 //         { session, new: true }
//                 //     );

//                 //     sendEvent('log', {
//                 //         message: `Updated Capital Account with new balance: ${newCapitalOpeningBalance.amount.toFixed(2)} ${newCapitalOpeningBalance.type} ` +
//                 //             `(includes ${isProfit ? 'profit' : 'loss'} transfer of ${netProfitLoss.toFixed(2)})`
//                 //     });
//                 // STEP 5: TRANSFER PROFIT/LOSS TO CAPITAL ACCOUNT - FINAL CORRECTED VERSION
//                 if (capitalAccount) {
//                     sendEvent('log', { message: `Transferring ${isProfit ? 'profit' : 'loss'} to Capital account` });

//                     // Get current capital account data
//                     const capitalAccountData = accountBalances.get(capitalAccount._id.toString());

//                     let currentCapitalAmount = 0;
//                     let currentCapitalType = 'Cr'; // Default is Credit

//                     if (capitalAccountData) {
//                         currentCapitalAmount = capitalAccountData.balance;
//                         currentCapitalType = capitalAccountData.type;
//                     } else if (capitalAccount.openingBalance) {
//                         currentCapitalAmount = Number(capitalAccount.openingBalance.amount) || 0;
//                         currentCapitalType = capitalAccount.openingBalance.type || 'Cr';
//                     }

//                     sendEvent('log', {
//                         message: `Current Capital: ${currentCapitalAmount.toFixed(2)} ${currentCapitalType}`
//                     });

//                     // Now calculate new capital balance
//                     let newCapitalAmount;
//                     let newCapitalType;

//                     if (isProfit) {
//                         // PROFIT TRANSFER: Increases Capital on CREDIT side
//                         if (currentCapitalType === 'Cr') {
//                             // Current is Credit, profit adds to Credit
//                             newCapitalAmount = currentCapitalAmount + netProfitLoss;
//                             newCapitalType = 'Cr'; // Still Credit
//                         } else {
//                             // Current is Debit (rare), profit reduces Debit
//                             newCapitalAmount = Math.abs(currentCapitalAmount - netProfitLoss);
//                             if (currentCapitalAmount > netProfitLoss) {
//                                 newCapitalType = 'Dr'; // Still Debit but smaller
//                                 newCapitalAmount = currentCapitalAmount - netProfitLoss;
//                             } else {
//                                 newCapitalType = 'Cr'; // Becomes Credit
//                                 newCapitalAmount = netProfitLoss - currentCapitalAmount;
//                             }
//                         }
//                         sendEvent('log', { message: `Adding profit ${netProfitLoss.toFixed(2)} to Capital` });
//                     } else {
//                         // LOSS TRANSFER: Decreases Capital (could move to Debit)
//                         if (currentCapitalType === 'Cr') {
//                             // Current is Credit, loss reduces Credit
//                             newCapitalAmount = Math.abs(currentCapitalAmount - netProfitLoss);
//                             if (currentCapitalAmount > netProfitLoss) {
//                                 newCapitalType = 'Cr'; // Still Credit
//                                 newCapitalAmount = currentCapitalAmount - netProfitLoss;
//                             } else {
//                                 newCapitalType = 'Dr'; // Becomes Debit
//                                 newCapitalAmount = netProfitLoss - currentCapitalAmount;
//                             }
//                         } else {
//                             // Current is Debit, loss adds to Debit
//                             newCapitalAmount = currentCapitalAmount + netProfitLoss;
//                             newCapitalType = 'Dr'; // Still Debit, larger
//                         }
//                         sendEvent('log', { message: `Deducting loss ${netProfitLoss.toFixed(2)} from Capital` });
//                     }

//                     sendEvent('log', {
//                         message: `Capital Adjustment:
//         Current: ${currentCapitalAmount.toFixed(2)} ${currentCapitalType}
//         ${isProfit ? 'Profit added' : 'Loss deducted'}: ${netProfitLoss.toFixed(2)}
//         New: ${newCapitalAmount.toFixed(2)} ${newCapitalType}`
//                     });

//                     // CRITICAL: If we have profit, capital should ALWAYS end up as Cr
//                     // (unless it started as Dr and profit wasn't enough to overcome it, which is rare)
//                     if (isProfit) {
//                         // After profit, capital should never be Dr
//                         if (newCapitalType === 'Dr') {
//                             sendEvent('log', {
//                                 message: 'WARNING: Profit resulted in Dr capital. Forcing to Cr.'
//                             });
//                             newCapitalType = 'Cr';
//                             // If it was Dr, profit should have made it Cr
//                             // The amount should be the profit minus the starting debit
//                             newCapitalAmount = Math.abs(netProfitLoss - currentCapitalAmount);
//                         }
//                     }

//                     // Update capital account
//                     const capitalUpdatedFiscalYear = capitalAccount.fiscalYear.includes(newFiscalYear._id)
//                         ? capitalAccount.fiscalYear
//                         : [...capitalAccount.fiscalYear, newFiscalYear._id];

//                     const capitalUpdatedOpeningBalanceByFiscalYear = capitalAccount.openingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             amount: newCapitalAmount,
//                             type: newCapitalType,
//                             date: new Date()
//                         }]);

//                     const capitalUpdatedClosingBalanceByFiscalYear = capitalAccount.closingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             amount: newCapitalAmount,
//                             type: newCapitalType,
//                             date: new Date()
//                         }]);

//                     await Account.findOneAndUpdate(
//                         { _id: capitalAccount._id },
//                         {
//                             $set: {
//                                 fiscalYear: capitalUpdatedFiscalYear,
//                                 openingBalanceByFiscalYear: capitalUpdatedOpeningBalanceByFiscalYear,
//                                 closingBalanceByFiscalYear: capitalUpdatedClosingBalanceByFiscalYear,
//                                 openingBalance: {
//                                     fiscalYear: newFiscalYear._id,
//                                     amount: newCapitalAmount,
//                                     type: newCapitalType
//                                 }
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', {
//                         message: `Capital Account updated to: ${newCapitalAmount.toFixed(2)} ${newCapitalType}`
//                     });
//                 } else {
//                     sendEvent('log', { message: 'Warning: Capital Account not found, skipping profit/loss transfer' });
//                 }
//             } else {
//                 sendEvent('log', { message: 'Warning: Profit & Loss account not found, skipping P&L adjustment' });
//             }

//             // Initialize bill counters - Check for existing ones first
//             sendEvent('log', { message: 'Initializing bill counters...' });
//             const transactionTypes = [
//                 'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
//                 'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment', 'BankDeposit', 'BankWithdrawal'
//             ];

//             for (const transactionType of transactionTypes) {
//                 const existingCounter = await BillCounter.findOne({
//                     company: companyId,
//                     fiscalYear: newFiscalYear._id,
//                     transactionType
//                 }).session(session);

//                 if (!existingCounter) {
//                     await BillCounter.create([{
//                         company: companyId,
//                         fiscalYear: newFiscalYear._id,
//                         transactionType,
//                         currentBillNumber: 0
//                     }], { session });
//                 }
//             }

//             // Update session
//             req.session.currentFiscalYear = {
//                 id: newFiscalYear._id.toString(),
//                 startDate: newFiscalYear.startDate,
//                 endDate: newFiscalYear.endDate,
//                 name: newFiscalYear.name,
//                 dateFormat: newFiscalYear.dateFormat,
//                 isActive: true
//             };

//             // Mark transaction as committed
//             transactionCommitted = true;

//             sendEvent('progress', { value: 100 });
//             sendEvent('complete', {
//                 message: `Fiscal year ${fiscalYearName} created successfully! 
//                 Net ${isProfit ? 'Profit' : 'Loss'}: ${netProfitLoss.toFixed(2)} 
//                 Current fiscal year set to ${fiscalYearName}.`
//             });
//         }, transactionOptions); // End of withTransaction

//     } catch (err) {
//         console.error('Error in fiscal year creation:', err);

//         // Only abort if transaction wasn't committed
//         await safeAbortTransaction();

//         sendEvent('error', {
//             message: `Failed to create fiscal year: ${err.message}`,
//             details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     } finally {
//         try {
//             if (session.inTransaction()) { // Ensure session is not left hanging if transaction failed without explicit abort
//                 await safeAbortTransaction();
//             }
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session:', sessionError);
//         }
//         res.end(); // Always end the response
//     }

//     // Handle client disconnect
//     req.on('close', async () => {
//         // Ensure that if the client disconnects mid-transaction, it's aborted
//         await safeAbortTransaction();
//         try {
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session on client close:', sessionError);
//         }
//     });
// });


//profit and calculations in credit and trnsafering to capital
// router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType !== 'retailer') {
//         res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
//         return res.end();
//     }

//     // Set headers for SSE
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//     });

//     // Function to send events
//     const sendEvent = (type, data) => {
//         res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
//     };

//     const session = await mongoose.startSession();
//     let transactionCommitted = false;
//     let transactionAborted = false;

//     // Helper function to safely abort transaction
//     const safeAbortTransaction = async () => {
//         if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
//             try {
//                 await session.abortTransaction();
//                 transactionAborted = true;
//             } catch (abortError) {
//                 // Ignore errors when aborting already aborted transaction
//                 if (!abortError.message.includes('abortTransaction twice')) {
//                     console.error('Error aborting transaction:', abortError);
//                 }
//             }
//         }
//     };

//     try {
//         // Start transaction with extended timeout and retry options
//         const transactionOptions = {
//             readConcern: { level: 'snapshot' },
//             writeConcern: { w: 'majority' },
//             maxTimeMS: 600000, // 10 minute timeout
//             retryWrites: true
//         };

//         await session.withTransaction(async () => {
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;

//             // Get parameters from query string
//             const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

//             let startDate, endDate;
//             if (dateFormat === 'nepali') {
//                 startDate = startDateNepali;
//                 endDate = endDateNepali;
//             } else if (dateFormat === 'english') {
//                 startDate = startDateEnglish;
//                 endDate = endDateEnglish;
//             } else {
//                 sendEvent('error', { message: 'Invalid date format' });
//                 throw new Error('Invalid date format');
//             }

//             if (!endDate) {
//                 // If endDate is not provided, calculate it as one year minus one day from startDate
//                 endDate = new Date(startDate);
//                 endDate.setFullYear(endDate.getFullYear() + 1);
//                 endDate.setDate(endDate.getDate() - 1);
//             }

//             const startDateObject = new Date(startDate);
//             const endDateObject = new Date(endDate);
//             const startYear = startDateObject.getFullYear();
//             const endYear = endDateObject.getFullYear();
//             const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

//             // Step 1: Create fiscal year
//             sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
//             sendEvent('progress', { value: 10 });

//             const existingFiscalYear = await FiscalYear.findOne({
//                 name: fiscalYearName,
//                 company: companyId
//             }).session(session);

//             if (existingFiscalYear) {
//                 sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
//                 throw new Error('Fiscal year already exists');
//             }

//             // Process in batches to avoid transaction timeouts
//             const processInBatches = async (items, processFn, batchSize = 50) => {
//                 for (let i = 0; i < items.length; i += batchSize) {
//                     const batch = items.slice(i, i + batchSize);
//                     await Promise.all(batch.map(item => processFn(item)));

//                     // Send progress updates
//                     const progress = 33 + (i / items.length * 33);
//                     sendEvent('progress', { value: Math.min(progress, 66) });
//                 }
//             };

//             const newFiscalYear = (await FiscalYear.create([{
//                 name: fiscalYearName,
//                 startDate: startDateObject,
//                 endDate: endDateObject,
//                 dateFormat,
//                 company: companyId
//             }], { session }))[0];

//             sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
//             sendEvent('progress', { value: 33 });

//             // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
//             sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

//             // Check if settings already exist for this user and company in new fiscal year
//             const existingSettings = await Settings.findOne({
//                 company: companyId,
//                 fiscalYear: newFiscalYear._id,
//                 userId: req.user.id
//             }).session(session);

//             if (existingSettings) {
//                 sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
//             } else {
//                 const currentSettings = await Settings.findOne({
//                     company: companyId,
//                     fiscalYear: currentFiscalYear,
//                     userId: req.user.id
//                 }).session(session);

//                 if (currentSettings) {
//                     // Create new settings with unique _id and proper fiscal year reference
//                     const newSettingsData = {
//                         ...currentSettings.toObject(),
//                         _id: new mongoose.Types.ObjectId(), // Generate new unique ID
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     };
//                     // Remove any existing _id to ensure new one is used
//                     delete newSettingsData._id;

//                     await Settings.create([newSettingsData], { session });
//                     sendEvent('log', { message: 'Settings cloned successfully' });
//                 } else {
//                     // Create default settings
//                     await Settings.create([{
//                         company: companyId,
//                         userId: req.user.id,
//                         fiscalYear: newFiscalYear._id,
//                         createdAt: new Date(),
//                         updatedAt: new Date()
//                     }], { session });
//                     sendEvent('log', { message: 'Created default settings for new fiscal year' });
//                 }
//             }

//             // Step 2: Process items in batches
//             sendEvent('log', { message: 'Creating items for new fiscal year...' });
//             const items = await Item.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Store total stock value for stock account update
//             let totalStockValue = 0;

//             await processInBatches(items, async (item) => {
//                 try {
//                     // Get ALL transactions that affect stock for this item
//                     const stockTransactions = await Transaction.find({
//                         item: item._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
//                     }).sort({ date: 1 }).session(session);

//                     // Calculate current stock by processing all transactions
//                     let currentStock = Number(item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock) || 0;
//                     let totalPurchases = 0;
//                     let totalSales = 0;
//                     let totalPurchaseReturns = 0;
//                     let totalSalesReturns = 0;
//                     let totalAdjustments = 0;

//                     for (const transaction of stockTransactions) {
//                         const quantity = Number(transaction.quantity) || 0;
//                         const adjustmentQuantity = Number(transaction.adjustmentQuantity) || 0;

//                         switch (transaction.type) {
//                             case 'Purc': // Purchase
//                                 currentStock += quantity;
//                                 totalPurchases += quantity;
//                                 break;
//                             case 'Sale': // Sale
//                                 currentStock -= quantity;
//                                 totalSales += quantity;
//                                 break;
//                             case 'PrRt': // Purchase Return
//                                 currentStock -= quantity;
//                                 totalPurchaseReturns += quantity;
//                                 break;
//                             case 'SlRt': // Sales Return
//                                 currentStock += quantity;
//                                 totalSalesReturns += quantity;
//                                 break;
//                             case 'StockAdjustment': // Stock Adjustment
//                                 currentStock += adjustmentQuantity;
//                                 totalAdjustments += adjustmentQuantity;
//                                 break;
//                         }
//                     }

//                     // Calculate weighted average purchase price from stockEntries
//                     let totalQuantityFromEntries = 0;
//                     let totalPriceFromEntries = 0;
//                     let totalSalesPriceFromEntries = 0;

//                     for (const entry of item.stockEntries) {
//                         const entryPuPrice = Number(entry.puPrice) || 0;
//                         const entryQuantity = Number(entry.quantity) || 0;
//                         const entryPrice = Number(entry.price) || 0;

//                         if (entryPuPrice > 0 && entryQuantity > 0) {
//                             totalQuantityFromEntries += entryQuantity;
//                             totalPriceFromEntries += entryQuantity * entryPuPrice;
//                             totalSalesPriceFromEntries += entryQuantity * entryPrice;
//                         }
//                     }

//                     let purchasePrice = 0;
//                     let salesPrice = 0;

//                     if (totalQuantityFromEntries > 0) {
//                         purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
//                         salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
//                     } else {
//                         // Fallback to transaction-based calculation if no valid stock entries
//                         const purchases = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Purc',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalQuantity = 0;
//                         let totalPrice = 0;
//                         for (let purchase of purchases) {
//                             const purchaseQuantity = Number(purchase.quantity) || 0;
//                             const purchasePuPrice = Number(purchase.puPrice) || 0;
//                             if (purchaseQuantity > 0 && purchasePuPrice > 0) {
//                                 totalQuantity += purchaseQuantity;
//                                 totalPrice += purchaseQuantity * purchasePuPrice;
//                             }
//                         }

//                         // Ensure item.puPrice is also a number for fallback
//                         purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : (Number(item.puPrice) || 0);

//                         const salesTransactions = await Transaction.find({
//                             item: item._id,
//                             company: companyId,
//                             type: 'Sale',
//                             fiscalYear: currentFiscalYear
//                         }).session(session);

//                         let totalSalesQuantity = 0;
//                         let totalSalesPrice = 0;
//                         for (let sale of salesTransactions) {
//                             const saleSalesPrice = Number(sale.salesPrice) || 0;
//                             const saleQuantity = Number(sale.quantity) || 0;
//                             if (saleSalesPrice > 0 && saleQuantity > 0) {
//                                 totalSalesQuantity += saleQuantity;
//                                 totalSalesPrice += saleQuantity * saleSalesPrice;
//                             }
//                         }
//                         salesPrice = totalSalesQuantity > 0 ? (totalSalesPrice / totalSalesQuantity) : (Number(item.price) || 0); // Use item.price as fallback if no sales transactions
//                     }

//                     // Ensure all final values are numbers, defaulting to 0 if NaN
//                     purchasePrice = Number(purchasePrice) || 0;
//                     salesPrice = Number(salesPrice) || 0;

//                     const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
//                     const openingStock = Number(openingStockFromEntries > 0 ? openingStockFromEntries : currentStock) || 0;
//                     const openingStockValue = Number(purchasePrice * openingStock) || 0; // Ensure this is a number

//                     sendEvent('log', {
//                         message: `Item ${item.name} - ` +
//                             `Stock from Entries: ${openingStockFromEntries}, ` +
//                             `Purchases: ${totalPurchases}, ` +
//                             `Sales: ${totalSales}, ` +
//                             `Purchase Returns: ${totalPurchaseReturns}, ` +
//                             `Sales Returns: ${totalSalesReturns}, ` +
//                             `Adjustments: ${totalAdjustments},` +
//                             `Calculated Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
//                     });

//                     // Prepare fiscal year array
//                     const updatedFiscalYear = item.fiscalYear.includes(newFiscalYear._id) 
//                         ? item.fiscalYear 
//                         : [...item.fiscalYear, newFiscalYear._id];

//                     // Prepare openingStockByFiscalYear array
//                     const updatedOpeningStockByFiscalYear = item.openingStockByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             openingStock: openingStock,
//                             openingStockValue: openingStockValue,
//                             purchasePrice: purchasePrice,
//                             salesPrice: salesPrice,
//                         }]);

//                     // Prepare closingStockByFiscalYear array
//                     const updatedClosingStockByFiscalYear = item.closingStockByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             closingStock: openingStock,
//                             closingStockValue: openingStockValue,
//                             purchasePrice: purchasePrice,
//                             salesPrice: salesPrice,
//                         }]);

//                     // Update item using findOneAndUpdate to avoid version conflicts
//                     await Item.findOneAndUpdate(
//                         { _id: item._id },
//                         {
//                             $set: {
//                                 fiscalYear: updatedFiscalYear,
//                                 openingStockByFiscalYear: updatedOpeningStockByFiscalYear,
//                                 closingStockByFiscalYear: updatedClosingStockByFiscalYear,
//                                 stock: openingStock,
//                                 openingStock: openingStock
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { message: `Updated item: ${item.name} with new opening stock: ${openingStock} and value: ${openingStockValue}` });
//                 } catch (saveError) {
//                     console.error(`Error processing item ${item.name}:`, saveError);
//                     throw saveError;
//                 }
//             });

//             // STEP 2.5: CALCULATE TOTAL STOCK VALUE FROM STOCK ENTRIES AND UPDATE STOCK ACCOUNT
//             sendEvent('log', { message: 'Calculating total stock value from stock entries...' });

//             // Recalculate total stock value from ALL stock entries (quantity * puPrice)
//             totalStockValue = 0;

//             // Process each item to calculate stock value from stockEntries
//             for (const item of items) {
//                 let itemStockValue = 0;

//                 // Calculate stock value from stockEntries (quantity * puPrice)
//                 item.stockEntries.forEach(entry => {
//                     const quantity = Number(entry.quantity) || 0;
//                     const puPrice = Number(entry.puPrice) || 0;
//                     const stockValue = quantity * puPrice;
//                     itemStockValue += stockValue;
//                 });

//                 totalStockValue += itemStockValue;

//                 sendEvent('log', { 
//                     message: `Item ${item.name}: ${item.stockEntries.length} stock entries, Stock Value: ${itemStockValue.toFixed(2)}` 
//                 });
//             }

//             sendEvent('log', { message: `Total stock value from all items: ${totalStockValue.toFixed(2)}` });

//             // Find the Stock in hand company group
//             const stockGroup = await CompanyGroup.findOne({
//                 name: 'Stock in hand',
//                 company: companyId
//             }).session(session);

//             // Declare stockAccount variable at the proper scope
//             let stockAccount = null;

//             if (!stockGroup) {
//                 sendEvent('log', { message: 'Warning: Stock in hand company group not found' });
//             } else {
//                 // Find the Stock account
//                 stockAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: stockGroup._id,
//                     isActive: true
//                 }).session(session);

//                 if (!stockAccount) {
//                     sendEvent('log', { message: 'Warning: Stock account not found under Stock in hand group' });
//                 } else {
//                     sendEvent('log', { message: `Found Stock account: ${stockAccount.name}, updating with total stock value: ${totalStockValue.toFixed(2)}` });

//                     // Prepare fiscal year array
//                     const updatedFiscalYear = stockAccount.fiscalYear.includes(newFiscalYear._id) 
//                         ? stockAccount.fiscalYear 
//                         : [...stockAccount.fiscalYear, newFiscalYear._id];

//                     // Prepare openingBalanceByFiscalYear array
//                     const updatedOpeningBalanceByFiscalYear = stockAccount.openingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             amount: totalStockValue,
//                             type: 'Dr', // Stock is an asset, so debit balance
//                             date: new Date()
//                         }]);

//                     // Prepare closingBalanceByFiscalYear array
//                     const updatedClosingBalanceByFiscalYear = stockAccount.closingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             amount: totalStockValue,
//                             type: 'Dr', // Stock is an asset, so debit balance
//                             date: new Date()
//                         }]);

//                     // Update stock account using findOneAndUpdate to avoid version conflicts
//                     await Account.findOneAndUpdate(
//                         { _id: stockAccount._id },
//                         {
//                             $set: {
//                                 fiscalYear: updatedFiscalYear,
//                                 openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                                 closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                                 openingBalance: {
//                                     fiscalYear: newFiscalYear._id,
//                                     amount: totalStockValue,
//                                     type: 'Dr'
//                                 }
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { message: `Successfully updated Stock account with total stock value: ${totalStockValue.toFixed(2)}` });
//                 }
//             }

//             sendEvent('progress', { value: 66 });

//             // Step 3: Process accounts in batches
//             sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
//             const accounts = await Account.find({
//                 company: companyId,
//                 fiscalYear: { $in: [currentFiscalYear] }
//             }).session(session);

//             // Define account groups that should have zero opening balance (except cash accounts)
//             const zeroBalanceGroups = await CompanyGroup.find({
//                 name: {
//                     $in: ['Purchase', 'Sale', 'Fixed Assets',
//                         'Reserves & Surplus',
//                         'Secured Loans',
//                         'Securities & Deposits',
//                         'Stock in hand',      // Already handled above, skip in regular processing
//                         'Unsecured Loans',
//                         'Expenses (Direct/Mfg.)',
//                         'Expenses (Indirect/Admn.)',
//                         'Income (Direct/Opr.)',
//                         'Income (Indirect)',
//                         'Loans & Advances',
//                         'Provisions/Expenses Payable',
//                         'Current Assets',
//                     ]
//                 },
//                 company: companyId
//             }).select('_id').session(session);

//             const zeroBalanceGroupIds = zeroBalanceGroups.map(g => g._id.toString()); // Convert to string for easier comparison

//             // Get special account group IDs
//             const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup, profitLossGroup, capitalGroup] = await Promise.all([
//                 CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Profit & Loss', company: companyId }).select('_id').session(session),
//                 CompanyGroup.findOne({ name: 'Capital Account', company: companyId }).select('_id').session(session)
//             ]);

//             const cashInHandGroupId = cashInHandGroup?._id.toString();
//             const sundryDebtorsGroupId = sundryDebtorsGroup?._id.toString();
//             const sundryCreditorsGroupId = sundryCreditorsGroup?._id.toString();
//             const profitLossGroupId = profitLossGroup?._id.toString();
//             const capitalGroupId = capitalGroup?._id.toString();

//             // Find Profit & Loss account and Capital Account
//             let profitLossAccount = null;
//             let capitalAccount = null;

//             if (profitLossGroupId) {
//                 profitLossAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: profitLossGroupId,
//                     isActive: true
//                 }).session(session);
//             }

//             if (capitalGroupId) {
//                 capitalAccount = await Account.findOne({
//                     company: companyId,
//                     companyGroups: capitalGroupId,
//                     isActive: true
//                 }).session(session);
//             }

//             // Variables to track total debit and credit balances
//             let totalDebitBalance = 0;
//             let totalCreditBalance = 0;

//             const processAccountBatch = async (batch) => {
//                 return Promise.all(batch.map(async (account) => {
//                     try {
//                         // Skip stock account as it's already processed (only if stockAccount exists)
//                         if (stockAccount && account._id.equals(stockAccount._id)) {
//                             sendEvent('log', { message: `Skipping Stock account ${account.name} as it was already processed` });
//                             return;
//                         }

//                         const accountCompanyGroupId = account.companyGroups ? account.companyGroups.toString() : null;

//                         // Determine account type based on their company group
//                         const isCashAccount = accountCompanyGroupId === cashInHandGroupId;
//                         const isSundryAccount = accountCompanyGroupId === sundryDebtorsGroupId || accountCompanyGroupId === sundryCreditorsGroupId;
//                         const isZeroBalanceAccount = zeroBalanceGroupIds.includes(accountCompanyGroupId);
//                         const isProfitLossAccount = profitLossAccount && account._id.equals(profitLossAccount._id);
//                         const isCapitalAccount = capitalAccount && account._id.equals(capitalAccount._id);

//                         // Build transaction query
//                         let transactionQuery = {
//                             account: account._id,
//                             company: companyId,
//                             fiscalYear: currentFiscalYear,
//                             type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt', 'BnkDep', 'BnkWtd'] }
//                         };

//                         // For Sundry Debtors/Creditors, filter out cash transactions from 'Sale'/'Purc' etc.
//                         if (isSundryAccount) {
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } }
//                             ];
//                         } else if (isCashAccount) {
//                             // For cash accounts, only consider transactions that involve cash
//                             transactionQuery.$or = [
//                                 { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: 'cash' },
//                                 { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'BnkWtd', 'BnkDep'] } }
//                             ];
//                         }

//                         // Get transactions for balance calculation
//                         const transactions = await Transaction.find(transactionQuery).session(session);

//                         // Calculate new opening balance - USING openingBalanceByFiscalYear
//                         let newOpeningBalance;
//                         if (isZeroBalanceAccount) {
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Resetting balance to zero for ${account.name} (Zero Balance Group)` });
//                         } else if (isProfitLossAccount) {
//                             // For Profit & Loss, we'll calculate the balance separately later
//                             newOpeningBalance = {
//                                 amount: 0,
//                                 type: 'Dr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                             sendEvent('log', { message: `Setting P&L account ${account.name} to zero initially` });
//                         } else {
//                             // Get opening balance from openingBalanceByFiscalYear for current fiscal year
//                             const currentFiscalYearOpeningBalanceEntry = account.openingBalanceByFiscalYear?.find(
//                                 f => f.fiscalYear.equals(currentFiscalYear)
//                             );

//                             let runningBalance = 0;
//                             let startingBalanceType = 'Dr';

//                             if (currentFiscalYearOpeningBalanceEntry) {
//                                 runningBalance = Number(currentFiscalYearOpeningBalanceEntry.amount) || 0;
//                                 startingBalanceType = currentFiscalYearOpeningBalanceEntry.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using opening balance from openingBalanceByFiscalYear for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'}` });
//                             } else {
//                                 // Fallback to current openingBalance if no fiscal year entry found
//                                 runningBalance = Number(account.openingBalance?.amount) || 0;
//                                 startingBalanceType = account.openingBalance?.type || 'Dr';
//                                 if (startingBalanceType === 'Cr') {
//                                     runningBalance = -runningBalance;
//                                 }
//                                 sendEvent('log', { message: `Using current account.openingBalance for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'} (fallback)` });
//                             }

//                             // Process all transactions to calculate running balance
//                             for (const transaction of transactions) {
//                                 const debit = Number(transaction.debit) || 0;
//                                 const credit = Number(transaction.credit) || 0;
//                                 if (debit > 0) runningBalance += debit;
//                                 if (credit > 0) runningBalance -= credit;
//                             }

//                             newOpeningBalance = {
//                                 amount: Math.abs(runningBalance),
//                                 type: runningBalance >= 0 ? 'Dr' : 'Cr',
//                                 fiscalYear: newFiscalYear._id
//                             };
//                         }

//                         // Track total balances for Profit & Loss calculation (skip P&L account itself for now)
//                         if (!isProfitLossAccount && !isCapitalAccount) {
//                             if (newOpeningBalance.type === 'Dr') {
//                                 totalDebitBalance += newOpeningBalance.amount;
//                             } else {
//                                 totalCreditBalance += newOpeningBalance.amount;
//                             }
//                         }

//                         // Prepare fiscal year array
//                         const updatedFiscalYear = account.fiscalYear.includes(newFiscalYear._id) 
//                             ? account.fiscalYear 
//                             : [...account.fiscalYear, newFiscalYear._id];

//                         // Prepare openingBalanceByFiscalYear array
//                         const updatedOpeningBalanceByFiscalYear = account.openingBalanceByFiscalYear
//                             .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                             .concat([{
//                                 fiscalYear: newFiscalYear._id,
//                                 amount: Number(newOpeningBalance.amount) || 0,
//                                 type: newOpeningBalance.type,
//                                 date: new Date()
//                             }]);

//                         // Prepare closingBalanceByFiscalYear array
//                         const updatedClosingBalanceByFiscalYear = account.closingBalanceByFiscalYear
//                             .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                             .concat([{
//                                 fiscalYear: currentFiscalYear,
//                                 amount: Number(newOpeningBalance.amount) || 0,
//                                 type: newOpeningBalance.type,
//                                 date: new Date()
//                             }]);

//                         // Update account using findOneAndUpdate to avoid version conflicts
//                         await Account.findOneAndUpdate(
//                             { _id: account._id },
//                             {
//                                 $set: {
//                                     fiscalYear: updatedFiscalYear,
//                                     openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                                     closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                                     openingBalance: {
//                                         fiscalYear: newFiscalYear._id,
//                                         amount: Number(newOpeningBalance.amount) || 0,
//                                         type: newOpeningBalance.type
//                                     }
//                                 }
//                             },
//                             { session, new: true }
//                         );

//                         sendEvent('log', {
//                             message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
//                                 (isZeroBalanceAccount ? ' (reset to zero)' : '') +
//                                 (isCashAccount ? ' (cash account)' : '') +
//                                 (isSundryAccount ? ' (sundry account)' : '') +
//                                 (isProfitLossAccount ? ' (P&L account)' : '') +
//                                 (isCapitalAccount ? ' (capital account)' : '')
//                         });
//                     } catch (saveError) {
//                         console.error(`Error processing account ${account.name}:`, saveError);
//                         throw saveError;
//                     }
//                 }));
//             };

//             // Process accounts in batches of 50
//             const BATCH_SIZE = 50;
//             let accountsProcessed = 0;
//             const totalAccounts = accounts.length;

//             for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
//                 const batch = accounts.slice(i, i + BATCH_SIZE);
//                 await processAccountBatch(batch);
//                 accountsProcessed += batch.length;

//                 // Update progress
//                 const progress = 66 + (accountsProcessed / totalAccounts * 34);
//                 sendEvent('progress', { value: Math.min(progress, 100) });
//             }

//             sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

//             // STEP 4: CALCULATE AND UPDATE PROFIT & LOSS ACCOUNT
//             sendEvent('log', { message: 'Calculating Profit & Loss adjustment...' });

//             // Calculate the difference between total debit and credit balances
//             // This gives us the net profit/loss for the year
//             const netProfitLoss = Math.abs(totalCreditBalance - totalDebitBalance);
//             const isProfit = totalCreditBalance > totalDebitBalance; // Credit > Debit = Profit
//             const isLoss = totalDebitBalance > totalCreditBalance;   // Debit > Credit = Loss

//             sendEvent('log', { 
//                 message: `Total Debit Balance: ${totalDebitBalance.toFixed(2)}, Total Credit Balance: ${totalCreditBalance.toFixed(2)}, Net ${isProfit ? 'Profit' : 'Loss'}: ${netProfitLoss.toFixed(2)}` 
//             });

//             // Update Profit & Loss account with the net profit/loss
//             if (profitLossAccount && netProfitLoss > 0) {
//                 sendEvent('log', { message: `Updating Profit & Loss account with net ${isProfit ? 'profit' : 'loss'} amount: ${netProfitLoss.toFixed(2)}` });

//                 // For P&L account:
//                 // Profit = Credit balance (added to Equity)
//                 // Loss = Debit balance (deducted from Equity)
//                 const pnlBalanceType = isProfit ? 'Cr' : 'Dr';

//                 // Prepare fiscal year array
//                 const updatedFiscalYear = profitLossAccount.fiscalYear.includes(newFiscalYear._id) 
//                     ? profitLossAccount.fiscalYear 
//                     : [...profitLossAccount.fiscalYear, newFiscalYear._id];

//                 // Prepare openingBalanceByFiscalYear array
//                 const updatedOpeningBalanceByFiscalYear = profitLossAccount.openingBalanceByFiscalYear
//                     .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                     .concat([{
//                         fiscalYear: newFiscalYear._id,
//                         amount: netProfitLoss,
//                         type: pnlBalanceType,
//                         date: new Date()
//                     }]);

//                 // Prepare closingBalanceByFiscalYear array
//                 const updatedClosingBalanceByFiscalYear = profitLossAccount.closingBalanceByFiscalYear
//                     .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                     .concat([{
//                         fiscalYear: currentFiscalYear,
//                         amount: netProfitLoss,
//                         type: pnlBalanceType,
//                         date: new Date()
//                     }]);

//                 // Update Profit & Loss account
//                 await Account.findOneAndUpdate(
//                     { _id: profitLossAccount._id },
//                     {
//                         $set: {
//                             fiscalYear: updatedFiscalYear,
//                             openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
//                             closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
//                             openingBalance: {
//                                 fiscalYear: newFiscalYear._id,
//                                 amount: netProfitLoss,
//                                 type: pnlBalanceType
//                             }
//                         }
//                     },
//                     { session, new: true }
//                 );

//                 sendEvent('log', { message: `Successfully updated Profit & Loss account with net ${isProfit ? 'profit' : 'loss'} amount: ${netProfitLoss.toFixed(2)}` });

//                 // STEP 5: TRANSFER PROFIT/LOSS TO CAPITAL ACCOUNT
//                 if (capitalAccount) {
//                     sendEvent('log', { message: 'Transferring Profit/Loss to Capital Account...' });

//                     // Get current capital balance
//                     const currentCapitalBalanceEntry = capitalAccount.openingBalanceByFiscalYear?.find(
//                         f => f.fiscalYear.equals(currentFiscalYear)
//                     );

//                     let capitalRunningBalance = 0;
//                     let capitalStartingBalanceType = 'Cr'; // Capital is normally Credit balance

//                     if (currentCapitalBalanceEntry) {
//                         capitalRunningBalance = Number(currentCapitalBalanceEntry.amount) || 0;
//                         capitalStartingBalanceType = currentCapitalBalanceEntry.type || 'Cr';
//                         if (capitalStartingBalanceType === 'Dr') {
//                             capitalRunningBalance = -capitalRunningBalance;
//                         }
//                     }

//                     // Get capital account transactions for the year
//                     const capitalTransactions = await Transaction.find({
//                         account: capitalAccount._id,
//                         company: companyId,
//                         fiscalYear: currentFiscalYear,
//                         type: { $in: ['Jrnl', 'DrNt', 'CrNt', 'Pymt', 'Rcpt'] }
//                     }).session(session);

//                     // Calculate current capital balance
//                     for (const transaction of capitalTransactions) {
//                         const debit = Number(transaction.debit) || 0;
//                         const credit = Number(transaction.credit) || 0;
//                         if (debit > 0) capitalRunningBalance -= debit;
//                         if (credit > 0) capitalRunningBalance += credit;
//                     }

//                     // Adjust capital for profit/loss
//                     if (isProfit) {
//                         // Profit increases capital (credit balance)
//                         capitalRunningBalance += netProfitLoss;
//                     } else {
//                         // Loss decreases capital (credit balance gets smaller)
//                         capitalRunningBalance -= netProfitLoss;
//                     }

//                     // Calculate new capital opening balance
//                     const newCapitalOpeningBalance = {
//                         amount: Math.abs(capitalRunningBalance),
//                         type: capitalRunningBalance >= 0 ? 'Cr' : 'Dr',
//                         fiscalYear: newFiscalYear._id
//                     };

//                     // Update capital account with adjusted balance
//                     const capitalUpdatedFiscalYear = capitalAccount.fiscalYear.includes(newFiscalYear._id) 
//                         ? capitalAccount.fiscalYear 
//                         : [...capitalAccount.fiscalYear, newFiscalYear._id];

//                     const capitalUpdatedOpeningBalanceByFiscalYear = capitalAccount.openingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
//                         .concat([{
//                             fiscalYear: newFiscalYear._id,
//                             amount: Number(newCapitalOpeningBalance.amount) || 0,
//                             type: newCapitalOpeningBalance.type,
//                             date: new Date()
//                         }]);

//                     const capitalUpdatedClosingBalanceByFiscalYear = capitalAccount.closingBalanceByFiscalYear
//                         .filter(f => !f.fiscalYear.equals(currentFiscalYear))
//                         .concat([{
//                             fiscalYear: currentFiscalYear,
//                             amount: Number(newCapitalOpeningBalance.amount) || 0,
//                             type: newCapitalOpeningBalance.type,
//                             date: new Date()
//                         }]);

//                     await Account.findOneAndUpdate(
//                         { _id: capitalAccount._id },
//                         {
//                             $set: {
//                                 fiscalYear: capitalUpdatedFiscalYear,
//                                 openingBalanceByFiscalYear: capitalUpdatedOpeningBalanceByFiscalYear,
//                                 closingBalanceByFiscalYear: capitalUpdatedClosingBalanceByFiscalYear,
//                                 openingBalance: {
//                                     fiscalYear: newFiscalYear._id,
//                                     amount: Number(newCapitalOpeningBalance.amount) || 0,
//                                     type: newCapitalOpeningBalance.type
//                                 }
//                             }
//                         },
//                         { session, new: true }
//                     );

//                     sendEvent('log', { 
//                         message: `Updated Capital Account with new balance: ${newCapitalOpeningBalance.amount} ${newCapitalOpeningBalance.type} ` +
//                                 `(includes ${isProfit ? 'profit' : 'loss'} transfer of ${netProfitLoss.toFixed(2)})` 
//                     });
//                 } else {
//                     sendEvent('log', { message: 'Warning: Capital Account not found, skipping profit/loss transfer' });
//                 }
//             } else if (!profitLossAccount) {
//                 sendEvent('log', { message: 'Warning: Profit & Loss account not found, skipping P&L adjustment' });
//             }

//             // Initialize bill counters - Check for existing ones first
//             sendEvent('log', { message: 'Initializing bill counters...' });
//             const transactionTypes = [
//                 'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
//                 'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment', 'BankDeposit', 'BankWithdrawal'
//             ];

//             for (const transactionType of transactionTypes) {
//                 const existingCounter = await BillCounter.findOne({
//                     company: companyId,
//                     fiscalYear: newFiscalYear._id,
//                     transactionType
//                 }).session(session);

//                 if (!existingCounter) {
//                     await BillCounter.create([{
//                         company: companyId,
//                         fiscalYear: newFiscalYear._id,
//                         transactionType,
//                         currentBillNumber: 0
//                     }], { session });
//                 }
//             }

//             // Update session
//             req.session.currentFiscalYear = {
//                 id: newFiscalYear._id.toString(),
//                 startDate: newFiscalYear.startDate,
//                 endDate: newFiscalYear.endDate,
//                 name: newFiscalYear.name,
//                 dateFormat: newFiscalYear.dateFormat,
//                 isActive: true
//             };

//             // Mark transaction as committed
//             transactionCommitted = true;

//             sendEvent('progress', { value: 100 });
//             sendEvent('complete', { message: `Fiscal year ${fiscalYearName} created successfully! Current fiscal year set to ${fiscalYearName}.` });
//         }, transactionOptions); // End of withTransaction

//     } catch (err) {
//         console.error('Error in fiscal year creation:', err);

//         // Only abort if transaction wasn't committed
//         await safeAbortTransaction();

//         sendEvent('error', {
//             message: `Failed to create fiscal year: ${err.message}`,
//             details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     } finally {
//         try {
//             if (session.inTransaction()) { // Ensure session is not left hanging if transaction failed without explicit abort
//                 await safeAbortTransaction();
//             }
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session:', sessionError);
//         }
//         res.end(); // Always end the response
//     }

//     // Handle client disconnect
//     req.on('close', async () => {
//         // Ensure that if the client disconnects mid-transaction, it's aborted
//         await safeAbortTransaction();
//         try {
//             await session.endSession();
//         } catch (sessionError) {
//             console.error('Error ending session on client close:', sessionError);
//         }
//     });
// });

router.get('/change-fiscal-year-stream', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized access' })}\n\n`);
        return res.end();
    }

    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // Function to send events
    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    const session = await mongoose.startSession();
    let transactionCommitted = false;
    let transactionAborted = false;

    // Helper function to safely abort transaction
    const safeAbortTransaction = async () => {
        if (!transactionCommitted && !transactionAborted && session.inTransaction()) {
            try {
                await session.abortTransaction();
                transactionAborted = true;
            } catch (abortError) {
                // Ignore errors when aborting already aborted transaction
                if (!abortError.message.includes('abortTransaction twice')) {
                    console.error('Error aborting transaction:', abortError);
                }
            }
        }
    };

    try {
        // Start transaction with extended timeout and retry options
        const transactionOptions = {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            maxTimeMS: 600000, // 10 minute timeout
            retryWrites: true
        };

        await session.withTransaction(async () => {
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;

            // Get parameters from query string
            const { startDateEnglish, endDateEnglish, startDateNepali, endDateNepali, dateFormat } = req.query;

            let startDate, endDate;
            if (dateFormat === 'nepali') {
                startDate = startDateNepali;
                endDate = endDateNepali;
            } else if (dateFormat === 'english') {
                startDate = startDateEnglish;
                endDate = endDateEnglish;
            } else {
                sendEvent('error', { message: 'Invalid date format' });
                throw new Error('Invalid date format');
            }

            if (!endDate) {
                // If endDate is not provided, calculate it as one year minus one day from startDate
                endDate = new Date(startDate);
                endDate.setFullYear(endDate.getFullYear() + 1);
                endDate.setDate(endDate.getDate() - 1);
            }

            const startDateObject = new Date(startDate);
            const endDateObject = new Date(endDate);
            const startYear = startDateObject.getFullYear();
            const endYear = endDateObject.getFullYear();
            const fiscalYearName = `${startYear}/${endYear.toString().slice(-2)}`;

            // Step 1: Create fiscal year
            sendEvent('log', { message: `Creating new fiscal year ${fiscalYearName}...` });
            sendEvent('progress', { value: 10 });

            const existingFiscalYear = await FiscalYear.findOne({
                name: fiscalYearName,
                company: companyId
            }).session(session);

            if (existingFiscalYear) {
                sendEvent('error', { message: `Fiscal Year ${fiscalYearName} already exists.` });
                throw new Error('Fiscal year already exists');
            }

            // Process in batches to avoid transaction timeouts
            const processInBatches = async (items, processFn, batchSize = 50) => {
                for (let i = 0; i < items.length; i += batchSize) {
                    const batch = items.slice(i, i + batchSize);
                    await Promise.all(batch.map(item => processFn(item)));

                    // Send progress updates
                    const progress = 33 + (i / items.length * 33);
                    sendEvent('progress', { value: Math.min(progress, 66) });
                }
            };

            const newFiscalYear = (await FiscalYear.create([{
                name: fiscalYearName,
                startDate: startDateObject,
                endDate: endDateObject,
                dateFormat,
                company: companyId
            }], { session }))[0];

            sendEvent('log', { message: `Created new fiscal year: ${fiscalYearName}` });
            sendEvent('progress', { value: 33 });

            // Step 1.5: Clone settings to new fiscal year - FIXED DUPLICATE KEY ISSUE
            sendEvent('log', { message: 'Cloning settings to new fiscal year...' });

            // Check if settings already exist for this user and company in new fiscal year
            const existingSettings = await Settings.findOne({
                company: companyId,
                fiscalYear: newFiscalYear._id,
                userId: req.user.id
            }).session(session);

            if (existingSettings) {
                sendEvent('log', { message: 'Settings already exist for new fiscal year, skipping creation' });
            } else {
                const currentSettings = await Settings.findOne({
                    company: companyId,
                    fiscalYear: currentFiscalYear,
                    userId: req.user.id
                }).session(session);

                if (currentSettings) {
                    // Create new settings with unique _id and proper fiscal year reference
                    const newSettingsData = {
                        ...currentSettings.toObject(),
                        _id: new mongoose.Types.ObjectId(), // Generate new unique ID
                        fiscalYear: newFiscalYear._id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    // Remove any existing _id to ensure new one is used
                    delete newSettingsData._id;

                    await Settings.create([newSettingsData], { session });
                    sendEvent('log', { message: 'Settings cloned successfully' });
                } else {
                    // Create default settings
                    await Settings.create([{
                        company: companyId,
                        userId: req.user.id,
                        fiscalYear: newFiscalYear._id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }], { session });
                    sendEvent('log', { message: 'Created default settings for new fiscal year' });
                }
            }

            // Step 2: Process items in batches
            sendEvent('log', { message: 'Creating items for new fiscal year...' });
            const items = await Item.find({
                company: companyId,
                fiscalYear: { $in: [currentFiscalYear] }
            }).session(session);

            // Store total stock value for stock account update
            let totalStockValue = 0;

            await processInBatches(items, async (item) => {
                try {
                    // Get ALL transactions that affect stock for this item
                    const stockTransactions = await Transaction.find({
                        item: item._id,
                        company: companyId,
                        fiscalYear: currentFiscalYear,
                        type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'StockAdjustment'] }
                    }).sort({ date: 1 }).session(session);

                    // Calculate current stock by processing all transactions
                    let currentStock = Number(item.openingStockByFiscalYear?.find(f => f.fiscalYear.equals(currentFiscalYear))?.openingStock) || 0;
                    let totalPurchases = 0;
                    let totalSales = 0;
                    let totalPurchaseReturns = 0;
                    let totalSalesReturns = 0;
                    let totalAdjustments = 0;

                    for (const transaction of stockTransactions) {
                        const quantity = Number(transaction.quantity) || 0;
                        const adjustmentQuantity = Number(transaction.adjustmentQuantity) || 0;

                        switch (transaction.type) {
                            case 'Purc': // Purchase
                                currentStock += quantity;
                                totalPurchases += quantity;
                                break;
                            case 'Sale': // Sale
                                currentStock -= quantity;
                                totalSales += quantity;
                                break;
                            case 'PrRt': // Purchase Return
                                currentStock -= quantity;
                                totalPurchaseReturns += quantity;
                                break;
                            case 'SlRt': // Sales Return
                                currentStock += quantity;
                                totalSalesReturns += quantity;
                                break;
                            case 'StockAdjustment': // Stock Adjustment
                                currentStock += adjustmentQuantity;
                                totalAdjustments += adjustmentQuantity;
                                break;
                        }
                    }

                    // Calculate weighted average purchase price from stockEntries
                    let totalQuantityFromEntries = 0;
                    let totalPriceFromEntries = 0;
                    let totalSalesPriceFromEntries = 0;

                    for (const entry of item.stockEntries) {
                        const entryPuPrice = Number(entry.puPrice) || 0;
                        const entryQuantity = Number(entry.quantity) || 0;
                        const entryPrice = Number(entry.price) || 0;

                        if (entryPuPrice > 0 && entryQuantity > 0) {
                            totalQuantityFromEntries += entryQuantity;
                            totalPriceFromEntries += entryQuantity * entryPuPrice;
                            totalSalesPriceFromEntries += entryQuantity * entryPrice;
                        }
                    }

                    let purchasePrice = 0;
                    let salesPrice = 0;

                    if (totalQuantityFromEntries > 0) {
                        purchasePrice = totalPriceFromEntries / totalQuantityFromEntries;
                        salesPrice = totalSalesPriceFromEntries / totalQuantityFromEntries;
                    } else {
                        // Fallback to transaction-based calculation if no valid stock entries
                        const purchases = await Transaction.find({
                            item: item._id,
                            company: companyId,
                            type: 'Purc',
                            fiscalYear: currentFiscalYear
                        }).session(session);

                        let totalQuantity = 0;
                        let totalPrice = 0;
                        for (let purchase of purchases) {
                            const purchaseQuantity = Number(purchase.quantity) || 0;
                            const purchasePuPrice = Number(purchase.puPrice) || 0;
                            if (purchaseQuantity > 0 && purchasePuPrice > 0) {
                                totalQuantity += purchaseQuantity;
                                totalPrice += purchaseQuantity * purchasePuPrice;
                            }
                        }

                        // Ensure item.puPrice is also a number for fallback
                        purchasePrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : (Number(item.puPrice) || 0);

                        const salesTransactions = await Transaction.find({
                            item: item._id,
                            company: companyId,
                            type: 'Sale',
                            fiscalYear: currentFiscalYear
                        }).session(session);

                        let totalSalesQuantity = 0;
                        let totalSalesPrice = 0;
                        for (let sale of salesTransactions) {
                            const saleSalesPrice = Number(sale.salesPrice) || 0;
                            const saleQuantity = Number(sale.quantity) || 0;
                            if (saleSalesPrice > 0 && saleQuantity > 0) {
                                totalSalesQuantity += saleQuantity;
                                totalSalesPrice += saleQuantity * saleSalesPrice;
                            }
                        }
                        salesPrice = totalSalesQuantity > 0 ? (totalSalesPrice / totalSalesQuantity) : (Number(item.price) || 0); // Use item.price as fallback if no sales transactions
                    }

                    // Ensure all final values are numbers, defaulting to 0 if NaN
                    purchasePrice = Number(purchasePrice) || 0;
                    salesPrice = Number(salesPrice) || 0;

                    const openingStockFromEntries = item.stockEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
                    const openingStock = Number(openingStockFromEntries > 0 ? openingStockFromEntries : currentStock) || 0;
                    const openingStockValue = Number(purchasePrice * openingStock) || 0; // Ensure this is a number

                    sendEvent('log', {
                        message: `Item ${item.name} - ` +
                            `Stock from Entries: ${openingStockFromEntries}, ` +
                            `Purchases: ${totalPurchases}, ` +
                            `Sales: ${totalSales}, ` +
                            `Purchase Returns: ${totalPurchaseReturns}, ` +
                            `Sales Returns: ${totalSalesReturns}, ` +
                            `Adjustments: ${totalAdjustments},` +
                            `Calculated Purchase Price: ${purchasePrice} (from ${totalQuantityFromEntries > 0 ? 'stock entries' : 'transactions'})`
                    });

                    // Prepare fiscal year array
                    const updatedFiscalYear = item.fiscalYear.includes(newFiscalYear._id)
                        ? item.fiscalYear
                        : [...item.fiscalYear, newFiscalYear._id];

                    // Prepare openingStockByFiscalYear array
                    const updatedOpeningStockByFiscalYear = item.openingStockByFiscalYear
                        .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
                        .concat([{
                            fiscalYear: newFiscalYear._id,
                            openingStock: openingStock,
                            openingStockValue: openingStockValue,
                            purchasePrice: purchasePrice,
                            salesPrice: salesPrice,
                        }]);

                    // Prepare closingStockByFiscalYear array
                    const updatedClosingStockByFiscalYear = item.closingStockByFiscalYear
                        .filter(f => !f.fiscalYear.equals(currentFiscalYear))
                        .concat([{
                            fiscalYear: currentFiscalYear,
                            closingStock: openingStock,
                            closingStockValue: openingStockValue,
                            purchasePrice: purchasePrice,
                            salesPrice: salesPrice,
                        }]);

                    // Update item using findOneAndUpdate to avoid version conflicts
                    await Item.findOneAndUpdate(
                        { _id: item._id },
                        {
                            $set: {
                                fiscalYear: updatedFiscalYear,
                                openingStockByFiscalYear: updatedOpeningStockByFiscalYear,
                                closingStockByFiscalYear: updatedClosingStockByFiscalYear,
                                stock: openingStock,
                                openingStock: openingStock
                            }
                        },
                        { session, new: true }
                    );

                    sendEvent('log', { message: `Updated item: ${item.name} with new opening stock: ${openingStock} and value: ${openingStockValue}` });
                } catch (saveError) {
                    console.error(`Error processing item ${item.name}:`, saveError);
                    throw saveError;
                }
            });

            // STEP 2.5: CALCULATE TOTAL STOCK VALUE FROM STOCK ENTRIES AND UPDATE STOCK ACCOUNT
            sendEvent('log', { message: 'Calculating total stock value from stock entries...' });

            // Recalculate total stock value from ALL stock entries (quantity * puPrice)
            totalStockValue = 0;

            // Process each item to calculate stock value from stockEntries
            for (const item of items) {
                let itemStockValue = 0;

                // Calculate stock value from stockEntries (quantity * puPrice)
                item.stockEntries.forEach(entry => {
                    const quantity = Number(entry.quantity) || 0;
                    const puPrice = Number(entry.puPrice) || 0;
                    const stockValue = quantity * puPrice;
                    itemStockValue += stockValue;
                });

                totalStockValue += itemStockValue;

                sendEvent('log', {
                    message: `Item ${item.name}: ${item.stockEntries.length} stock entries, Stock Value: ${itemStockValue.toFixed(2)}`
                });
            }

            sendEvent('log', { message: `Total stock value from all items: ${totalStockValue.toFixed(2)}` });

            // Find the Stock in hand company group
            const stockGroup = await CompanyGroup.findOne({
                name: 'Stock in hand',
                company: companyId
            }).session(session);

            // Declare stockAccount variable at the proper scope
            let stockAccount = null;

            if (!stockGroup) {
                sendEvent('log', { message: 'Warning: Stock in hand company group not found' });
            } else {
                // Find the Stock account
                stockAccount = await Account.findOne({
                    company: companyId,
                    companyGroups: stockGroup._id,
                    isActive: true
                }).session(session);

                if (!stockAccount) {
                    sendEvent('log', { message: 'Warning: Stock account not found under Stock in hand group' });
                } else {
                    sendEvent('log', { message: `Found Stock account: ${stockAccount.name}, updating with total stock value: ${totalStockValue.toFixed(2)}` });

                    // Prepare fiscal year array
                    const updatedFiscalYear = stockAccount.fiscalYear.includes(newFiscalYear._id)
                        ? stockAccount.fiscalYear
                        : [...stockAccount.fiscalYear, newFiscalYear._id];

                    // Prepare openingBalanceByFiscalYear array
                    const updatedOpeningBalanceByFiscalYear = stockAccount.openingBalanceByFiscalYear
                        .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
                        .concat([{
                            fiscalYear: newFiscalYear._id,
                            amount: totalStockValue,
                            type: 'Dr', // Stock is an asset, so debit balance
                            date: new Date()
                        }]);

                    // Prepare closingBalanceByFiscalYear array
                    const updatedClosingBalanceByFiscalYear = stockAccount.closingBalanceByFiscalYear
                        .filter(f => !f.fiscalYear.equals(currentFiscalYear))
                        .concat([{
                            fiscalYear: currentFiscalYear,
                            amount: totalStockValue,
                            type: 'Dr', // Stock is an asset, so debit balance
                            date: new Date()
                        }]);

                    // Update stock account using findOneAndUpdate to avoid version conflicts
                    await Account.findOneAndUpdate(
                        { _id: stockAccount._id },
                        {
                            $set: {
                                fiscalYear: updatedFiscalYear,
                                openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
                                closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
                                openingBalance: {
                                    fiscalYear: newFiscalYear._id,
                                    amount: totalStockValue,
                                    type: 'Dr'
                                }
                            }
                        },
                        { session, new: true }
                    );

                    sendEvent('log', { message: `Successfully updated Stock account with total stock value: ${totalStockValue.toFixed(2)}` });
                }
            }

            sendEvent('progress', { value: 66 });

            // Step 3: Process accounts in batches
            sendEvent('log', { message: 'Updating accounts for new fiscal year...' });
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: { $in: [currentFiscalYear] }
            }).session(session);

            // Define account groups that should have zero opening balance (except cash accounts)
            const zeroBalanceGroups = await CompanyGroup.find({
                name: {
                    $in: ['Purchase', 'Sale', 'Fixed Assets',
                        'Reserves & Surplus',
                        'Secured Loans',
                        'Securities & Deposits',
                        'Stock in hand',      // Already handled above, skip in regular processing
                        'Unsecured Loans',
                        'Expenses (Direct/Mfg.)',
                        'Expenses (Indirect/Admn.)',
                        'Income (Direct/Opr.)',
                        'Income (Indirect)',
                        'Loans & Advances',
                        'Provisions/Expenses Payable',
                        'Current Assets',
                    ]
                },
                company: companyId
            }).select('_id').session(session);

            const zeroBalanceGroupIds = zeroBalanceGroups.map(g => g._id.toString()); // Convert to string for easier comparison

            // Get special account group IDs
            const [cashInHandGroup, sundryDebtorsGroup, sundryCreditorsGroup, profitLossGroup, capitalGroup] = await Promise.all([
                CompanyGroup.findOne({ name: 'Cash in Hand', company: companyId }).select('_id').session(session),
                CompanyGroup.findOne({ name: 'Sundry Debtors', company: companyId }).select('_id').session(session),
                CompanyGroup.findOne({ name: 'Sundry Creditors', company: companyId }).select('_id').session(session),
                CompanyGroup.findOne({ name: 'Profit & Loss', company: companyId }).select('_id').session(session),
                CompanyGroup.findOne({ name: 'Capital Account', company: companyId }).select('_id').session(session)
            ]);

            const cashInHandGroupId = cashInHandGroup?._id.toString();
            const sundryDebtorsGroupId = sundryDebtorsGroup?._id.toString();
            const sundryCreditorsGroupId = sundryCreditorsGroup?._id.toString();
            const profitLossGroupId = profitLossGroup?._id.toString();
            const capitalGroupId = capitalGroup?._id.toString();

            // Find Profit & Loss account and Capital Account
            let profitLossAccount = null;
            let capitalAccount = null;

            if (profitLossGroupId) {
                profitLossAccount = await Account.findOne({
                    company: companyId,
                    companyGroups: profitLossGroupId,
                    isActive: true
                }).session(session);
            }

            if (capitalGroupId) {
                capitalAccount = await Account.findOne({
                    company: companyId,
                    companyGroups: capitalGroupId,
                    isActive: true
                }).session(session);
            }

            // Variables to track total debit and credit balances
            // IMPORTANT: Start with stock value in totalDebitBalance since stock is an asset (debit)
            let totalDebitBalance = totalStockValue;
            let totalCreditBalance = 0;

            sendEvent('log', {
                message: `Starting Profit/Loss calculation with Stock value (debit): ${totalStockValue.toFixed(2)}`
            });

            const processAccountBatch = async (batch) => {
                return Promise.all(batch.map(async (account) => {
                    try {
                        // Skip stock account as it's already processed (only if stockAccount exists)
                        if (stockAccount && account._id.equals(stockAccount._id)) {
                            sendEvent('log', { message: `Skipping Stock account ${account.name} as it was already processed and added to totalDebitBalance` });
                            return;
                        }

                        const accountCompanyGroupId = account.companyGroups ? account.companyGroups.toString() : null;

                        // Determine account type based on their company group
                        const isCashAccount = accountCompanyGroupId === cashInHandGroupId;
                        const isSundryAccount = accountCompanyGroupId === sundryDebtorsGroupId || accountCompanyGroupId === sundryCreditorsGroupId;
                        const isZeroBalanceAccount = zeroBalanceGroupIds.includes(accountCompanyGroupId);
                        const isProfitLossAccount = profitLossAccount && account._id.equals(profitLossAccount._id);
                        const isCapitalAccount = capitalAccount && account._id.equals(capitalAccount._id);

                        // Build transaction query
                        let transactionQuery = {
                            account: account._id,
                            company: companyId,
                            fiscalYear: currentFiscalYear,
                            type: { $in: ['Purc', 'Sale', 'SlRt', 'PrRt', 'Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt', 'BnkDep', 'BnkWtd'] }
                        };

                        // For Sundry Debtors/Creditors, filter out cash transactions from 'Sale'/'Purc' etc.
                        if (isSundryAccount) {
                            transactionQuery.$or = [
                                { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: { $ne: 'cash' } },
                                { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'DrNt', 'CrNt'] } }
                            ];
                        } else if (isCashAccount) {
                            // For cash accounts, only consider transactions that involve cash
                            transactionQuery.$or = [
                                { type: { $in: ['Sale', 'Purc', 'SlRt', 'PrRt'] }, paymentMode: 'cash' },
                                { type: { $in: ['Pymt', 'Rcpt', 'Jrnl', 'BnkWtd', 'BnkDep'] } }
                            ];
                        }

                        // Get transactions for balance calculation
                        const transactions = await Transaction.find(transactionQuery).session(session);

                        // Calculate new opening balance - USING openingBalanceByFiscalYear
                        let newOpeningBalance;
                        if (isZeroBalanceAccount) {
                            newOpeningBalance = {
                                amount: 0,
                                type: 'Dr',
                                fiscalYear: newFiscalYear._id
                            };
                            sendEvent('log', { message: `Resetting balance to zero for ${account.name} (Zero Balance Group)` });
                        } else if (isProfitLossAccount) {
                            // For Profit & Loss, we'll calculate the balance separately later
                            newOpeningBalance = {
                                amount: 0,
                                type: 'Dr',
                                fiscalYear: newFiscalYear._id
                            };
                            sendEvent('log', { message: `Setting P&L account ${account.name} to zero initially` });
                        } else {
                            // Get opening balance from openingBalanceByFiscalYear for current fiscal year
                            const currentFiscalYearOpeningBalanceEntry = account.openingBalanceByFiscalYear?.find(
                                f => f.fiscalYear.equals(currentFiscalYear)
                            );

                            let runningBalance = 0;
                            let startingBalanceType = 'Dr';

                            if (currentFiscalYearOpeningBalanceEntry) {
                                runningBalance = Number(currentFiscalYearOpeningBalanceEntry.amount) || 0;
                                startingBalanceType = currentFiscalYearOpeningBalanceEntry.type || 'Dr';
                                if (startingBalanceType === 'Cr') {
                                    runningBalance = -runningBalance;
                                }
                                sendEvent('log', { message: `Using opening balance from openingBalanceByFiscalYear for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'}` });
                            } else {
                                // Fallback to current openingBalance if no fiscal year entry found
                                runningBalance = Number(account.openingBalance?.amount) || 0;
                                startingBalanceType = account.openingBalance?.type || 'Dr';
                                if (startingBalanceType === 'Cr') {
                                    runningBalance = -runningBalance;
                                }
                                sendEvent('log', { message: `Using current account.openingBalance for ${account.name}: ${runningBalance >= 0 ? runningBalance : -runningBalance} ${runningBalance >= 0 ? 'Dr' : 'Cr'} (fallback)` });
                            }

                            // Process all transactions to calculate running balance
                            for (const transaction of transactions) {
                                const debit = Number(transaction.debit) || 0;
                                const credit = Number(transaction.credit) || 0;
                                if (debit > 0) runningBalance += debit;
                                if (credit > 0) runningBalance -= credit;
                            }

                            newOpeningBalance = {
                                amount: Math.abs(runningBalance),
                                type: runningBalance >= 0 ? 'Dr' : 'Cr',
                                fiscalYear: newFiscalYear._id
                            };
                        }

                        // Track total balances for Profit & Loss calculation (skip P&L and Capital accounts for now)
                        if (!isProfitLossAccount && !isCapitalAccount) {
                            if (newOpeningBalance.type === 'Dr') {
                                totalDebitBalance += newOpeningBalance.amount;
                            } else {
                                totalCreditBalance += newOpeningBalance.amount;
                            }
                            sendEvent('log', {
                                message: `Account ${account.name}: ${newOpeningBalance.amount} ${newOpeningBalance.type}. ` +
                                    `Total Debit: ${totalDebitBalance.toFixed(2)}, Total Credit: ${totalCreditBalance.toFixed(2)}`
                            });
                        }

                        // Prepare fiscal year array
                        const updatedFiscalYear = account.fiscalYear.includes(newFiscalYear._id)
                            ? account.fiscalYear
                            : [...account.fiscalYear, newFiscalYear._id];

                        // Prepare openingBalanceByFiscalYear array
                        const updatedOpeningBalanceByFiscalYear = account.openingBalanceByFiscalYear
                            .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
                            .concat([{
                                fiscalYear: newFiscalYear._id,
                                amount: Number(newOpeningBalance.amount) || 0,
                                type: newOpeningBalance.type,
                                date: new Date()
                            }]);

                        // Prepare closingBalanceByFiscalYear array
                        const updatedClosingBalanceByFiscalYear = account.closingBalanceByFiscalYear
                            .filter(f => !f.fiscalYear.equals(currentFiscalYear))
                            .concat([{
                                fiscalYear: currentFiscalYear,
                                amount: Number(newOpeningBalance.amount) || 0,
                                type: newOpeningBalance.type,
                                date: new Date()
                            }]);

                        // Update account using findOneAndUpdate to avoid version conflicts
                        await Account.findOneAndUpdate(
                            { _id: account._id },
                            {
                                $set: {
                                    fiscalYear: updatedFiscalYear,
                                    openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
                                    closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
                                    openingBalance: {
                                        fiscalYear: newFiscalYear._id,
                                        amount: Number(newOpeningBalance.amount) || 0,
                                        type: newOpeningBalance.type
                                    }
                                }
                            },
                            { session, new: true }
                        );

                        sendEvent('log', {
                            message: `Updated account: ${account.name} with new balance: ${newOpeningBalance.amount} ${newOpeningBalance.type}` +
                                (isZeroBalanceAccount ? ' (reset to zero)' : '') +
                                (isCashAccount ? ' (cash account)' : '') +
                                (isSundryAccount ? ' (sundry account)' : '') +
                                (isProfitLossAccount ? ' (P&L account)' : '') +
                                (isCapitalAccount ? ' (capital account)' : '')
                        });
                    } catch (saveError) {
                        console.error(`Error processing account ${account.name}:`, saveError);
                        throw saveError;
                    }
                }));
            };

            // Process accounts in batches of 50
            const BATCH_SIZE = 50;
            let accountsProcessed = 0;
            const totalAccounts = accounts.length;

            for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
                const batch = accounts.slice(i, i + BATCH_SIZE);
                await processAccountBatch(batch);
                accountsProcessed += batch.length;

                // Update progress
                const progress = 66 + (accountsProcessed / totalAccounts * 34);
                sendEvent('progress', { value: Math.min(progress, 100) });
            }

            sendEvent('log', { message: `Completed updating ${accountsProcessed} accounts` });

            // STEP 4: CALCULATE AND UPDATE PROFIT & LOSS ACCOUNT
            sendEvent('log', { message: 'Calculating Profit & Loss adjustment...' });

            // CORRECTED LOGIC:
            // In accounting, for Profit & Loss calculation:
            // Profit = Total Credits (Income) > Total Debits (Expenses) 
            // But when looking at ALL accounts (assets + liabilities + equity + income + expenses):
            // For trial balance: Total Debits MUST equal Total Credits
            // The balancing figure is Profit/Loss
            // If Debits > Credits: We need Credit balance (Profit) to balance
            // If Credits > Debits: We need Debit balance (Loss) to balance

            // So the CORRECT calculation is:
            const netProfitLoss = Math.abs(totalCreditBalance - totalDebitBalance);
            const isProfit = totalDebitBalance > totalCreditBalance;  // Debits > Credits = Profit (Credit)
            const isLoss = totalCreditBalance > totalDebitBalance;    // Credits > Debits = Loss (Debit)

            sendEvent('log', {
                message: `Final Totals including Stock value:
    Total Debit Balance (Assets + Expenses): ${totalDebitBalance.toFixed(2)} 
    Total Credit Balance (Liabilities + Income): ${totalCreditBalance.toFixed(2)} 
    Net ${isProfit ? 'Profit' : 'Loss'}: ${netProfitLoss.toFixed(2)} 
    Balance Type: ${isProfit ? 'Cr' : 'Dr'}`
            });

            // Update Profit & Loss account with the net profit/loss
            if (profitLossAccount && netProfitLoss > 0) {
                sendEvent('log', { message: `Updating Profit & Loss account with net ${isProfit ? 'profit' : 'loss'} amount: ${netProfitLoss.toFixed(2)}` });

                // For P&L account:
                // Profit = Credit balance (needed to balance when Debits > Credits)
                // Loss = Debit balance (needed to balance when Credits > Debits)
                const pnlBalanceType = isProfit ? 'Cr' : 'Dr';

                // Prepare fiscal year array
                const updatedFiscalYear = profitLossAccount.fiscalYear.includes(newFiscalYear._id)
                    ? profitLossAccount.fiscalYear
                    : [...profitLossAccount.fiscalYear, newFiscalYear._id];

                // Prepare openingBalanceByFiscalYear array (start new fiscal year with zero)
                const updatedOpeningBalanceByFiscalYear = profitLossAccount.openingBalanceByFiscalYear
                    .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
                    .concat([{
                        fiscalYear: newFiscalYear._id,
                        amount: 0,
                        type: 'Dr',
                        date: new Date()
                    }]);

                // Prepare closingBalanceByFiscalYear array (closing balance for current fiscal year)
                const updatedClosingBalanceByFiscalYear = profitLossAccount.closingBalanceByFiscalYear
                    .filter(f => !f.fiscalYear.equals(currentFiscalYear))
                    .concat([{
                        fiscalYear: currentFiscalYear,
                        amount: netProfitLoss,
                        type: pnlBalanceType,
                        date: new Date()
                    }]);

                // Update Profit & Loss account
                await Account.findOneAndUpdate(
                    { _id: profitLossAccount._id },
                    {
                        $set: {
                            fiscalYear: updatedFiscalYear,
                            openingBalanceByFiscalYear: updatedOpeningBalanceByFiscalYear,
                            closingBalanceByFiscalYear: updatedClosingBalanceByFiscalYear,
                            openingBalance: {
                                fiscalYear: newFiscalYear._id,
                                amount: 0,
                                type: 'Dr'
                            }
                        }
                    },
                    { session, new: true }
                );

                sendEvent('log', { message: `Successfully updated Profit & Loss account with net ${isProfit ? 'profit' : 'loss'} amount: ${netProfitLoss.toFixed(2)} ${pnlBalanceType}` });

                // STEP 5: TRANSFER PROFIT/LOSS TO CAPITAL ACCOUNT
                if (capitalAccount) {
                    sendEvent('log', { message: 'Transferring Profit/Loss to Capital Account...' });

                    // Get current capital balance from openingBalanceByFiscalYear
                    const currentCapitalBalanceEntry = capitalAccount.openingBalanceByFiscalYear?.find(
                        f => f.fiscalYear.equals(currentFiscalYear)
                    );

                    let capitalBalance = 0;
                    let capitalBalanceType = 'Cr'; // Capital is normally Credit balance

                    if (currentCapitalBalanceEntry) {
                        capitalBalance = Number(currentCapitalBalanceEntry.amount) || 0;
                        capitalBalanceType = currentCapitalBalanceEntry.type || 'Cr';
                    }

                    // Get capital account transactions for the year
                    const capitalTransactions = await Transaction.find({
                        account: capitalAccount._id,
                        company: companyId,
                        fiscalYear: currentFiscalYear,
                        type: { $in: ['Jrnl', 'DrNt', 'CrNt', 'Pymt', 'Rcpt'] }
                    }).session(session);

                    // Calculate net effect of transactions on capital
                    let capitalNetEffect = 0;
                    for (const transaction of capitalTransactions) {
                        const debit = Number(transaction.debit) || 0;
                        const credit = Number(transaction.credit) || 0;

                        // For capital account (which is a Credit account):
                        // Debit decreases capital (negative effect)
                        // Credit increases capital (positive effect)
                        capitalNetEffect += credit - debit;
                    }

                    // Calculate adjusted capital balance before profit/loss transfer
                    let adjustedCapitalBalance;
                    if (capitalBalanceType === 'Cr') {
                        adjustedCapitalBalance = capitalBalance + capitalNetEffect;
                    } else {
                        adjustedCapitalBalance = capitalBalance - capitalNetEffect;
                    }

                    // Now add/subtract profit/loss
                    // IMPORTANT: Capital is a CREDIT account
                    if (isProfit) {
                        // Profit INCREASES capital (add to credit balance)
                        adjustedCapitalBalance += netProfitLoss;
                    } else {
                        // Loss DECREASES capital (subtract from credit balance)
                        adjustedCapitalBalance -= netProfitLoss;
                    }

                    // Determine final capital balance type
                    // Capital should normally be Credit, but could become Debit if losses exceed capital
                    const finalCapitalBalance = Math.abs(adjustedCapitalBalance);
                    const finalCapitalType = adjustedCapitalBalance >= 0 ? 'Cr' : 'Dr';

                    sendEvent('log', {
                        message: `Capital Account Calculation:
            Starting Capital: ${capitalBalance.toFixed(2)} ${capitalBalanceType}
            Transaction Net Effect: ${capitalNetEffect.toFixed(2)}
            ${isProfit ? 'Profit added' : 'Loss deducted'}: ${netProfitLoss.toFixed(2)}
            Final Capital: ${finalCapitalBalance.toFixed(2)} ${finalCapitalType}`
                    });

                    // Update capital account with adjusted balance
                    const capitalUpdatedFiscalYear = capitalAccount.fiscalYear.includes(newFiscalYear._id)
                        ? capitalAccount.fiscalYear
                        : [...capitalAccount.fiscalYear, newFiscalYear._id];

                    const capitalUpdatedOpeningBalanceByFiscalYear = capitalAccount.openingBalanceByFiscalYear
                        .filter(f => !f.fiscalYear.equals(newFiscalYear._id))
                        .concat([{
                            fiscalYear: newFiscalYear._id,
                            amount: finalCapitalBalance,
                            type: finalCapitalType,
                            date: new Date()
                        }]);

                    const capitalUpdatedClosingBalanceByFiscalYear = capitalAccount.closingBalanceByFiscalYear
                        .filter(f => !f.fiscalYear.equals(currentFiscalYear))
                        .concat([{
                            fiscalYear: currentFiscalYear,
                            amount: finalCapitalBalance,
                            type: finalCapitalType,
                            date: new Date()
                        }]);

                    await Account.findOneAndUpdate(
                        { _id: capitalAccount._id },
                        {
                            $set: {
                                fiscalYear: capitalUpdatedFiscalYear,
                                openingBalanceByFiscalYear: capitalUpdatedOpeningBalanceByFiscalYear,
                                closingBalanceByFiscalYear: capitalUpdatedClosingBalanceByFiscalYear,
                                openingBalance: {
                                    fiscalYear: newFiscalYear._id,
                                    amount: finalCapitalBalance,
                                    type: finalCapitalType
                                }
                            }
                        },
                        { session, new: true }
                    );

                    sendEvent('log', {
                        message: `Updated Capital Account with new balance: ${finalCapitalBalance.toFixed(2)} ${finalCapitalType} ` +
                            `(includes ${isProfit ? 'profit' : 'loss'} transfer of ${netProfitLoss.toFixed(2)})`
                    });
                } else {
                    sendEvent('log', { message: 'Warning: Capital Account not found, skipping profit/loss transfer' });
                }
            } else if (!profitLossAccount) {
                sendEvent('log', { message: 'Warning: Profit & Loss account not found, skipping P&L adjustment' });
            }

            // Initialize bill counters - Check for existing ones first
            sendEvent('log', { message: 'Initializing bill counters...' });
            const transactionTypes = [
                'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
                'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment', 'BankDeposit', 'BankWithdrawal'
            ];

            for (const transactionType of transactionTypes) {
                const existingCounter = await BillCounter.findOne({
                    company: companyId,
                    fiscalYear: newFiscalYear._id,
                    transactionType
                }).session(session);

                if (!existingCounter) {
                    await BillCounter.create([{
                        company: companyId,
                        fiscalYear: newFiscalYear._id,
                        transactionType,
                        currentBillNumber: 0
                    }], { session });
                }
            }

            // Update session
            req.session.currentFiscalYear = {
                id: newFiscalYear._id.toString(),
                startDate: newFiscalYear.startDate,
                endDate: newFiscalYear.endDate,
                name: newFiscalYear.name,
                dateFormat: newFiscalYear.dateFormat,
                isActive: true
            };

            // Mark transaction as committed
            transactionCommitted = true;

            sendEvent('progress', { value: 100 });
            sendEvent('complete', {
                message: `Fiscal year ${fiscalYearName} created successfully! 
                Net ${isProfit ? 'Profit' : 'Loss'} for the year: ${netProfitLoss.toFixed(2)} ${isProfit ? 'Cr' : 'Dr'}
                Current fiscal year set to ${fiscalYearName}.`
            });
        }, transactionOptions); // End of withTransaction

    } catch (err) {
        console.error('Error in fiscal year creation:', err);

        // Only abort if transaction wasn't committed
        await safeAbortTransaction();

        sendEvent('error', {
            message: `Failed to create fiscal year: ${err.message}`,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    } finally {
        try {
            if (session.inTransaction()) { // Ensure session is not left hanging if transaction failed without explicit abort
                await safeAbortTransaction();
            }
            await session.endSession();
        } catch (sessionError) {
            console.error('Error ending session:', sessionError);
        }
        res.end(); // Always end the response
    }

    // Handle client disconnect
    req.on('close', async () => {
        // Ensure that if the client disconnects mid-transaction, it's aborted
        await safeAbortTransaction();
        try {
            await session.endSession();
        } catch (sessionError) {
            console.error('Error ending session on client close:', sessionError);
        }
    });
});

router.get('/progress', (req, res) => {
    res.status(200).json({ progress });
});

router.get('/split-fiscal-year', ensureAuthenticated, ensureCompanySelected, async (req, res) => {
    console.log('Split fiscal year SSE endpoint hit');

    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*', // Be careful with '*' in production
    });

    const session = await mongoose.startSession();
    let transactionCommitted = false; // Flag to track transaction status

    // Function to send events
    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    // Helper function to safely abort transaction
    const safeAbortTransaction = async () => {
        if (!transactionCommitted && session.inTransaction()) {
            try {
                await session.abortTransaction();
                console.log('Transaction aborted due to error or client disconnect.');
            } catch (abortError) {
                if (!abortError.message.includes('abortTransaction twice')) {
                    console.error('Error during transaction abort:', abortError);
                }
            }
        }
    };

    try {
        // Get parameters from query string (GET request)
        const {
            sourceCompanyId: rawSourceCompanyId, // Renamed to avoid direct manipulation before ObjectId conversion
            fiscalYearId: rawFiscalYearId,       // Renamed
            newCompanyName,
            deleteAfterSplit = 'false'
        } = req.query;

        console.log('SSE Split request params:', { rawSourceCompanyId, rawFiscalYearId, newCompanyName, deleteAfterSplit });

        // Validate input and convert to ObjectId
        if (!rawSourceCompanyId || !rawFiscalYearId || !newCompanyName) {
            sendEvent('error', { error: 'Source company ID, fiscal year ID, and new company name are required' });
            return res.end();
        }

        const sourceCompanyId = new mongoose.Types.ObjectId(rawSourceCompanyId);
        const fiscalYearId = new mongoose.Types.ObjectId(rawFiscalYearId);
        const userId = new mongoose.Types.ObjectId(req.user.id);

        // Convert deleteAfterSplit to boolean
        const shouldDeleteAfterSplit = deleteAfterSplit === 'true';

        await session.withTransaction(async () => {
            // Send initial progress
            sendEvent('progress', { value: 5, message: 'Starting company split process...' });

            // Get source company
            const sourceCompany = await Company.findById(sourceCompanyId).session(session);
            if (!sourceCompany) {
                sendEvent('error', { error: 'Source company not found' });
                throw new Error('Source company not found'); // Throw to abort transaction
            }

            // Get fiscal year to split
            const splitFiscalYear = await FiscalYear.findOne({
                _id: fiscalYearId,
                company: sourceCompanyId
            }).session(session);

            if (!splitFiscalYear) {
                sendEvent('error', { error: 'Fiscal year not found in source company' });
                throw new Error('Fiscal year not found in source company'); // Throw to abort transaction
            }

            // Check if new company name already exists for this user
            const existingCompany = await Company.findOne({
                name: newCompanyName,
                owner: userId
            }).session(session);

            if (existingCompany) {
                sendEvent('error', { error: 'Company with this name already exists' });
                throw new Error('Company with this name already exists'); // Throw to abort transaction
            }

            // Step 1: Create new company
            sendEvent('progress', { value: 10, message: 'Creating new company...' });
            // Convert the start date to YYYY-MM-DD format
            const startDateObj = new Date(splitFiscalYear.startDate);
            const formattedStartDate = startDateObj.toISOString().split('T')[0];

            const newCompany = await Company.create([{
                name: newCompanyName,
                owner: userId,
                tradeType: sourceCompany.tradeType,
                address: sourceCompany.address,
                country: sourceCompany.country,
                state: sourceCompany.state,
                city: sourceCompany.city,
                ward: sourceCompany.ward,
                phone: sourceCompany.phone,
                pan: sourceCompany.pan,
                email: sourceCompany.email,
                users: [], // Will be updated later
                currency: sourceCompany.currency,
                vatEnabled: sourceCompany.vatEnabled,
                dateFormat: sourceCompany.dateFormat,
                fiscalYearStartDate: formattedStartDate,
                createdAt: new Date(), // Use current date for company creation
                updatedAt: new Date()
            }], { session });

            const newCompanyId = newCompany[0]._id;

            // Step 2: Create fiscal years for new company
            sendEvent('progress', { value: 15, message: 'Setting up fiscal years...' });

            const newFiscalYear = await FiscalYear.create([{
                name: splitFiscalYear.name,
                startDate: splitFiscalYear.startDate,
                endDate: splitFiscalYear.endDate,
                dateFormat: splitFiscalYear.dateFormat,
                company: newCompanyId,
                isActive: true
            }], { session });

            const newFiscalYearId = newFiscalYear[0]._id;

            // Step 3: Clone settings
            sendEvent('progress', { value: 20, message: 'Cloning settings...' });

            const sourceSettings = await Settings.findOne({
                company: sourceCompanyId,
                fiscalYear: splitFiscalYear._id
            }).session(session);

            if (sourceSettings) {
                await Settings.create([{
                    ...sourceSettings.toObject(),
                    _id: new mongoose.Types.ObjectId(), // Ensure new _id
                    company: newCompanyId,
                    fiscalYear: newFiscalYearId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }], { session });
            } else {
                // Create default settings if none found in source
                await Settings.create([{
                    company: newCompanyId,
                    userId: userId, // Assign to the current user (owner)
                    fiscalYear: newFiscalYearId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }], { session });
            }

            // Step 4: Clone users from source company
            sendEvent('progress', { value: 21, message: 'Cloning users with roles and permissions...' });

            const sourceUsers = await User.find({
                company: sourceCompanyId
            }).session(session);

            let usersProcessed = 0;
            const userBatchSize = 20;

            // Create user mapping for grantedBy references
            const userMap = new Map();
            userMap.set(userId.toString(), userId); // The current user is already mapped to themselves

            for (let i = 0; i < sourceUsers.length; i += userBatchSize) {
                const batch = sourceUsers.slice(i, i + userBatchSize);

                const userCreationPromises = batch.map(async (user) => {
                    try {
                        // Skip if this is the current user (owner) since they're already the owner of new company
                        if (user._id.equals(userId)) {
                            usersProcessed++;
                            return userId;
                        }

                        // Check if user with same email already exists (globally)
                        const existingUser = await User.findOne({
                            email: user.email
                        }).session(session);

                        let newUserId;

                        if (existingUser) {
                            // User exists, check if they need to be added to the new company
                            const userInNewCompany = existingUser.company && existingUser.company.equals(newCompanyId);

                            if (!userInNewCompany) {
                                // Add existing user to new company
                                await User.findByIdAndUpdate(
                                    existingUser._id,
                                    {
                                        $set: { company: newCompanyId },
                                        fiscalYear: newFiscalYearId, // Set fiscal year for the user in the new company
                                        updatedAt: new Date()
                                    },
                                    { session }
                                );
                            }
                            newUserId = existingUser._id;
                            console.log(`User "${user.email}" already exists globally. Added to new company with role: ${user.role}`);
                        } else {
                            // Create new user with hashed password and all permissions
                            const newUserData = {
                                name: user.name,
                                email: user.email,
                                password: user.password, // Already hashed in source
                                company: newCompanyId,
                                fiscalYear: newFiscalYearId, // Assign fiscal year to new user
                                isActive: user.isActive,
                                isAdmin: user.isAdmin,
                                role: user.role,
                                isEmailVerified: user.isEmailVerified,
                                menuPermissions: user.menuPermissions ? new Map(user.menuPermissions) : new Map(),
                                preferences: user.preferences ? { ...user.preferences } : { theme: 'light' },
                                createdAt: new Date(),
                                updatedAt: new Date()
                            };

                            // Handle grantedBy mapping if it exists
                            if (user.grantedBy) {
                                const grantedByNewId = userMap.get(user.grantedBy.toString());
                                if (grantedByNewId) {
                                    newUserData.grantedBy = grantedByNewId;
                                } else {
                                    // If grantedBy user not cloned yet, set to current user (owner)
                                    newUserData.grantedBy = userId;
                                }
                            }

                            const newUser = await User.create([newUserData], { session });
                            newUserId = newUser[0]._id;
                            console.log(`Created new user: ${user.name} (${user.email}) with role: ${user.role}`);
                        }

                        // Store mapping for user references
                        userMap.set(user._id.toString(), newUserId);
                        usersProcessed++;
                        return newUserId;
                    } catch (error) {
                        console.error(`Error cloning user ${user.email}:`, error);
                        // If it's a duplicate key error on email, try to find the existing user again
                        if (error.code === 11000 && error.message.includes('email')) {
                            const existingUser = await User.findOne({ email: user.email }).session(session);
                            if (existingUser) {
                                if (!existingUser.company.equals(newCompanyId)) { // Add to new company if not already there
                                    await User.findByIdAndUpdate(
                                        existingUser._id,
                                        {
                                            $set: { company: newCompanyId },
                                            fiscalYear: newFiscalYearId,
                                            updatedAt: new Date()
                                        },
                                        { session }
                                    );
                                }
                                userMap.set(user._id.toString(), existingUser._id);
                                usersProcessed++;
                                return existingUser._id;
                            }
                        }
                        throw error; // Re-throw other errors
                    }
                });

                await Promise.all(userCreationPromises);

                const progress = 21 + (usersProcessed / sourceUsers.length * 1);
                sendEvent('progress', { value: Math.min(progress, 22), message: `Cloned ${usersProcessed}/${sourceUsers.length} users with roles and permissions...` });
            }

            // Update grantedBy references for all users in a second pass (for newly created users in new company)
            if (userMap.size > 0) {
                sendEvent('progress', { value: 21.8, message: 'Updating user permissions references...' });

                const updateGrantedByPromises = [];
                userMap.forEach((newUserId, oldUserId) => {
                    // Only update users in the new company whose grantedBy might still point to an old ID
                    updateGrantedByPromises.push(
                        User.updateMany(
                            {
                                company: newCompanyId,
                                'grantedBy': new mongoose.Types.ObjectId(oldUserId) // Check for old ID
                            },
                            {
                                $set: {
                                    grantedBy: newUserId, // Set to new ID
                                    lastPermissionUpdate: new Date()
                                }
                            },
                            { session }
                        )
                    );
                });

                await Promise.all(updateGrantedByPromises);
            }

            // Update company with all cloned users
            const clonedUserIds = Array.from(userMap.values());
            // Ensure the owner (userId) is definitely in the list
            if (!clonedUserIds.some(id => id.equals(userId))) {
                clonedUserIds.push(userId);
            }

            await Company.findByIdAndUpdate(
                newCompanyId,
                {
                    $set: { users: clonedUserIds },
                    updatedAt: new Date()
                },
                { session }
            );

            sendEvent('progress', { value: 22, message: 'User cloning completed successfully' });

            // Step 5: Clone company groups from source company
            sendEvent('progress', { value: 23, message: 'Cloning account groups...' });

            const sourceCompanyGroups = await CompanyGroup.find({
                company: sourceCompanyId
            }).session(session);

            let companyGroupsProcessed = 0;
            const companyGroupBatchSize = 50;

            // Create company group mapping for account cloning
            const companyGroupMap = new Map();

            for (let i = 0; i < sourceCompanyGroups.length; i += companyGroupBatchSize) {
                const batch = sourceCompanyGroups.slice(i, i + companyGroupBatchSize);

                const companyGroupCreationPromises = batch.map(async (companyGroup) => {
                    try {
                        // Check if company group with same name already exists in new company
                        const existingCompanyGroup = await CompanyGroup.findOne({
                            name: companyGroup.name,
                            company: newCompanyId
                        }).session(session);

                        let newCompanyGroupId;

                        if (existingCompanyGroup) {
                            // Use existing company group
                            newCompanyGroupId = existingCompanyGroup._id;
                            console.log(`CompanyGroup "${companyGroup.name}" already exists in new company, using existing ID`);
                        } else {
                            // Create new company group
                            const newCompanyGroup = await CompanyGroup.create([{
                                name: companyGroup.name,
                                type: companyGroup.type,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });

                            newCompanyGroupId = newCompanyGroup[0]._id;
                            console.log(`Created new company group: ${companyGroup.name} with type: ${companyGroup.type} in new company`);
                        }

                        // Store mapping for account company group reference updates
                        companyGroupMap.set(companyGroup._id.toString(), newCompanyGroupId);
                        return newCompanyGroupId;
                    } catch (error) {
                        console.error(`Error cloning company group ${companyGroup.name}:`, error);
                        if (error.code === 11000 && error.message.includes('name')) { // Duplicate key error
                            const existingCompanyGroup = await CompanyGroup.findOne({ name: companyGroup.name, company: newCompanyId }).session(session);
                            if (existingCompanyGroup) {
                                companyGroupMap.set(companyGroup._id.toString(), existingCompanyGroup._id);
                                return existingCompanyGroup._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(companyGroupCreationPromises);
                companyGroupsProcessed += batch.length;

                const progress = 23 + (companyGroupsProcessed / sourceCompanyGroups.length * 1);
                sendEvent('progress', { value: Math.min(progress, 24), message: `Cloned ${companyGroupsProcessed}/${sourceCompanyGroups.length} account groups...` });
            }

            // Step 6: Clone categories from source company
            sendEvent('progress', { value: 24, message: 'Cloning categories...' });

            const sourceCategories = await Category.find({
                company: sourceCompanyId
            }).session(session);

            let categoriesProcessed = 0;
            const categoryBatchSize = 50;
            const categoryMap = new Map();

            for (let i = 0; i < sourceCategories.length; i += categoryBatchSize) {
                const batch = sourceCategories.slice(i, i + categoryBatchSize);

                const categoryCreationPromises = batch.map(async (category) => {
                    try {
                        const existingCategory = await Category.findOne({ name: category.name, company: newCompanyId }).session(session);
                        let newCategoryId;
                        if (existingCategory) {
                            newCategoryId = existingCategory._id;
                        } else {
                            const newCategory = await Category.create([{
                                name: category.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });
                            newCategoryId = newCategory[0]._id;
                        }
                        categoryMap.set(category._id.toString(), newCategoryId);
                        return newCategoryId;
                    } catch (error) {
                        console.error(`Error cloning category ${category.name}:`, error);
                        if (error.code === 11000 && error.message.includes('name')) {
                            const existingCategory = await Category.findOne({ name: category.name, company: newCompanyId }).session(session);
                            if (existingCategory) {
                                categoryMap.set(category._id.toString(), existingCategory._id);
                                return existingCategory._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(categoryCreationPromises);
                categoriesProcessed += batch.length;
                const progress = 24 + (categoriesProcessed / sourceCategories.length * 1);
                sendEvent('progress', { value: Math.min(progress, 25), message: `Cloned ${categoriesProcessed}/${sourceCategories.length} categories...` });
            }

            // Step 7: Clone itemsCompany from source company
            sendEvent('progress', { value: 25, message: 'Cloning items companies...' });

            const sourceItemsCompanies = await itemsCompany.find({
                company: sourceCompanyId
            }).session(session);

            let itemsCompaniesProcessed = 0;
            const itemsCompanyBatchSize = 50;
            const itemsCompanyMap = new Map();

            for (let i = 0; i < sourceItemsCompanies.length; i += itemsCompanyBatchSize) {
                const batch = sourceItemsCompanies.slice(i, i + itemsCompanyBatchSize);

                const itemsCompanyCreationPromises = batch.map(async (itemsComp) => {
                    try {
                        const existingItemsCompany = await itemsCompany.findOne({ name: itemsComp.name, company: newCompanyId }).session(session);
                        let newItemsCompanyId;
                        if (existingItemsCompany) {
                            newItemsCompanyId = existingItemsCompany._id;
                        } else {
                            const newItemsCompany = await itemsCompany.create([{
                                name: itemsComp.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });
                            newItemsCompanyId = newItemsCompany[0]._id;
                        }
                        itemsCompanyMap.set(itemsComp._id.toString(), newItemsCompanyId);
                        return newItemsCompanyId;
                    } catch (error) {
                        console.error(`Error cloning itemsCompany ${itemsComp.name}:`, error);
                        if (error.code === 11000 && error.message.includes('name')) {
                            const existingItemsCompany = await itemsCompany.findOne({ name: itemsComp.name, company: newCompanyId }).session(session);
                            if (existingItemsCompany) {
                                itemsCompanyMap.set(itemsComp._id.toString(), existingItemsCompany._id);
                                return existingItemsCompany._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(itemsCompanyCreationPromises);
                itemsCompaniesProcessed += batch.length;
                const progress = 25 + (itemsCompaniesProcessed / sourceItemsCompanies.length * 1);
                sendEvent('progress', { value: Math.min(progress, 26), message: `Cloned ${itemsCompaniesProcessed}/${sourceItemsCompanies.length} items companies...` });
            }

            // Step 8: Clone mainUnit from source company
            sendEvent('progress', { value: 26, message: 'Cloning main units...' });

            const sourceMainUnits = await MainUnit.find({
                company: sourceCompanyId
            }).session(session);

            let mainUnitsProcessed = 0;
            const mainUnitBatchSize = 50;
            const mainUnitMap = new Map();

            for (let i = 0; i < sourceMainUnits.length; i += mainUnitBatchSize) {
                const batch = sourceMainUnits.slice(i, i + mainUnitBatchSize);

                const mainUnitCreationPromises = batch.map(async (mainUnit) => {
                    try {
                        const existingMainUnit = await MainUnit.findOne({ name: mainUnit.name, company: newCompanyId }).session(session);
                        let newMainUnitId;
                        if (existingMainUnit) {
                            newMainUnitId = existingMainUnit._id;
                        } else {
                            const newMainUnit = await MainUnit.create([{
                                name: mainUnit.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });
                            newMainUnitId = newMainUnit[0]._id;
                        }
                        mainUnitMap.set(mainUnit._id.toString(), newMainUnitId);
                        return newMainUnitId;
                    } catch (error) {
                        console.error(`Error cloning mainUnit ${mainUnit.name}:`, error);
                        if (error.code === 11000 && error.message.includes('name')) {
                            const existingMainUnit = await MainUnit.findOne({ name: mainUnit.name, company: newCompanyId }).session(session);
                            if (existingMainUnit) {
                                mainUnitMap.set(mainUnit._id.toString(), existingMainUnit._id);
                                return existingMainUnit._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(mainUnitCreationPromises);
                mainUnitsProcessed += batch.length;
                const progress = 26 + (mainUnitsProcessed / sourceMainUnits.length * 1);
                sendEvent('progress', { value: Math.min(progress, 27), message: `Cloned ${mainUnitsProcessed}/${sourceMainUnits.length} main units...` });
            }

            // Step 9: Clone unit from source company
            sendEvent('progress', { value: 27, message: 'Cloning units...' });

            const sourceUnits = await Unit.find({
                company: sourceCompanyId
            }).session(session);

            let unitsProcessed = 0;
            const unitBatchSize = 50;
            const unitMap = new Map();

            for (let i = 0; i < sourceUnits.length; i += unitBatchSize) {
                const batch = sourceUnits.slice(i, i + unitBatchSize);

                const unitCreationPromises = batch.map(async (unit) => {
                    try {
                        const existingUnit = await Unit.findOne({ name: unit.name, company: newCompanyId }).session(session);
                        let newUnitId;
                        if (existingUnit) {
                            newUnitId = existingUnit._id;
                        } else {
                            const newUnit = await Unit.create([{
                                name: unit.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });
                            newUnitId = newUnit[0]._id;
                        }
                        unitMap.set(unit._id.toString(), newUnitId);
                        return newUnitId;
                    } catch (error) {
                        console.error(`Error cloning unit ${unit.name}:`, error);
                        if (error.code === 11000 && error.message.includes('name')) {
                            const existingUnit = await Unit.findOne({ name: unit.name, company: newCompanyId }).session(session);
                            if (existingUnit) {
                                unitMap.set(unit._id.toString(), existingUnit._id);
                                return existingUnit._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(unitCreationPromises);
                unitsProcessed += batch.length;
                const progress = 27 + (unitsProcessed / sourceUnits.length * 1);
                sendEvent('progress', { value: Math.min(progress, 28), message: `Cloned ${unitsProcessed}/${sourceUnits.length} units...` });
            }

            // Step 10: Clone compositions from source company
            sendEvent('progress', { value: 28, message: 'Cloning compositions...' });

            const sourceCompositions = await Composition.find({
                company: sourceCompanyId
            }).session(session);

            let compositionsProcessed = 0;
            const compositionBatchSize = 50;
            const compositionMap = new Map();

            for (let i = 0; i < sourceCompositions.length; i += compositionBatchSize) {
                const batch = sourceCompositions.slice(i, i + compositionBatchSize);

                const compositionCreationPromises = batch.map(async (composition) => {
                    try {
                        const existingComposition = await Composition.findOne({ name: composition.name, company: newCompanyId }).session(session);
                        let newCompositionId;
                        if (existingComposition) {
                            newCompositionId = existingComposition._id;
                        } else {
                            const newComposition = await Composition.create([{
                                name: composition.name,
                                company: newCompanyId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }], { session });
                            newCompositionId = newComposition[0]._id;
                        }
                        compositionMap.set(composition._id.toString(), newCompositionId);
                        return newCompositionId;
                    } catch (error) {
                        console.error(`Error cloning composition ${composition.name}:`, error);
                        if (error.code === 11000 && error.message.includes('name')) {
                            const existingComposition = await Composition.findOne({ name: composition.name, company: newCompanyId }).session(session);
                            if (existingComposition) {
                                compositionMap.set(composition._id.toString(), existingComposition._id);
                                return existingComposition._id;
                            }
                        }
                        throw error;
                    }
                });

                await Promise.all(compositionCreationPromises);
                compositionsProcessed += batch.length;
                const progress = 28 + (compositionsProcessed / sourceCompositions.length * 1);
                sendEvent('progress', { value: Math.min(progress, 29), message: `Cloned ${compositionsProcessed}/${sourceCompositions.length} compositions...` });
            }

            // Helper for safe reference mapping
            const getSafeReference = (oldId, mapping, fieldName, itemOrAccountName) => {
                if (!oldId) {
                    // console.warn(`${itemOrAccountName} has undefined ${fieldName}`); // Log this if it happens frequently
                    return undefined;
                }

                const oldIdString = oldId.toString();
                const newId = mapping.get(oldIdString);

                if (!newId) {
                    console.warn(`No mapping found for ${fieldName}: ${oldIdString} in ${itemOrAccountName}. This might indicate missing data or an unmapped type.`);
                    return undefined; // Return undefined if no mapping is found
                }
                return newId;
            };

            // Step 11: Process items in batches - WITH PROPER COMPOSITION ASSOCIATION
            sendEvent('progress', { value: 29, message: 'Cloning items with stock and composition data...' });

            const sourceItems = await Item.find({
                company: sourceCompanyId,
                fiscalYear: splitFiscalYear._id
            }).session(session); // Don't populate here, use mappings

            let itemsProcessed = 0;
            const itemBatchSize = 50;

            for (let i = 0; i < sourceItems.length; i += itemBatchSize) {
                const batch = sourceItems.slice(i, i + itemBatchSize);

                const itemCreationPromises = batch.map(async (item) => {
                    try {
                        const newCompositionIds = [];
                        if (item.composition && item.composition.length > 0) {
                            for (const oldCompId of item.composition) {
                                if (oldCompId) {
                                    const newCompId = compositionMap.get(oldCompId.toString());
                                    if (newCompId) {
                                        newCompositionIds.push(newCompId);
                                    } else {
                                        console.warn(`No mapping found for composition ID ${oldCompId} for item ${item.name}. Skipping this composition for the new item.`);
                                    }
                                }
                            }
                        }

                        // Safely get all references
                        const newItemsCompany = getSafeReference(item.itemsCompany, itemsCompanyMap, 'itemsCompany', item.name);
                        const newCategory = getSafeReference(item.category, categoryMap, 'category', item.name);
                        const newUnit = getSafeReference(item.unit, unitMap, 'unit', item.name);
                        const newMainUnit = getSafeReference(item.mainUnit, mainUnitMap, 'mainUnit', item.name);

                        // Basic validation for critical references
                        if (!newItemsCompany || !newCategory || !newUnit || !newMainUnit) {
                            console.error(`Skipping item ${item.name} - missing required cloned references.`);
                            return null; // Skip this item
                        }

                        // Get the specific opening and closing stock data for the split fiscal year
                        const openingStockData = item.openingStockByFiscalYear?.find(
                            os => os.fiscalYear.equals(splitFiscalYear._id)
                        );

                        const closingStockData = item.closingStockByFiscalYear?.find(
                            cs => cs.fiscalYear.equals(splitFiscalYear._id)
                        );

                        // Use the existing stock values from the source item, ensuring they are numbers
                        const currentStock = Number(item.stock) || 0;
                        const currentOpeningStock = Number(item.openingStock) || 0;

                        // Use purchase/sales price from opening stock data or fallback to item's direct fields, ensuring numbers
                        const purchasePrice = Number(openingStockData?.purchasePrice) || Number(item.puPrice) || 0;
                        const salesPrice = Number(openingStockData?.salesPrice) || Number(item.price) || 0;
                        const openingStockValue = Number(purchasePrice * currentOpeningStock) || 0; // Ensure result is a number

                        // Clone ALL stock entries
                        const clonedStockEntries = item.stockEntries.map(entry => {
                            const clonedEntry = {
                                ...entry.toObject(),
                                _id: new mongoose.Types.ObjectId()
                            };

                            // Clear any specific transaction/bill references that belong to the old company/transactions
                            clonedEntry.purchaseBillId = undefined;
                            clonedEntry.sourceTransfer = undefined;
                            clonedEntry.transactionId = undefined;

                            // Recalculate expiry status for the new entry
                            if (clonedEntry.expiryDate) {
                                const today = new Date();
                                const expiryDate = new Date(clonedEntry.expiryDate);
                                const timeDiff = expiryDate.getTime() - today.getTime();
                                const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

                                clonedEntry.daysUntilExpiry = daysUntilExpiry;

                                if (daysUntilExpiry <= 0) {
                                    clonedEntry.expiryStatus = 'expired';
                                } else if (daysUntilExpiry <= 30) {
                                    clonedEntry.expiryStatus = 'danger';
                                } else if (daysUntilExpiry <= 90) {
                                    clonedEntry.expiryStatus = 'warning';
                                } else {
                                    clonedEntry.expiryStatus = 'safe';
                                }
                            }
                            return clonedEntry;
                        });

                        const newItemData = {
                            name: item.name,
                            code: item.code,
                            barcode: item.barcode,
                            itemsCompany: newItemsCompany,
                            category: newCategory,
                            unit: newUnit,
                            mainUnit: newMainUnit,
                            composition: newCompositionIds, // Use the mapped composition IDs
                            puPrice: Number(item.puPrice) || 0, // Ensure numbers
                            price: Number(item.price) || 0,     // Ensure numbers
                            WSUnit: item.WSUnit,
                            company: newCompanyId,
                            fiscalYear: [newFiscalYearId],
                            originalFiscalYear: newFiscalYearId,
                            stock: currentStock,
                            openingStock: currentOpeningStock,
                            minStock: Number(item.minStock) || 0,
                            maxStock: Number(item.maxStock) || 0,
                            reorderLevel: Number(item.reorderLevel) || 0,
                            isActive: item.isActive,
                            vatStatus: item.vatStatus,
                            vatRate: Number(item.vatRate) || 0,
                            discount: Number(item.discount) || 0,
                            description: item.description,
                            hscode: item.hscode,
                            manufacturer: item.manufacturer,
                            brand: item.brand,
                            openingStockByFiscalYear: [{
                                fiscalYear: newFiscalYearId,
                                openingStock: currentOpeningStock,
                                openingStockValue: openingStockValue,
                                purchasePrice: purchasePrice,
                                salesPrice: salesPrice,
                            }],
                            closingStockByFiscalYear: closingStockData ? [{
                                fiscalYear: newFiscalYearId,
                                closingStock: Number(closingStockData.closingStock) || 0,
                                closingStockValue: Number(closingStockData.closingStockValue) || 0,
                                purchasePrice: Number(closingStockData.purchasePrice) || purchasePrice, // Use current calculated if missing
                                salesPrice: Number(closingStockData.salesPrice) || salesPrice,       // Use current calculated if missing
                            }] : [],
                            initialOpeningStock: item.initialOpeningStock ? {
                                initialFiscalYear: newFiscalYearId,
                                openingStock: Number(item.initialOpeningStock.openingStock) || currentOpeningStock,
                                openingStockValue: Number(item.initialOpeningStock.openingStockValue) || openingStockValue,
                                purchasePrice: Number(item.initialOpeningStock.purchasePrice) || purchasePrice,
                                salesPrice: Number(item.initialOpeningStock.salesPrice) || salesPrice,
                                date: new Date()
                            } : undefined,
                            stockEntries: clonedStockEntries,
                            status: item.status || 'active',
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };

                        const newItem = await Item.create([newItemData], { session });
                        return newItem[0]._id;
                    } catch (error) {
                        console.error(`Error cloning item ${item.name}:`, error);
                        return null; // Return null to allow other items to process
                    }
                });

                const batchResults = await Promise.all(itemCreationPromises);
                const validResults = batchResults.filter(id => id !== null); // Count only successfully cloned items
                itemsProcessed += validResults.length;

                const progress = 29 + (itemsProcessed / sourceItems.length * 29);
                sendEvent('progress', { value: Math.min(progress, 58), message: `Cloned ${itemsProcessed}/${sourceItems.length} items with compositions and stock...` });
            }

            // Step 12: Process accounts in batches - CLONE DIRECTLY FROM SOURCE ACCOUNTS
            sendEvent('progress', { value: 58, message: 'Cloning accounts with balance data...' });

            const sourceAccounts = await Account.find({
                company: sourceCompanyId,
                fiscalYear: splitFiscalYear._id
            }).session(session);

            let accountsProcessed = 0;
            const accountBatchSize = 50;

            for (let i = 0; i < sourceAccounts.length; i += accountBatchSize) {
                const batch = sourceAccounts.slice(i, i + accountBatchSize);

                const accountCreationPromises = batch.map(async (account) => {
                    try {
                        const openingBalanceData = account.openingBalanceByFiscalYear?.find(
                            ob => ob.fiscalYear.equals(splitFiscalYear._id)
                        );

                        // Use existing balance values from the source account, ensuring numbers
                        const currentOpeningBalanceAmount = Number(account.openingBalance?.amount) || 0;
                        const currentOpeningBalanceType = account.openingBalance?.type || 'Dr';

                        // 🔥 FIX: Get the new company group ID from the mapping
                        const newCompanyGroupId = getSafeReference(account.companyGroups, companyGroupMap, 'companyGroups', account.name);

                        // Basic validation for critical references
                        if (!newCompanyGroupId) {
                            console.error(`Skipping account ${account.name} - missing required cloned company group reference.`);
                            return null; // Skip this account
                        }

                        const newAccount = await Account.create([{
                            name: account.name,
                            address: account.address,
                            ward: account.ward,
                            phone: account.phone,
                            pan: account.pan,
                            contactperson: account.contactperson,
                            email: account.email,
                            type: account.type,
                            companyGroups: newCompanyGroupId, // 🔥 FIX: Use the new company group ID
                            company: newCompanyId,
                            fiscalYear: [newFiscalYearId],
                            originalFiscalYear: newFiscalYearId,
                            creditLimit: Number(account.creditLimit) || 0, // Ensure number
                            openingBalance: {
                                fiscalYear: newFiscalYearId,
                                amount: currentOpeningBalanceAmount,
                                type: currentOpeningBalanceType,
                                date: startDateObj // Use fiscal year start date
                            },
                            openingBalanceByFiscalYear: [{
                                fiscalYear: newFiscalYearId,
                                amount: currentOpeningBalanceAmount,
                                type: currentOpeningBalanceType,
                                date: startDateObj // Use fiscal year start date
                            }],
                            closingBalanceByFiscalYear: [{
                                fiscalYear: newFiscalYearId, // Closing for this (new) fiscal year is the same as opening
                                amount: currentOpeningBalanceAmount,
                                type: currentOpeningBalanceType,
                                date: startDateObj // Use fiscal year start date
                            }],
                            initialOpeningBalance: account.initialOpeningBalance ? {
                                initialFiscalYear: newFiscalYearId,
                                amount: Number(account.initialOpeningBalance.amount) || currentOpeningBalanceAmount,
                                type: account.initialOpeningBalance.type || currentOpeningBalanceType,
                                date: startDateObj
                            } : undefined,
                            openingBalanceDate: startDateObj, // Use fiscal year start date
                            isActive: account.isActive,
                            defaultCashAccount: account.defaultCashAccount,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }], { session });

                        return newAccount[0]._id;
                    } catch (error) {
                        console.error(`Error cloning account ${account.name}:`, error);
                        return null; // Return null to allow other accounts to process
                    }
                });

                const batchResults = await Promise.all(accountCreationPromises);
                const validResults = batchResults.filter(id => id !== null); // Count only successfully cloned accounts
                accountsProcessed += validResults.length;

                const progress = 58 + (accountsProcessed / sourceAccounts.length * 25);
                sendEvent('progress', { value: Math.min(progress, 83), message: `Cloned ${accountsProcessed}/${sourceAccounts.length} accounts with balance data...` });
            }


            // Step 13: Copy transactions (Requires re-mapping ALL item/account/contraAccount references)
            sendEvent('progress', { value: 83, message: 'Copying transactions (This is a placeholder - requires re-mapping all references)...' });
            // This section is complex. To truly "copy" transactions, you would need to:
            // 1. Fetch all transactions for the `splitFiscalYear` from `sourceCompanyId`.
            // 2. For each transaction, create a new transaction in `newCompanyId` for `newFiscalYearId`.
            // 3. CRITICALLY: Any `item`, `account`, `contraAccount`, `purchaseBillId` references
            //    in the original transaction MUST be mapped to their newly created counterparts
            //    in the new company using the maps (itemMap, accountMap, etc.) you built earlier.
            //    If a referenced entity wasn't cloned (e.g., an item was skipped),
            //    you'd need to decide how to handle that transaction (skip it, or replace reference with default/null).
            // This logic is significant and is beyond a simple copy-paste for safety.
            // For now, I'm keeping this as a placeholder and logging.
            const sourceTransactions = await Transaction.find({
                company: sourceCompanyId,
                fiscalYear: splitFiscalYear._id
            }).session(session); // Just fetching, not copying yet

            sendEvent('log', { message: `Found ${sourceTransactions.length} transactions to potentially copy. Manual mapping of references is required for actual copying.` });

            // Step 14: Initialize bill counters
            sendEvent('progress', { value: 90, message: 'Initializing counters...' });

            const transactionTypes = [
                'Sales', 'Purchase', 'SalesReturn', 'PurchaseReturn',
                'Payment', 'Receipt', 'Journal', 'DebitNote', 'CreditNote', 'StockAdjustment', 'BankDeposit', 'BankWithdrawal'
            ];

            await Promise.all(transactionTypes.map(async (transactionType) => {
                // Check if counter already exists to prevent duplicates if retry happens
                const existingCounter = await BillCounter.findOne({
                    company: newCompanyId,
                    fiscalYear: newFiscalYearId,
                    transactionType
                }).session(session);

                if (!existingCounter) {
                    await BillCounter.create([{
                        company: newCompanyId,
                        fiscalYear: newFiscalYearId,
                        transactionType,
                        currentBillNumber: 0
                    }], { session });
                }
            }));

            // Step 15: Clean up source company if requested
            if (shouldDeleteAfterSplit) {
                sendEvent('progress', { value: 95, message: 'Cleaning up source company...' });

                const deletionStats = {
                    itemsDeleted: 0,
                    accountsDeleted: 0,
                    transactionsDeleted: 0,
                    fiscalYearsDeleted: 0,
                    settingsDeleted: 0,
                    billCountersDeleted: 0,
                    usersUpdated: 0,
                    categoriesDeleted: 0,
                    itemsCompaniesDeleted: 0,
                    mainUnitsDeleted: 0,
                    unitsDeleted: 0,
                    compositionsDeleted: 0,
                    companyGroupsDeleted: 0,
                };

                // 15.1: Prevent deletion of current active fiscal year for the logged-in user's session
                if (req.session.currentFiscalYear && fiscalYearId.equals(req.session.currentFiscalYear.id)) {
                    sendEvent('error', { error: 'Cannot delete the current active fiscal year. Switch to another fiscal year in the source company first.' });
                    throw new Error('Cannot delete current active fiscal year');
                }

                // 15.2: Check if it's the only fiscal year in source company
                const fiscalYearCount = await FiscalYear.countDocuments({ company: sourceCompanyId }).session(session);
                if (fiscalYearCount <= 1) { // Changed to <= 1 to avoid deleting the very last FY
                    sendEvent('error', { error: 'Cannot delete the last remaining fiscal year in the source company.' });
                    throw new Error('Cannot delete the last remaining fiscal year in source company');
                }

                sendEvent('progress', { value: 96, message: 'Deleting transactions from source company...' });
                const transactionResult = await Transaction.deleteMany({
                    company: sourceCompanyId,
                    fiscalYear: splitFiscalYear._id
                }).session(session);
                deletionStats.transactionsDeleted += transactionResult.deletedCount;

                sendEvent('progress', { value: 97, message: 'Cleaning up items in source company...' });
                // 15.3: Remove fiscal year reference from items. If an item *only* belongs to this fiscal year, delete it.
                const itemsAffected = await Item.find({
                    company: sourceCompanyId,
                    fiscalYear: splitFiscalYear._id
                }).session(session);

                for (const item of itemsAffected) {
                    if (item.fiscalYear.length === 1 && item.fiscalYear[0].equals(splitFiscalYear._id)) {
                        // If this is the only fiscal year for the item, delete the item
                        await Item.findByIdAndDelete(item._id).session(session);
                        deletionStats.itemsDeleted++;
                    } else {
                        // Otherwise, just pull the fiscal year reference
                        item.fiscalYear.pull(splitFiscalYear._id);
                        item.openingStockByFiscalYear = item.openingStockByFiscalYear.filter(f => !f.fiscalYear.equals(splitFiscalYear._id));
                        item.closingStockByFiscalYear = item.closingStockByFiscalYear.filter(f => !f.fiscalYear.equals(splitFiscalYear._id));
                        item.stockEntries = item.stockEntries.filter(entry => { // Assuming stockEntries can have fiscalYear or you need to clear them
                            // Decide if you need to filter stockEntries based on fiscalYear
                            // For this operation, usually you just remove the fiscalYear reference from the item
                            // and the stockEntries should remain if they don't have fiscalYear field.
                            // If they DO have fiscalYear, then this filter applies.
                            return !(entry.fiscalYear && entry.fiscalYear.equals(splitFiscalYear._id));
                        });
                        if (item.originalFiscalYear && item.originalFiscalYear.equals(splitFiscalYear._id)) {
                            item.originalFiscalYear = undefined; // Clear original fiscal year if it was the one being split
                        }
                        await item.save({ session });
                    }
                }

                sendEvent('progress', { value: 98, message: 'Cleaning up accounts in source company...' });
                // 15.4: Remove fiscal year reference from accounts. If an account *only* belongs to this fiscal year, delete it.
                const accountsAffected = await Account.find({
                    company: sourceCompanyId,
                    fiscalYear: splitFiscalYear._id
                }).session(session);

                for (const account of accountsAffected) {
                    if (account.fiscalYear.length === 1 && account.fiscalYear[0].equals(splitFiscalYear._id)) {
                        await Account.findByIdAndDelete(account._id).session(session);
                        deletionStats.accountsDeleted++;
                    } else {
                        account.fiscalYear.pull(splitFiscalYear._id);
                        account.openingBalanceByFiscalYear = account.openingBalanceByFiscalYear.filter(f => !f.fiscalYear.equals(splitFiscalYear._id));
                        account.closingBalanceByFiscalYear = account.closingBalanceByFiscalYear.filter(f => !f.fiscalYear.equals(splitFiscalYear._id));
                        if (account.originalFiscalYear && account.originalFiscalYear.equals(splitFiscalYear._id)) {
                            account.originalFiscalYear = undefined;
                        }

                        // IMPORTANT: Recalculate 'openingBalance' if the one being removed was the primary one
                        // This is a simplification; a full recalculation would involve finding the previous FY's closing balance.
                        // For simplicity, we'll reset it to 0 if the originalFY was deleted.
                        if (account.openingBalance && account.openingBalance.fiscalYear && account.openingBalance.fiscalYear.equals(splitFiscalYear._id)) {
                            account.openingBalance = { amount: 0, type: 'Dr', fiscalYear: newFiscalYearId }; // Point to a valid FY for new company (even if 0)
                        }
                        await account.save({ session });
                    }
                }

                sendEvent('progress', { value: 99, message: 'Removing supporting records from source company...' });
                // 15.5: Delete supporting records specific to the fiscal year
                const settingsResult = await Settings.deleteMany({ company: sourceCompanyId, fiscalYear: splitFiscalYear._id }).session(session);
                deletionStats.settingsDeleted += settingsResult.deletedCount;

                const billCounterResult = await BillCounter.deleteMany({ company: sourceCompanyId, fiscalYear: splitFiscalYear._id }).session(session);
                deletionStats.billCountersDeleted += billCounterResult.deletedCount;

                // 15.6: Delete the fiscal year itself
                await FiscalYear.findByIdAndDelete(splitFiscalYear._id).session(session);
                deletionStats.fiscalYearsDeleted++;

                // 15.7: Remove sourceCompanyId from any users who no longer belong to it (this might be too broad)
                // It's safer to only remove the specific user associations that were part of the split
                // (e.g., if a user was only tied to the fiscal year being deleted)
                // For simplicity, we assume users are shared or managed separately for company association.
                // If a user was SOLELY linked to this fiscal year/company and no other, they might need adjustment.
                // For now, only remove fiscalYear ref from user if it was the only one.
                const usersWhoseFiscalYearWasSplit = await User.find({ company: sourceCompanyId, fiscalYear: splitFiscalYear._id }).session(session);
                for (const user of usersWhoseFiscalYearWasSplit) {
                    // This is a simplification. A real system would need to decide what to do with users
                    // who no longer have a valid fiscal year in their previous company.
                    // For now, we'll unset the fiscalYear for them in the old company.
                    user.fiscalYear = undefined;
                    await user.save({ session });
                    deletionStats.usersUpdated++;
                }

                // If some base data (Categories, Units, Groups, etc.) are no longer referenced by any remaining items/accounts in the SOURCE company,
                // you might want to delete them. This is very complex and usually not done automatically.
                // For a split, you generally only delete the specific fiscal year's transactional data.
                // It's better to leave the master data (categories, units) in the source company unless explicitly managed.

                console.log('Cleanup completed:', deletionStats);
                sendEvent('progress', { value: 99, message: `Cleanup completed: ${deletionStats.itemsDeleted} items, ${deletionStats.accountsDeleted} accounts, ${deletionStats.transactionsDeleted} transactions removed from source fiscal year.` });
            }

            // Mark transaction as committed
            transactionCommitted = true;

            // Final response
            const result = {
                success: true,
                message: `Company split successfully. New company "${newCompanyName}" created with cloned balances and stocks.`,
                data: {
                    newCompany: {
                        _id: newCompanyId,
                        name: newCompanyName
                    },
                    newFiscalYear: {
                        _id: newFiscalYearId,
                        name: splitFiscalYear.name
                    },
                    statistics: {
                        usersCopied: usersProcessed,
                        companyGroupsCopied: companyGroupsProcessed,
                        categoriesCopied: categoriesProcessed,
                        itemsCompaniesCopied: itemsCompaniesProcessed,
                        mainUnitsCopied: mainUnitsProcessed,
                        unitsCopied: unitsProcessed,
                        compositionsCopied: compositionsProcessed,
                        itemsCopied: itemsProcessed,
                        accountsCopied: accountsProcessed,
                        transactionsFoundForCopy: sourceTransactions.length // Not actually copied yet
                    }
                }
            };

            sendEvent('complete', { ...result });
        }); // End of withTransaction
    } catch (error) {
        console.error('Error splitting company:', error);
        await safeAbortTransaction(); // Ensure transaction is aborted on error

        sendEvent('error', {
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        try {
            await session.endSession(); // Ensure session is always ended
        } catch (sessionError) {
            console.error('Error ending session:', sessionError);
        }
        res.end(); // Always end the response stream
    }

    // Handle client disconnect
    req.on('close', async () => {
        console.log('Client disconnected from SSE');
        await safeAbortTransaction(); // Abort if client disconnects before commit
        try {
            await session.endSession();
        } catch (sessionError) {
            console.error('Error ending session on client close:', sessionError);
        }
    });
});


// router.delete('/delete-fiscal-year/:id', ensureAuthenticated, ensureCompanySelected, async (req, res) => {
//     const fiscalYearId = req.params.id;
//     const companyId = req.session.currentCompany;

//     try {
//         // 1. Get the fiscal year to be deleted
//         const fiscalYearToDelete = await FiscalYear.findOne({
//             _id: fiscalYearId,
//             company: companyId
//         });

//         if (!fiscalYearToDelete) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Fiscal year not found.'
//             });
//         }

//         // 2. Prevent deletion of current fiscal year
//         if (fiscalYearToDelete._id.equals(req.session.currentFiscalYear.id)) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Cannot delete the current active fiscal year. Switch to another fiscal year first.'
//             });
//         }

//         // 3. Check if it's the only fiscal year
//         const fiscalYearCount = await FiscalYear.countDocuments({ company: companyId });
//         if (fiscalYearCount === 1) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Cannot delete the only fiscal year.'
//             });
//         }

//         // 4. Check if any transactions exist for this fiscal year
//         const transactionExists = await Transaction.exists({
//             company: companyId,
//             fiscalYear: fiscalYearId
//         });

//         if (transactionExists) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Cannot delete this fiscal year because it has transactions.'
//             });
//         }

//         // Track deletion statistics
//         const deletionStats = {
//             itemsDeleted: 0,
//             accountsDeleted: 0,
//             transactionsDeleted: 0
//         };

//         // 5. Delete items originally created in this fiscal year
//         const itemsToDelete = await Item.find({
//             company: companyId,
//             originalFiscalYear: fiscalYearId
//         });

//         // Delete items and their related data
//         if (itemsToDelete.length > 0) {
//             const itemIds = itemsToDelete.map(item => item._id);

//             // Delete related transactions
//             const transactionResult = await Transaction.deleteMany({
//                 company: companyId,
//                 item: { $in: itemIds }
//             });
//             deletionStats.transactionsDeleted += transactionResult.deletedCount;

//             // Delete the items themselves
//             const itemResult = await Item.deleteMany({
//                 _id: { $in: itemIds }
//             });
//             deletionStats.itemsDeleted = itemResult.deletedCount;
//         }

//         // 6. Remove fiscal year references from remaining items
//         await Item.updateMany(
//             { company: companyId, fiscalYear: fiscalYearId },
//             {
//                 $pull: {
//                     fiscalYear: fiscalYearId,
//                     openingStockByFiscalYear: { fiscalYear: fiscalYearId },
//                     closingStockByFiscalYear: { fiscalYear: fiscalYearId },
//                     stockEntries: { fiscalYear: fiscalYearId }
//                 }
//             }
//         );

//         // 7. Delete accounts created in this fiscal year
//         const accountsToDelete = await Account.find({
//             company: companyId,
//             $or: [
//                 { originalFiscalYear: fiscalYearId },
//                 { fiscalYear: { $eq: [fiscalYearId] } } // Accounts only belonging to this FY
//             ]
//         });

//         if (accountsToDelete.length > 0) {
//             const accountIds = accountsToDelete.map(acc => acc._id);

//             // Delete related transactions
//             const accountTransactionResult = await Transaction.deleteMany({
//                 company: companyId,
//                 $or: [
//                     { account: { $in: accountIds } },
//                     { contraAccount: { $in: accountIds } }
//                 ]
//             });
//             deletionStats.transactionsDeleted += accountTransactionResult.deletedCount;

//             // Delete the accounts themselves
//             const accountResult = await Account.deleteMany({
//                 _id: { $in: accountIds }
//             });
//             deletionStats.accountsDeleted = accountResult.deletedCount;
//         }

//         // 8. Remove references from accounts
//         const latestFiscalYear = await FiscalYear.findOne({
//             company: companyId,
//             _id: { $ne: fiscalYearId }
//         }).sort({ endDate: -1 });

//         await Account.updateMany(
//             { company: companyId },
//             {
//                 $pull: {
//                     fiscalYear: fiscalYearId,
//                     openingBalanceByFiscalYear: { fiscalYear: fiscalYearId },
//                     closingBalanceByFiscalYear: {
//                         fiscalYear: latestFiscalYear ? latestFiscalYear._id : null
//                     }
//                 },
//                 $unset: {
//                     'openingBalance.fiscalYear': 1
//                 },
//                 $set: {
//                     'openingBalance.amount': 0,
//                     'openingBalance.type': 'Dr'
//                 }
//             }
//         );

//         // 9. Delete supporting records
//         const fiscalYearTransactions = await Transaction.deleteMany({
//             company: companyId,
//             fiscalYear: fiscalYearId
//         });
//         deletionStats.transactionsDeleted += fiscalYearTransactions.deletedCount;

//         // 10. Delete bill counters for this fiscal year
//         await BillCounter.deleteMany({
//             company: companyId,
//             fiscalYear: fiscalYearId
//         });

//         // 11. Delete settings for this fiscal year
//         await Settings.deleteMany({
//             company: companyId,
//             fiscalYear: fiscalYearId
//         });

//         // 12. Delete the fiscal year
//         await FiscalYear.findByIdAndDelete(fiscalYearId);

//         // 13. Update company with new latest fiscal year
//         if (latestFiscalYear) {
//             await Company.findByIdAndUpdate(companyId, {
//                 fiscalYear: latestFiscalYear._id
//             });

//             // Update session with new fiscal year if needed
//             if (req.session.currentFiscalYear && req.session.currentFiscalYear.id === fiscalYearId) {
//                 req.session.currentFiscalYear = {
//                     id: latestFiscalYear._id.toString(),
//                     startDate: latestFiscalYear.startDate,
//                     endDate: latestFiscalYear.endDate,
//                     name: latestFiscalYear.name,
//                     dateFormat: latestFiscalYear.dateFormat,
//                     isActive: latestFiscalYear.isActive
//                 };
//             }
//         }

//         res.status(200).json({
//             success: true,
//             message: `Fiscal year "${fiscalYearToDelete.name}" deleted successfully`,
//             data: {
//                 deletedFiscalYear: {
//                     id: fiscalYearToDelete._id,
//                     name: fiscalYearToDelete.name,
//                     startDate: fiscalYearToDelete.startDate,
//                     endDate: fiscalYearToDelete.endDate
//                 },
//                 deletionStats: deletionStats,
//                 newActiveFiscalYear: latestFiscalYear ? {
//                     id: latestFiscalYear._id,
//                     name: latestFiscalYear.name,
//                     startDate: latestFiscalYear.startDate,
//                     endDate: latestFiscalYear.endDate
//                 } : null
//             }
//         });

//     } catch (err) {
//         console.error('Error deleting fiscal year:', err);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to delete fiscal year',
//             message: err.message
//         });
//     }
// });


module.exports = router;
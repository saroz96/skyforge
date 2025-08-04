const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const NepaliDate = require('nepali-date');
const PurchaseBill = require('../../models/retailer/PurchaseBill')
const PurchaseReturn = require('../../models/retailer/PurchaseReturns');
const SalesBill = require('../../models/retailer/SalesBill');
const SalesReturn = require('../../models/retailer/SalesReturn');
const StockAdjustment = require('../../models/retailer/StockAdjustment');
const Company = require('../../models/Company');
const Item = require('../../models/retailer/Item');
const FiscalYear = require('../../models/FiscalYear');
const { isLoggedIn, ensureAuthenticated, ensureCompanySelected } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const Account = require('../../models/retailer/Account');

router.get('/items/search/getFetched', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear');

        // Check if fiscal year is already in the session or available in the company
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

        // Get all items for the company
        const items = await Item.find({
            company: companyId,
            status: 'active',
            $or: [
                { originalFiscalYear: fiscalYear },
                {
                    fiscalYear: fiscalYear,
                    originalFiscalYear: { $lt: fiscalYear }
                }
            ]
        })
            .populate('category', 'name')
            .populate('unit', 'name')
            .populate('originalFiscalYear')
            .sort({ name: 1 });

        // Format items with calculated stock and price
        const formattedItems = items.map((item) => {
            const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
            const latestStockEntry = item.stockEntries.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const price = latestStockEntry?.price || item.price || 0;
            const puPrice = latestStockEntry?.puPrice || item.puPrice || 0;

            return {
                _id: item._id,
                name: item.name,
                code: item.code || '', // Added code field for frontend search
                category: item.category?.name || 'N/A',
                stock: totalStock,
                unit: item.unit || { name: 'N/A' }, // Changed to object format for frontend
                price: price || puPrice,
                mainUnitPuPrice: latestStockEntry?.mainUnitPuPrice || item.mainUnitPuPrice || 0,
                mrp: latestStockEntry?.mrp || item.mrp || 0
            };
        });

        res.json({
            success: true,
            data: formattedItems
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load items',
            error: error.message
        });
    }
});


router.get('/items-ledger/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'This endpoint is only available for retailers'
        });
    }

    try {
        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
        const companyDateFormat = company ? company.dateFormat : 'english';

        // Extract dates from query parameters
        let fromDate = req.query.fromDate ? req.query.fromDate : null;
        let toDate = req.query.toDate ? req.query.toDate : null;

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

        // Fiscal year handling
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

        if (!fromDate || !toDate) {
            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    companyId,
                    nepaliDate,
                    companyDateFormat,
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName,
                    title: 'Items Ledger',
                    user: req.user,
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        }

        // Build the query based on the company's date format
        let query = { company: companyId };

        if (fromDate && toDate) {
            query.date = { $gte: fromDate, $lte: toDate };
        } else if (fromDate) {
            query.date = { $gte: fromDate };
        } else if (toDate) {
            query.date = { $lte: toDate };
        }

        const itemId = req.params.id;
        const item = await Item.findById(itemId)
            .populate('fiscalYear')
            .populate('openingStockByFiscalYear.fiscalYear')
            .populate('unit');

        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found'
            });
        }

        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid item ID'
            });
        }


        // Calculate adjusted opening stock
        let openingStock = parseFloat(item.initialOpeningStock?.openingStock) || 0.00;
        const purchasePrice = parseFloat(item.initialOpeningStock?.purchasePrice) || 0.00;

        if (fromDate) {
            const preDateQuery = {
                company: companyId,
                date: { $lt: fromDate },
                'items.item': itemId
            };

            const [
                historicalPurchases,
                historicalPurchaseReturns,
                historicalSales,
                historicalSalesReturns,
                historicalAdjustments
            ] = await Promise.all([
                PurchaseBill.find(preDateQuery),
                PurchaseReturn.find(preDateQuery),
                SalesBill.find(preDateQuery),
                SalesReturn.find(preDateQuery),
                StockAdjustment.find(preDateQuery)
            ]);

            openingStock += calculateHistoricalStock(
                historicalPurchases,
                historicalPurchaseReturns,
                historicalSales,
                historicalSalesReturns,
                historicalAdjustments,
                itemId
            );
        }

        // Fetch transactions for the date range
        const [
            purchaseEntries,
            purchaseReturnEntries,
            salesEntries,
            salesReturnEntries,
            stockAdjustmentEntries
        ] = await Promise.all([
            PurchaseBill.find({ ...query, 'items.item': itemId })
                .populate('account')
                .populate({
                    path: 'items.item',
                    model: 'Item',
                    select: 'name stock bonus',
                    populate: { path: 'unit' }
                }),
            PurchaseReturn.find({ ...query, 'items.item': itemId })
                .populate('account')
                .populate({
                    path: 'items.item',
                    model: 'Item',
                    select: 'name stock',
                    populate: { path: 'unit' }
                }),
            SalesBill.find({ ...query, 'items.item': itemId })
                .populate('account')
                .populate({
                    path: 'items.item',
                    model: 'Item',
                    select: 'name stock',
                    populate: { path: 'unit' }
                }),
            SalesReturn.find({ ...query, 'items.item': itemId })
                .populate('account')
                .populate({
                    path: 'items.item',
                    model: 'Item',
                    select: 'name stock',
                    populate: { path: 'unit' }
                }),
            StockAdjustment.find({ ...query, 'items.item': itemId })
                .populate({
                    path: 'items.item',
                    model: 'Item',
                    select: 'name stock',
                    populate: { path: 'unit' }
                })
        ]);

        // Process all entries
        let entries = [];

        // Process purchase entries
        purchaseEntries.forEach(purchaseBill => {
            purchaseBill.items.forEach(itemEntry => {
                if (itemEntry.item._id.toString() === itemId) {
                    entries.push(createPurchaseEntry(purchaseBill, itemEntry));
                }
            });
        });

        // Process purchase return entries
        purchaseReturnEntries.forEach(purchaseReturn => {
            purchaseReturn.items.forEach(itemEntry => {
                if (itemEntry.item._id.toString() === itemId) {
                    entries.push(createPurchaseReturnEntry(purchaseReturn, itemEntry));
                }
            });
        });

        // Process sales entries
        salesEntries.forEach(salesBill => {
            salesBill.items.forEach(itemEntry => {
                if (itemEntry.item._id.toString() === itemId) {
                    entries.push(createSalesEntry(salesBill, itemEntry));
                }
            });
        });

        // Process sales return entries
        salesReturnEntries.forEach(salesReturn => {
            salesReturn.items.forEach(itemEntry => {
                if (itemEntry.item._id.toString() === itemId) {
                    entries.push(createSalesReturnEntry(salesReturn, itemEntry));
                }
            });
        });

        // Process stock adjustment entries
        stockAdjustmentEntries.forEach(adjustment => {
            adjustment.items.forEach(itemEntry => {
                if (itemEntry.item._id.toString() === itemId) {
                    entries.push(createAdjustmentEntry(adjustment, itemEntry));
                }
            });
        });

        // Sort entries by date
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate running balance
        let balance = openingStock;
        entries = entries.map(entry => {
            balance += (entry.qtyIn + (entry.bonus || 0)) - entry.qtyOut;
            return {
                ...entry,
                balance: balance
            };
        });

        // Prepare the response
        const response = {
            success: true,
            data: {
                meta: {
                    openingStock,
                    purchasePrice,
                    currentStock: balance,
                    item: {
                        id: item._id,
                        name: item.name,
                        unit: item.unit?.name || 'N/A',
                        unitDetails: item.unit || null
                    },
                    dateRange: {
                        fromDate,
                        toDate
                    },
                    company: {
                        id: companyId,
                        name: currentCompanyName,
                        dateFormat: companyDateFormat
                    }
                },
                entries,
                summary: {
                    totalPurchases: entries.reduce((sum, entry) => entry.type === 'Purc' ? sum + entry.qtyIn : sum, 0),
                    totalSales: entries.reduce((sum, entry) => entry.type === 'Sale' ? sum + entry.qtyOut : sum, 0),
                    totalPurchaseReturns: entries.reduce((sum, entry) => entry.type === 'PrRt' ? sum + entry.qtyOut : sum, 0),
                    totalSalesReturns: entries.reduce((sum, entry) => entry.type === 'SlRt' ? sum + entry.qtyIn : sum, 0),
                    totalAdjustments: entries.reduce((sum, entry) => ['xcess', 'short'].includes(entry.type) ? sum + entry.qtyIn - entry.qtyOut : sum, 0)
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});


// Helper function to calculate historical stock movement
function calculateHistoricalStock(purchases, purchaseReturns, sales, salesReturns, adjustments, itemId) {
    let stockChange = 0;

    const processItems = (transactions, handler) => {
        transactions.forEach(transaction => {
            transaction.items.forEach(item => {
                if (item.item.toString() === itemId) {
                    handler(item, transaction);
                }
            });
        });
    };

    // Process historical purchases
    processItems(purchases, (item) => {
        stockChange += item.Altquantity + item.Altbonus;
    });

    // Process historical purchase returns
    processItems(purchaseReturns, (item) => {
        stockChange -= item.quantity;
    });

    // Process historical sales
    processItems(sales, (item) => {
        stockChange -= item.quantity;
    });

    // Process historical sales returns
    processItems(salesReturns, (item) => {
        stockChange += item.quantity;
    });

    // Process historical adjustments
    processItems(adjustments, (item, transaction) => {
        if (transaction.adjustmentType === 'xcess') {
            stockChange += item.quantity;
        } else if (transaction.adjustmentType === 'short') {
            stockChange -= item.quantity;
        }
    });

    return stockChange;
}

// Entry creation helpers (keep your original field mapping)
function createPurchaseEntry(purchaseBill, itemEntry) {
    return {
        date: purchaseBill.date,
        partyName: purchaseBill.account?.name || 'N/A',
        billNumber: purchaseBill.billNumber,
        type: 'Purc',
        qtyIn: itemEntry.Altquantity,
        bonus: itemEntry.Altbonus,
        qtyOut: 0,
        price: itemEntry.AltpuPrice,
        unit: itemEntry.item.unit.name,
        batchNumber: itemEntry.batchNumber || 'N/A',
        expiryDate: itemEntry.expiryDate || 'N/A',
        balance: 0,
    };
}

function createPurchaseReturnEntry(purchaseReturn, itemEntry) {
    return {
        date: purchaseReturn.date,
        partyName: purchaseReturn.account?.name || 'N/A',
        billNumber: purchaseReturn.billNumber,
        type: 'PrRt',
        qtyIn: 0,
        qtyOut: itemEntry.quantity,
        price: itemEntry.puPrice,
        unit: itemEntry.item.unit.name,
        batchNumber: itemEntry.batchNumber || 'N/A',
        expiryDate: itemEntry.expiryDate || 'N/A',
        balance: 0,
    };
}


function createSalesEntry(salesBill, itemEntry) {
    return {
        date: salesBill.date,
        partyName: salesBill.account ? salesBill.account.name : salesBill.cashAccount || 'N/A',
        billNumber: salesBill.billNumber,
        type: 'Sale',
        qtyIn: 0,
        qtyOut: itemEntry.quantity,
        price: itemEntry.price,
        unit: itemEntry.item.unit.name,
        batchNumber: itemEntry.batchNumber || 'N/A',
        expiryDate: itemEntry.expiryDate ? itemEntry.expiryDate.toISOString().split('T')[0] : 'N/A',
        balance: 0,
    };
}

function createSalesReturnEntry(salesReturn, itemEntry) {
    return {
        date: salesReturn.date,
        partyName: salesReturn.account ? salesReturn.account.name : salesReturn.cashAccount || 'N/A',
        billNumber: salesReturn.billNumber,
        type: 'SlRt',
        qtyIn: itemEntry.quantity,
        qtyOut: 0,
        price: itemEntry.price,
        unit: itemEntry.item.unit.name,
        batchNumber: itemEntry.batchNumber || 'N/A',
        expiryDate: itemEntry.expiryDate ? itemEntry.expiryDate.toISOString().split('T')[0] : 'N/A',
        balance: 0,
    };
}

function createAdjustmentEntry(adjustment, itemEntry) {
    const qtyIn = adjustment.adjustmentType === 'xcess' ? itemEntry.quantity : 0;
    const qtyOut = adjustment.adjustmentType === 'short' ? itemEntry.quantity : 0;
    return {
        date: adjustment.date,
        partyName: 'Stock Adjustments',
        billNumber: adjustment.billNumber,
        type: adjustment.adjustmentType,
        qtyIn: qtyIn,
        qtyOut: qtyOut,
        unit: itemEntry.item.unit.name,
        price: itemEntry.puPrice,
        batchNumber: itemEntry.batchNumber || 'N/A',
        expiryDate: itemEntry.expiryDate ? itemEntry.expiryDate : "N/A",
        balance: 0,
    };
}

// Route to get stock status of all items
router.get('/stock-status', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
        const currentCompany = await Company.findById(new ObjectId(companyId));

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const initialCurrentFiscalYear = company.fiscalYear; // Assuming it's a single object
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

        const items = await Item.find({ company: companyId, fiscalYear: fiscalYear })
            .populate('category', 'name')
            .populate('unit', 'name')
            .populate('company', 'name')
            .populate('fiscalYear', 'year')
            .exec();

        const processedItems = await Promise.all(items.map(async (item) => {
            // Fetch purchase, sales, stock adjustment, and return bills for calculations
            const purchaseBills = await PurchaseBill.find({ company: companyId, fiscalYear: fiscalYear, 'items.item': item._id });
            const salesBills = await SalesBill.find({ company: companyId, fiscalYear: fiscalYear, 'items.item': item._id });
            const stockAdjustments = await StockAdjustment.find({ company: companyId, fiscalYear: fiscalYear, 'items.item': item._id });
            const purchaseReturnBills = await PurchaseReturn.find({ company: companyId, fiscalYear: fiscalYear, 'items.item': item._id });
            const salesReturnBills = await SalesReturn.find({ company: companyId, fiscalYear: fiscalYear, 'items.item': item._id });

            // Calculate total quantities in and out
            const totalQtyIn = purchaseBills.reduce((total, bill) => {
                const itemInBill = bill.items.find(purchaseItem => purchaseItem.item.equals(item._id));
                return total + (itemInBill ? itemInBill.Altquantity : 0) + (itemInBill ? itemInBill.Altbonus : 0);
            }, 0);

            const totalSalesReturn = salesReturnBills.reduce((total, bill) => {
                const itemInBill = bill.items.find(salesReturnItem => salesReturnItem.item.equals(item._id));
                return total + (itemInBill ? itemInBill.quantity : 0);
            }, 0);

            const totalStockAdjustments = stockAdjustments.reduce((acc, adj) => {
                adj.items.forEach(adjItem => {
                    if (adjItem.item.equals(item._id)) {
                        if (adj.adjustmentType === 'xcess') {
                            acc.totalQtyIn += adjItem.quantity;
                        } else if (adj.adjustmentType === 'short') {
                            acc.totalQtyOut += adjItem.quantity;
                        }
                    }
                });
                return acc;
            }, { totalQtyIn: 0, totalQtyOut: 0 });

            const totalSalesOut = salesBills.reduce((total, bill) => {
                const itemInBill = bill.items.find(salesItem => salesItem.item.equals(item._id));
                return total + (itemInBill ? itemInBill.quantity : 0);
            }, 0);

            const totalPurchaseReturn = purchaseReturnBills.reduce((total, bill) => {
                const itemInBill = bill.items.find(purchaseReturnItem => purchaseReturnItem.item.equals(item._id));
                return total + (itemInBill ? itemInBill.quantity : 0);
            }, 0);

            // Get opening stock data for current fiscal year
            const openingStockData = item.openingStockByFiscalYear.find(os =>
                os.fiscalYear && os.fiscalYear.toString() === fiscalYear.toString()
            ) || {};

            const openingStock = openingStockData.openingStock || 0;
            const openingPurchasePrice = parseFloat(openingStockData.purchasePrice) || 0;
            const openingSalesPrice = openingStockData.salesPrice || 0;

            // Calculate average prices including opening stock
            let avgPuPrice = 0;
            let avgPrice = 0;

            if (item.stockEntries && item.stockEntries.length > 0) {
                // Calculate values from stock entries
                const stockEntriesData = item.stockEntries.reduce((acc, entry) => {
                    if (entry.quantity > 0 && entry.puPrice > 0 && entry.price > 0) {
                        acc.totalPuValue += entry.puPrice * entry.quantity;
                        acc.totalSalesValue += entry.price * entry.quantity;
                        acc.totalQuantity += entry.quantity;
                    }
                    return acc;
                }, { totalPuValue: 0, totalSalesValue: 0, totalQuantity: 0 });

                // Include opening stock in calculations if it exists
                if (openingStock > 0) {
                    stockEntriesData.totalPuValue += openingPurchasePrice * openingStock;
                    stockEntriesData.totalSalesValue += openingSalesPrice * openingStock;
                    stockEntriesData.totalQuantity += openingStock;
                }

                // Calculate weighted averages
                avgPuPrice = stockEntriesData.totalQuantity > 0
                    ? stockEntriesData.totalPuValue / stockEntriesData.totalQuantity
                    : 0;

                avgPrice = stockEntriesData.totalQuantity > 0
                    ? stockEntriesData.totalSalesValue / stockEntriesData.totalQuantity
                    : 0;
            }
            else if (openingStock > 0) {
                // If no stock entries but has opening stock
                avgPuPrice = openingPurchasePrice;
                avgPrice = openingSalesPrice;
            }

            // Calculate total quantity from stock entries (excluding bonus)
            let totalStockEntriesQuantity = 0;
            if (item.stockEntries && item.stockEntries.length > 0) {
                totalStockEntriesQuantity = item.stockEntries.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0);
            }

            // Calculate total stock
            const totalStock = openingStock + totalQtyIn + totalSalesReturn + totalStockAdjustments.totalQtyIn -
                (totalSalesOut + totalPurchaseReturn + totalStockAdjustments.totalQtyOut);

            // Prepare item data for response
            return {
                _id: item._id,
                name: item.name,
                code: item.code,
                category: item.category ? item.category.name : null,
                unit: item.unit ? item.unit.name : null,
                openingStock,
                totalQtyIn: totalQtyIn + totalSalesReturn + totalStockAdjustments.totalQtyIn,
                totalQtyOut: totalSalesOut + totalPurchaseReturn + totalStockAdjustments.totalQtyOut,
                stock: totalStock,
                avgPuPrice,
                avgPrice,
                totalStockValuePurchase: totalStock * avgPuPrice,
                totalStockValueSales: totalStock * avgPrice,
                company: item.company ? item.company.name : null,
                fiscalYear: item.fiscalYear ? item.fiscalYear.year : null
            };
        }));

        // Prepare response data
        const responseData = {
            success: true,
            company: {
                _id: company._id,
                name: company.name,
                renewalDate: company.renewalDate,
                dateFormat: company.dateFormat
            },
            fiscalYear: currentFiscalYear ? {
                _id: currentFiscalYear._id,
                name: currentFiscalYear.name,
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                isActive: currentFiscalYear.isActive
            } : null,
            currentCompany,
            items: processedItems,
            user: {
                _id: req.user._id,
                name: req.user.name,
                isAdmin: req.user.isAdmin,
                role: req.user.role,
                preferences: req.user.preferences || { theme: 'light' }
            },
            showPurchaseValue: req.query.showPurchaseValue === 'true',
            showSalesValue: req.query.showSalesValue === 'true'
        };

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching stock status:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});




router.get('/monthly-vat-summary', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const { month, year, nepaliMonth, nepaliYear } = req.query;
            const today = new Date();

            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

            const currentCompany = await Company.findById(new ObjectId(companyId));
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'nepali';

            // Get current Nepali date
            const currentNepaliDate = new NepaliDate();
            const currentNepaliYear = currentNepaliDate.getYear();

            if (!companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company ID is required'
                });
            }

            const company = await Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear');

            const currentFiscalYear = company?.fiscalYear;
            if (!currentFiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found'
                });
            }

            // If no month/year is selected, return empty data
            if ((companyDateFormat === 'english' && (!month || !year)) ||
                (companyDateFormat === 'nepali' && (!nepaliMonth || !nepaliYear))) {
                return res.json({
                    success: true,
                    data: {
                        companyDateFormat,
                        nepaliDate,
                        company,
                        totals: null,
                        currentFiscalYear,
                        currentNepaliYear,
                        month: '',
                        year: '',
                        nepaliMonth: '',
                        nepaliYear: '',
                        reportDateRange: '',
                        currentCompanyName: req.session.currentCompanyName,
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    }
                });
            }

            let fromDate, toDate, reportDateRange;

            if (companyDateFormat === 'english') {
                // English date format - process month/year
                const monthInt = parseInt(month);
                const yearInt = parseInt(year);

                fromDate = new Date(yearInt, monthInt - 1, 1);
                toDate = new Date(yearInt, monthInt, 0);

                const monthNames = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
                reportDateRange = `${monthNames[monthInt - 1]}, ${yearInt}`;

                // Format dates as YYYY-MM-DD
                fromDate = fromDate.toISOString().split('T')[0];
                toDate = toDate.toISOString().split('T')[0];
            } else {
                const monthInt = parseInt(nepaliMonth);
                const yearInt = parseInt(nepaliYear);

                // Validate inputs
                if (monthInt < 1 || monthInt > 12 || yearInt < 2000 || yearInt > 2100) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid Nepali month or year'
                    });
                }

                // Create first day of month in Nepali format (YYYY-MM-DD)
                fromDate = `${yearInt}-${String(monthInt).padStart(2, '0')}-01`;

                // Get last day of month in Nepali format
                let lastDayOfMonth;
                for (let day = 31; day >= 1; day--) {
                    try {
                        const testDate = new NepaliDate(yearInt, monthInt - 1, day - 1);
                        lastDayOfMonth = day;
                        break;
                    } catch (e) {
                        continue;
                    }
                }

                if (!lastDayOfMonth) {
                    return res.status(400).json({
                        success: false,
                        error: 'Could not determine last day of month'
                    });
                }

                // Format toDate in Nepali format (YYYY-MM-DD)
                toDate = `${yearInt}-${String(monthInt).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

                const monthNames = ["Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashoj",
                    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
                reportDateRange = `${monthNames[monthInt - 1]}, ${yearInt}`;
            }

            // Convert to ObjectId
            const companyObjId = new ObjectId(companyId);
            const fiscalYearObjId = new ObjectId(currentFiscalYear._id);

            // Build the query
            const query = {
                company: companyObjId,
                fiscalYear: fiscalYearObjId,
                transactionDate: {
                    $gte: fromDate,
                    $lte: toDate
                }
            };

            // Get all documents
            const [salesBills, salesReturns, purchaseBills, purchaseReturns] = await Promise.all([
                SalesBill.find(query).lean(),
                SalesReturn.find(query).lean(),
                PurchaseBill.find(query).lean(),
                PurchaseReturn.find(query).lean()
            ]);

            // Manual aggregation
            const aggregateData = (docs, taxableField, nonVatField, vatField) => {
                return {
                    taxableAmount: docs.reduce((sum, doc) => sum + (doc[taxableField] || 0), 0),
                    nonVatAmount: docs.reduce((sum, doc) => sum + (doc[nonVatField] || 0), 0),
                    vatAmount: docs.reduce((sum, doc) => sum + (doc[vatField] || 0), 0)
                };
            };

            const totals = {
                sales: aggregateData(salesBills, 'taxableAmount', 'nonVatSales', 'vatAmount'),
                salesReturn: aggregateData(salesReturns, 'taxableAmount', 'nonVatSalesReturn', 'vatAmount'),
                purchase: aggregateData(purchaseBills, 'taxableAmount', 'nonVatPurchase', 'vatAmount'),
                purchaseReturn: aggregateData(purchaseReturns, 'taxableAmount', 'nonVatPurchaseReturn', 'vatAmount')
            };

            // Calculate net values
            const netSalesVat = totals.sales.vatAmount - totals.salesReturn.vatAmount;
            const netPurchaseVat = totals.purchase.vatAmount - totals.purchaseReturn.vatAmount;
            const netVat = netSalesVat - netPurchaseVat;

            res.json({
                success: true,
                data: {
                    companyDateFormat,
                    nepaliDate: new NepaliDate().format('YYYY-MM-DD'),
                    company,
                    currentFiscalYear,
                    currentNepaliYear,
                    totals: {
                        ...totals,
                        netSalesVat,
                        netPurchaseVat,
                        netVat
                    },
                    month,
                    year,
                    nepaliMonth,
                    nepaliYear,
                    reportDateRange,
                    currentCompanyName: req.session.currentCompanyName,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });

        } catch (error) {
            console.error('Error fetching VAT report:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
});

// router.get('/statement', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
//     if (req.tradeType === 'retailer') {
//         try {
//             const companyId = req.session.currentCompany;
//             const currentCompany = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat address ward pan city country email phone').populate('fiscalYear');;
//             const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english'; // Default to 'english'
//             const selectedCompany = req.query.account || '';
//             const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
//             const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
//             const paymentMode = req.query.paymentMode || 'all'; // New parameter for payment mode
//             const currentCompanyName = req.session.currentCompanyName;
//             const today = new Date();
//             const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD'); // Format the Nepali date as needed

//             // Retrieve the fiscal year from the session
//             let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//             let currentFiscalYear = null;

//             if (fiscalYear) {
//                 // Fetch the fiscal year from the database if available in the session
//                 currentFiscalYear = await FiscalYear.findById(fiscalYear);
//             }

//             // If no fiscal year is found in session, use the company's fiscal year
//             if (!currentFiscalYear && currentCompany.fiscalYear) {
//                 currentFiscalYear = currentCompany.fiscalYear;
//                 req.session.currentFiscalYear = {
//                     id: currentFiscalYear._id.toString(),
//                     startDate: currentFiscalYear.startDate,
//                     endDate: currentFiscalYear.endDate,
//                     name: currentFiscalYear.name,
//                     dateFormat: currentFiscalYear.dateFormat,
//                     isActive: currentFiscalYear.isActive
//                 };
//                 fiscalYear = req.session.currentFiscalYear.id;
//             }

//             if (!fiscalYear) {
//                 return res.status(400).json({ error: 'No fiscal year found in session or company.' });
//             }

//             // Fetch accounts that belong to the current fiscal year
//             const accounts = await Account.find({
//                 company: companyId,
//                 isActive: true, // Filter for active accounts
//                 $or: [
//                     { originalFiscalYear: fiscalYear }, // Created here
//                     {
//                         fiscalYear: fiscalYear,
//                         originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
//                     }
//                 ]
//             }).sort({ name: 1 });

//             if (!selectedCompany) {
//                 return res.json({
//                     status: 'success',
//                     data: {
//                         company: currentCompany,
//                         currentFiscalYear,
//                         statement: [],
//                         accounts,
//                         selectedCompany: null,
//                         fromDate: '',
//                         toDate: '',
//                         paymentMode,
//                         companyDateFormat,
//                         nepaliDate,
//                         currentCompanyName,
//                         currentCompany,
//                         user: {
//                             preferences: req.user.preferences,
//                             isAdmin: req.user.isAdmin,
//                             role: req.user.role
//                         }
//                     }
//                 });
//             }

//             // Fetch the selected account based on the fiscal year and company
//             const account = await Account.findOne({
//                 _id: selectedCompany,
//                 company: companyId,
//                 isActive: true, // Filter for active accounts
//                 $or: [
//                     { originalFiscalYear: fiscalYear }, // Created here
//                     {
//                         fiscalYear: fiscalYear,
//                         originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
//                     }
//                 ]
//             }).populate('companyGroups', 'name'); // Add population here

//             if (!account) {
//                 return res.status(404).json({ error: 'Account not found for the current fiscal year' });
//             }

//             // Query to filter transactions based on the selected company and fiscal year
//             let query = {
//                 company: companyId,
//                 isActive: true, // Ensure only active transactions
//             };

//             if (selectedCompany) {
//                 query.$or = [
//                     { account: selectedCompany },
//                     { paymentAccount: selectedCompany },
//                     { receiptAccount: selectedCompany },
//                     { debitAccount: selectedCompany },
//                     { creditAccount: selectedCompany },
//                 ];
//             }

//             if (paymentMode === 'exclude-cash') {
//                 query.paymentMode = { $ne: 'cash' };
//             } else if (paymentMode !== 'all') {
//                 query.paymentMode = paymentMode;
//             }

//             // Define groups that use transaction-based opening balance
//             const transactionBasedGroups = [
//                 'Sundry Debtors',
//                 'Sundry Creditors',
//                 'Cash in Hand',
//                 'Bank Accounts',
//                 'Bank O/D Account',
//                 'Duties & Taxes'
//             ];

//             // Determine if account belongs to transaction-based group
//             const isTransactionBased = account.companyGroups &&
//                 transactionBasedGroups.includes(account.companyGroups.name);

//             let openingBalance = 0;

//             if (isTransactionBased) {
//                 if (paymentMode !== 'cash') {
//                     // Existing transaction-based calculation
//                     const transactionsBeforeFromDate = await Transaction.find({
//                         ...query,
//                         date: { $lt: fromDate }
//                     }).sort({ date: 1 });

//                     openingBalance = account.initialOpeningBalance.type === 'Dr'
//                         ? account.initialOpeningBalance.amount
//                         : -account.initialOpeningBalance.amount;

//                     transactionsBeforeFromDate.forEach(tx => {
//                         openingBalance += (tx.debit || 0) - (tx.credit || 0);
//                     });
//                 }
//             } else {
//                 // For non-transaction groups, use fiscal year opening balance
//                 openingBalance = account.openingBalance.type === 'Dr'
//                     ? account.openingBalance.amount
//                     : -account.openingBalance.amount;
//             }

//             if (fromDate && toDate) {
//                 query.date = { $gte: fromDate, $lte: toDate };
//             } else if (fromDate) {
//                 query.date = { $gte: fromDate };
//             } else if (toDate) {
//                 query.date = { $lte: toDate };
//             }

//             const filteredTransactions = await Transaction.find(query)
//                 .sort({ date: 1 })
//                 .populate('paymentAccount', 'name')
//                 .populate('receiptAccount', 'name')
//                 .populate('debitAccount', 'name')
//                 .populate('creditAccount', 'name')
//                 .populate('account', 'name')
//                 .populate('accountType', 'name')
//                 .lean();

//             const cleanTransactions = filteredTransactions.map(tx => ({
//                 ...tx,
//                 paymentAccount: tx.paymentAccount ? { name: tx.paymentAccount.name } : null,
//                 receiptAccount: tx.receiptAccount ? { name: tx.receiptAccount.name } : null,
//                 debitAccount: tx.debitAccount ? { name: tx.debitAccount.name } : null,
//                 creditAccount: tx.creditAccount ? { name: tx.creditAccount.name } : null,
//                 account: tx.account ? { name: tx.account.name } : null,
//                 accountType: tx.accountType ? { name: tx.accountType.name } : 'Opening Balance'
//             }));

//             const { statement, totalDebit, totalCredit } = prepareStatementWithOpeningBalanceAndTotals(openingBalance, cleanTransactions, fromDate,
//                 paymentMode,
//                 isTransactionBased
//             );

//             const partyName = account.name;

//             res.json({
//                 status: 'success',
//                 data: {
//                     currentFiscalYear,
//                     statement,
//                     accounts,
//                     partyName,
//                     selectedCompany,
//                     account,
//                     fromDate: req.query.fromDate,
//                     toDate: req.query.toDate,
//                     paymentMode,
//                     company: currentCompany,
//                     totalDebit,
//                     totalCredit,
//                     finalBalance: openingBalance + totalDebit - totalCredit,
//                     currentCompanyName,
//                     companyDateFormat,
//                     nepaliDate,
//                     currentCompany,
//                     user: {
//                         preferences: req.user.preferences,
//                         isAdmin: req.user.isAdmin,
//                         role: req.user.role
//                     }
//                 }
//             });
//         } catch (error) {
//             console.error("Error fetching statement:", error);
//             res.status(500).json({ error: 'Error fetching statement' });
//         }
//     }
// });

// // Function to calculate opening balance based on opening balance date
// function calculateOpeningBalance(account, transactions, fromDate) {
//     const openingBalanceDate = fromDate || account.openingBalanceDate || new Date('July 17, 2023'); // Use fromDate if available
//     let openingBalance = account.openingBalance.type === 'Dr' ? account.openingBalance.amount : -account.openingBalance.amount;

//     transactions.forEach(tx => {
//         if (tx.date < openingBalanceDate) {
//             openingBalance += (tx.debit || 0) - (tx.credit || 0);
//         }
//     });

//     return openingBalance;
// }

// function prepareStatementWithOpeningBalanceAndTotals(openingBalance, transactions, fromDate, paymentMode, isTransactionBased) {
//     let balance = openingBalance;
//     let totalDebit = paymentMode !== 'cash' && openingBalance > 0 ? openingBalance : 0;
//     let totalCredit = paymentMode !== 'cash' && openingBalance < 0 ? -openingBalance : 0;

//     const statement = paymentMode !== 'cash' ? [
//         {
//             date: fromDate ? fromDate.toISOString().split('T')[0] : '',
//             type: '',
//             billNumber: '',
//             paymentMode: '',
//             paymentAccount: '',
//             receiptAccount: '',
//             debitAccount: '',
//             creditAccount: '',
//             accountType: 'Opening Balance',
//             purchaseSalesType: '',
//             purchaseSalesReturnType: '',
//             journalAccountType: '',
//             drCrNoteAccountType: '',
//             account: '',
//             debit: openingBalance > 0 ? openingBalance : null,
//             credit: openingBalance < 0 ? -openingBalance : null,
//             balance: formatBalance(openingBalance),
//             billId: '' // Ensure billId is included
//         }
//     ] : [];

//     const transactionsByBill = transactions.reduce((acc, tx) => {
//         let billId = tx.billId || tx.purchaseBillId || tx.salesReturnBillId || tx.purchaseReturnBillId || tx.journalBillId || tx.debitNoteId || tx.creditNoteId || tx.paymentAccountId || tx.receiptAccountId;

//         if (!acc[billId]) {
//             acc[billId] = {
//                 date: tx.date,
//                 type: tx.type,
//                 billNumber: tx.billNumber,
//                 paymentMode: tx.paymentMode,
//                 partyBillNumber: tx.partyBillNumber,
//                 paymentAccount: tx.paymentAccount,
//                 receiptAccount: tx.receiptAccount,
//                 debitAccount: tx.debitAccount,
//                 creditAccount: tx.creditAccount,
//                 accountType: tx.accountType,
//                 purchaseSalesType: tx.purchaseSalesType,
//                 purchaseSalesReturnType: tx.purchaseSalesReturnType,
//                 journalAccountType: tx.journalAccountType,
//                 drCrNoteAccountType: tx.drCrNoteAccountType,
//                 account: tx.account,
//                 debit: 0,
//                 credit: 0,
//                 balance: 0,
//                 billId: tx.billId
//             };
//         }
//         acc[billId].debit = tx.debit || 0;
//         acc[billId].credit = tx.credit || 0;
//         return acc;
//     }, {});

//     // Iterate over grouped transactions to prepare the final statement
//     Object.values(transactionsByBill).forEach(tx => {
//         balance += (tx.debit || 0) - (tx.credit || 0);
//         totalDebit += tx.debit || 0;
//         totalCredit += tx.credit || 0;
//         statement.push({
//             date: tx.date,
//             type: tx.type,
//             billNumber: tx.billNumber,
//             paymentMode: tx.paymentMode,
//             partyBillNumber: tx.partyBillNumber,
//             paymentAccount: tx.paymentAccount,
//             receiptAccount: tx.receiptAccount,
//             debitAccount: tx.debitAccount,
//             creditAccount: tx.creditAccount,
//             accountType: tx.accountType,
//             purchaseSalesType: tx.purchaseSalesType,
//             purchaseSalesReturnType: tx.purchaseSalesReturnType,
//             journalAccountType: tx.journalAccountType,
//             drCrNoteAccountType: tx.drCrNoteAccountType,
//             account: tx.account,
//             debit: tx.debit,
//             credit: tx.credit,
//             balance: formatBalance(balance),
//             billId: tx.billId,
//         });
//     });

//     return { statement, totalDebit, totalCredit };
// }

// function formatBalance(amount) {
//     return amount > 0 ? `${amount.toFixed(2)} Dr` : `${(-amount).toFixed(2)} Cr`;
// }

module.exports = router;
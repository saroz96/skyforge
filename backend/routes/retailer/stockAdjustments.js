const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const StockAdjustment = require('../../models/retailer/StockAdjustment');
const Item = require('../../models/retailer/Item');
const NepaliDate = require('nepali-date');
const Company = require('../../models/Company');
// const BillCounter = require('../../models/retailer/stockAdjustmentBillCounter');
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const FiscalYear = require('../../models/FiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');
const Category = require('../../models/retailer/Category');
const Unit = require('../../models/retailer/Unit');


router.get('/stockAdjustments/register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const currentCompanyName = req.session.currentCompanyName;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

            // Extract dates from query parameters
            let fromDate = req.query.fromDate ? req.query.fromDate : null;
            let toDate = req.query.toDate ? req.query.toDate : null;

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;
                fiscalYear = currentFiscalYear._id.toString();
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // If no date range provided, return basic info
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        company,
                        currentFiscalYear: currentFiscalYear,
                        nepaliDate,
                        companyDateFormat,
                        currentCompany,
                        stockAdjustments: [],
                        fromDate: req.query.fromDate || '',
                        toDate: req.query.toDate || '',
                        currentCompanyName,
                        user: req.user,
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    },
                    meta: {
                        title: 'Stock Adjustments Register',
                        theme: req.user.preferences?.theme || 'light'
                    }
                });
            }

            // Build the query based on the date range
            let query = {
                company: companyId,
                fiscalYear: fiscalYear
            };

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const stockAdjustments = await StockAdjustment.find(query)
                .sort({ date: 1 })
                .populate('items.item')
                .populate('items.unit')
                .populate('user')
                .lean()
                .exec();

            const formattedAdjustments = stockAdjustments.map(adjustment => {
                return adjustment.items.map(item => ({
                    date: adjustment.date,
                    billNumber: adjustment.billNumber,
                    itemId: item.item?._id,
                    itemName: item.item ? item.item.name : 'N/A',
                    quantity: item.quantity,
                    unitId: item.unit?._id,
                    unitName: item.unit?.name || 'N/A',
                    puPrice: item.puPrice,
                    adjustmentType: adjustment.adjustmentType,
                    reason: item.reason.join(' '),
                    vatStatus: item.vatStatus,
                    userId: adjustment.user?._id,
                    userName: adjustment.user?.name || 'N/A',
                    adjustmentId: adjustment._id,
                }));
            }).flat(); // Flatten the nested array of items

            const items = await Item.find({ company: companyId }).select('name _id');

            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    stockAdjustments: formattedAdjustments,
                    items,
                    companyDateFormat,
                    nepaliDate,
                    currentCompany,
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName,
                    user: req.user,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'Stock Adjustments Register',
                    theme: req.user.preferences?.theme || 'light'
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }
    } catch (error) {
        console.error('Error in stock-adjustments register endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Route to get next bill number for stock adjustments
router.get('/stockAdjustments/new/next-number', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const companyId = req.session.currentCompany;
        const fiscalYearId = req.session.currentFiscalYear?.id;

        // Get fiscal year details first
        const fiscalYear = await FiscalYear.findById(fiscalYearId);
        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'Fiscal year not found'
            });
        }

        // Get or create bill counter for stock adjustments
        let lastCounter = await BillCounter.findOne({
            company: companyId,
            fiscalYear: fiscalYearId,
            transactionType: 'stockAdjustment'
        });

        // If no counter exists, create one
        if (!lastCounter) {
            lastCounter = new BillCounter({
                company: companyId,
                fiscalYear: fiscalYearId,
                transactionType: 'stockAdjustment',
                currentBillNumber: 0
            });
            await lastCounter.save();
        }

        // Calculate next bill number
        const nextNumber = lastCounter.currentBillNumber + 1;
        const prefix = fiscalYear.billPrefixes?.stockAdjustment || 'ADJ';
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        return res.json({
            success: true,
            data: {
                nextBillNumber: nextBillNumber,
                currentCounter: lastCounter.currentBillNumber
            }
        });

    } catch (error) {
        console.error('Error in /stockAdjustments/new/next-number route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Main route for stock adjustments - optimized without items fetching
router.get('/stockAdjustments/new', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const companyId = req.session.currentCompany;

        // Fetch essential data (excluding items)
        const [
            company,
            fiscalYear,
            categories,
            units
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled name')
                .populate('fiscalYear'),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId })
        ]);

        // Fiscal year handling
        let currentFiscalYear = fiscalYear;
        let fiscalYearId = req.session.currentFiscalYear?.id;

        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;

            // Update session with company's fiscal year
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };

            fiscalYearId = req.session.currentFiscalYear.id;
        }

        if (!fiscalYearId) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        // Get next bill number (using the same logic from original but without incrementing)
        const lastCounter = await BillCounter.findOne({
            company: companyId,
            fiscalYear: fiscalYearId,
            transactionType: 'stockAdjustment'
        });

        // Calculate next number for display only
        const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
        const prefix = currentFiscalYear?.billPrefixes?.stockAdjustment || 'ADJ';
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // Date handling
        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const transactionDateNepali = new NepaliDate(today).format('YYYY-MM-DD');
        const companyDateFormat = company ? company.dateFormat : 'english';

        // Prepare response data (without items)
        const responseData = {
            success: true,
            data: {
                company: {
                    _id: company._id,
                    name: company.name,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    vatEnabled: company.vatEnabled
                },
                fiscalYear: currentFiscalYear ? {
                    _id: currentFiscalYear._id,
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate
                } : null,
                categories: categories.map(cat => ({
                    _id: cat._id,
                    name: cat.name
                })),
                units: units.map(unit => ({
                    _id: unit._id,
                    name: unit.name,
                    conversionFactor: unit.conversionFactor || 1
                })),
                dates: {
                    nepaliDate,
                    transactionDateNepali,
                    companyDateFormat
                },
                billInfo: {
                    nextBillNumber
                },
                user: {
                    _id: req.user._id,
                    isAdmin: req.user.isAdmin,
                    role: req.user.role,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                currentCompanyName: req.session.currentCompanyName
            }
        };

        return res.json(responseData);

    } catch (error) {
        console.error('Error in /stockAdjustments/new route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.post('/stockAdjustments/new', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }

    const session = await mongoose.startSession();
    try {
        const result = await session.withTransaction(async () => {
            const {
                items,
                adjustmentType,
                note,
                nepaliDate,
                billDate,
                isVatExempt,
                vatPercentage,
                discountPercentage,
            } = req.body;

            const companyId = req.session.currentCompany;
            const userId = req.user._id;
            const currentFiscalYear = req.session.currentFiscalYear.id;

            const company = await Company.findById(companyId).session(session);
            if (!company) {
                throw new Error('Company not found');
            }

            const dateFormat = company.dateFormat;
            const date = dateFormat === 'nepali' ? nepaliDate : new Date(billDate);

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            const itemsArray = [];

            // Validate and process each item
            for (const itemData of items) {
                const {
                    item,
                    unit,
                    batchNumber,
                    expiryDate,
                    marginPercentage,
                    mrp,
                    price,
                    quantity,
                    puPrice,
                    reason,
                    vatStatus,
                } = itemData;

                const product = await Item.findById(item).session(session);
                if (!product) {
                    throw new Error(`Item not found: ${item}`);
                }

                const itemTotal = parseFloat(puPrice) * parseFloat(quantity);
                subTotal += itemTotal;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemTotal;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemTotal;
                }

                const itemToAdjust = await Item.findById(item).session(session);
                const parsedQuantity = parseInt(quantity);
                const uniqueId = uuidv4();

                // Handle excess adjustment
                if (adjustmentType === 'xcess') {
                    itemToAdjust.stock += parsedQuantity;
                    let batchEntry = itemToAdjust.stockEntries.find(
                        (entry) => entry.batchNumber === batchNumber
                    );
                    if (batchEntry) {
                        batchEntry.quantity += parsedQuantity;
                    } else {
                        itemToAdjust.stockEntries.push({
                            date,
                            batchNumber,
                            expiryDate,
                            quantity: parsedQuantity,
                            price,
                            puPrice,
                            mrp,
                            marginPercentage,
                            uniqueUuId: uniqueId,
                            fiscalYear: currentFiscalYear
                        });
                    }
                }

                // Handle short adjustment
                if (adjustmentType === 'short') {
                    let remainingQuantity = parsedQuantity;
                    for (const batch of itemToAdjust.stockEntries) {
                        if (batch.batchNumber === batchNumber && batch.uniqueUuId === itemData.uniqueUuId && remainingQuantity > 0) {
                            const deductAmount = Math.min(batch.quantity, remainingQuantity);
                            batch.quantity -= deductAmount;
                            remainingQuantity -= deductAmount;

                            if (batch.quantity < 0) {
                                throw new Error('Insufficient batch stock');
                            }
                        }
                    }
                    itemToAdjust.stock -= parsedQuantity;
                    if (itemToAdjust.stock < 0) {
                        throw new Error('Insufficient total stock');
                    }
                }

                await itemToAdjust.save({ session });
                itemsArray.push({
                    item,
                    unit,
                    quantity: parsedQuantity,
                    puPrice,
                    batchNumber,
                    expiryDate,
                    reason: Array.isArray(reason) ? reason : [reason],
                    vatStatus
                });
            }

            // Calculate financials
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            const vatAmount = (!isVatExemptBool || isVatAll)
                ? (finalTaxableAmount * vatPercentage) / 100
                : 0;

            const totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;

            // Generate bill number and create adjustment
            const billNumber = await getNextBillNumber(companyId, currentFiscalYear, 'stockAdjustment', session);
            const newStockAdjustment = new StockAdjustment({
                items: itemsArray,
                billNumber,
                note,
                date,
                isVatAll,
                isVatExempt: isVatExemptBool,
                adjustmentType,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatAdjustment: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                vatAmount,
                totalAmount,
                isActive: true,
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            const savedAdjustment = await newStockAdjustment.save({ session });

            return {
                adjustment: savedAdjustment,
                billNumber,
                totalAmount,
                vatAmount,
                discountAmount: discountForTaxable + discountForNonTaxable
            };
        });

        await session.commitTransaction();

        return res.json({
            success: true,
            data: {
                adjustmentId: result.adjustment._id,
                billNumber: result.billNumber,
                totalAmount: result.totalAmount,
                vatAmount: result.vatAmount,
                discountAmount: result.discountAmount,
                message: 'Stock adjustment recorded successfully'
            }
        });
    } catch (err) {
        await session.abortTransaction();
        console.error('Error recording stock adjustment:', err);

        return res.status(400).json({
            success: false,
            error: err.message || 'Error recording stock adjustment',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    } finally {
        session.endSession();
    }
});


router.get('/stockAdjustments/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const stockAdjustmentId = req.params.id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');

            const company = await Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat name address ward city country phone email pan')
                .populate('fiscalYear');

            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Handle fiscal year
            let fiscalYear = req.session.currentFiscalYear?.id || null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear).lean();
            }

            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;
                fiscalYear = currentFiscalYear._id.toString();
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Validate stock adjustment ID
            if (!mongoose.Types.ObjectId.isValid(stockAdjustmentId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid stock adjustment ID.'
                });
            }

            const currentCompany = await Company.findById(new ObjectId(companyId));
            if (!currentCompany) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Find the stock adjustment record with populated fields
            const stockAdjustment = await StockAdjustment.findById(stockAdjustmentId)
                .populate('items.item')
                .populate('items.unit')
                .populate('user', 'name')
                .lean();

            if (!stockAdjustment) {
                return res.status(404).json({
                    success: false,
                    message: 'Stock adjustment not found.'
                });
            }

            // Format dates safely
            const formatDate = (date) => {
                if (!date) return null;
                try {
                    return new Date(date).toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }
            };

            // Process items to ensure all required fields are present
            const processedItems = stockAdjustment.items.map(item => ({
                ...item,
                item: item.item || { name: 'N/A', _id: null },
                unit: item.unit || { name: 'N/A', _id: null },
                quantity: item.quantity || 0,
                puPrice: item.puPrice || 0,
                reason: item.reason || [],
                vatStatus: item.vatStatus || 'vatable'
            }));

            // Calculate totals
            const totals = processedItems.reduce((acc, item) => {
                const itemTotal = (item.quantity || 0) * (item.puPrice || 0);
                return {
                    totalQuantity: acc.totalQuantity + (item.quantity || 0),
                    totalValue: acc.totalValue + itemTotal
                };
            }, { totalQuantity: 0, totalValue: 0 });

            // Prepare response
            const response = {
                success: true,
                data: {
                    company: {
                        ...company,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear: currentFiscalYear,
                    currentCompanyName,
                    currentCompany: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        phone: currentCompany.phone,
                        pan: currentCompany.pan,
                        address: currentCompany.address,
                        ward: currentCompany.ward,
                        city: currentCompany.city,
                        email: currentCompany.email,
                        country: currentCompany.country
                    },
                    stockAdjustment: {
                        ...stockAdjustment,
                        date: formatDate(stockAdjustment.date),
                        createdAt: formatDate(stockAdjustment.createdAt),
                        updatedAt: formatDate(stockAdjustment.updatedAt),
                        items: processedItems,
                        user: stockAdjustment.user || { name: 'N/A' },
                        billNumber: stockAdjustment.billNumber || 'N/A',
                        adjustmentType: stockAdjustment.adjustmentType || 'N/A'
                    },
                    totals: totals,
                    currentDate: formatDate(new Date()),
                    nepaliDate: nepaliDate,
                    companyDateFormat: company.dateFormat || 'english',
                    userPreferences: {
                        theme: req.user?.preferences?.theme || 'light'
                    },
                    userRoles: {
                        isAdminOrSupervisor: req.user?.isAdmin || req.user?.role === 'Supervisor'
                    }
                }
            };

            res.json(response);
        } catch (error) {
            console.error('Error retrieving stock adjustment:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
});



module.exports = router;
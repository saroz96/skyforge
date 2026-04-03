const express = require('express');
const router = express.Router();

const { v4: uuidv4 } = require('uuid');

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Item = require('../../models/retailer/Item');
const SalesReturn = require('../../models/retailer/SalesReturn');
const Transaction = require('../../models/retailer/Transaction');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
// const BillCounter = require('../../models/retailer/salesReturnBillCounter');
const Account = require('../../models/retailer/Account');
const Settings = require('../../models/retailer/Settings');
const Company = require('../../models/Company');
const NepaliDate = require('nepali-date');
const { ensureTradeType } = require('../../middleware/tradeType');
const SalesBill = require('../../models/retailer/SalesBill');
const Category = require('../../models/retailer/Category');
const Unit = require('../../models/retailer/Unit');
const FiscalYear = require('../../models/FiscalYear');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');
const CompanyGroup = require('../../models/retailer/CompanyGroup');


router.get('/sales-return/next-number', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

        // Get or create bill counter
        let lastCounter = await BillCounter.findOne({
            company: companyId,
            fiscalYear: fiscalYearId,
            transactionType: 'salesReturn'
        });

        // If no counter exists, create one
        if (!lastCounter) {
            lastCounter = new BillCounter({
                company: companyId,
                fiscalYear: fiscalYearId,
                transactionType: 'salesReturn',
                currentBillNumber: 0
            });
            await lastCounter.save();
        }

        // Calculate next bill number
        const nextNumber = lastCounter.currentBillNumber + 1;
        const prefix = fiscalYear.billPrefixes.salesReturn;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        return res.json({
            success: true,
            data: {
                nextSalesReturnNumber: nextBillNumber,
                currentCounter: lastCounter.currentBillNumber
            }
        });

    } catch (error) {
        console.error('Error in /sales-return/next-number route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Main route for sales return - optimized without items fetching and voucher number generation
router.get('/sales-return', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;

            // Fetch required data in parallel (except items)
            const [
                bills,
                salesInvoices,
                company
            ] = await Promise.all([
                SalesReturn.find({ company: companyId }).populate('account').populate('items.item'),
                SalesBill.find({ company: companyId }),
                Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear')
            ]);

            // Date handling
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const transactionDateNepali = new NepaliDate(today).format('YYYY-MM-DD');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Fiscal year handling
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;

                // Set the fiscal year in the session for future requests
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

            // Fetch only the required company groups: Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            const accounts = await Account.find({
                company: companyId,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear }, // Created here
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                    }
                ],
                companyGroups: { $in: relevantGroupIds }
            });

            // Prepare response data (without items and without nextSalesReturnNumber)
            const responseData = {
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        vatEnabled: company.vatEnabled,
                        fiscalYear: company.fiscalYear
                    },
                    accounts: accounts,
                    salesReturns: bills.map(bill => ({
                        _id: bill._id,
                        billNumber: bill.billNumber,
                        account: bill.account,
                        items: bill.items,
                        totalAmount: bill.totalAmount,
                        discount: bill.discount,
                        taxableAmount: bill.taxableAmount,
                        vatAmount: bill.vatAmount,
                        grandTotal: bill.grandTotal,
                        transactionDate: bill.transactionDate
                    })),
                    salesInvoices: salesInvoices,
                    dates: {
                        nepaliDate,
                        transactionDateNepali
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        isActive: currentFiscalYear.isActive
                    },
                    userPreferences: {
                        theme: req.user.preferences?.theme || 'light'
                    },
                    permissions: {
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    }
                }
            };

            return res.json(responseData);
        }
    } catch (error) {
        console.error('Error in /sales-return route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.get('/sales-bill-by-number/:billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden for this trade type'
        });
    }

    try {
        const { billNumber } = req.params;
        const companyId = req.session.currentCompany;
        const fiscalYear = req.session.currentFiscalYear?.id;

        if (!billNumber) {
            return res.status(400).json({
                success: false,
                error: 'Bill number is required'
            });
        }

        // Find the sales bill by number
        const salesBill = await SalesBill.findOne({
            billNumber: billNumber,
            company: companyId,
            purchaseSalesType: 'Sales',
            fiscalYear: fiscalYear
        })
            .populate({
                path: 'items.item',
                select: 'name hscode uniqueNumber vatStatus unit sellingPrice category',
                populate: [
                    { path: 'unit', select: 'name _id' },
                    { path: 'category', select: 'name _id' }
                ]
            })
            .populate({
                path: 'items.unit',
                select: 'name _id'
            })
            .populate({
                path: 'account',
                select: 'name address pan phone email _id'
            })
            .populate('user', 'name')
            .lean()
            .exec();

        if (!salesBill) {
            return res.status(404).json({
                success: false,
                error: 'Sales bill not found'
            });
        }

        // VALIDATION: Check if this is a cash sales bill
        // Cash sales bills have cashAccount field populated (string)
        // Credit sales bills have account field populated (object reference)
        if (salesBill.cashAccount && salesBill.cashAccount.trim() !== '') {
            return res.status(400).json({
                success: false,
                error: `Bill ${billNumber} is a Cash Sales bill. Cash sales returns should be created from Cash Sales Return section.`,
                isCashSales: true,
                billType: 'cash',
                cashAccount: salesBill.cashAccount,
                cashAccountAddress: salesBill.cashAccountAddress || '',
                cashAccountPan: salesBill.cashAccountPan || '',
                cashAccountEmail: salesBill.cashAccountEmail || '',
                cashAccountPhone: salesBill.cashAccountPhone || ''
            });
        }

        // VALIDATION: Check if this is a credit sales bill (should have account)
        if (!salesBill.account) {
            return res.status(400).json({
                success: false,
                error: `Bill ${billNumber} is not a valid credit sales bill. Account information is missing.`,
                isCreditSales: false
            });
        }

        // Check if this bill already has returns
        const existingReturns = await SalesReturn.find({
            originalSalesBill: salesBill._id,
            company: companyId
        })
            .select('billNumber date totalAmount items')
            .sort({ date: -1 })
            .lean();

        // Calculate returned quantities for each item
        const returnedQuantities = {};
        existingReturns.forEach(returnBill => {
            if (returnBill.items && Array.isArray(returnBill.items)) {
                returnBill.items.forEach(returnItem => {
                    if (returnItem.item && returnItem.batchNumber) {
                        const key = `${returnItem.item}_${returnItem.batchNumber}`;
                        if (!returnedQuantities[key]) {
                            returnedQuantities[key] = 0;
                        }
                        returnedQuantities[key] += returnItem.quantity || 0;
                    }
                });
            }
        });

        // Process items for the response
        const processedItems = salesBill.items.map((item, index) => {
            const itemData = item.item || {};

            // Create key for matching returned items
            const key = `${item.item?._id}_${item.batchNumber}`;
            const returnedQty = returnedQuantities[key] || 0;
            const availableQty = Math.max(0, item.quantity - returnedQty);

            return {
                ...item,
                item: {
                    _id: itemData._id,
                    name: itemData.name || '',
                    hscode: itemData.hscode || '',
                    uniqueNumber: itemData.uniqueNumber || '',
                    vatStatus: itemData.vatStatus || 'vatable',
                    category: itemData.category || null,
                    expiryDate: itemData.expiryDate || null,
                    unit: itemData.unit || null,
                    sellingPrice: itemData.sellingPrice || 0
                },
                unit: item.unit || (itemData.unit ? {
                    _id: itemData.unit._id,
                    name: itemData.unit.name
                } : null),
                returnedQuantity: returnedQty,
                availableQuantity: availableQty,
                originalQuantity: item.quantity,
                originalPrice: item.price,
                originalAmount: (item.quantity * item.price).toFixed(2),
                // Include batchNumber and expiryDate from the sales bill item
                batchNumber: item.batchNumber || '',
                expiryDate: item.expiryDate || null
            };
        });

        // Calculate total available quantity
        const totalAvailableQuantity = processedItems.reduce((sum, item) => sum + item.availableQuantity, 0);

        // Get return details for frontend display
        const returnDetails = existingReturns.map(ret => ({
            billNumber: ret.billNumber,
            date: ret.date,
            totalAmount: ret.totalAmount || 0
        }));

        // Determine if there are any active (non-cancelled) returns
        const hasActiveReturns = existingReturns.length > 0;

        res.json({
            success: true,
            data: {
                bill: {
                    ...salesBill,
                    items: processedItems,
                    hasExistingReturns: hasActiveReturns,
                    existingReturns: returnDetails,
                    returnCount: existingReturns.length,
                    totalItems: salesBill.items.reduce((sum, item) => sum + item.quantity, 0),
                    totalAvailableItems: totalAvailableQuantity,
                    // Check if all quantities are already returned
                    isFullyReturned: processedItems.every(item => item.availableQuantity === 0),
                    // Bill type information
                    billType: 'credit', // Indicate this is a credit sales bill
                    // Include bill summary details
                    billSummary: {
                        subTotal: salesBill.subTotal || 0,
                        discountPercentage: salesBill.discountPercentage || 0,
                        discountAmount: salesBill.discountAmount || 0,
                        vatPercentage: salesBill.vatPercentage || 13,
                        vatAmount: salesBill.vatAmount || 0,
                        totalAmount: salesBill.totalAmount || 0,
                        taxableAmount: salesBill.taxableAmount || 0,
                        nonVatSales: salesBill.nonVatSales || 0,
                        roundOffAmount: salesBill.roundOffAmount || 0,
                        isVatExempt: salesBill.isVatExempt || false,
                        isVatAll: salesBill.isVatAll || '',
                        paymentMode: salesBill.paymentMode || 'credit'
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error fetching sales bill by number:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching sales bill',
            details: error.message
        });
    }
});

router.get('/sales-return/register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled isVatExempt').populate('fiscalYear');
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';
            const vatEnabled = currentCompany.vatEnabled || false;
            const isVatExempt = currentCompany.isVatExempt || false;

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

                // Set the fiscal year in the session for future requests
                req.session.currentFiscalYear = {
                    id: currentFiscalYear._id.toString(),
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                };

                fiscalYear = currentFiscalYear._id.toString();
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // If no date range provided, return empty response with company info
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        company: company,
                        currentFiscalYear: currentFiscalYear,
                        bills: [],
                        currentCompany: currentCompany,
                        currentCompanyName: currentCompanyName,
                        companyDateFormat: companyDateFormat,
                        fromDate: fromDate || '',
                        toDate: toDate || '',
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                    }
                });
            }

            // Build the query
            let query = { company: companyId };

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const bills = await SalesReturn.find(query)
                .sort({ date: 1, billNumber: 1 })
                .populate('account')
                .populate('items.item')
                .populate('user');

            // Format response for React
            return res.json({
                success: true,
                data: {
                    company: company,
                    currentFiscalYear: currentFiscalYear,
                    bills: bills,
                    currentCompany: currentCompany,
                    currentCompanyName: currentCompanyName,
                    companyDateFormat: companyDateFormat,
                    fromDate: fromDate,
                    toDate: toDate,
                    vatEnabled,
                    isVatExempt,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized trade type'
            });
        }
    } catch (error) {
        console.error('Error fetching sales return bills:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.post('/sales-return', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { accountId, items, vatPercentage, transactionDateNepali, transactionDateRoman, billDate, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount, originalSalesBill, originalSalesBillNumber } = req.body;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            const userId = req.user._id;

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let vatAmount = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            // Validation checks
            if (!companyId) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Company ID is required." });
            }

            const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
            if (!accounts) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Invalid account for this company" });
            }

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity, 10);
                subTotal += itemTotal;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemTotal;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemTotal;
                }
            }

            // Check validation conditions after processing all items
            if (isVatExempt !== 'all') {
                if (isVatExemptBool && hasVatableItems) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: 'Cannot save VAT exempt bill with vatable items' });
                }

                if (!isVatExemptBool && hasNonVatableItems) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: 'Cannot save bill with non-vatable items when VAT is applied' });
                }
            }

            // Apply discount and calculate amounts
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            // Calculate VAT
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            } else {
                vatAmount = 0;
            }

            let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            // Handle round off settings
            let roundOffForSalesReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: currentFiscalYear }).session(session);
            if (!roundOffForSalesReturn) {
                roundOffForSalesReturn = { roundOffSalesReturn: false };
            }

            let roundOffAmount = 0;
            if (roundOffForSalesReturn.roundOffSalesReturn) {
                finalAmount = Math.round(finalAmount.toFixed(2));
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSalesReturn.roundOffSalesReturn) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Generate bill number only after all validations pass
            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'salesReturn', session);

            // Create new sales return
            const newBill = new SalesReturn({
                billNumber: billNumber,
                account: accountId,
                purchaseSalesReturnType: 'Sales Return',
                items: [],
                isVatExempt: isVatExemptBool,
                isVatAll,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatSalesReturn: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                vatAmount,
                totalAmount: finalAmount,
                roundOffAmount: roundOffAmount,
                paymentMode,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
                originalSalesBill,
                originalSalesBillNumber,
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            // Get previous balance
            let previousBalance = 0;
            const accountTransaction = await Transaction.findOne({ account: accountId })
                .sort({ transactionDate: -1 })
                .session(session);
            if (accountTransaction) {
                previousBalance = accountTransaction.balance;
            }

            // Generate a unique ID for the stock entry
            const uniqueId = uuidv4();

            // FIFO stock addition function
            async function addStock(product, quantity, price, batchNumber, expiryDate, uniqueId) {
                const quantityNumber = Number(quantity);

                // Calculate discount values
                const itemTotal = price * quantityNumber;
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = price - (price * discount / 100);

                product.stockEntries.push({
                    quantity: quantityNumber,
                    price: price,
                    puPrice: price,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    batchNumber: batchNumber,
                    expiryDate: expiryDate,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    mrp: price,
                    uniqueUuId: uniqueId,
                    salesReturnBillId: newBill._id,
                    fiscalYear: currentFiscalYear,
                });

                product.stock = (product.stock || 0) + quantityNumber;
                await product.save({ session });
            }

            const billItems = [];

            // Process all items to update stock and build bill items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                // Calculate discount values
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                await addStock(
                    product, item.quantity, item.price, item.batchNumber, item.expiryDate, uniqueId
                );

                billItems.push({
                    item: product._id,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: item.quantity,
                    price: item.price,
                    netPrice: netPuPrice,
                    puPrice: item.price,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    unit: item.unit,
                    vatStatus: product.vatStatus,
                    uniqueUuId: uniqueId,
                    fiscalYear: currentFiscalYear,
                });
            }

            // Create transactions for each item
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                // Calculate discount values
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                const transaction = new Transaction({
                    item: product,
                    account: accountId,
                    billNumber: billNumber,
                    purchaseSalesReturnType: 'Sales Return',
                    quantity: items[0].quantity,
                    price: items[0].price,
                    netPrice: netPuPrice,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    isType: 'SlRt',
                    type: 'SlRt',
                    salesReturnBillId: newBill._id,
                    debit: 0,
                    credit: newBill.totalAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + newBill.totalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    fiscalYear: currentFiscalYear,
                    company: companyId,
                    user: userId
                });

                await transaction.save({ session });
            }

            // Create transaction for Sales Account
            const salesRtnAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesRtnAmount > 0) {
                const salesRtnAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesRtnAccount) {
                    const partyAccount = await Account.findById(accountId).session(session);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, message: 'Party account not found.' });
                    }
                    const salesRtnTransaction = new Transaction({
                        account: salesRtnAccount._id,
                        billNumber: billNumber,
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: partyAccount.name,
                        debit: salesRtnAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + salesRtnAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesRtnTransaction.save({ session });
                }
            }

            // Create transaction for VAT amount
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const partyAccount = await Account.findById(accountId).session(session);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, message: 'Party account not found.' });
                    }
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: billNumber,
                        isType: 'VAT',
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: partyAccount.name,
                        debit: vatAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + vatAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                }
            }

            // Create transaction for round-off amount
            if (roundOffAmount !== 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const partyAccount = await Account.findById(accountId).session(session);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, message: 'Party account not found.' });
                    }

                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        isType: 'RoundOff',
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: partyAccount.name,
                        debit: roundOffAmount > 0 ? 0 : Math.abs(roundOffAmount),
                        credit: roundOffAmount > 0 ? roundOffAmount : 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                }
            }

            // Create cash transaction if payment mode is cash
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        billNumber: billNumber,
                        isType: 'SlRt',
                        type: 'SlRt',
                        salesReturnBillId: newBill._id,
                        purchaseSalesReturnType: 'Sales Return',
                        debit: 0,
                        credit: finalAmount,
                        paymentMode: paymentMode,
                        balance: previousBalance + finalAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });
                    await cashTransaction.save({ session });
                }
            }

            // Update bill with items and save
            newBill.items = billItems;
            await newBill.save({ session });

            // Commit the transaction if everything succeeds
            await session.commitTransaction();
            session.endSession();

            // In your router.post('/sales-return', ...) route

            // Replace the current response section with this:
            const responseData = {
                success: true,
                message: 'Sales Return saved successfully!',
                data: {
                    bill: {
                        _id: newBill._id,
                        billNumber: newBill.billNumber,
                        account: {
                            _id: accounts._id,
                            name: accounts.name,
                            address: accounts.address,
                            pan: accounts.pan,
                            phone: accounts.phone,
                            email: accounts.email
                        },
                        totalAmount: newBill.totalAmount,
                        items: newBill.items,
                        vatAmount: newBill.vatAmount,
                        discountAmount: newBill.discountAmount,
                        roundOffAmount: newBill.roundOffAmount,
                        subTotal: newBill.subTotal,
                        taxableAmount: newBill.taxableAmount,
                        nonVatSalesReturn: newBill.nonVatSalesReturn,
                        isVatExempt: newBill.isVatExempt,
                        vatPercentage: newBill.vatPercentage,
                        paymentMode: newBill.paymentMode,
                        date: newBill.date,
                        transactionDate: newBill.transactionDate,
                        user: {
                            name: req.user.name
                        }
                    }
                }
            };

            return res.status(200).json(responseData);
        } catch (error) {
            console.error("Error creating sales return:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: 'Error creating sales return',
                error: error.message
            });
        }
    }
});


router.get('/sales-return/finds', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;

                // Set the fiscal year in the session for future requests
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
                return res.status(400).json({ error: 'No fiscal year found in session or company.' });
            }

            // Fetch the latest saved bill number (without modifying it)
            const latestBill = await SalesReturn.findOne({
                company: companyId,
                fiscalYear: fiscalYear
            })
                .sort({ date: -1, billNumber: -1 }) // Sort by date descending, then billNumber descending
                .select('billNumber date')
                .lean();
            console.log('Latest bill query result:', latestBill);

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    company: company,
                    billNumber: latestBill?.billNumber || '',
                    currentFiscalYear: currentFiscalYear,
                    companyDateFormat: companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
                    title: '',
                    body: '',
                    user: req.user,
                    theme: req.user.preferences?.theme || 'light',
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error in /sales-return/finds:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        return res.status(400).json({ error: 'Invalid trade type' });
    }
});

router.get('/sales-return/get-id-by-number', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        const { billNumber } = req.query;
        const companyId = req.session.currentCompany;
        const fiscalYear = req.session.currentFiscalYear?.id;

        if (!billNumber) {
            return res.status(400).json({
                success: false,
                error: 'Bill number is required'
            });
        }

        const salesReturn = await SalesReturn.findOne({
            billNumber: billNumber,
            company: companyId,
            fiscalYear: fiscalYear
        })
            .select('_id billNumber')
            .lean();

        if (!salesReturn) {
            return res.status(404).json({
                success: false,
                error: 'Voucher not found'
            });
        }

        res.json({
            success: true,
            data: {
                _id: salesReturn._id,
                billNumber: salesReturn.billNumber
            }
        });

    } catch (error) {
        console.error('Error getting bill ID:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.get('/sales-return/find-party', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        const { billNumber } = req.query;
        const companyId = req.session.currentCompany;
        const fiscalYear = req.session.currentFiscalYear?.id;

        if (!billNumber) {
            return res.status(400).json({
                success: false,
                error: 'Voucher number is required'
            });
        }

        // Find the purchase bill
        const salesReturn = await SalesReturn.findOne({
            billNumber: billNumber,
            company: companyId,
            fiscalYear: fiscalYear
        })
            .populate({
                path: 'account',
                select: 'name address pan uniqueNumber'
            })
            .select('billNumber date account paymentMode')
            .lean();

        if (!salesReturn) {
            return res.status(404).json({
                success: false,
                error: 'Voucher not found'
            });
        }

        res.json({
            success: true,
            data: {
                billNumber: salesReturn.billNumber,
                date: salesReturn.date,
                paymentMode: salesReturn.paymentMode,
                accountId: salesReturn.account._id,
                accountName: salesReturn.account.name,
                accountAddress: salesReturn.account.address || '',
                accountPan: salesReturn.account.pan || '',
                accountUniqueNumber: salesReturn.account.uniqueNumber || ''
            }
        });

    } catch (error) {
        console.error('Error fetching voucher party info:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Updated Route to update party for a voucher
router.put('/sales-return/change-party/:billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        const { billNumber } = req.params;
        const { accountId } = req.body;
        const companyId = req.session.currentCompany;
        const fiscalYear = req.session.currentFiscalYear?.id;

        if (!accountId) {
            return res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
        }

        // Verify account exists
        const account = await Account.findOne({
            _id: accountId,
            company: companyId,
            isActive: true
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        // Get the original purchase bill to get amounts
        const originalBill = await SalesReturn.findOne({
            billNumber: billNumber,
            company: companyId,
            fiscalYear: fiscalYear
        });

        if (!originalBill) {
            return res.status(404).json({
                success: false,
                error: 'Voucher not found'
            });
        }

        // Update purchase bill account
        const updatedBill = await SalesReturn.findOneAndUpdate(
            {
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            },
            {
                $set: {
                    account: accountId,
                    'accountInfo.name': account.name,
                    'accountInfo.address': account.address,
                    'accountInfo.pan': account.pan,
                    'accountInfo.uniqueNumber': account.uniqueNumber
                }
            },
            {
                new: true,
                runValidators: true
            }
        ).select('billNumber account totalAmount taxableAmount nonVatSalesReturn vatAmount roundOffAmount');

        // Update related transactions
        // IMPORTANT: Party account should be CREDIT side, Purchase account should be DEBIT side
        const transactions = await Transaction.find({
            salesReturnBillId: originalBill._id,
            company: companyId,
            fiscalYear: fiscalYear
        });

        // Process each transaction based on its type
        for (const transaction of transactions) {
            let updateFields = {};

            // Check if this is a party account transaction (based on the account)
            const isPartyTransaction = transaction.account.toString() === originalBill.account.toString();

            if (isPartyTransaction) {
                // This was the old party transaction, update to new party
                // Party account should be CREDIT side (money owed to party)
                updateFields = {
                    account: accountId,
                    'accountInfo.name': account.name,
                    'accountInfo.address': account.address,
                    'accountInfo.pan': account.pan,
                    debit: 0,  // Party gets CREDIT
                    credit: originalBill.totalAmount,
                    balance: 0
                };
            } else {
                // Check if this is a purchase account transaction
                const salesReturnAccount = await Account.findOne({
                    _id: transaction.account,
                    company: companyId,
                    name: 'Sales Return'
                });

                if (salesReturnAccount) {
                    // Purchase account should be DEBIT side (purchase expense)
                    const salesReturnAmount = originalBill.taxableAmount + originalBill.nonVatPurchase;
                    updateFields = {
                        debit: 0,
                        credit: salesReturnAmount,
                        balance: 0,
                        purchaseSalesReturnType: account.name  // Update purchase type with new party name
                    };
                } else {
                    // For other transactions (VAT, RoundOff, etc.)
                    updateFields = {
                        purchaseSalesReturnType: account.name
                    };
                }
            }

            // Update the transaction
            await Transaction.findByIdAndUpdate(
                transaction._id,
                { $set: updateFields }
            );
        }

        res.json({
            success: true,
            message: 'Party updated successfully',
            data: {
                billNumber: updatedBill.billNumber,
                accountId: updatedBill.account,
                accountName: account.name
            }
        });

    } catch (error) {
        console.error('Error updating party:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.get('/sales-return/edit/billNumber', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.query;
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

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

            // Find the payment document by billNumber
            const salesReturnInvoice = await SalesReturn.findOne({
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            }).populate({
                path: 'items.item',
                select: 'name hscode uniqueNumber vatStatus unit price category',
                populate: [
                    {
                        path: 'unit',
                        select: 'name _id'
                    },
                    {
                        path: 'category',
                        select: 'name _id'
                    }
                ]
            })
                .populate({
                    path: 'items.unit',
                    select: 'name _id'
                })
                .populate({
                    path: 'account',
                    select: 'name address pan _id uniqueNumber'
                })
                .lean()
                .exec();

            if (!salesReturnInvoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Voucher number not found'
                });
            }

            // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            // Fetch accounts excluding 'Cash in Hand' and 'Bank Accounts'
            const accounts = await Account.find({
                company: companyId,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear },
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear }
                    }
                ],
                companyGroups: { $in: relevantGroupIds }
            }).exec();

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    salesReturnInvoice,
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts,
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            });
        } catch (error) {
            console.error('Error fetching data for purchase form:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

router.get('/sales-return/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { id: billId } = req.params;
            const companyId = req.session.currentCompany;

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            const company = await Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear');

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

            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const companyDateFormat = company.dateFormat || 'english';
            if (!currentFiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'Fiscal year not found'
                });
            }

            const salesReturnInvoice = await SalesReturn.findOne({
                _id: billId,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate({
                    path: 'items.item',
                    select: 'name hscode uniqueNumber vatStatus unit Price quantity bonus batchNumber expiryDate stockEntries category',
                    populate: [
                        {
                            path: 'unit',
                            select: 'name _id'
                        },
                        {
                            path: 'category',
                            select: 'name _id'
                        }
                    ]
                })
                .populate({
                    path: 'items.unit',
                    select: 'name _id'
                })
                .populate({
                    path: 'account',
                    select: 'name address pan _id'
                })
                .lean()
                .exec();

            if (!salesReturnInvoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Sales return invoice not found or does not belong to the selected company'
                });
            }

            const processedItems = salesReturnInvoice.items.map(item => {
                // Get fields from the referenced item document
                const itemData = item.item || {};

                // Calculate stock and latest puPrice
                const totalStock = itemData.stockEntries?.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0) || 0;

                // Sort stock entries by date to get the latest one
                const sortedStockEntries = itemData.stockEntries
                    ? [...itemData.stockEntries].sort((a, b) => new Date(b.date) - new Date(a.date))
                    : [];

                const latestStockEntry = sortedStockEntries[0] || {};
                const latestPrice = latestStockEntry.price || itemData.Price || 0;

                const unit = item.unit || (itemData.unit ? {
                    _id: itemData.unit._id,
                    name: itemData.unit.name
                } : null);

                return {
                    ...item,
                    // Item details from the Item model
                    name: itemData.name || '',
                    hscode: itemData.hscode || '',
                    uniqueNumber: itemData.uniqueNumber || '',
                    vatStatus: itemData.vatStatus || 'vatable',
                    category: itemData.category || null,
                    stock: totalStock,
                    latestPrice: Math.round(latestPrice * 100) / 100,
                    // Unit details (either from direct unit reference or item's unit)
                    unit: unit,
                    // Other fields from the purchase item
                    puPrice: item.price,
                    quantity: item.quantity,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate?.toISOString().split('T')[0] || '',
                    bonus: item.bonus || 0,
                    amount: (item.quantity * item.price).toFixed(2),
                    uniqueUuId: item.uniqueUuId || '',

                    // Include the original item reference ID
                    item: item.item?._id || null
                };
            });

            // Fetch all items for the company (for dropdown) with stock and latest price
            const allItems = await Item.find({ company: companyId, status: 'active' })
                .populate([
                    { path: 'unit', select: 'name _id' },
                    { path: 'category', select: 'name _id' },
                    { path: 'stockEntries', select: 'quantity price date' }
                ])
                .select('name hscode uniqueNumber vatStatus unit price quantity stockEntries category')
                .lean();

            // Process all items to include stock and latest price
            const processedAllItems = allItems.map(item => {
                const totalStock = item.stockEntries.reduce((sum, entry) => {
                    return sum + (entry.quantity || 0);
                }, 0);

                // Sort stock entries by date to get the latest one
                const sortedStockEntries = [...item.stockEntries].sort((a, b) => {
                    return new Date(b.date) - new Date(a.date);
                });

                const latestStockEntry = sortedStockEntries[0] || {};
                const latestPrice = latestStockEntry.price || item.price || 0;

                return {
                    ...item,
                    stock: totalStock,
                    latestPrice: Math.round(latestPrice * 100) / 100,
                    category: item.category || null
                };
            }).sort((a, b) => a.name.localeCompare(b.name));

            // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            const accounts = await Account.find({
                company: companyId,
                isActive: true,
                $or: [
                    { originalFiscalYear: fiscalYear }, // Created here
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                    }
                ],
                companyGroups: { $in: relevantGroupIds }
            });

            // Prepare response data
            const responseData = {
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        vatEnabled: company.vatEnabled,
                        dateFormat: companyDateFormat,
                        name: req.session.currentCompanyName,
                        fiscalYear: currentFiscalYear
                    },
                    salesReturnInvoice: {
                        ...salesReturnInvoice,
                        items: processedItems
                    },
                    items: processedAllItems,
                    accounts: accounts.map(account => ({
                        _id: account._id,
                        name: account.name,
                        address: account.address,
                        pan: account.pan,
                        uniqueNumber: account.uniqueNumber
                    })),
                    user: {
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: {
                            theme: req.user.preferences?.theme || 'light'
                        }
                    }
                }
            };

            res.json(responseData);
        } catch (error) {
            console.error('Error fetching bill for edit:', error);
            res.status(500).json({
                success: false,
                error: 'Error fetching bill for edit',
                details: error.message
            });
        }
    }
});


// GET route for checking if sales return can be edited
router.get('/sales-return/:id/can-edit', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { id } = req.params;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;

            const salesReturn = await SalesReturn.findOne({
                _id: id,
                company: companyId,
                fiscalYear: currentFiscalYear
            });

            if (!salesReturn) {
                return res.status(404).json({ success: false, message: "Sales return not found" });
            }

            // Check if can be edited
            const canEdit = !salesReturn.isUpdated;

            return res.status(200).json({
                success: true,
                data: {
                    canEdit,
                    isUpdated: salesReturn.isUpdated,
                    message: canEdit ? "Sales return can be edited" : "Sales return has already been updated and cannot be edited further"
                }
            });

        } catch (error) {
            console.error("Error checking edit status:", error);
            return res.status(500).json({
                success: false,
                message: 'Error checking edit status',
                error: error.message
            });
        }
    }
});

// router.put('/sales-return/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
//     if (req.tradeType === 'retailer') {
//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//             const { id } = req.params;
//             const { accountId, items, vatPercentage, transactionDateNepali, transactionDateRoman, billDate, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount, originalSalesBill, originalSalesBillNumber } = req.body;
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;
//             const userId = req.user._id;

//             // Find existing sales return with populated items
//             const existingSalesReturn = await SalesReturn.findOne({
//                 _id: id,
//                 company: companyId,
//                 fiscalYear: currentFiscalYear
//             }).session(session).populate('items.item');

//             if (!existingSalesReturn) {
//                 await session.abortTransaction();
//                 return res.status(404).json({ success: false, message: "Sales return not found" });
//             }

//             // Check if sales return is already used/modified
//             if (existingSalesReturn.isUpdated) {
//                 await session.abortTransaction();
//                 return res.status(400).json({ success: false, message: "Sales return cannot be updated" });
//             }

//             // Create a map of existing items with their uniqueUuId as key for precise tracking
//             const existingItemsMap = new Map();
//             existingSalesReturn.items.forEach(item => {
//                 const key = `${item.item._id.toString()}_${item.uniqueUuId}`;
//                 existingItemsMap.set(key, {
//                     itemId: item.item._id.toString(),
//                     quantity: item.quantity,
//                     price: item.price,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     uniqueUuId: item.uniqueUuId,
//                     unit: item.unit,
//                     vatStatus: item.vatStatus
//                 });
//             });

//             const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
//             const isVatAll = isVatExempt === 'all';
//             const discount = parseFloat(discountPercentage) || 0;

//             // Validation checks
//             if (!companyId) {
//                 await session.abortTransaction();
//                 return res.status(400).json({ success: false, message: "Company ID is required." });
//             }

//             const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
//             if (!accounts) {
//                 await session.abortTransaction();
//                 return res.status(400).json({ success: false, message: "Invalid account for this company" });
//             }

//             // Check if account changed
//             if (existingSalesReturn.account.toString() !== accountId) {
//                 await session.abortTransaction();
//                 return res.status(400).json({ success: false, message: "Account cannot be changed during update" });
//             }

//             // Validate each item before processing and calculate totals
//             let subTotal = 0;
//             let totalTaxableAmount = 0;
//             let totalNonTaxableAmount = 0;
//             let hasVatableItems = false;
//             let hasNonVatableItems = false;

//             // First, validate all items exist
//             for (let i = 0; i < items.length; i++) {
//                 const item = items[i];
//                 const product = await Item.findById(item.item).session(session);

//                 if (!product) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
//                 }

//                 const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//                 subTotal += itemTotal;

//                 if (product.vatStatus === 'vatable') {
//                     hasVatableItems = true;
//                     totalTaxableAmount += itemTotal;
//                 } else {
//                     hasNonVatableItems = true;
//                     totalNonTaxableAmount += itemTotal;
//                 }
//             }

//             // Check validation conditions
//             if (isVatExempt !== 'all') {
//                 if (isVatExemptBool && hasVatableItems) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: 'Cannot save VAT exempt bill with vatable items' });
//                 }

//                 if (!isVatExemptBool && hasNonVatableItems) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: 'Cannot save bill with non-vatable items when VAT is applied' });
//                 }
//             }

//             // Apply discount and calculate amounts
//             const discountForTaxable = (totalTaxableAmount * discount) / 100;
//             const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
//             const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
//             const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

//             // Calculate VAT
//             let vatAmount = 0;
//             if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
//                 vatAmount = (finalTaxableAmount * vatPercentage) / 100;
//             }

//             let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
//             let finalAmount = totalAmount;

//             // Handle round off settings
//             let roundOffForSalesReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: currentFiscalYear }).session(session);
//             if (!roundOffForSalesReturn) {
//                 roundOffForSalesReturn = { roundOffSalesReturn: false };
//             }

//             let roundOffAmount = 0;
//             if (roundOffForSalesReturn.roundOffSalesReturn) {
//                 finalAmount = Math.round(finalAmount.toFixed(2));
//                 roundOffAmount = finalAmount - totalAmount;
//             } else if (manualRoundOffAmount && !roundOffForSalesReturn.roundOffSalesReturn) {
//                 roundOffAmount = parseFloat(manualRoundOffAmount);
//                 finalAmount = totalAmount + roundOffAmount;
//             }

//             // STEP 1: REVERSE OLD TRANSACTIONS
//             await Transaction.deleteMany({
//                 salesReturnBillId: existingSalesReturn._id
//             }).session(session);

//             // STEP 2: PROCESS STOCK UPDATES - Following purchase edit pattern
//             // First, collect all product updates
//             const productUpdates = new Map();

//             // Process existing items to reverse their stock (remove old entries)
//             for (const [key, existingItem] of existingItemsMap) {
//                 const product = await Item.findById(existingItem.itemId).session(session);
//                 if (!product) continue;

//                 // Find the exact stock entry by uniqueUuId
//                 const stockEntryIndex = product.stockEntries.findIndex(entry =>
//                     entry.uniqueUuId === existingItem.uniqueUuId
//                 );

//                 if (stockEntryIndex !== -1) {
//                     // Track the reverse update
//                     if (!productUpdates.has(product._id.toString())) {
//                         productUpdates.set(product._id.toString(), {
//                             product,
//                             stockDelta: 0,
//                             entriesToRemove: [],
//                             entriesToUpdate: [],
//                             entriesToAdd: []
//                         });
//                     }

//                     const update = productUpdates.get(product._id.toString());
//                     const stockEntry = product.stockEntries[stockEntryIndex];
//                     update.stockDelta -= stockEntry.quantity;
//                     update.entriesToRemove.push(stockEntryIndex);
//                 }
//             }

//             // Process removed items (items in existing but not in new)
//             const newItemKeys = new Set(items.map(item => `${item.item}_${item.uniqueUuId || ''}`));

//             for (const [key, existingItem] of existingItemsMap) {
//                 if (!newItemKeys.has(key)) {
//                     // This item was removed, already handled in the reverse step above
//                     // No additional action needed as we're removing all old entries
//                 }
//             }

//             // Apply all reverse stock updates (remove old entries)
//             for (const [productId, update] of productUpdates) {
//                 // Remove entries in reverse order to avoid index issues
//                 update.entriesToRemove.sort((a, b) => b - a).forEach(index => {
//                     update.product.stockEntries.splice(index, 1);
//                 });

//                 // Update stock
//                 update.product.stock += update.stockDelta;

//                 // Save the product
//                 await update.product.save({ session });
//             }

//             // Clear product updates for the addition phase
//             productUpdates.clear();

//             // STEP 3: Process new items and add their stock
//             const billItems = [];

//             for (let i = 0; i < items.length; i++) {
//                 const item = items[i];
//                 const product = await Item.findById(item.item).session(session);

//                 if (!product) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
//                 }

//                 // Check if this item existed before (has uniqueUuId)
//                 const existingKey = `${item.item}_${item.uniqueUuId || ''}`;
//                 const existingItem = existingItemsMap.get(existingKey);

//                 // Calculate discount values
//                 const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//                 const discountPercentagePerItem = discount;
//                 const discountAmountPerItem = (itemTotal * discount) / 100;
//                 const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

//                 // Prepare stock entry
//                 const stockEntry = {
//                     quantity: parseFloat(item.quantity),
//                     price: parseFloat(item.price),
//                     puPrice: parseFloat(item.price),
//                     discountPercentagePerItem: discountPercentagePerItem,
//                     discountAmountPerItem: discountAmountPerItem,
//                     netPuPrice: netPuPrice,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     mrp: parseFloat(item.price),
//                     uniqueUuId: item.uniqueUuId || uuidv4(), // Use existing UUID or generate new
//                     salesReturnBillId: existingSalesReturn._id,
//                     fiscalYear: currentFiscalYear,
//                 };

//                 // Track product update
//                 if (!productUpdates.has(product._id.toString())) {
//                     productUpdates.set(product._id.toString(), {
//                         product,
//                         stockDelta: 0,
//                         entriesToAdd: []
//                     });
//                 }

//                 const update = productUpdates.get(product._id.toString());

//                 if (existingItem) {
//                     // This item existed before, we're updating it
//                     // Only add the difference if quantity changed
//                     const quantityDifference = parseFloat(item.quantity) - existingItem.quantity;
//                     if (quantityDifference > 0) {
//                         // Increased quantity - add only the difference
//                         update.stockDelta += quantityDifference;
//                         // Create a new stock entry for the additional quantity
//                         const additionalStockEntry = { ...stockEntry, quantity: quantityDifference };
//                         update.entriesToAdd.push(additionalStockEntry);
//                     } else if (quantityDifference < 0) {
//                         // Decreased quantity - handled in reverse step, no addition needed
//                         // The reverse step already removed the full quantity
//                         // Now we need to add back the new quantity
//                         update.stockDelta += parseFloat(item.quantity);
//                         update.entriesToAdd.push(stockEntry);
//                     } else {
//                         // Quantity unchanged - no stock change needed
//                         // But we still need to keep the entry in the bill
//                         // We'll add it back with the original UUID
//                         update.stockDelta += 0; // No stock change
//                         // Don't push to entriesToAdd to avoid duplicate entries
//                     }
//                 } else {
//                     // Brand new item - add full quantity
//                     update.stockDelta += parseFloat(item.quantity);
//                     update.entriesToAdd.push(stockEntry);
//                 }

//                 // Add to bill items (always include all items)
//                 billItems.push({
//                     item: product._id,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     quantity: parseFloat(item.quantity),
//                     price: parseFloat(item.price),
//                     netPrice: netPuPrice,
//                     puPrice: parseFloat(item.price),
//                     discountPercentagePerItem: discountPercentagePerItem,
//                     discountAmountPerItem: discountAmountPerItem,
//                     netPuPrice: netPuPrice,
//                     unit: item.unit,
//                     vatStatus: product.vatStatus,
//                     uniqueUuId: stockEntry.uniqueUuId,
//                     fiscalYear: currentFiscalYear,
//                 });
//             }

//             // Apply all new stock additions
//             for (const [productId, update] of productUpdates) {
//                 if (update.entriesToAdd.length > 0) {
//                     // Use atomic operation to add entries and update stock
//                     await Item.findByIdAndUpdate(
//                         productId,
//                         {
//                             $push: { stockEntries: { $each: update.entriesToAdd } },
//                             $inc: { stock: update.stockDelta }
//                         },
//                         { session }
//                     );
//                 }
//             }

//             // Get previous balance for transactions
//             let previousBalance = 0;
//             const accountTransaction = await Transaction.findOne({ account: accountId })
//                 .sort({ transactionDate: -1 })
//                 .session(session);
//             if (accountTransaction) {
//                 previousBalance = accountTransaction.balance;
//             }

//             // STEP 4: CREATE NEW TRANSACTIONS
//             // Create a single transaction for the party account
//             const partyTransaction = new Transaction({
//                 item: null,
//                 account: accountId,
//                 billNumber: existingSalesReturn.billNumber,
//                 purchaseSalesReturnType: 'Sales Return',
//                 quantity: 0,
//                 price: 0,
//                 netPrice: 0,
//                 discountPercentagePerItem: 0,
//                 discountAmountPerItem: 0,
//                 netPuPrice: 0,
//                 isType: 'SlRt',
//                 type: 'SlRt',
//                 salesReturnBillId: existingSalesReturn._id,
//                 debit: 0,
//                 credit: finalAmount,
//                 paymentMode: paymentMode,
//                 balance: previousBalance + finalAmount,
//                 date: nepaliDate ? nepaliDate : new Date(billDate),
//                 fiscalYear: currentFiscalYear,
//                 company: companyId,
//                 user: userId
//             });

//             await partyTransaction.save({ session });

//             // Create transaction for Sales Account
//             const salesRtnAmount = finalTaxableAmount + finalNonTaxableAmount;
//             if (salesRtnAmount > 0) {
//                 const salesRtnAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
//                 if (salesRtnAccount) {
//                     const salesRtnTransaction = new Transaction({
//                         account: salesRtnAccount._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         type: 'SlRt',
//                         billId: existingSalesReturn._id,
//                         purchaseSalesReturnType: accounts.name,
//                         debit: salesRtnAmount,
//                         credit: 0,
//                         paymentMode: paymentMode,
//                         balance: previousBalance + salesRtnAmount,
//                         date: nepaliDate ? nepaliDate : new Date(billDate),
//                         company: companyId,
//                         user: userId,
//                         fiscalYear: currentFiscalYear
//                     });
//                     await salesRtnTransaction.save({ session });
//                 }
//             }

//             // Create transaction for VAT amount
//             if (vatAmount > 0) {
//                 const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
//                 if (vatAccount) {
//                     const vatTransaction = new Transaction({
//                         account: vatAccount._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         isType: 'VAT',
//                         type: 'SlRt',
//                         billId: existingSalesReturn._id,
//                         purchaseSalesReturnType: accounts.name,
//                         debit: vatAmount,
//                         credit: 0,
//                         paymentMode: paymentMode,
//                         balance: previousBalance + vatAmount,
//                         date: nepaliDate ? nepaliDate : new Date(billDate),
//                         company: companyId,
//                         user: userId,
//                         fiscalYear: currentFiscalYear
//                     });
//                     await vatTransaction.save({ session });
//                 }
//             }

//             // Create transaction for round-off amount
//             if (roundOffAmount !== 0) {
//                 const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
//                 if (roundOffAccount) {
//                     const roundOffTransaction = new Transaction({
//                         account: roundOffAccount._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         isType: 'RoundOff',
//                         type: 'SlRt',
//                         billId: existingSalesReturn._id,
//                         purchaseSalesReturnType: accounts.name,
//                         debit: roundOffAmount > 0 ? 0 : Math.abs(roundOffAmount),
//                         credit: roundOffAmount > 0 ? roundOffAmount : 0,
//                         paymentMode: paymentMode,
//                         balance: previousBalance + roundOffAmount,
//                         date: nepaliDate ? nepaliDate : new Date(billDate),
//                         company: companyId,
//                         user: userId,
//                         fiscalYear: currentFiscalYear
//                     });
//                     await roundOffTransaction.save({ session });
//                 }
//             }

//             // Create cash transaction if payment mode is cash
//             if (paymentMode === 'cash') {
//                 const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
//                 if (cashAccount) {
//                     const cashTransaction = new Transaction({
//                         account: cashAccount._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         isType: 'SlRt',
//                         type: 'SlRt',
//                         salesReturnBillId: existingSalesReturn._id,
//                         purchaseSalesReturnType: 'Sales Return',
//                         debit: 0,
//                         credit: finalAmount,
//                         paymentMode: paymentMode,
//                         balance: previousBalance + finalAmount,
//                         date: nepaliDate ? nepaliDate : new Date(billDate),
//                         company: companyId,
//                         user: userId,
//                         fiscalYear: currentFiscalYear,
//                     });
//                     await cashTransaction.save({ session });
//                 }
//             }

//             // STEP 5: UPDATE THE SALES RETURN BILL
//             existingSalesReturn.account = accountId;
//             existingSalesReturn.items = billItems;
//             existingSalesReturn.isVatExempt = isVatExemptBool;
//             existingSalesReturn.isVatAll = isVatAll;
//             existingSalesReturn.vatPercentage = isVatExemptBool ? 0 : vatPercentage;
//             existingSalesReturn.subTotal = subTotal;
//             existingSalesReturn.discountPercentage = discount;
//             existingSalesReturn.discountAmount = discountForTaxable + discountForNonTaxable;
//             existingSalesReturn.nonVatSalesReturn = finalNonTaxableAmount;
//             existingSalesReturn.taxableAmount = finalTaxableAmount;
//             existingSalesReturn.vatAmount = vatAmount;
//             existingSalesReturn.totalAmount = finalAmount;
//             existingSalesReturn.roundOffAmount = roundOffAmount;
//             existingSalesReturn.paymentMode = paymentMode;
//             existingSalesReturn.date = nepaliDate ? nepaliDate : new Date(billDate);
//             existingSalesReturn.transactionDate = transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman);
//             existingSalesReturn.originalSalesBill = originalSalesBill;
//             existingSalesReturn.originalSalesBillNumber = originalSalesBillNumber;
//             existingSalesReturn.isUpdated = true;
//             existingSalesReturn.updatedAt = new Date();
//             existingSalesReturn.updatedBy = userId;

//             await existingSalesReturn.save({ session });

//             // Commit the transaction
//             await session.commitTransaction();
//             session.endSession();

//             // Prepare response data
//             const responseData = {
//                 success: true,
//                 message: 'Sales Return updated successfully!',
//                 data: {
//                     bill: {
//                         _id: existingSalesReturn._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         account: {
//                             _id: accounts._id,
//                             name: accounts.name,
//                             address: accounts.address,
//                             pan: accounts.pan,
//                             phone: accounts.phone,
//                             email: accounts.email
//                         },
//                         totalAmount: existingSalesReturn.totalAmount,
//                         items: existingSalesReturn.items,
//                         vatAmount: existingSalesReturn.vatAmount,
//                         discountAmount: existingSalesReturn.discountAmount,
//                         roundOffAmount: existingSalesReturn.roundOffAmount,
//                         subTotal: existingSalesReturn.subTotal,
//                         taxableAmount: existingSalesReturn.taxableAmount,
//                         nonVatSalesReturn: existingSalesReturn.nonVatSalesReturn,
//                         isVatExempt: existingSalesReturn.isVatExempt,
//                         vatPercentage: existingSalesReturn.vatPercentage,
//                         paymentMode: existingSalesReturn.paymentMode,
//                         date: existingSalesReturn.date,
//                         transactionDate: existingSalesReturn.transactionDate,
//                         user: {
//                             name: req.user.name
//                         }
//                     }
//                 }
//             };

//             return res.status(200).json(responseData);

//         } catch (error) {
//             console.error("Error updating sales return:", error);
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(500).json({
//                 success: false,
//                 message: 'Error updating sales return',
//                 error: error.message
//             });
//         }
//     }
// });

// router.put('/sales-return/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
//     if (req.tradeType === 'retailer') {
//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//             const { id } = req.params;
//             const { accountId, items, vatPercentage, transactionDateNepali, transactionDateRoman, billDate, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount, originalSalesBill, originalSalesBillNumber } = req.body;
//             const companyId = req.session.currentCompany;
//             const currentFiscalYear = req.session.currentFiscalYear.id;
//             const userId = req.user._id;

//             // Find existing sales return with populated items
//             const existingSalesReturn = await SalesReturn.findOne({
//                 _id: id,
//                 company: companyId,
//                 fiscalYear: currentFiscalYear
//             }).session(session).populate('items.item');

//             if (!existingSalesReturn) {
//                 await session.abortTransaction();
//                 return res.status(404).json({ success: false, message: "Sales return not found" });
//             }

//             // Check if sales return is already used/modified
//             if (existingSalesReturn.isUpdated) {
//                 await session.abortTransaction();
//                 return res.status(400).json({ success: false, message: "Sales return cannot be updated" });
//             }

//             // Create a map of existing items with their uniqueUuId as key for precise tracking
//             const existingItemsMap = new Map();
//             existingSalesReturn.items.forEach(item => {
//                 const key = `${item.item._id.toString()}_${item.uniqueUuId}`;
//                 existingItemsMap.set(key, {
//                     itemId: item.item._id.toString(),
//                     quantity: item.quantity,
//                     price: item.price,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     uniqueUuId: item.uniqueUuId,
//                     unit: item.unit,
//                     vatStatus: item.vatStatus
//                 });
//             });

//             const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
//             const isVatAll = isVatExempt === 'all';
//             const discount = parseFloat(discountPercentage) || 0;

//             // Validation checks
//             if (!companyId) {
//                 await session.abortTransaction();
//                 return res.status(400).json({ success: false, message: "Company ID is required." });
//             }

//             const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
//             if (!accounts) {
//                 await session.abortTransaction();
//                 return res.status(400).json({ success: false, message: "Invalid account for this company" });
//             }

//             // Check if account changed
//             if (existingSalesReturn.account.toString() !== accountId) {
//                 await session.abortTransaction();
//                 return res.status(400).json({ success: false, message: "Account cannot be changed during update" });
//             }

//             // Validate each item before processing and calculate totals
//             let subTotal = 0;
//             let totalTaxableAmount = 0;
//             let totalNonTaxableAmount = 0;
//             let hasVatableItems = false;
//             let hasNonVatableItems = false;

//             // First, validate all items exist
//             for (let i = 0; i < items.length; i++) {
//                 const item = items[i];
//                 const product = await Item.findById(item.item).session(session);

//                 if (!product) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
//                 }

//                 const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//                 subTotal += itemTotal;

//                 if (product.vatStatus === 'vatable') {
//                     hasVatableItems = true;
//                     totalTaxableAmount += itemTotal;
//                 } else {
//                     hasNonVatableItems = true;
//                     totalNonTaxableAmount += itemTotal;
//                 }
//             }

//             // Check validation conditions
//             if (isVatExempt !== 'all') {
//                 if (isVatExemptBool && hasVatableItems) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: 'Cannot save VAT exempt bill with vatable items' });
//                 }

//                 if (!isVatExemptBool && hasNonVatableItems) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: 'Cannot save bill with non-vatable items when VAT is applied' });
//                 }
//             }

//             // Apply discount and calculate amounts
//             const discountForTaxable = (totalTaxableAmount * discount) / 100;
//             const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
//             const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
//             const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

//             // Calculate VAT
//             let vatAmount = 0;
//             if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
//                 vatAmount = (finalTaxableAmount * vatPercentage) / 100;
//             }

//             let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
//             let finalAmount = totalAmount;

//             // Handle round off settings
//             let roundOffForSalesReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: currentFiscalYear }).session(session);
//             if (!roundOffForSalesReturn) {
//                 roundOffForSalesReturn = { roundOffSalesReturn: false };
//             }

//             let roundOffAmount = 0;
//             if (roundOffForSalesReturn.roundOffSalesReturn) {
//                 finalAmount = Math.round(finalAmount.toFixed(2));
//                 roundOffAmount = finalAmount - totalAmount;
//             } else if (manualRoundOffAmount && !roundOffForSalesReturn.roundOffSalesReturn) {
//                 roundOffAmount = parseFloat(manualRoundOffAmount);
//                 finalAmount = totalAmount + roundOffAmount;
//             }

//             // STEP 1: DELETE ALL OLD TRANSACTIONS
//             await Transaction.deleteMany({
//                 salesReturnBillId: existingSalesReturn._id
//             }).session(session);

//             // STEP 2: PROCESS STOCK UPDATES
//             // First, collect all product updates for removal
//             const productUpdates = new Map();

//             // Process existing items to reverse their stock (remove old entries)
//             for (const [key, existingItem] of existingItemsMap) {
//                 const product = await Item.findById(existingItem.itemId).session(session);
//                 if (!product) continue;

//                 // Find the exact stock entry by uniqueUuId
//                 const stockEntryIndex = product.stockEntries.findIndex(entry =>
//                     entry.uniqueUuId === existingItem.uniqueUuId
//                 );

//                 if (stockEntryIndex !== -1) {
//                     // Track the reverse update
//                     if (!productUpdates.has(product._id.toString())) {
//                         productUpdates.set(product._id.toString(), {
//                             product,
//                             stockDelta: 0,
//                             entriesToRemove: []
//                         });
//                     }

//                     const update = productUpdates.get(product._id.toString());
//                     const stockEntry = product.stockEntries[stockEntryIndex];
//                     update.stockDelta -= stockEntry.quantity;
//                     update.entriesToRemove.push(stockEntryIndex);
//                 }
//             }

//             // Apply all reverse stock updates (remove old entries)
//             for (const [productId, update] of productUpdates) {
//                 // Remove entries in reverse order to avoid index issues
//                 update.entriesToRemove.sort((a, b) => b - a).forEach(index => {
//                     update.product.stockEntries.splice(index, 1);
//                 });

//                 // Update stock
//                 update.product.stock += update.stockDelta;

//                 // Save the product
//                 await update.product.save({ session });
//             }

//             // Clear product updates for the addition phase
//             productUpdates.clear();

//             // STEP 3: Process new items and add their stock
//             const billItems = [];

//             for (let i = 0; i < items.length; i++) {
//                 const item = items[i];
//                 const product = await Item.findById(item.item).session(session);

//                 if (!product) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
//                 }

//                 // Check if this item existed before (has uniqueUuId)
//                 const existingKey = `${item.item}_${item.uniqueUuId || ''}`;
//                 const existingItem = existingItemsMap.get(existingKey);

//                 // Calculate discount values
//                 const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//                 const discountPercentagePerItem = discount;
//                 const discountAmountPerItem = (itemTotal * discount) / 100;
//                 const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

//                 // Prepare stock entry
//                 const stockEntry = {
//                     quantity: parseFloat(item.quantity),
//                     price: parseFloat(item.price),
//                     puPrice: parseFloat(item.price),
//                     discountPercentagePerItem: discountPercentagePerItem,
//                     discountAmountPerItem: discountAmountPerItem,
//                     netPuPrice: netPuPrice,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     mrp: parseFloat(item.price),
//                     uniqueUuId: item.uniqueUuId || uuidv4(),
//                     salesReturnBillId: existingSalesReturn._id,
//                     fiscalYear: currentFiscalYear,
//                 };

//                 // Track product update
//                 if (!productUpdates.has(product._id.toString())) {
//                     productUpdates.set(product._id.toString(), {
//                         product,
//                         stockDelta: 0,
//                         entriesToAdd: []
//                     });
//                 }

//                 const update = productUpdates.get(product._id.toString());

//                 if (existingItem) {
//                     // This item existed before
//                     // Add the full quantity back (since we removed it completely)
//                     update.stockDelta += parseFloat(item.quantity);
//                     update.entriesToAdd.push(stockEntry);
//                 } else {
//                     // Brand new item - add full quantity
//                     update.stockDelta += parseFloat(item.quantity);
//                     update.entriesToAdd.push(stockEntry);
//                 }

//                 // Add to bill items
//                 billItems.push({
//                     item: product._id,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     quantity: parseFloat(item.quantity),
//                     price: parseFloat(item.price),
//                     netPrice: netPuPrice,
//                     puPrice: parseFloat(item.price),
//                     discountPercentagePerItem: discountPercentagePerItem,
//                     discountAmountPerItem: discountAmountPerItem,
//                     netPuPrice: netPuPrice,
//                     unit: item.unit,
//                     vatStatus: product.vatStatus,
//                     uniqueUuId: stockEntry.uniqueUuId,
//                     fiscalYear: currentFiscalYear,
//                 });
//             }

//             // Apply all new stock additions
//             for (const [productId, update] of productUpdates) {
//                 if (update.entriesToAdd.length > 0) {
//                     await Item.findByIdAndUpdate(
//                         productId,
//                         {
//                             $push: { stockEntries: { $each: update.entriesToAdd } },
//                             $inc: { stock: update.stockDelta }
//                         },
//                         { session }
//                     );
//                 }
//             }

//             // Get previous balance for transactions
//             let previousBalance = 0;
//             const accountTransaction = await Transaction.findOne({ account: accountId })
//                 .sort({ transactionDate: -1 })
//                 .session(session);
//             if (accountTransaction) {
//                 previousBalance = accountTransaction.balance;
//             }

//             // STEP 4: CREATE NEW TRANSACTIONS - ONE PER ITEM (LIKE PURCHASE EDIT)
//             for (let i = 0; i < items.length; i++) {
//                 const item = items[i];
//                 const product = await Item.findById(item.item).session(session);

//                 if (!product) {
//                     await session.abortTransaction();
//                     return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
//                 }

//                 // Calculate item values
//                 const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
//                 const discountPercentagePerItem = discount;
//                 const discountAmountPerItem = (itemTotal * discount) / 100;
//                 const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

//                 // await partyTransaction.save({ session });
//                 const partyTransaction = new Transaction({
//                     item: null,
//                     account: accountId,
//                     billNumber: existingSalesReturn.billNumber,
//                     purchaseSalesReturnType: 'Sales Return',
//                     quantity: 0,
//                     price: 0,
//                     netPrice: 0,
//                     discountPercentagePerItem: 0,
//                     discountAmountPerItem: 0,
//                     netPuPrice: 0,
//                     isType: 'SlRt',
//                     type: 'SlRt',
//                     salesReturnBillId: existingSalesReturn._id,
//                     debit: 0,
//                     credit: finalAmount,
//                     paymentMode: paymentMode,
//                     balance: previousBalance + finalAmount,
//                     date: nepaliDate ? nepaliDate : new Date(billDate),
//                     fiscalYear: currentFiscalYear,
//                     company: companyId,
//                     user: userId
//                 });

//                 await partyTransaction.save({ session });
//             }

//             // Create Sales Account transaction (total taxable + non-taxable)
//             const salesRtnAmount = finalTaxableAmount + finalNonTaxableAmount;
//             if (salesRtnAmount > 0) {
//                 const salesRtnAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
//                 if (salesRtnAccount) {
//                     const salesRtnTransaction = new Transaction({
//                         account: salesRtnAccount._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         type: 'SlRt',
//                         billId: existingSalesReturn._id,
//                         purchaseSalesReturnType: accounts.name,
//                         debit: salesRtnAmount, // Sales account gets debited
//                         credit: 0,
//                         paymentMode: paymentMode,
//                         balance: 0,
//                         date: nepaliDate ? nepaliDate : new Date(billDate),
//                         company: companyId,
//                         user: userId,
//                         fiscalYear: currentFiscalYear
//                     });
//                     await salesRtnTransaction.save({ session });
//                 }
//             }

//             if (vatAmount > 0) {
//                 const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
//                 if (vatAccount) {
//                     const vatTransaction = new Transaction({
//                         account: vatAccount._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         isType: 'VAT',
//                         type: 'SlRt',
//                         billId: existingSalesReturn._id,
//                         purchaseSalesReturnType: accounts.name,
//                         debit: vatAmount,
//                         credit: 0,
//                         paymentMode: paymentMode,
//                         balance: previousBalance + vatAmount,
//                         date: nepaliDate ? nepaliDate : new Date(billDate),
//                         company: companyId,
//                         user: userId,
//                         fiscalYear: currentFiscalYear
//                     });
//                     await vatTransaction.save({ session });
//                 }
//             }

//             // Create Round Off transaction
//             if (roundOffAmount !== 0) {
//                 const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
//                 if (roundOffAccount) {
//                     const roundOffTransaction = new Transaction({
//                         account: roundOffAccount._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         isType: 'RoundOff',
//                         type: 'SlRt',
//                         billId: existingSalesReturn._id,
//                         purchaseSalesReturnType: accounts.name,
//                         debit: roundOffAmount > 0 ? roundOffAmount : 0,
//                         credit: roundOffAmount < 0 ? Math.abs(roundOffAmount) : 0,
//                         paymentMode: paymentMode,
//                         balance: 0,
//                         date: nepaliDate ? nepaliDate : new Date(billDate),
//                         company: companyId,
//                         user: userId,
//                         fiscalYear: currentFiscalYear
//                     });
//                     await roundOffTransaction.save({ session });
//                 }
//             }

//             // Create Cash transaction if payment mode is cash
//             if (paymentMode === 'cash') {
//                 const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
//                 if (cashAccount) {
//                     const cashTransaction = new Transaction({
//                         account: cashAccount._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         isType: 'SlRt',
//                         type: 'SlRt',
//                         salesReturnBillId: existingSalesReturn._id,
//                         purchaseSalesReturnType: 'Sales Return',
//                         debit: 0,
//                         credit: finalAmount, // Cash account gets credited
//                         paymentMode: paymentMode,
//                         balance: 0,
//                         date: nepaliDate ? nepaliDate : new Date(billDate),
//                         company: companyId,
//                         user: userId,
//                         fiscalYear: currentFiscalYear,
//                     });
//                     await cashTransaction.save({ session });
//                 }
//             }

//             // STEP 5: UPDATE THE SALES RETURN BILL
//             existingSalesReturn.account = accountId;
//             existingSalesReturn.items = billItems;
//             existingSalesReturn.isVatExempt = isVatExemptBool;
//             existingSalesReturn.isVatAll = isVatAll;
//             existingSalesReturn.vatPercentage = isVatExemptBool ? 0 : vatPercentage;
//             existingSalesReturn.subTotal = subTotal;
//             existingSalesReturn.discountPercentage = discount;
//             existingSalesReturn.discountAmount = discountForTaxable + discountForNonTaxable;
//             existingSalesReturn.nonVatSalesReturn = finalNonTaxableAmount;
//             existingSalesReturn.taxableAmount = finalTaxableAmount;
//             existingSalesReturn.vatAmount = vatAmount;
//             existingSalesReturn.totalAmount = finalAmount;
//             existingSalesReturn.roundOffAmount = roundOffAmount;
//             existingSalesReturn.paymentMode = paymentMode;
//             existingSalesReturn.date = nepaliDate ? nepaliDate : new Date(billDate);
//             existingSalesReturn.transactionDate = transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman);
//             existingSalesReturn.originalSalesBill = originalSalesBill;
//             existingSalesReturn.originalSalesBillNumber = originalSalesBillNumber;
//             existingSalesReturn.isUpdated = true;
//             existingSalesReturn.updatedAt = new Date();
//             existingSalesReturn.updatedBy = userId;

//             await existingSalesReturn.save({ session });

//             // Commit the transaction
//             await session.commitTransaction();
//             session.endSession();

//             // Prepare response data
//             const responseData = {
//                 success: true,
//                 message: 'Sales Return updated successfully!',
//                 data: {
//                     bill: {
//                         _id: existingSalesReturn._id,
//                         billNumber: existingSalesReturn.billNumber,
//                         account: {
//                             _id: accounts._id,
//                             name: accounts.name,
//                             address: accounts.address,
//                             pan: accounts.pan,
//                             phone: accounts.phone,
//                             email: accounts.email
//                         },
//                         totalAmount: existingSalesReturn.totalAmount,
//                         items: existingSalesReturn.items,
//                         vatAmount: existingSalesReturn.vatAmount,
//                         discountAmount: existingSalesReturn.discountAmount,
//                         roundOffAmount: existingSalesReturn.roundOffAmount,
//                         subTotal: existingSalesReturn.subTotal,
//                         taxableAmount: existingSalesReturn.taxableAmount,
//                         nonVatSalesReturn: existingSalesReturn.nonVatSalesReturn,
//                         isVatExempt: existingSalesReturn.isVatExempt,
//                         vatPercentage: existingSalesReturn.vatPercentage,
//                         paymentMode: existingSalesReturn.paymentMode,
//                         date: existingSalesReturn.date,
//                         transactionDate: existingSalesReturn.transactionDate,
//                         user: {
//                             name: req.user.name
//                         }
//                     }
//                 }
//             };

//             return res.status(200).json(responseData);

//         } catch (error) {
//             console.error("Error updating sales return:", error);
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(500).json({
//                 success: false,
//                 message: 'Error updating sales return',
//                 error: error.message
//             });
//         }
//     }
// });

router.put('/sales-return/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id } = req.params;
            const { accountId, items, vatPercentage, transactionDateNepali, transactionDateRoman, billDate, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount, originalSalesBill, originalSalesBillNumber } = req.body;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const userId = req.user._id;

            // Find existing sales return with populated items
            const existingSalesReturn = await SalesReturn.findOne({
                _id: id,
                company: companyId,
                fiscalYear: currentFiscalYear
            }).session(session).populate('items.item');

            if (!existingSalesReturn) {
                await session.abortTransaction();
                return res.status(404).json({ success: false, message: "Sales return not found" });
            }

            // Check if sales return is already used/modified
            if (existingSalesReturn.isUpdated) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Sales return cannot be updated" });
            }

            // Create a map of existing items with their uniqueUuId as key for precise tracking
            const existingItemsMap = new Map();
            existingSalesReturn.items.forEach(item => {
                const key = `${item.item._id.toString()}_${item.uniqueUuId}`;
                existingItemsMap.set(key, {
                    itemId: item.item._id.toString(),
                    quantity: item.quantity,
                    price: item.price,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    uniqueUuId: item.uniqueUuId,
                    unit: item.unit,
                    vatStatus: item.vatStatus
                });
            });

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            // Validation checks
            if (!companyId) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Company ID is required." });
            }

            const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
            if (!accounts) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Invalid account for this company" });
            }

            // Check if account changed
            if (existingSalesReturn.account.toString() !== accountId) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Account cannot be changed during update" });
            }

            // Validate each item before processing and calculate totals
            let subTotal = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            // First, validate all items exist
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                subTotal += itemTotal;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemTotal;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemTotal;
                }
            }

            // Check validation conditions
            if (isVatExempt !== 'all') {
                if (isVatExemptBool && hasVatableItems) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: 'Cannot save VAT exempt bill with vatable items' });
                }

                if (!isVatExemptBool && hasNonVatableItems) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: 'Cannot save bill with non-vatable items when VAT is applied' });
                }
            }

            // Apply discount and calculate amounts
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            // Calculate VAT
            let vatAmount = 0;
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            }

            let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            // Handle round off settings
            let roundOffForSalesReturn = await Settings.findOne({ company: companyId, userId, fiscalYear: currentFiscalYear }).session(session);
            if (!roundOffForSalesReturn) {
                roundOffForSalesReturn = { roundOffSalesReturn: false };
            }

            let roundOffAmount = 0;
            if (roundOffForSalesReturn.roundOffSalesReturn) {
                finalAmount = Math.round(finalAmount.toFixed(2));
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSalesReturn.roundOffSalesReturn) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // STEP 1: DELETE ALL OLD TRANSACTIONS
            await Transaction.deleteMany({
                salesReturnBillId: existingSalesReturn._id
            }).session(session);

            // STEP 2: PROCESS STOCK UPDATES
            // First, collect all product updates for removal
            const productUpdates = new Map();

            // Process existing items to reverse their stock (remove old entries)
            for (const [key, existingItem] of existingItemsMap) {
                const product = await Item.findById(existingItem.itemId).session(session);
                if (!product) continue;

                // Find the exact stock entry by uniqueUuId
                const stockEntryIndex = product.stockEntries.findIndex(entry =>
                    entry.uniqueUuId === existingItem.uniqueUuId
                );

                if (stockEntryIndex !== -1) {
                    // Track the reverse update
                    if (!productUpdates.has(product._id.toString())) {
                        productUpdates.set(product._id.toString(), {
                            product,
                            stockDelta: 0,
                            entriesToRemove: []
                        });
                    }

                    const update = productUpdates.get(product._id.toString());
                    const stockEntry = product.stockEntries[stockEntryIndex];
                    update.stockDelta -= stockEntry.quantity;
                    update.entriesToRemove.push(stockEntryIndex);
                }
            }

            // Apply all reverse stock updates (remove old entries)
            for (const [productId, update] of productUpdates) {
                // Remove entries in reverse order to avoid index issues
                update.entriesToRemove.sort((a, b) => b - a).forEach(index => {
                    update.product.stockEntries.splice(index, 1);
                });

                // Update stock
                update.product.stock += update.stockDelta;

                // Save the product
                await update.product.save({ session });
            }

            // Clear product updates for the addition phase
            productUpdates.clear();

            // STEP 3: Process new items and add their stock
            const billItems = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                // Check if this item existed before (has uniqueUuId)
                const existingKey = `${item.item}_${item.uniqueUuId || ''}`;
                const existingItem = existingItemsMap.get(existingKey);

                // Calculate discount values
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                // Prepare stock entry
                const stockEntry = {
                    quantity: parseFloat(item.quantity),
                    price: parseFloat(item.price),
                    puPrice: parseFloat(item.price),
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    mrp: parseFloat(item.price),
                    uniqueUuId: item.uniqueUuId || uuidv4(),
                    salesReturnBillId: existingSalesReturn._id,
                    fiscalYear: currentFiscalYear,
                };

                // Track product update
                if (!productUpdates.has(product._id.toString())) {
                    productUpdates.set(product._id.toString(), {
                        product,
                        stockDelta: 0,
                        entriesToAdd: []
                    });
                }

                const update = productUpdates.get(product._id.toString());

                if (existingItem) {
                    // This item existed before
                    // Add the full quantity back (since we removed it completely)
                    update.stockDelta += parseFloat(item.quantity);
                    update.entriesToAdd.push(stockEntry);
                } else {
                    // Brand new item - add full quantity
                    update.stockDelta += parseFloat(item.quantity);
                    update.entriesToAdd.push(stockEntry);
                }

                // Add to bill items
                billItems.push({
                    item: product._id,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: parseFloat(item.quantity),
                    price: parseFloat(item.price),
                    netPrice: netPuPrice,
                    puPrice: parseFloat(item.price),
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    unit: item.unit,
                    vatStatus: product.vatStatus,
                    uniqueUuId: stockEntry.uniqueUuId,
                    fiscalYear: currentFiscalYear,
                });
            }

            // Apply all new stock additions
            for (const [productId, update] of productUpdates) {
                if (update.entriesToAdd.length > 0) {
                    await Item.findByIdAndUpdate(
                        productId,
                        {
                            $push: { stockEntries: { $each: update.entriesToAdd } },
                            $inc: { stock: update.stockDelta }
                        },
                        { session }
                    );
                }
            }

            // Get previous balance for transactions
            let previousBalance = 0;
            const accountTransaction = await Transaction.findOne({ account: accountId })
                .sort({ transactionDate: -1 })
                .session(session);
            if (accountTransaction) {
                previousBalance = accountTransaction.balance;
            }

            // STEP 4: CREATE NEW TRANSACTIONS
            let runningBalance = previousBalance;

            // 4.1 Create ONE party transaction for the TOTAL amount (not per item)
            const partyTransaction = new Transaction({
                item: null,
                account: accountId,
                billNumber: existingSalesReturn.billNumber,
                purchaseSalesReturnType: 'Sales Return',
                quantity: 0,
                price: 0,
                netPrice: 0,
                discountPercentagePerItem: 0,
                discountAmountPerItem: 0,
                netPuPrice: 0,
                isType: 'SlRt',
                type: 'SlRt',
                salesReturnBillId: existingSalesReturn._id,
                debit: 0,
                credit: finalAmount, // ONE transaction with total amount
                paymentMode: paymentMode,
                balance: previousBalance + finalAmount,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                fiscalYear: currentFiscalYear,
                company: companyId,
                user: userId
            });

            await partyTransaction.save({ session });
            runningBalance = previousBalance + finalAmount;

            // 4.2 Create Sales Account transaction (total taxable + non-taxable)
            const salesRtnAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesRtnAmount > 0) {
                const salesRtnAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesRtnAccount) {
                    const salesRtnTransaction = new Transaction({
                        account: salesRtnAccount._id,
                        billNumber: existingSalesReturn.billNumber,
                        type: 'SlRt',
                        billId: existingSalesReturn._id,
                        purchaseSalesReturnType: accounts.name,
                        debit: salesRtnAmount, // Sales account gets debited
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesRtnTransaction.save({ session });
                }
            }

            // 4.3 Create VAT Account transaction
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: existingSalesReturn.billNumber,
                        isType: 'VAT',
                        type: 'SlRt',
                        billId: existingSalesReturn._id,
                        purchaseSalesReturnType: accounts.name,
                        debit: vatAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                }
            }

            // 4.4 Create Round Off transaction
            if (roundOffAmount !== 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: existingSalesReturn.billNumber,
                        isType: 'RoundOff',
                        type: 'SlRt',
                        billId: existingSalesReturn._id,
                        purchaseSalesReturnType: accounts.name,
                        debit: roundOffAmount > 0 ? roundOffAmount : 0,
                        credit: roundOffAmount < 0 ? Math.abs(roundOffAmount) : 0,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                }
            }

            // 4.5 Create Cash transaction if payment mode is cash
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        billNumber: existingSalesReturn.billNumber,
                        isType: 'SlRt',
                        type: 'SlRt',
                        salesReturnBillId: existingSalesReturn._id,
                        purchaseSalesReturnType: 'Sales Return',
                        debit: 0,
                        credit: finalAmount,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });
                    await cashTransaction.save({ session });
                }
            }

            // STEP 5: UPDATE THE SALES RETURN BILL
            existingSalesReturn.account = accountId;
            existingSalesReturn.items = billItems;
            existingSalesReturn.isVatExempt = isVatExemptBool;
            existingSalesReturn.isVatAll = isVatAll;
            existingSalesReturn.vatPercentage = isVatExemptBool ? 0 : vatPercentage;
            existingSalesReturn.subTotal = subTotal;
            existingSalesReturn.discountPercentage = discount;
            existingSalesReturn.discountAmount = discountForTaxable + discountForNonTaxable;
            existingSalesReturn.nonVatSalesReturn = finalNonTaxableAmount;
            existingSalesReturn.taxableAmount = finalTaxableAmount;
            existingSalesReturn.vatAmount = vatAmount;
            existingSalesReturn.totalAmount = finalAmount;
            existingSalesReturn.roundOffAmount = roundOffAmount;
            existingSalesReturn.paymentMode = paymentMode;
            existingSalesReturn.date = nepaliDate ? nepaliDate : new Date(billDate);
            existingSalesReturn.transactionDate = transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman);
            existingSalesReturn.originalSalesBill = originalSalesBill;
            existingSalesReturn.originalSalesBillNumber = originalSalesBillNumber;
            existingSalesReturn.isUpdated = true;
            existingSalesReturn.updatedAt = new Date();
            existingSalesReturn.updatedBy = userId;

            await existingSalesReturn.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            // Prepare response data
            const responseData = {
                success: true,
                message: 'Sales Return updated successfully!',
                data: {
                    bill: {
                        _id: existingSalesReturn._id,
                        billNumber: existingSalesReturn.billNumber,
                        account: {
                            _id: accounts._id,
                            name: accounts.name,
                            address: accounts.address,
                            pan: accounts.pan,
                            phone: accounts.phone,
                            email: accounts.email
                        },
                        totalAmount: existingSalesReturn.totalAmount,
                        items: existingSalesReturn.items,
                        vatAmount: existingSalesReturn.vatAmount,
                        discountAmount: existingSalesReturn.discountAmount,
                        roundOffAmount: existingSalesReturn.roundOffAmount,
                        subTotal: existingSalesReturn.subTotal,
                        taxableAmount: existingSalesReturn.taxableAmount,
                        nonVatSalesReturn: existingSalesReturn.nonVatSalesReturn,
                        isVatExempt: existingSalesReturn.isVatExempt,
                        vatPercentage: existingSalesReturn.vatPercentage,
                        paymentMode: existingSalesReturn.paymentMode,
                        date: existingSalesReturn.date,
                        transactionDate: existingSalesReturn.transactionDate,
                        user: {
                            name: req.user.name
                        }
                    }
                }
            };

            return res.status(200).json(responseData);

        } catch (error) {
            console.error("Error updating sales return:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: 'Error updating sales return',
                error: error.message
            });
        }
    }
});


router.get('/cash/sales-return/next-number', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

        // Get or create bill counter
        let lastCounter = await BillCounter.findOne({
            company: companyId,
            fiscalYear: fiscalYearId,
            transactionType: 'salesReturn'
        });

        // If no counter exists, create one
        if (!lastCounter) {
            lastCounter = new BillCounter({
                company: companyId,
                fiscalYear: fiscalYearId,
                transactionType: 'salesReturn',
                currentBillNumber: 0
            });
            await lastCounter.save();
        }

        // Calculate next bill number
        const nextNumber = lastCounter.currentBillNumber + 1;
        const prefix = fiscalYear.billPrefixes.salesReturn;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        return res.json({
            success: true,
            data: {
                nextSalesReturnBillNumber: nextBillNumber,
                currentCounter: lastCounter.currentBillNumber
            }
        });

    } catch (error) {
        console.error('Error in /cash/sales-return/next-number route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Main route for cash sales return - optimized without items fetching and voucher number generation
router.get('/cash/sales-return', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const companyId = req.session.currentCompany;

        // Fetch all required data in parallel for better performance (except items)
        const [
            company,
            bills,
            salesInvoice,
            fiscalYears,
            categories,
            units,
            companyGroups,
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesReturn.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            SalesBill.find({ company: companyId }),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId }),
            CompanyGroup.find({ company: companyId }),
        ]);

        // Date handling
        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const transactionDateNepali = new NepaliDate(today).format('YYYY-MM-DD');
        const companyDateFormat = company ? company.dateFormat : 'english';

        // Fiscal year handling
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
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

        // 1. Fetch active cash accounts from Account collection
        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Cash in Hand'] }
        }).exec();

        const relevantGroupIds = relevantGroups.map(group => group._id);

        const activeAccounts = await Account.find({
            company: companyId,
            fiscalYear: fiscalYear,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        }).select('name address pan phone email defaultCashAccount');

        // 2. Fetch previously used cash accounts from SalesBill collection
        const usedCashAccounts = await SalesBill.aggregate([
            {
                $match: {
                    company: new mongoose.Types.ObjectId(companyId),
                    cashAccount: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: "$cashAccount",
                    address: { $first: "$cashAccountAddress" },
                    pan: { $first: "$cashAccountPan" },
                    phone: { $first: "$cashAccountPhone" },
                    email: { $first: "$cashAccountEmail" }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    address: 1,
                    pan: 1,
                    phone: 1,
                    email: 1,
                    isHistorical: true // Flag to identify historical accounts
                }
            }
        ]);

        // Combine both results, ensuring no duplicates
        const combinedAccounts = [...activeAccounts.map(acc => ({
            ...acc.toObject(),
            isHistorical: false
        }))];

        usedCashAccounts.forEach(usedAccount => {
            // Only add if not already in activeAccounts
            if (!activeAccounts.some(acc => acc.name === usedAccount.name)) {
                combinedAccounts.push({
                    _id: null, // No ID since it's from SalesBill
                    name: usedAccount.name,
                    address: usedAccount.address,
                    pan: usedAccount.pan,
                    phone: usedAccount.phone,
                    email: usedAccount.email,
                    isHistorical: true
                });
            }
        });

        // Sort combined accounts alphabetically by name
        combinedAccounts.sort((a, b) => a.name.localeCompare(b.name));

        // Prepare response data (without items and without nextBillNumber)
        const responseData = {
            success: true,
            data: {
                company: {
                    _id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    vatEnabled: company.vatEnabled,
                    fiscalYear: company.fiscalYear
                },
                accounts: combinedAccounts,
                salesReturnBills: bills.map(bill => ({
                    _id: bill._id,
                    billNumber: bill.billNumber,
                    account: bill.account,
                    items: bill.items,
                    totalAmount: bill.totalAmount,
                    discount: bill.discount,
                    taxableAmount: bill.taxableAmount,
                    vatAmount: bill.vatAmount,
                    grandTotal: bill.grandTotal,
                    transactionDate: bill.transactionDate
                })),
                salesInvoices: salesInvoice.map(invoice => ({
                    _id: invoice._id,
                    billNumber: invoice.billNumber,
                    account: invoice.account,
                    grandTotal: invoice.grandTotal,
                    transactionDate: invoice.transactionDate
                })),
                // Note: nextSalesReturnBillNumber is removed from here
                dates: {
                    nepaliDate,
                    transactionDateNepali
                },
                currentFiscalYear: {
                    _id: currentFiscalYear._id,
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    isActive: currentFiscalYear.isActive
                },
                categories: categories.map(cat => ({
                    _id: cat._id,
                    name: cat.name
                })),
                units: units.map(unit => ({
                    _id: unit._id,
                    name: unit.name
                })),
                companyGroups: companyGroups.map(group => ({
                    _id: group._id,
                    name: group.name
                })),
                userPreferences: {
                    theme: req.user.preferences?.theme || 'light'
                },
                permissions: {
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            }
        };

        return res.json(responseData);

    } catch (error) {
        console.error('Error in /cash/sales-return route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.post('/cash/sales-return', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { cashAccount, cashAccountAddress, cashAccountPan, cashAccountEmail, cashAccountPhone, items, vatPercentage, transactionDateNepali, transactionDateRoman, billDate, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount } = req.body;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            const userId = req.user._id;

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let vatAmount = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            // Validation
            if (!companyId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, error: 'Company ID is required' });
            }

            if (!cashAccount) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, error: 'Invalid account for this company' });
            }

            if (!items || items.length === 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, error: 'No items provided' });
            }

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, error: `Item with id ${item.item} not found` });
                }

                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity, 10);
                subTotal += itemTotal;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemTotal;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemTotal;
                }
            }

            // Check validation conditions after processing all items
            if (isVatExempt !== 'all') {
                if (isVatExemptBool && hasVatableItems) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, error: 'Cannot save VAT exempt bill with vatable items' });
                }

                if (!isVatExemptBool && hasNonVatableItems) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, error: 'Cannot save bill with non-vatable items when VAT is applied' });
                }
            }

            // Apply discount and calculate amounts
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;
            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            // Calculate VAT
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            } else {
                vatAmount = 0;
            }

            let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            // Handle round off settings
            let roundOffForSalesReturn = await Settings.findOne({
                company: companyId,
                userId,
                fiscalYear: currentFiscalYear
            }).session(session);
            if (!roundOffForSalesReturn) {
                roundOffForSalesReturn = { roundOffSalesReturn: false };
            }

            let roundOffAmount = 0;
            if (roundOffForSalesReturn.roundOffSalesReturn) {
                finalAmount = Math.round(finalAmount.toFixed(2));
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSalesReturn.roundOffSalesReturn) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Generate bill number only after all validations pass
            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'salesReturn', session);

            // Create new sales return
            const newBill = new SalesReturn({
                billNumber: billNumber,
                cashAccount: cashAccount,
                cashAccountAddress,
                cashAccountPan,
                cashAccountEmail,
                cashAccountPhone,
                purchaseSalesReturnType: 'Sales Return',
                items: [],
                isVatExempt: isVatExemptBool,
                isVatAll,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatSalesReturn: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                vatAmount,
                totalAmount: finalAmount,
                roundOffAmount: roundOffAmount,
                paymentMode,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            // Get previous balance
            let previousBalance = 0;
            const accountTransaction = await Transaction.findOne({ cashAccount: cashAccount })
                .sort({ transactionDate: -1 })
                .session(session);
            if (accountTransaction) {
                previousBalance = accountTransaction.balance;
            }

            // Generate a unique ID for the stock entry
            const uniqueId = uuidv4();

            // FIFO stock addition function
            async function addStock(product, quantity, price, batchNumber, expiryDate, uniqueId) {
                const quantityNumber = Number(quantity);

                // Calculate discount values
                const itemTotal = price * quantityNumber;
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = price - (price * discount / 100);

                product.stockEntries.push({
                    quantity: quantityNumber,
                    price: price,
                    puPrice: price,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    batchNumber: batchNumber,
                    expiryDate: expiryDate,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    mrp: price,
                    uniqueUuId: uniqueId,
                    salesReturnBillId: newBill._id,
                    fiscalYear: currentFiscalYear,
                });

                product.stock = (product.stock || 0) + quantityNumber;
                await product.save({ session });
            }

            const billItems = [];

            // Process all items to update stock and build bill items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, error: `Item with id ${item.item} not found` });
                }

                // Calculate discount values
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                await addStock(
                    product, item.quantity, item.price, item.batchNumber, item.expiryDate, uniqueId
                );

                billItems.push({
                    item: product._id,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: item.quantity,
                    price: item.price,
                    netPrice: netPuPrice,
                    puPrice: item.price,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    unit: item.unit,
                    vatStatus: product.vatStatus,
                    uniqueUuId: uniqueId,
                    fiscalYear: currentFiscalYear,
                });
            }

            // Create transactions for each item
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                const transaction = new Transaction({
                    item: product,
                    cashAccount: cashAccount,
                    billNumber: billNumber,
                    purchaseSalesReturnType: 'Sales Return',
                    quantity: items[0].quantity,
                    price: items[0].price,
                    netPrice: netPuPrice,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    isType: 'SlRt',
                    type: 'SlRt',
                    salesReturnBillId: newBill._id,
                    debit: 0,
                    credit: newBill.totalAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + newBill.totalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    fiscalYear: currentFiscalYear,
                    company: companyId,
                    user: userId
                });

                await transaction.save({ session });
            }

            // Create transaction for Sales Account
            const salesRtnAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesRtnAmount > 0) {
                const salesRtnAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesRtnAccount) {
                    const salesTransaction = new Transaction({
                        account: salesRtnAccount._id,
                        billNumber: billNumber,
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: cashAccount,
                        debit: salesRtnAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + salesRtnAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesTransaction.save({ session });
                }
            }

            // Create transaction for VAT amount
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: billNumber,
                        isType: 'VAT',
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: cashAccount,
                        debit: vatAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + vatAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                }
            }

            // Create transaction for round-off amount
            if (roundOffAmount !== 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        isType: 'RoundOff',
                        type: 'SlRt',
                        billId: newBill._id,
                        purchaseSalesReturnType: cashAccount,
                        debit: roundOffAmount > 0 ? 0 : Math.abs(roundOffAmount),
                        credit: roundOffAmount > 0 ? roundOffAmount : 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                }
            }

            // Create cash transaction if payment mode is cash
            if (paymentMode === 'cash') {
                const cashInHandAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashInHandAccount) {
                    const cashTransaction = new Transaction({
                        account: cashInHandAccount._id,
                        cashAccount: cashAccount,
                        billNumber: billNumber,
                        isType: 'SlRt',
                        type: 'SlRt',
                        salesReturnBillId: newBill._id,
                        purchaseSalesReturnType: 'Sales Return',
                        debit: 0,
                        credit: finalAmount,
                        paymentMode: paymentMode,
                        balance: previousBalance + finalAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });
                    await cashTransaction.save({ session });
                }
            }

            // Update bill with items and save
            newBill.items = billItems;
            await newBill.save({ session });

            // Commit the transaction if everything succeeds
            await session.commitTransaction();
            session.endSession();

            // return res.status(201).json({
            //     success: true,
            //     message: 'Sales Return saved successfully!',
            //     bill: {
            //         id: newBill._id,
            //         billNumber: newBill.billNumber,
            //         totalAmount: newBill.totalAmount,
            //         date: newBill.date,
            //         items: newBill.items.map(item => ({
            //             itemId: item.item,
            //             quantity: item.quantity,
            //             price: item.price,
            //             amount: item.quantity * item.price
            //         }))
            //     },
            //     printUrl: `/sales-return/${newBill._id}/cash/direct-print`
            // });

            // In your router.post('/cash/sales-return', ...) route

            // Replace the current response section with this:

            const responseData = {
                success: true,
                message: 'Sales Return saved successfully!',
                data: {
                    bill: {
                        _id: newBill._id,
                        billNumber: newBill.billNumber,
                        cashAccount: newBill.cashAccount,
                        cashAccountAddress: newBill.cashAccountAddress,
                        cashAccountPan: newBill.cashAccountPan,
                        cashAccountEmail: newBill.cashAccountEmail,
                        cashAccountPhone: newBill.cashAccountPhone,
                        totalAmount: newBill.totalAmount,
                        items: newBill.items.map(item => ({
                            item: item.item,
                            quantity: item.quantity,
                            price: item.price,
                            batchNumber: item.batchNumber,
                            expiryDate: item.expiryDate,
                            vatStatus: item.vatStatus
                        })),
                        vatAmount: newBill.vatAmount,
                        discountAmount: newBill.discountAmount,
                        roundOffAmount: newBill.roundOffAmount,
                        subTotal: newBill.subTotal,
                        taxableAmount: newBill.taxableAmount,
                        nonVatSalesReturn: newBill.nonVatSalesReturn,
                        isVatExempt: newBill.isVatExempt,
                        vatPercentage: newBill.vatPercentage,
                        paymentMode: newBill.paymentMode,
                        date: newBill.date,
                        transactionDate: newBill.transactionDate,
                        user: {
                            name: req.user.name
                        }
                    }
                }
            };

            return res.status(201).json(responseData);


        } catch (error) {
            console.error("Error creating sales return:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                error: 'Error creating sales return',
                details: error.message
            });
        }
    } else {
        return res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

router.get('/sales-return/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const currentCompanyName = req.session.currentCompanyName;
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const transactionDateNepali = new NepaliDate(today).format('YYYY-MM-DD');

            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;

                // Set the fiscal year in the session for future requests
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

            const currentCompany = await Company.findById(new ObjectId(companyId));
            if (!currentCompany) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const billId = req.params.id;
            const bill = await SalesReturn.findById(billId)
                .populate({ path: 'account', select: 'name pan address email phone openingBalance' })
                .populate('items.item')
                .populate('user');

            if (!bill) {
                return res.status(404).json({
                    success: false,
                    error: 'Sales return bill not found'
                });
            }

            // Populate unit for each item in the bill
            for (const item of bill.items) {
                await item.item.populate('unit');
            }

            let finalBalance = null;
            let balanceLabel = '';

            // Fetch the latest transaction for the current company and bill
            if (bill.paymentMode === 'credit') {
                const latestTransaction = await Transaction.findOne({
                    company: new ObjectId(companyId),
                    billId: new ObjectId(billId)
                }).sort({ transactionDate: -1 });

                let lastBalance = 0;

                if (latestTransaction) {
                    lastBalance = Math.abs(latestTransaction.balance || 0);
                    if (latestTransaction.debit) {
                        balanceLabel = 'Dr';
                    } else if (latestTransaction.credit) {
                        balanceLabel = 'Cr';
                    }
                }

                // Retrieve the opening balance from the account
                const openingBalance = bill.account ? bill.account.openingBalance : null;

                if (openingBalance) {
                    lastBalance += (openingBalance.type === 'Dr' ? openingBalance.amount : -openingBalance.amount);
                    balanceLabel = openingBalance.type;
                }

                finalBalance = lastBalance;
            }

            // Prepare the response data
            const responseData = {
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear,
                    bill: {
                        ...bill._doc,
                        items: bill.items.map(item => ({
                            ...item._doc,
                            item: {
                                ...item.item._doc,
                                unit: item.item.unit
                            }
                        })),
                        account: bill.account,
                        user: bill.user
                    },
                    currentCompanyName,
                    currentCompany: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        phone: currentCompany.phone,
                        pan: currentCompany.pan,
                        address: currentCompany.address,
                    },
                    lastBalance: finalBalance,
                    balanceLabel,
                    paymentMode: bill.paymentMode,
                    nepaliDate,
                    transactionDateNepali,
                    englishDate: bill.englishDate,
                    companyDateFormat,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                }
            };

            res.json(responseData);
        } catch (error) {
            console.error("Error fetching sales return bill for printing:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching sales return bill for printing',
                details: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

router.get('/salesReturn-vat-report', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const companyId = req.session.currentCompany;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';

        if (!currentCompany) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Extract dates from query parameters
        let fromDate = req.query.fromDate ? req.query.fromDate : null;
        let toDate = req.query.toDate ? req.query.toDate : null;

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat')
            .populate('fiscalYear');

        // Check fiscal year
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
                message: 'No fiscal year found in session or company.'
            });
        }

        if (!fromDate || !toDate) {
            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    companyDateFormat,
                    nepaliDate,
                    currentCompany,
                    salesReturnVatReport: [],
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName: req.session.currentCompanyName,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'Sales Return VAT Report',
                    theme: req.user.preferences?.theme || 'light'
                }
            });
        }

        // Build query
        let query = { company: companyId };
        if (fromDate && toDate) {
            query.date = { $gte: fromDate, $lte: toDate };
        } else if (fromDate) {
            query.date = { $gte: fromDate };
        } else if (toDate) {
            query.date = { $lte: toDate };
        }

        const salesReturns = await SalesReturn.find(query)
            .populate('account')
            .populate('cashAccount')
            .sort({ date: 1 });

        // const Bills = await SalesBill.find(query)
        //     .populate('account')
        //     .populate('cashAccount')
        //     .sort({ billNumber: 1 });

        // Prepare VAT report data
        const salesReturnVatReport = await Promise.all(salesReturns.map(async returnBill => {
            if (returnBill.account) {
                const account = await Account.findById(returnBill.account);
                return {
                    billNumber: returnBill.billNumber,
                    date: returnBill.date,
                    accountName: account ? account.name : 'N/A',
                    panNumber: account ? account.pan : 'N/A',
                    totalAmount: returnBill.totalAmount,
                    discountAmount: returnBill.discountAmount,
                    nonVatSales: returnBill.nonVatSalesReturn,
                    taxableAmount: returnBill.taxableAmount,
                    vatAmount: returnBill.vatAmount,
                };
            } else {
                return {
                    billNumber: returnBill.billNumber,
                    date: returnBill.date,
                    accountName: returnBill.cashAccount || 'Cash Sale',
                    panNumber: returnBill.cashAccountPan || 'N/A',
                    totalAmount: returnBill.totalAmount,
                    discountAmount: returnBill.discountAmount,
                    nonVatSales: returnBill.nonVatSalesReturn,
                    taxableAmount: returnBill.taxableAmount,
                    vatAmount: returnBill.vatAmount,
                    isCash: true
                }
            }
        }));

        res.json({
            success: true,
            data: {
                company,
                currentFiscalYear,
                salesReturnVatReport,
                companyDateFormat,
                nepaliDate,
                currentCompany,
                fromDate: req.query.fromDate,
                toDate: req.query.toDate,
                currentCompanyName: req.session.currentCompanyName,
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            },
            meta: {
                title: 'Sales Return VAT Report',
                theme: req.user.preferences?.theme || 'light'
            }
        });

    } catch (error) {
        console.error('Error in salesReturn-vat-report:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
module.exports = router;
const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require("../../middleware/auth");
const { ensureTradeType } = require("../../middleware/tradeType");
const Account = require("../../models/retailer/Account");
const Item = require("../../models/retailer/Item");
const Company = require("../../models/Company");
const NepaliDate = require('nepali-date');
const Settings = require('../../models/retailer/Settings');
const Transaction = require('../../models/retailer/Transaction');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');
const FiscalYear = require('../../models/FiscalYear');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const CompanyGroup = require('../../models/retailer/CompanyGroup');
const itemsCompany = require('../../models/retailer/itemsCompany');
const Unit = require('../../models/retailer/Unit');
const Composition = require('../../models/retailer/Composition')
const MainUnit = require('../../models/retailer/MainUnit');
const Category = require('../../models/retailer/Category');
const SalesBill = require('../../models/retailer/SalesBill');

// Credit Sales routes
router.get('/credit-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }
        const companyId = req.session.currentCompany;
        // Fetch all required data in parallel for better performance
        const [
            company,
            bills,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            itemsCompanies,
            composition,
            mainUnits,
            companyGroups
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesBill.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({ company: companyId, fiscalYear: req.session.currentFiscalYear?.id })
                .populate('category')
                .populate('unit')
                .populate('itemsCompany')
                .populate('mainUnit')
                .populate('composition')
                .populate({
                    path: 'stockEntries',
                    match: { quantity: { $gt: 0 } },
                    select: 'batchNumber expiryDate quantity puPrice date',
                }),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'sales'
            }),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId }),
            itemsCompany.find({ company: companyId }),
            Composition.find({ company: companyId }),
            MainUnit.find({ company: companyId }),
            CompanyGroup.find({ company: companyId })
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

        // Process items with stock information
        const itemsWithStock = items.map(item => {
            const totalStock = item.stockEntries.reduce((sum, entry) => {
                return sum + (entry.quantity || 0);
            }, 0);

            // Sort stock entries by date in descending order (newest first)
            const sortedStockEntries = [...item.stockEntries].sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });

            // Get the latest stock entry (first item after sorting)
            const latestStockEntry = sortedStockEntries[0] || null;

            // Get the latest puPrice (rounded to 2 decimal places)
            const puPrice = latestStockEntry?.puPrice
                ? Math.round(latestStockEntry.puPrice * 100) / 100
                : item.puPrice
                    ? Math.round(item.puPrice * 100) / 100
                    : 0;

            return {
                ...item.toObject(),
                stock: totalStock,
                latestPuPrice: puPrice,
                latestStockEntry: latestStockEntry
            };
        });

        // Calculate next bill number
        const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
        const prefix = fiscalYears.billPrefixes.sales;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // Fetch only the required company groups: Sundry Debtors
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
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    vatEnabled: company.vatEnabled,
                    fiscalYear: company.fiscalYear
                },
                items: itemsWithStock,
                accounts,
                salesBills: bills.map(bill => ({
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
                nextSalesBillNumber: nextBillNumber,
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
                itemsCompanies: itemsCompanies.map(ic => ({
                    _id: ic._id,
                    name: ic.name
                })),
                compositions: composition.map(comp => ({
                    _id: comp._id,
                    name: comp.name
                })),
                mainUnits: mainUnits.map(mu => ({
                    _id: mu._id,
                    name: mu.name
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
        console.error('Error in /credit-sales route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Fetch all sales bills
router.get('/sales-register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';

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

            const bills = await SalesBill.find(query)
                .sort({ date: 1 })
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
                    companyDateFormat: companyDateFormat,
                    fromDate: fromDate,
                    toDate: toDate,
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
        console.error('Error fetching sales bills:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.post('/credit-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden for this trade type'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            accountId,
            items,
            vatPercentage,
            transactionDateRoman,
            transactionDateNepali,
            billDate,
            nepaliDate,
            isVatExempt,
            discountPercentage,
            paymentMode,
            roundOffAmount: manualRoundOffAmount
        } = req.body;

        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation checks
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Company ID is required.'
            });
        }
        if (!isVatExempt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid vat selection.'
            });
        }
        if (!paymentMode) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid payment mode.'
            });
        }

        const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
        const isVatAll = isVatExempt === 'all';
        const discount = parseFloat(discountPercentage) || 0;

        let subTotal = 0;
        let vatAmount = 0;
        let totalTaxableAmount = 0;
        let totalNonTaxableAmount = 0;
        let hasVatableItems = false;
        let hasNonVatableItems = false;

        const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
        if (!accounts) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid account for this company'
            });
        }

        // Validate items and calculate amounts
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    error: `Item with id ${item.item} not found`
                });
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

            const availableStock = product.stockEntries.reduce((acc, entry) => acc + entry.quantity, 0);
            if (availableStock < item.quantity) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: `Not enough stock for item: ${product.name}. Available: ${availableStock}, Required: ${item.quantity}`
                });
            }
        }

        // VAT validation
        if (isVatExempt !== 'all') {
            if (isVatExemptBool && hasVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot save VAT exempt bill with vatable items'
                });
            }

            if (!isVatExemptBool && hasNonVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot save bill with non-vatable items when VAT is applied'
                });
            }
        }

        // Calculate amounts
        const discountForTaxable = (totalTaxableAmount * discount) / 100;
        const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

        const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
        const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

        if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
            vatAmount = (finalTaxableAmount * vatPercentage) / 100;
        } else {
            vatAmount = 0;
        }

        let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
        let finalAmount = totalAmount;

        // Round off handling
        let roundOffForSales = await Settings.findOne({
            company: companyId,
            userId,
            fiscalYear: currentFiscalYear
        }).session(session);

        if (!roundOffForSales) {
            roundOffForSales = { roundOffSales: false };
        }

        let roundOffAmount = 0;
        if (roundOffForSales.roundOffSales) {
            finalAmount = Math.round(finalAmount.toFixed(2));
            roundOffAmount = finalAmount - totalAmount;
        } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
            roundOffAmount = parseFloat(manualRoundOffAmount);
            finalAmount = totalAmount + roundOffAmount;
        }

        // Create bill number
        const newBillNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

        // Create new bill
        const newBill = new SalesBill({
            billNumber: newBillNumber,
            account: accountId,
            purchaseSalesType: 'Sales',
            items: [],
            isVatExempt: isVatExemptBool,
            isVatAll,
            vatPercentage: isVatExemptBool ? 0 : vatPercentage,
            subTotal,
            discountPercentage: discount,
            discountAmount: discountForTaxable + discountForNonTaxable,
            nonVatSales: finalNonTaxableAmount,
            taxableAmount: finalTaxableAmount,
            vatAmount,
            totalAmount: finalAmount,
            roundOffAmount: roundOffAmount,
            paymentMode,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear
        });

        // Get previous balance
        let previousBalance = 0;
        const accountTransaction = await Transaction.findOne({ account: accountId }).sort({ transactionDate: -1 }).session(session);
        if (accountTransaction) {
            previousBalance = accountTransaction.balance;
        }

        // Group items by (product, batchNumber)
        const groupedItems = {};
        for (const item of items) {
            const key = `${item.item}-${item.batchNumber || 'N/A'}`;
            if (!groupedItems[key]) {
                groupedItems[key] = { ...item, quantity: 0 };
            }
            groupedItems[key].quantity += Number(item.quantity);
        }

        // Stock reduction function
        async function reduceStock(product, quantity) {
            product.stock -= quantity;
            let remainingQuantity = quantity;
            const batchesUsed = [];

            product.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

            for (let i = 0; i < product.stockEntries.length && remainingQuantity > 0; i++) {
                let entry = product.stockEntries[i];
                const quantityUsed = Math.min(entry.quantity, remainingQuantity);
                batchesUsed.push({
                    batchNumber: entry.batchNumber,
                    quantity: quantityUsed,
                    uniqueUuId: entry.uniqueUuId,
                });

                remainingQuantity -= quantityUsed;
                entry.quantity -= quantityUsed;
            }

            product.stockEntries = product.stockEntries.filter(entry => entry.quantity > 0);
            await product.save({ session });

            if (remainingQuantity > 0) {
                throw new Error(`Not enough stock for item: ${product.name}. Required: ${quantity}, Available: ${quantity - remainingQuantity}`);
            }

            return batchesUsed;
        }

        // Process stock reduction
        const billItems = [];
        const transactions = [];

        for (const item of Object.values(groupedItems)) {
            const product = await Item.findById(item.item).session(session);
            const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
            const itemDiscountPercentage = discount;
            const itemDiscountAmount = (itemTotal * discount) / 100;
            const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

            const batchesUsed = await reduceStock(product, item.quantity);

            const itemsForBill = batchesUsed.map(batch => ({
                item: product._id,
                quantity: batch.quantity,
                price: item.price,
                netPrice: netPrice,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: itemDiscountPercentage,
                discountAmountPerItem: itemDiscountAmount,
                unit: item.unit,
                batchNumber: batch.batchNumber,
                expiryDate: item.expiryDate,
                vatStatus: product.vatStatus,
                fiscalYear: fiscalYearId,
                uniqueUuId: batch.uniqueUuId
            }));

            billItems.push(...itemsForBill);
        }

        // Create transactions for items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);
            const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
            const itemDiscountPercentage = discount;
            const itemDiscountAmount = (itemTotal * discount) / 100;
            const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

            const transaction = new Transaction({
                item: product,
                unit: item.unit,
                WSUnit: item.WSUnit,
                price: item.price,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: itemDiscountPercentage,
                discountAmountPerItem: itemDiscountAmount,
                netPrice: netPrice,
                quantity: item.quantity,
                account: accountId,
                billNumber: newBillNumber,
                isType: 'Sale',
                type: 'Sale',
                billId: newBill._id,
                purchaseSalesType: 'Sales',
                debit: finalAmount,
                credit: 0,
                paymentMode: paymentMode,
                balance: previousBalance - finalAmount,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });
            await transaction.save({ session });
            transactions.push(transaction);
        }

        // Flatten bill items
        const flattenedBillItems = billItems.flat();

        // Create sales account transaction
        const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
        if (salesAmount > 0) {
            const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
            if (salesAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        error: 'Party account not found.'
                    });
                }
                const salesTransaction = new Transaction({
                    account: salesAccount._id,
                    billNumber: newBillNumber,
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: 0,
                    credit: salesAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + salesAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await salesTransaction.save({ session });
            }
        }

        // Create VAT transaction
        if (vatAmount > 0) {
            const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
            if (vatAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        error: 'Party account not found.'
                    });
                }
                const vatTransaction = new Transaction({
                    account: vatAccount._id,
                    billNumber: newBillNumber,
                    isType: 'VAT',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: 0,
                    credit: vatAmount,
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

        // Create round-off transactions
        if (roundOffAmount > 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        error: 'Party account not found.'
                    });
                }
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: newBillNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: 0,
                    credit: roundOffAmount,
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

        if (roundOffAmount < 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        error: 'Party account not found.'
                    });
                }
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: newBillNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: Math.abs(roundOffAmount),
                    credit: 0,
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

        // Cash payment handling
        if (paymentMode === 'cash') {
            const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
            if (cashAccount) {
                const cashTransaction = new Transaction({
                    account: cashAccount._id,
                    billNumber: newBillNumber,
                    isType: 'Sale',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: 'Sales',
                    debit: finalAmount,
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: previousBalance + finalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await cashTransaction.save({ session });
            }
        }

        // Update bill with items
        newBill.items = flattenedBillItems;
        await newBill.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response
        const response = {
            success: true,
            message: 'Bill created successfully',
            bill: {
                _id: newBill._id,
                billNumber: newBill.billNumber,
                account: newBill.account,
                totalAmount: newBill.totalAmount,
                date: newBill.date,
                transactionDate: newBill.transactionDate,
                items: newBill.items.map(item => ({
                    item: item.item,
                    quantity: item.quantity,
                    price: item.price,
                    batchNumber: item.batchNumber
                })),
                vatAmount: newBill.vatAmount,
                discountAmount: newBill.discountAmount,
                roundOffAmount: newBill.roundOffAmount,
                paymentMode: newBill.paymentMode
            },
            printUrl: `/bills/${newBill._id}/direct-print`
        };

        if (req.query.print === 'true') {
            response.redirect = `/bills/${newBill._id}/direct-print`;
            return res.json(response);
        }

        return res.json(response);

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error while creating sales bill:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while processing the bill.',
            details: error.message
        });
    }
});


router.get('/credit-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const companyId = req.session.currentCompany;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company not selected'
            });
        }

        // Fetch all required data in parallel for better performance
        const [
            company,
            bills,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            companyGroups
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesBill.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({ company: companyId, fiscalYear: req.session.currentFiscalYear?.id })
                .populate('category')
                .populate('unit')
                .populate({
                    path: 'stockEntries',
                    match: { quantity: { $gt: 0 } },
                    select: 'batchNumber expiryDate quantity puPrice date price marginPercentage mrp netPuPrice',
                }),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'sales'
            }),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId }),
            CompanyGroup.find({ company: companyId })
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

        // Process items with stock information
        const itemsWithStock = items.map(item => {
            const totalStock = item.stockEntries.reduce((sum, entry) => {
                return sum + (entry.quantity || 0);
            }, 0);

            // Sort stock entries by date in descending order (newest first)
            const sortedStockEntries = [...item.stockEntries].sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });

            // Get the latest stock entry (first item after sorting)
            const latestStockEntry = sortedStockEntries[0] || null;

            // Get the latest puPrice (rounded to 2 decimal places)
            const puPrice = latestStockEntry?.puPrice
                ? Math.round(latestStockEntry.puPrice * 100) / 100
                : item.puPrice
                    ? Math.round(item.puPrice * 100) / 100
                    : 0;

            return {
                ...item.toObject(),
                stock: totalStock,
                latestPuPrice: puPrice,
                latestStockEntry: latestStockEntry,
                stockEntries: sortedStockEntries // Include all sorted stock entries
            };
        });

        // Calculate next bill number
        const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
        const prefix = fiscalYears.billPrefixes.sales;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

        // Fetch only the required company groups: Sundry Debtors
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
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat || 'english',
                    vatEnabled: company.vatEnabled,
                    fiscalYear: company.fiscalYear
                },
                items: itemsWithStock,
                accounts: accounts.map(account => ({
                    _id: account._id,
                    name: account.name,
                    uniqueNumber: account.uniqueNumber,
                    address: account.address,
                    pan: account.pan,
                    companyGroups: account.companyGroups
                })),
                salesBills: bills.map(bill => ({
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
                nextBillNumber,
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
                    name: unit.name,
                    shortName: unit.shortName
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
        console.error('Error in /credit-sales/open route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.post('/credit-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({ error: 'Access denied for this trade type' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            accountId,
            items,
            vatPercentage,
            transactionDateRoman,
            transactionDateNepali,
            billDate,
            nepaliDate,
            isVatExempt,
            discountPercentage,
            paymentMode,
            roundOffAmount: manualRoundOffAmount,
        } = req.body;
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation checks
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Company ID is required.' });
        }
        if (!isVatExempt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid VAT selection.' });
        }
        if (!paymentMode) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid payment mode.' });
        }

        const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
        const isVatAll = isVatExempt === 'all';
        const discount = parseFloat(discountPercentage) || 0;

        let subTotal = 0;
        let vatAmount = 0;
        let totalTaxableAmount = 0;
        let totalNonTaxableAmount = 0;
        let hasVatableItems = false;
        let hasNonVatableItems = false;

        // Validate account
        const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
        if (!accounts) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid account for this company' });
        }

        // Validate items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ error: `Item with id ${item.item} not found` });
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

            // Validate batch entry
            const batchEntry = product.stockEntries.find(entry => entry.batchNumber === item.batchNumber && entry.uniqueUuId === item.uniqueUuId);
            if (!batchEntry) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: `Batch number ${item.batchNumber} not found for item: ${product.name}` });
            }

            // Check stock quantity
            if (batchEntry.quantity < item.quantity) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    error: `Not enough stock for item: ${product.name}`,
                    details: {
                        available: batchEntry.quantity,
                        required: item.quantity
                    }
                });
            }
        }

        // VAT validation
        if (isVatExempt !== 'all') {
            if (isVatExemptBool && hasVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: 'Cannot save VAT exempt bill with vatable items' });
            }

            if (!isVatExemptBool && hasNonVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ error: 'Cannot save bill with non-vatable items when VAT is applied' });
            }
        }

        const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

        // Calculate amounts
        const discountForTaxable = (totalTaxableAmount * discount) / 100;
        const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

        const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
        const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

        if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
            vatAmount = (finalTaxableAmount * vatPercentage) / 100;
        } else {
            vatAmount = 0;
        }

        let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
        let finalAmount = totalAmount;

        // Handle round off
        let roundOffForSales = await Settings.findOne({
            company: companyId, userId, fiscalYear: currentFiscalYear
        }).session(session);

        if (!roundOffForSales) {
            roundOffForSales = { roundOffSales: false };
        }

        let roundOffAmount = 0;
        if (roundOffForSales.roundOffSales) {
            finalAmount = Math.round(finalAmount.toFixed(2));
            roundOffAmount = finalAmount - totalAmount;
        } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
            roundOffAmount = parseFloat(manualRoundOffAmount);
            finalAmount = totalAmount + roundOffAmount;
        }

        // Create new bill
        const newBill = new SalesBill({
            billNumber: billNumber,
            account: accountId,
            purchaseSalesType: 'Sales',
            items: [],
            isVatExempt: isVatExemptBool,
            isVatAll,
            vatPercentage: isVatExemptBool ? 0 : vatPercentage,
            subTotal,
            discountPercentage: discount,
            discountAmount: discountForTaxable + discountForNonTaxable,
            nonVatSales: finalNonTaxableAmount,
            taxableAmount: finalTaxableAmount,
            vatAmount,
            totalAmount: finalAmount,
            roundOffAmount: roundOffAmount,
            paymentMode,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear
        });

        // Stock reduction function
        async function reduceStockBatchWise(product, batchNumber, quantity, uniqueUuId) {
            let remainingQuantity = quantity;
            const batchEntries = product.stockEntries.filter(entry =>
                entry.batchNumber === batchNumber &&
                entry.uniqueUuId === uniqueUuId
            );

            if (batchEntries.length === 0) {
                throw new Error(`Batch number ${batchNumber} with ID ${uniqueUuId} not found for product: ${product.name}`);
            }

            const selectedBatchEntry = batchEntries[0];
            if (selectedBatchEntry.quantity <= remainingQuantity) {
                remainingQuantity -= selectedBatchEntry.quantity;
                selectedBatchEntry.quantity = 0;
                product.stockEntries = product.stockEntries.filter(entry =>
                    !(entry.batchNumber === batchNumber &&
                        entry.uniqueUuId === uniqueUuId &&
                        entry.quantity === 0)
                );
            } else {
                selectedBatchEntry.quantity -= remainingQuantity;
                remainingQuantity = 0;
            }

            if (remainingQuantity > 0) {
                throw new Error(`Not enough stock in the selected stock entry for batch number ${batchNumber} of product: ${product.name}`);
            }

            product.stock = product.stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);
            await product.save({ session });
        }

        // Process items
        const billItems = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ error: `Item with id ${item.item} not found` });
            }

            const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
            const itemDiscountPercentage = discount;
            const itemDiscountAmount = (itemTotal * discount) / 100;
            const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

            await reduceStockBatchWise(product, item.batchNumber, item.quantity, item.uniqueUuId);
            product.stock -= item.quantity;
            await product.save({ session });

            billItems.push({
                item: product._id,
                quantity: item.quantity,
                price: item.price,
                netPrice: netPrice,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: itemDiscountPercentage,
                discountAmountPerItem: itemDiscountAmount,
                unit: item.unit,
                batchNumber: item.batchNumber,
                expiryDate: item.expiryDate,
                vatStatus: product.vatStatus,
                fiscalYear: fiscalYearId,
                uniqueUuId: item.uniqueUuId,
            });
        }

        // Create transactions
        let previousBalance = 0;
        const accountTransaction = await Transaction.findOne({ account: accountId }).sort({ transactionDate: -1 }).session(session);
        if (accountTransaction) {
            previousBalance = accountTransaction.balance;
        }

        const correctTotalAmount = newBill.totalAmount;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);
            const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
            const itemDiscountPercentage = discount;
            const itemDiscountAmount = (itemTotal * discount) / 100;
            const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

            const transaction = new Transaction({
                item: product,
                account: accountId,
                billNumber: billNumber,
                quantity: items.reduce((sum, item) => sum + item.quantity, 0),
                price: items[0].price,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: itemDiscountPercentage,
                discountAmountPerItem: itemDiscountAmount,
                netPrice: netPrice,
                unit: items[0].unit,
                isType: 'Sale',
                type: 'Sale',
                billId: newBill._id,
                purchaseSalesType: 'Sales',
                debit: correctTotalAmount,
                credit: 0,
                paymentMode: paymentMode,
                balance: previousBalance - correctTotalAmount,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });

            await transaction.save({ session });
        }

        // Sales account transaction
        const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
        if (salesAmount > 0) {
            const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
            if (salesAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ error: 'Party account not found.' });
                }
                const salesTransaction = new Transaction({
                    account: salesAccount._id,
                    billNumber: billNumber,
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: 0,
                    credit: salesAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + salesAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await salesTransaction.save({ session });
            }
        }

        // VAT transaction
        if (vatAmount > 0) {
            const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
            if (vatAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ error: 'Party account not found.' });
                }
                const vatTransaction = new Transaction({
                    account: vatAccount._id,
                    billNumber: billNumber,
                    isType: 'VAT',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: 0,
                    credit: vatAmount,
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

        // Round-off transactions
        if (roundOffAmount > 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ error: 'Party account not found.' });
                }
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: billNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: 0,
                    credit: roundOffAmount,
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

        if (roundOffAmount < 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ error: 'Party account not found.' });
                }
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: billNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: partyAccount.name,
                    debit: Math.abs(roundOffAmount),
                    credit: 0,
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

        // Cash payment transaction
        if (paymentMode === 'cash') {
            const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
            if (cashAccount) {
                const cashTransaction = new Transaction({
                    account: cashAccount._id,
                    billNumber: billNumber,
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: 'Sales',
                    debit: finalAmount,
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: previousBalance + finalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await cashTransaction.save({ session });
            }
        }

        // Update bill with items
        newBill.items = billItems;
        await newBill.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Bill created successfully',
            bill: {
                _id: newBill._id,
                billNumber: newBill.billNumber,
                account: newBill.account,
                totalAmount: newBill.totalAmount,
                date: newBill.date,
                transactionDate: newBill.transactionDate
            },
            printUrl: req.query.print === 'true' ? `/bills/${newBill._id}/direct-print/credit-open` : null
        });

    } catch (error) {
        console.error("Error creating bill:", error);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
            error: 'Error creating bill',
            details: error.message
        });
    }
});


router.get('/cash-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const companyId = req.session.currentCompany;

        // Fetch all required data in parallel for better performance
        const [
            company,
            bills,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            companyGroups,
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesBill.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id
            })
                .populate('category')
                .populate('unit')
                .populate({
                    path: 'stockEntries',
                    match: { quantity: { $gt: 0 } },
                    select: 'batchNumber expiryDate quantity puPrice date',
                }),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'sales'
            }),
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

        // Process items with stock information
        const itemsWithStock = items.map(item => {
            const totalStock = item.stockEntries.reduce((sum, entry) => {
                return sum + (entry.quantity || 0);
            }, 0);

            // Sort stock entries by date in descending order (newest first)
            const sortedStockEntries = [...item.stockEntries].sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });

            // Get the latest stock entry (first item after sorting)
            const latestStockEntry = sortedStockEntries[0] || null;

            // Get the latest puPrice (rounded to 2 decimal places)
            const puPrice = latestStockEntry?.puPrice
                ? Math.round(latestStockEntry.puPrice * 100) / 100
                : item.puPrice
                    ? Math.round(item.puPrice * 100) / 100
                    : 0;

            return {
                ...item.toObject(),
                stock: totalStock,
                latestPuPrice: puPrice,
                latestStockEntry: latestStockEntry
            };
        });

        // Calculate next bill number
        const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
        const prefix = fiscalYears.billPrefixes.sales;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

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

        // Prepare response data
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
                items: itemsWithStock,
                accounts: combinedAccounts,
                salesBills: bills.map(bill => ({
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
                nextSalesBillNumber: nextBillNumber,
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
        console.error('Error in /cash/bills/add route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.post('/cash-sales', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden for this trade type'
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            cashAccount,
            cashAccountAddress,
            cashAccountPan,
            cashAccountEmail,
            cashAccountPhone,
            items,
            vatPercentage,
            transactionDateRoman,
            transactionDateNepali,
            billDate,
            nepaliDate,
            isVatExempt,
            discountPercentage,
            paymentMode,
            roundOffAmount: manualRoundOffAmount
        } = req.body;

        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        // Validation checks
        if (!companyId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Company ID is required.'
            });
        }

        if (!isVatExempt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid vat selection.'
            });
        }

        if (!paymentMode) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid payment mode.'
            });
        }

        const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
        const isVatAll = isVatExempt === 'all';
        const discount = parseFloat(discountPercentage) || 0;

        let subTotal = 0;
        let vatAmount = 0;
        let totalTaxableAmount = 0;
        let totalNonTaxableAmount = 0;
        let hasVatableItems = false;
        let hasNonVatableItems = false;

        // Validate cash account
        if (!cashAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: 'Invalid account for this company'
            });
        }

        // Validate items and calculate amounts
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    error: `Item with id ${item.item} not found`
                });
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

            // Check stock quantity
            const availableStock = product.stockEntries.reduce((acc, entry) => acc + entry.quantity, 0);
            if (availableStock < item.quantity) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: `Not enough stock for item: ${product.name}. Available: ${availableStock}, Required: ${item.quantity}`
                });
            }
        }

        // VAT validation
        if (isVatExempt !== 'all') {
            if (isVatExemptBool && hasVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot save VAT exempt bill with vatable items'
                });
            }

            if (!isVatExemptBool && hasNonVatableItems) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot save bill with non-vatable items when VAT is applied'
                });
            }
        }

        // Calculate amounts
        const discountForTaxable = (totalTaxableAmount * discount) / 100;
        const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

        const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
        const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

        if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
            vatAmount = (finalTaxableAmount * vatPercentage) / 100;
        } else {
            vatAmount = 0;
        }

        let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
        let finalAmount = totalAmount;

        // Round off handling
        let roundOffForSales = await Settings.findOne({
            company: companyId,
            userId,
            fiscalYear: currentFiscalYear
        }).session(session);

        if (!roundOffForSales) {
            roundOffForSales = { roundOffSales: false };
        }

        let roundOffAmount = 0;
        if (roundOffForSales.roundOffSales) {
            finalAmount = Math.round(finalAmount.toFixed(2));
            roundOffAmount = finalAmount - totalAmount;
        } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
            roundOffAmount = parseFloat(manualRoundOffAmount);
            finalAmount = totalAmount + roundOffAmount;
        }

        // Create bill number
        const newBillNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

        // Create new bill
        const newBill = new SalesBill({
            billNumber: newBillNumber,
            cashAccount: cashAccount,
            cashAccountAddress,
            cashAccountPan,
            cashAccountEmail,
            cashAccountPhone,
            purchaseSalesType: 'Sales',
            items: [],
            isVatExempt: isVatExemptBool,
            isVatAll,
            vatPercentage: isVatExemptBool ? 0 : vatPercentage,
            subTotal,
            discountPercentage: discount,
            discountAmount: discountForTaxable + discountForNonTaxable,
            nonVatSales: finalNonTaxableAmount,
            taxableAmount: finalTaxableAmount,
            vatAmount,
            totalAmount: finalAmount,
            roundOffAmount: roundOffAmount,
            paymentMode,
            date: nepaliDate ? nepaliDate : new Date(billDate),
            transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
            company: companyId,
            user: userId,
            fiscalYear: currentFiscalYear
        });

        // Get previous balance
        let previousBalance = 0;
        const accountTransaction = await Transaction.findOne({ cashAccount: cashAccount }).sort({ transactionDate: -1 }).session(session);
        if (accountTransaction) {
            previousBalance = accountTransaction.balance;
        }

        // Group items by (product, batchNumber)
        const groupedItems = {};
        for (const item of items) {
            const key = `${item.item}-${item.batchNumber || 'N/A'}`;
            if (!groupedItems[key]) {
                groupedItems[key] = { ...item, quantity: 0 };
            }
            groupedItems[key].quantity += Number(item.quantity);
        }

        // Stock reduction function
        async function reduceStock(product, quantity) {
            product.stock -= quantity;
            let remainingQuantity = quantity;
            const batchesUsed = [];

            product.stockEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

            for (let i = 0; i < product.stockEntries.length && remainingQuantity > 0; i++) {
                let entry = product.stockEntries[i];
                const quantityUsed = Math.min(entry.quantity, remainingQuantity);
                batchesUsed.push({
                    batchNumber: entry.batchNumber,
                    quantity: quantityUsed,
                    uniqueUuId: entry.uniqueUuId,
                });

                remainingQuantity -= quantityUsed;
                entry.quantity -= quantityUsed;
            }

            product.stockEntries = product.stockEntries.filter(entry => entry.quantity > 0);
            await product.save({ session });

            if (remainingQuantity > 0) {
                throw new Error(`Not enough stock for item: ${product.name}. Required: ${quantity}, Available: ${quantity - remainingQuantity}`);
            }

            return batchesUsed;
        }

        // Process stock reduction
        const billItems = [];
        const transactions = [];

        for (const item of Object.values(groupedItems)) {
            const product = await Item.findById(item.item).session(session);
            const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
            const itemDiscountPercentage = discount;
            const itemDiscountAmount = (itemTotal * discount) / 100;
            const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

            const batchesUsed = await reduceStock(product, item.quantity);

            const itemsForBill = batchesUsed.map(batch => ({
                item: product._id,
                quantity: batch.quantity,
                price: item.price,
                netPrice: netPrice,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: itemDiscountPercentage,
                discountAmountPerItem: itemDiscountAmount,
                unit: item.unit,
                batchNumber: batch.batchNumber,
                expiryDate: item.expiryDate,
                vatStatus: product.vatStatus,
                fiscalYear: fiscalYearId,
                uniqueUuId: batch.uniqueUuId
            }));

            billItems.push(...itemsForBill);
        }

        // Create transactions for items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await Item.findById(item.item).session(session);
            const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
            const itemDiscountPercentage = discount;
            const itemDiscountAmount = (itemTotal * discount) / 100;
            const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

            const transaction = new Transaction({
                item: product,
                unit: item.unit,
                WSUnit: item.WSUnit,
                price: item.price,
                puPrice: item.puPrice,
                netPuPrice: item.netPuPrice,
                discountPercentagePerItem: itemDiscountPercentage,
                discountAmountPerItem: itemDiscountAmount,
                netPrice: netPrice,
                quantity: item.quantity,
                cashAccount: cashAccount,
                billNumber: newBillNumber,
                isType: 'Sale',
                type: 'Sale',
                billId: newBill._id,
                purchaseSalesType: 'Sales',
                debit: finalAmount,
                credit: 0,
                paymentMode: paymentMode,
                balance: previousBalance - finalAmount,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });
            await transaction.save({ session });
            transactions.push(transaction);
        }

        // Flatten bill items
        const flattenedBillItems = billItems.flat();

        // Create sales account transaction
        const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
        if (salesAmount > 0) {
            const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
            if (salesAccount) {
                const salesTransaction = new Transaction({
                    account: salesAccount._id,
                    billNumber: newBillNumber,
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: cashAccount,
                    debit: 0,
                    credit: salesAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + salesAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await salesTransaction.save({ session });
            }
        }

        // Create VAT transaction
        if (vatAmount > 0) {
            const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
            if (vatAccount) {
                const vatTransaction = new Transaction({
                    account: vatAccount._id,
                    billNumber: newBillNumber,
                    isType: 'VAT',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: cashAccount,
                    debit: 0,
                    credit: vatAmount,
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

        // Create round-off transactions
        if (roundOffAmount > 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: newBillNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: cashAccount,
                    debit: 0,
                    credit: roundOffAmount,
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

        if (roundOffAmount < 0) {
            const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
            if (roundOffAccount) {
                const roundOffTransaction = new Transaction({
                    account: roundOffAccount._id,
                    billNumber: newBillNumber,
                    isType: 'RoundOff',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: cashAccount,
                    debit: Math.abs(roundOffAmount),
                    credit: 0,
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

        // Cash payment handling
        if (paymentMode === 'cash') {
            const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
            if (cashAccount) {
                const cashTransaction = new Transaction({
                    account: cashAccount._id,
                    cashAccount: cashAccount,
                    billNumber: newBillNumber,
                    isType: 'Sale',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: 'Sales',
                    debit: finalAmount,
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: previousBalance + finalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await cashTransaction.save({ session });
            }
        }

        // Update bill with items
        newBill.items = flattenedBillItems;
        await newBill.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Prepare response
        const response = {
            success: true,
            message: 'Cash bill created successfully',
            bill: {
                _id: newBill._id,
                billNumber: newBill.billNumber,
                cashAccount: newBill.cashAccount,
                totalAmount: newBill.totalAmount,
                date: newBill.date,
                transactionDate: newBill.transactionDate,
                items: newBill.items.map(item => ({
                    item: item.item,
                    quantity: item.quantity,
                    price: item.price,
                    batchNumber: item.batchNumber
                })),
                vatAmount: newBill.vatAmount,
                discountAmount: newBill.discountAmount,
                roundOffAmount: newBill.roundOffAmount,
                paymentMode: newBill.paymentMode
            },
            printUrl: `/bills/${newBill._id}/cash/direct-print`
        };

        if (req.query.print === 'true') {
            response.redirect = `/bills/${newBill._id}/cash/direct-print`;
            return res.json(response);
        }

        return res.json(response);

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error while creating cash sales bill:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while processing the bill.',
            details: error.message
        });
    }
});


router.get('/cash-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden for this trade type'
            });
        }

        const companyId = req.session.currentCompany;

        // Fetch all required data in parallel for better performance
        const [
            company,
            bills,
            items,
            lastCounter,
            fiscalYears,
            categories,
            units,
            companyGroups,
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            SalesBill.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            Item.find({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id
            })
                .populate('category')
                .populate('unit')
                .populate({
                    path: 'stockEntries',
                    match: { quantity: { $gt: 0 } },
                    select: 'batchNumber expiryDate quantity puPrice date',
                }),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'sales'
            }),
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

        // Process items with stock information
        const itemsWithStock = items.map(item => {
            const totalStock = item.stockEntries.reduce((sum, entry) => {
                return sum + (entry.quantity || 0);
            }, 0);

            // Sort stock entries by date in descending order (newest first)
            const sortedStockEntries = [...item.stockEntries].sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });

            // Get the latest stock entry (first item after sorting)
            const latestStockEntry = sortedStockEntries[0] || null;

            // Get the latest puPrice (rounded to 2 decimal places)
            const puPrice = latestStockEntry?.puPrice
                ? Math.round(latestStockEntry.puPrice * 100) / 100
                : item.puPrice
                    ? Math.round(item.puPrice * 100) / 100
                    : 0;

            return {
                ...item.toObject(),
                stock: totalStock,
                latestPuPrice: puPrice,
                latestStockEntry: latestStockEntry
            };
        });

        // Calculate next bill number
        const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
        const prefix = fiscalYears.billPrefixes.sales;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

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


        // Prepare response data
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
                items: itemsWithStock,
                accounts: combinedAccounts,
                salesBills: bills.map(bill => ({
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
                nextSalesBillNumber: nextBillNumber,
                dates: {
                    nepaliDate,
                    transactionDateNepali,
                    companyDateFormat
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
                },
                currentCompanyName: req.session.currentCompanyName
            }
        };

        return res.json(responseData);

    } catch (error) {
        console.error('Error in /cash/bills/addOpen route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// POST route to handle sales bill creation
router.post('/cash-sales/open', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const {
                cashAccount,
                cashAccountAddress,
                cashAccountPan,
                cashAccountEmail,
                cashAccountPhone,
                items,
                vatPercentage,
                transactionDateRoman,
                transactionDateNepali,
                billDate,
                nepaliDate,
                isVatExempt,
                discountPercentage,
                paymentMode,
                roundOffAmount: manualRoundOffAmount,
            } = req.body;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            const userId = req.user._id;

            console.log('Request Body:', req.body);

            if (!companyId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Company ID is required.' });
            }
            if (!isVatExempt) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Invalid vat selection.' });
            }
            if (!paymentMode) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Invalid payment mode.' });
            }

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let vatAmount = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            if (!cashAccount) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Invalid account for this company' });
            }

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, message: `Item with id ${item.item} not found` });
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

                // Find the specific batch entry
                const batchEntry = product.stockEntries.find(entry => entry.batchNumber === item.batchNumber && entry.uniqueUuId === item.uniqueUuId);
                if (!batchEntry) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, message: `Batch number ${item.batchNumber} not found for item: ${product.name}` });
                }

                // Check stock quantity using FIFO
                if (batchEntry.quantity < item.quantity) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        message: `Not enough stock for item: ${product.name}`,
                        data: {
                            available: batchEntry.quantity,
                            required: item.quantity
                        }
                    });
                }
            }

            // Check validation conditions after processing all items
            if (isVatExempt !== 'all') {
                if (isVatExemptBool && hasVatableItems) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, message: 'Cannot save VAT exempt bill with vatable items' });
                }

                if (!isVatExemptBool && hasNonVatableItems) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, message: 'Cannot save bill with non-vatable items when VAT is applied' });
                }
            }

            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'sales', session);

            // Apply discount proportionally to vatable and non-vatable items
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;

            // Calculate VAT only for vatable items
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            } else {
                vatAmount = 0;
            }

            let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            // Check if round off is enabled in settings
            let roundOffForSales = await Settings.findOne({
                company: companyId, userId, fiscalYear: currentFiscalYear
            }).session(session);

            // Handle case where settings is null
            if (!roundOffForSales) {
                console.log('No settings found, using default settings or handling as required');
                roundOffForSales = { roundOffSales: false };
            }
            let roundOffAmount = 0;
            if (roundOffForSales.roundOffSales) {
                finalAmount = Math.round(finalAmount.toFixed(2)); // Round off final amount
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForSales.roundOffSales) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Create new bill
            const newBill = new SalesBill({
                billNumber: billNumber,
                cashAccount: cashAccount,
                cashAccountAddress,
                cashAccountPan,
                cashAccountEmail,
                cashAccountPhone,
                purchaseSalesType: 'Sales',
                items: [], // We'll update this later
                isVatExempt: isVatExemptBool,
                isVatAll,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatSales: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                vatAmount,
                totalAmount: finalAmount,
                roundOffAmount: roundOffAmount,
                paymentMode,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                transactionDate: transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear
            });

            // Create transactions
            let previousBalance = 0;
            const accountTransaction = await Transaction.findOne({ cashAccount: cashAccount }).sort({ transactionDate: -1 }).session(session);
            if (accountTransaction) {
                previousBalance = accountTransaction.balance;
            }

            async function reduceStockBatchWise(product, batchNumber, quantity, uniqueUuId) {
                let remainingQuantity = quantity;

                // Find all batch entries with the specific batch number
                const batchEntries = product.stockEntries.filter(entry =>
                    entry.batchNumber === batchNumber &&
                    entry.uniqueUuId === uniqueUuId
                );

                if (batchEntries.length === 0) {
                    throw new Error(`Batch number ${batchNumber} with ID ${uniqueUuId} not found for product: ${product.name}`);
                }

                // Find the specific stock entry
                const selectedBatchEntry = batchEntries[0];

                // Reduce stock for the selected batch entry
                if (selectedBatchEntry.quantity <= remainingQuantity) {
                    remainingQuantity -= selectedBatchEntry.quantity;
                    selectedBatchEntry.quantity = 0;

                    // Remove the entry from stockEntries array if quantity is 0
                    product.stockEntries = product.stockEntries.filter(entry =>
                        !(entry.batchNumber === batchNumber &&
                            entry.uniqueUuId === uniqueUuId &&
                            entry.quantity === 0)
                    );
                } else {
                    selectedBatchEntry.quantity -= remainingQuantity;
                    remainingQuantity = 0;
                }

                if (remainingQuantity > 0) {
                    throw new Error(`Not enough stock in the selected stock entry for batch number ${batchNumber} of product: ${product.name}`);
                }

                // Recalculate total stock
                product.stock = product.stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);

                // Save the product with the updated stock entries
                await product.save({ session });
            }

            // Process all items first to reduce stock and build bill items
            const billItems = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                // Calculate item's share of the discount
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const itemDiscountPercentage = discount; // Same percentage for all items
                const itemDiscountAmount = (itemTotal * discount) / 100;
                const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                // Reduce stock for the specific batch
                await reduceStockBatchWise(product, item.batchNumber, item.quantity, item.uniqueUuId);

                // Update product stock
                product.stock -= item.quantity;
                await product.save({ session });

                billItems.push({
                    item: product._id,
                    quantity: item.quantity,
                    price: item.price,
                    netPrice: netPrice,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice,
                    discountPercentagePerItem: itemDiscountPercentage,
                    discountAmountPerItem: itemDiscountAmount,
                    unit: item.unit,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    vatStatus: product.vatStatus,
                    fiscalYear: fiscalYearId,
                    uniqueUuId: item.uniqueUuId,
                });
            }

            // Calculate the correct total amount from the bill (not from items)
            const correctTotalAmount = newBill.totalAmount; // This should be 14125 in your example

            // Validate each item before processing
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);
                // Calculate item's share of the discount
                const itemTotal = parseFloat(item.price) * parseFloat(item.quantity);
                const itemDiscountPercentage = discount; // Same percentage for all items
                const itemDiscountAmount = (itemTotal * discount) / 100;
                const netPrice = parseFloat(item.price) - (parseFloat(item.price) * discount / 100);

                // Now create a single transaction for the entire bill
                const transaction = new Transaction({
                    item: product,
                    cashAccount: cashAccount,
                    billNumber: billNumber,
                    quantity: items.reduce((sum, item) => sum + item.quantity, 0), // Total quantity
                    price: items[0].price, // Assuming same price for all items
                    unit: items[0].unit, // Assuming same unit for all items
                    netPuPrice: item.netPuPrice,
                    discountPercentagePerItem: itemDiscountPercentage,
                    discountAmountPerItem: itemDiscountAmount,
                    netPrice: netPrice,
                    isType: 'Sale',
                    type: 'Sale',
                    billId: newBill._id,
                    purchaseSalesType: 'Sales',
                    debit: correctTotalAmount, // Use the bill's total amount directly
                    credit: 0,
                    paymentMode: paymentMode,
                    balance: previousBalance - correctTotalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });

                await transaction.save({ session });
                console.log('Transaction amount:', correctTotalAmount);
            }

            // Update bill with items
            newBill.items = billItems;
            await newBill.save({ session });

            // Create a transaction for the default Sales Account
            const salesAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (salesAmount > 0) {
                const salesAccount = await Account.findOne({ name: 'Sales', company: companyId }).session(session);
                if (salesAccount) {
                    const salesTransaction = new Transaction({
                        account: salesAccount._id,
                        billNumber: billNumber,
                        type: 'Sale',
                        billId: newBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: salesAmount,// Credit is 0 for VAT transactions
                        paymentMode: paymentMode,
                        balance: previousBalance + salesAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await salesTransaction.save({ session });
                    console.log('Sales Transaction: ', salesTransaction);
                }
            }

            // Create a transaction for the VAT amount
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId }).session(session);
                if (vatAccount) {
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: billNumber,
                        isType: 'VAT',
                        type: 'Sale',
                        billId: newBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: vatAmount,         // Credit is 0 for VAT transactions
                        paymentMode: paymentMode,
                        balance: previousBalance + vatAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save({ session });
                    console.log('Vat Transaction: ', vatTransaction);
                }
            }

            // Create a transaction for the round-off amount
            if (roundOffAmount > 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        isType: 'RoundOff',
                        type: 'Sale',
                        billId: newBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: 0,  // Debit the VAT account
                        credit: roundOffAmount,         // Credit is 0 for VAT transactions
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                    console.log('Round-off Transaction: ', roundOffTransaction);
                }
            }

            if (roundOffAmount < 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId }).session(session);
                if (roundOffAccount) {
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        isType: 'RoundOff',
                        type: 'Sale',
                        billId: newBill._id,
                        purchaseSalesType: cashAccount,  // Save the party account name in purchaseSalesType,
                        debit: Math.abs(roundOffAmount),  // Debit the VAT account
                        credit: 0, // Ensure roundOffAmount is not saved as a negative value
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save({ session });
                    console.log('Round-off Transaction: ', roundOffTransaction);
                }
            }

            // If payment mode is cash, also create a transaction for the "Cash in Hand" account
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId }).session(session);
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        cashAccount: cashAccount,
                        billNumber: billNumber,
                        isType: 'Sale',
                        type: 'Sale',
                        billId: newBill._id,  // Set billId to the new bill's ID
                        purchaseSalesType: 'Sales',
                        debit: finalAmount,  // Debit is 0 for cash-in-hand as we're receiving cash
                        credit: 0,  // Credit is the total amount since we're receiving cash
                        paymentMode: paymentMode,
                        balance: previousBalance + finalAmount, // Update the balance
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await cashTransaction.save({ session });
                }
            }

            // Update bill with items
            newBill.items = billItems;
            await newBill.save({ session });

            // If everything goes smoothly, commit the transaction
            await session.commitTransaction();
            session.endSession();

            if (req.query.print === 'true') {
                // Return print information
                return res.status(200).json({
                    success: true,
                    message: 'Bill created successfully',
                    data: {
                        billId: newBill._id,
                        printUrl: `/bills/${newBill._id}/direct-print/cash-open`
                    }
                });
            } else {
                // Return success response
                return res.status(200).json({
                    success: true,
                    message: 'Bill saved successfully!',
                    data: newBill
                });
            }
        } catch (error) {
            console.error("Error creating bill:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: 'Error creating bill',
                error: error.message
            });
        }
    }
});

router.get('/sales/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            const bill = await SalesBill.findById(billId)
                .populate({ path: 'account', select: 'name pan address email phone openingBalance' })
                .populate('items.item')
                .populate('user');

            if (!bill) {
                return res.status(404).json({
                    success: false,
                    error: 'Bill not found'
                });
            }

            // Populate unit for each item in the bill
            for (const item of bill.items) {
                await item.item.populate('unit');
            }

            const firstBill = !bill.firstPrinted;
            if (firstBill) {
                bill.firstPrinted = true;
                await bill.save();
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
                    firstBill,
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
            console.error("Error fetching bill for printing:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching bill for printing',
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

router.get('/sales-vat-report', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english';

        // Extract dates from query parameters
        let fromDate = req.query.fromDate ? req.query.fromDate : null;
        let toDate = req.query.toDate ? req.query.toDate : null;

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

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
                    salesVatReport: [],
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName,
                    user: req.user,
                    theme: req.user.preferences?.theme || 'light',
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

        const Bills = await SalesBill.find(query)
            .populate('account')
            .populate('cashAccount')
            .sort({ date: 1 });

        const salesVatReport = await Promise.all(Bills.map(async bill => {
            if (bill.account) {
                const account = await Account.findById(bill.account);
                return {
                    billNumber: bill.billNumber,
                    date: bill.date,
                    accountName: account ? account.name : 'N/A',
                    panNumber: account ? account.pan : 'N/A',
                    totalAmount: bill.totalAmount,
                    discountAmount: bill.discountAmount,
                    nonVatSales: bill.nonVatSales,
                    taxableAmount: bill.taxableAmount,
                    vatAmount: bill.vatAmount,
                    isCash: false
                };
            } else {
                return {
                    billNumber: bill.billNumber,
                    date: bill.date,
                    accountName: bill.cashAccount || 'Cash Sale',
                    panNumber: bill.cashAccountPan || 'N/A',
                    totalAmount: bill.totalAmount,
                    discountAmount: bill.discountAmount,
                    nonVatSales: bill.nonVatSales,
                    taxableAmount: bill.taxableAmount,
                    vatAmount: bill.vatAmount,
                    isCash: true
                };
            }
        }));

        res.json({
            success: true,
            data: {
                company,
                currentFiscalYear,
                salesVatReport,
                companyDateFormat,
                nepaliDate,
                currentCompany,
                fromDate: req.query.fromDate || '',
                toDate: req.query.toDate || '',
                currentCompanyName,
                user: req.user,
                theme: req.user.preferences?.theme || 'light',
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        });

    } catch (error) {
        console.error('Error in sales-vat-report:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});


router.get('/statement', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const currentCompany = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat address ward pan city country email phone').populate('fiscalYear');;
            const companyDateFormat = currentCompany ? currentCompany.dateFormat : 'english'; // Default to 'english'
            const selectedCompany = req.query.account || '';
            const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
            const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
            const paymentMode = req.query.paymentMode || 'all'; // New parameter for payment mode
            const currentCompanyName = req.session.currentCompanyName;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD'); // Format the Nepali date as needed

            // Retrieve the fiscal year from the session
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                // Fetch the fiscal year from the database if available in the session
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session, use the company's fiscal year
            if (!currentFiscalYear && currentCompany.fiscalYear) {
                currentFiscalYear = currentCompany.fiscalYear;
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

            // Fetch accounts that belong to the current fiscal year
            const accounts = await Account.find({
                company: companyId,
                isActive: true, // Filter for active accounts
                $or: [
                    { originalFiscalYear: fiscalYear }, // Created here
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                    }
                ]
            }).sort({ name: 1 });

            if (!selectedCompany) {
                return res.json({
                    status: 'success',
                    data: {
                        company: currentCompany,
                        currentFiscalYear,
                        statement: [],
                        accounts,
                        selectedCompany: null,
                        fromDate: '',
                        toDate: '',
                        paymentMode,
                        companyDateFormat,
                        nepaliDate,
                        currentCompanyName,
                        currentCompany,
                        user: {
                            preferences: req.user.preferences,
                            isAdmin: req.user.isAdmin,
                            role: req.user.role
                        }
                    }
                });
            }

            // Fetch the selected account based on the fiscal year and company
            const account = await Account.findOne({
                _id: selectedCompany,
                company: companyId,
                isActive: true, // Filter for active accounts
                $or: [
                    { originalFiscalYear: fiscalYear }, // Created here
                    {
                        fiscalYear: fiscalYear,
                        originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                    }
                ]
            }).populate('companyGroups', 'name')
                .sort({ name: 1 }).lean(); // Add population here

            console.log('Accounts query result:', accounts); // Verify this shows data

            if (!account) {
                return res.status(404).json({ error: 'Account not found for the current fiscal year' });
            }

            // Query to filter transactions based on the selected company and fiscal year
            let query = {
                company: companyId,
                isActive: true, // Ensure only active transactions
            };

            if (selectedCompany) {
                query.$or = [
                    { account: selectedCompany },
                    { paymentAccount: selectedCompany },
                    { receiptAccount: selectedCompany },
                    { debitAccount: selectedCompany },
                    { creditAccount: selectedCompany },
                ];
            }

            if (paymentMode === 'exclude-cash') {
                query.paymentMode = { $ne: 'cash' };
            } else if (paymentMode !== 'all') {
                query.paymentMode = paymentMode;
            }

            // Define groups that use transaction-based opening balance
            const transactionBasedGroups = [
                'Sundry Debtors',
                'Sundry Creditors',
                'Cash in Hand',
                'Bank Accounts',
                'Bank O/D Account',
                'Duties & Taxes'
            ];

            // Determine if account belongs to transaction-based group
            const isTransactionBased = account.companyGroups &&
                transactionBasedGroups.includes(account.companyGroups.name);

            let openingBalance = 0;

            if (isTransactionBased) {
                if (paymentMode !== 'cash') {
                    // Existing transaction-based calculation
                    const transactionsBeforeFromDate = await Transaction.find({
                        ...query,
                        date: { $lt: fromDate }
                    }).sort({ date: 1 });

                    openingBalance = account.initialOpeningBalance.type === 'Dr'
                        ? account.initialOpeningBalance.amount
                        : -account.initialOpeningBalance.amount;

                    transactionsBeforeFromDate.forEach(tx => {
                        openingBalance += (tx.debit || 0) - (tx.credit || 0);
                    });
                }
            } else {
                // For non-transaction groups, use fiscal year opening balance
                openingBalance = account.openingBalance.type === 'Dr'
                    ? account.openingBalance.amount
                    : -account.openingBalance.amount;
            }

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const filteredTransactions = await Transaction.find(query)
                .sort({ date: 1 })
                .populate('paymentAccount', 'name')
                .populate('receiptAccount', 'name')
                .populate('debitAccount', 'name')
                .populate('creditAccount', 'name')
                .populate('account', 'name')
                .populate('accountType', 'name')
                .lean();

            const cleanTransactions = filteredTransactions.map(tx => ({
                ...tx,
                paymentAccount: tx.paymentAccount ? { name: tx.paymentAccount.name } : null,
                receiptAccount: tx.receiptAccount ? { name: tx.receiptAccount.name } : null,
                debitAccount: tx.debitAccount ? { name: tx.debitAccount.name } : null,
                creditAccount: tx.creditAccount ? { name: tx.creditAccount.name } : null,
                account: tx.account ? { name: tx.account.name } : null,
                accountType: tx.accountType ? { name: tx.accountType.name } : 'Opening Balance'
            }));

            const { statement, totalDebit, totalCredit } = prepareStatementWithOpeningBalanceAndTotals(openingBalance, cleanTransactions, fromDate,
                paymentMode,
                isTransactionBased
            );

            const partyName = account.name;

            res.json({
                status: 'success',
                data: {
                    currentFiscalYear,
                    statement,
                    accounts,
                    partyName,
                    selectedCompany,
                    account,
                    fromDate: req.query.fromDate,
                    toDate: req.query.toDate,
                    paymentMode,
                    company: currentCompany,
                    totalDebit,
                    totalCredit,
                    finalBalance: openingBalance + totalDebit - totalCredit,
                    currentCompanyName,
                    companyDateFormat,
                    nepaliDate,
                    currentCompany,
                    user: {
                        preferences: req.user.preferences,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    }
                }
            });
        } catch (error) {
            console.error("Error fetching statement:", error);
            res.status(500).json({ error: 'Error fetching statement' });
        }
    }
});

// Function to calculate opening balance based on opening balance date
function calculateOpeningBalance(account, transactions, fromDate) {
    const openingBalanceDate = fromDate || account.openingBalanceDate || new Date('July 17, 2023'); // Use fromDate if available
    let openingBalance = account.openingBalance.type === 'Dr' ? account.openingBalance.amount : -account.openingBalance.amount;

    transactions.forEach(tx => {
        if (tx.date < openingBalanceDate) {
            openingBalance += (tx.debit || 0) - (tx.credit || 0);
        }
    });

    return openingBalance;
}

function prepareStatementWithOpeningBalanceAndTotals(openingBalance, transactions, fromDate, paymentMode, isTransactionBased) {
    let balance = openingBalance;
    let totalDebit = paymentMode !== 'cash' && openingBalance > 0 ? openingBalance : 0;
    let totalCredit = paymentMode !== 'cash' && openingBalance < 0 ? -openingBalance : 0;

    const statement = paymentMode !== 'cash' ? [
        {
            date: fromDate ? fromDate.toISOString().split('T')[0] : '',
            type: '',
            billNumber: '',
            paymentMode: '',
            paymentAccount: '',
            receiptAccount: '',
            debitAccount: '',
            creditAccount: '',
            accountType: 'Opening Balance',
            purchaseSalesType: '',
            purchaseSalesReturnType: '',
            journalAccountType: '',
            drCrNoteAccountType: '',
            account: '',
            debit: openingBalance > 0 ? openingBalance : null,
            credit: openingBalance < 0 ? -openingBalance : null,
            balance: formatBalance(openingBalance),
            billId: '' // Ensure billId is included
        }
    ] : [];

    const transactionsByBill = transactions.reduce((acc, tx) => {
        let billId = tx.billId || tx.purchaseBillId || tx.salesReturnBillId || tx.purchaseReturnBillId || tx.journalBillId || tx.debitNoteId || tx.creditNoteId || tx.paymentAccountId || tx.receiptAccountId;

        if (!acc[billId]) {
            acc[billId] = {
                date: tx.date,
                type: tx.type,
                billNumber: tx.billNumber,
                paymentMode: tx.paymentMode,
                partyBillNumber: tx.partyBillNumber,
                paymentAccount: tx.paymentAccount,
                receiptAccount: tx.receiptAccount,
                debitAccount: tx.debitAccount,
                creditAccount: tx.creditAccount,
                accountType: tx.accountType,
                purchaseSalesType: tx.purchaseSalesType,
                purchaseSalesReturnType: tx.purchaseSalesReturnType,
                journalAccountType: tx.journalAccountType,
                drCrNoteAccountType: tx.drCrNoteAccountType,
                account: tx.account,
                debit: 0,
                credit: 0,
                balance: 0,
                billId: tx.billId
            };
        }
        acc[billId].debit = tx.debit || 0;
        acc[billId].credit = tx.credit || 0;
        return acc;
    }, {});

    // Iterate over grouped transactions to prepare the final statement
    Object.values(transactionsByBill).forEach(tx => {
        balance += (tx.debit || 0) - (tx.credit || 0);
        totalDebit += tx.debit || 0;
        totalCredit += tx.credit || 0;
        statement.push({
            date: tx.date,
            type: tx.type,
            billNumber: tx.billNumber,
            paymentMode: tx.paymentMode,
            partyBillNumber: tx.partyBillNumber,
            paymentAccount: tx.paymentAccount,
            receiptAccount: tx.receiptAccount,
            debitAccount: tx.debitAccount,
            creditAccount: tx.creditAccount,
            accountType: tx.accountType,
            purchaseSalesType: tx.purchaseSalesType,
            purchaseSalesReturnType: tx.purchaseSalesReturnType,
            journalAccountType: tx.journalAccountType,
            drCrNoteAccountType: tx.drCrNoteAccountType,
            account: tx.account,
            debit: tx.debit,
            credit: tx.credit,
            balance: formatBalance(balance),
            billId: tx.billId,
        });
    });

    return { statement, totalDebit, totalCredit };
}

function formatBalance(amount) {
    return amount > 0 ? `${amount.toFixed(2)} Dr` : `${(-amount).toFixed(2)} Cr`;
}

module.exports = router;
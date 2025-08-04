const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Item = require('../../models/retailer/Item');
const PurchaseReturn = require('../../models/retailer/PurchaseReturns');
const Transaction = require('../../models/retailer/Transaction');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth');
// const BillCounter = require('../../models/retailer/purchaseReturnBillCounter');
const Account = require('../../models/retailer/Account');
const Settings = require('../../models/retailer/Settings');
const Company = require('../../models/Company');
const NepaliDate = require('nepali-date');
const { ensureTradeType } = require('../../middleware/tradeType');
const PurchaseBill = require('../../models/retailer/PurchaseBill');
const FiscalYear = require('../../models/FiscalYear');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const checkDemoPeriod = require('../../middleware/checkDemoPeriod');
const CompanyGroup = require('../../models/retailer/CompanyGroup');
const PurchaseReturns = require('../../models/retailer/PurchaseReturns');
const Category = require('../../models/retailer/Category');
const Unit = require('../../models/retailer/Unit');

router.get('/purchase-return', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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
            items,
            bills,
            purchaseInvoices,
            lastCounter,
            fiscalYears,
            categories,
            units,
            companyGroups
        ] = await Promise.all([
            Company.findById(companyId)
                .select('renewalDate fiscalYear dateFormat vatEnabled')
                .populate('fiscalYear'),
            Item.find({ company: companyId, fiscalYear: req.session.currentFiscalYear?.id })
                .populate('category')
                .populate('unit')
                .populate({
                    path: 'stockEntries',
                    match: { quantity: { $gt: 0 } },
                    select: 'batchNumber expiryDate quantity puPrice date price marginPercentage mrp netPuPrice',
                }),
            PurchaseReturn.find({ company: companyId })
                .populate('account')
                .populate('items.item'),
            PurchaseBill.find({ company: companyId }),
            BillCounter.findOne({
                company: companyId,
                fiscalYear: req.session.currentFiscalYear?.id,
                transactionType: 'purchaseReturn'
            }),
            FiscalYear.findById(req.session.currentFiscalYear?.id),
            Category.find({ company: companyId }),
            Unit.find({ company: companyId }),
            CompanyGroup.find({
                name: { $in: ['Cash in Hand', 'Sundry Debtors', 'Sundry Creditors'] }
            })
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

        // Convert relevant group IDs to an array of ObjectIds
        const relevantGroupIds = companyGroups.map(group => group._id);

        // Fetch accounts that belong only to the specified groups
        const accounts = await Account.find({
            company: companyId,
            fiscalYear: fiscalYear,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        }).exec();

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
        const prefix = fiscalYears.billPrefixes.purchaseReturn;
        const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

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
                purchaseReturns: bills.map(bill => ({
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
                purchaseInvoices: purchaseInvoices.map(invoice => ({
                    _id: invoice._id,
                    billNumber: invoice.billNumber,
                    account: invoice.account,
                    items: invoice.items,
                    grandTotal: invoice.grandTotal
                })),
                nextBillNumber,
                dates: {
                    nepaliDate,
                    transactionDateNepali
                },
                currentFiscalYear: currentFiscalYear ? {
                    _id: currentFiscalYear._id,
                    name: currentFiscalYear.name,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    isActive: currentFiscalYear.isActive
                } : null,
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
        console.error('Error in /purchase-return route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Fetch all purchase bills
router.get('/purchase-return/register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
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

            const bills = await PurchaseReturn.find(query)
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
                    currentCompanyName: currentCompanyName,
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
        console.error('Error fetching purchase returns:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

router.post('/purchase-return', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, checkDemoPeriod, async (req, res) => {
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
            partyBillNumber,
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

            const itemTotal = parseFloat(item.puPrice) * parseFloat(item.quantity, 10);
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
        const roundOffForPurchaseReturn = await Settings.findOne({ company: companyId, userId }).session(session);
        let roundOffAmount = 0;

        if (roundOffForPurchaseReturn?.roundOffPurchaseReturn) {
            finalAmount = Math.round(finalAmount.toFixed(2));
            roundOffAmount = finalAmount - totalAmount;
        } else if (manualRoundOffAmount && !roundOffForPurchaseReturn?.roundOffPurchaseReturn) {
            roundOffAmount = parseFloat(manualRoundOffAmount);
            finalAmount = totalAmount + roundOffAmount;
        }

        const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'purchaseReturn', session);

        // Create new bill
        const newBill = new PurchaseReturn({
            billNumber: billNumber,
            partyBillNumber: partyBillNumber,
            account: accountId,
            purchaseSalesReturnType: 'Purchase Return',
            items: [],
            isVatExempt: isVatExemptBool,
            isVatAll,
            vatPercentage: isVatExemptBool ? 0 : vatPercentage,
            subTotal,
            discountPercentage: discount,
            discountAmount: discountForTaxable + discountForNonTaxable,
            nonVatPurchaseReturn: finalNonTaxableAmount,
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

            await reduceStockBatchWise(product, item.batchNumber, item.quantity, item.uniqueUuId);
            product.stock -= item.quantity;
            await product.save({ session });

            billItems.push({
                item: product._id,
                quantity: item.quantity,
                price: item.price,
                puPrice: item.puPrice,
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

            const transaction = new Transaction({
                item: product,
                account: accountId,
                billNumber: billNumber,
                partyBillNumber: partyBillNumber,
                quantity: item.quantity,
                puPrice: item.puPrice,
                unit: item.unit,
                type: 'PrRt',
                purchaseReturnBillId: newBill._id,
                purchaseSalesReturnType: 'Purchase Return',
                debit: correctTotalAmount,
                credit: 0,
                paymentMode: paymentMode,
                balance: previousBalance - finalAmount,
                date: nepaliDate ? nepaliDate : new Date(billDate),
                company: companyId,
                user: userId,
                fiscalYear: currentFiscalYear,
            });

            await transaction.save({ session });
        }

        // Purchase Return Account transaction
        const purchaseRtnAmount = finalTaxableAmount + finalNonTaxableAmount;
        if (purchaseRtnAmount > 0) {
            const purchaseRtnAccount = await Account.findOne({ name: 'Purchase', company: companyId }).session(session);
            if (purchaseRtnAccount) {
                const partyAccount = await Account.findById(accountId).session(session);
                if (!partyAccount) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ error: 'Party account not found.' });
                }
                const purchaseRtnTransaction = new Transaction({
                    account: purchaseRtnAccount._id,
                    billNumber: billNumber,
                    partyBillNumber,
                    type: 'PrRt',
                    purchaseReturnBillId: newBill._id,
                    purchaseSalesReturnType: partyAccount.name,
                    debit: 0,
                    credit: purchaseRtnAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + purchaseRtnAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });
                await purchaseRtnTransaction.save({ session });
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
                    partyBillNumber,
                    isType: 'VAT',
                    type: 'PrRt',
                    purchaseReturnBillId: newBill._id,
                    purchaseSalesReturnType: partyAccount.name,
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
                    partyBillNumber,
                    isType: 'RoundOff',
                    type: 'PrRt',
                    purchaseReturnBillId: newBill._id,
                    purchaseSalesReturnType: partyAccount.name,
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
                    partyBillNumber,
                    isType: 'RoundOff',
                    type: 'PrRt',
                    purchaseReturnBillId: newBill._id,
                    purchaseSalesReturnType: partyAccount.name,
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
                    partyBillNumber: partyBillNumber,
                    isType: 'PrRt',
                    type: 'PrRt',
                    purchaseReturnBillId: newBill._id,
                    purchaseSalesReturnType: 'Purchase Return',
                    debit: finalAmount,
                    credit: 0,
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

        // Update bill with items
        newBill.items = billItems;
        await newBill.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Purchase return created successfully',
            bill: {
                _id: newBill._id,
                billNumber: newBill.billNumber,
                account: newBill.account,
                totalAmount: newBill.totalAmount,
                date: newBill.date,
                transactionDate: newBill.transactionDate
            },
            printUrl: req.query.print === 'true' ? `/purchase-return/${newBill._id}/direct-print` : null
        });

    } catch (error) {
        console.error("Error creating purchase return:", error);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
            error: 'Error creating purchase return',
            details: error.message
        });
    }
});


router.get('/purchase-return/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            const purchaseReturnBillId = req.params.id;
            const bill = await PurchaseReturn.findById(purchaseReturnBillId)
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
                    purchaseReturnBillId: new ObjectId(purchaseReturnBillId)
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
            console.error("Error fetching purchase return bill for printing:", error);
            res.status(500).json({
                success: false,
                error: 'Error fetching purchase return bill for printing',
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

router.get('/purchaseReturn-vat-report', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied' 
            });
        }

        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';
        
        // Extract and validate dates
        let fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
        let toDate = req.query.toDate ? new Date(req.query.toDate) : null;
        
        if (fromDate && isNaN(fromDate.getTime())) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid fromDate format' 
            });
        }
        if (toDate && isNaN(toDate.getTime())) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid toDate format' 
            });
        }

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat address ward city pan')
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
                    purchaseReturnVatReport: [],
                    companyDateFormat,
                    nepaliDate,
                    currentCompany,
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'Purchase Return VAT Report',
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

        const purchaseReturns = await PurchaseReturn.find(query)
            .populate('account')
            .sort({ date: 1 });

        // Prepare VAT report data
        const purchaseReturnVatReport = await Promise.all(purchaseReturns.map(async bill => {
            const account = bill.account || await Account.findById(bill.account);
            return {
                billNumber: bill.billNumber,
                date: bill.date,
                account: account?.name || 'Unknown',
                panNumber: account?.pan || '',
                totalAmount: bill.totalAmount || 0,
                discountAmount: bill.discountAmount || 0,
                nonVatPurchaseReturn: bill.nonVatPurchaseReturn || 0,
                taxableAmount: bill.taxableAmount || 0,
                vatAmount: bill.vatAmount || 0,
            };
        }));

        res.json({
            success: true,
            data: {
                company,
                currentFiscalYear,
                purchaseReturnVatReport,
                companyDateFormat,
                nepaliDate,
                currentCompany,
                fromDate: req.query.fromDate,
                toDate: req.query.toDate,
                currentCompanyName,
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            },
            meta: {
                title: 'Purchase Return VAT Report',
                theme: req.user.preferences?.theme || 'light'
            }
        });

    } catch (error) {
        console.error('Error in purchaseReturn-vat-report:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;
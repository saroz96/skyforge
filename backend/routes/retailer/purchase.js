const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require("../../middleware/auth");
const { ensureTradeType } = require("../../middleware/tradeType");
const Account = require("../../models/retailer/Account");
const Item = require("../../models/retailer/Item");
const PurchaseBill = require("../../models/retailer/PurchaseBill");
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
const { default: Store } = require('../../models/retailer/Store');
const { default: Rack } = require('../../models/retailer/Rack');
const { checkStoreManagement } = require('../../middleware/storeManagement');

// Purchase Bill routes
router.get('/purchase', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkStoreManagement, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            // Fetch all required data in parallel for better performance
            const [
                items,
                purchasebills,
                company,
                stores,
                racks,
                // accounts,
                lastCounter
            ] = await Promise.all([
                Item.find({ company: companyId }).populate('category').populate('unit').populate('mainUnit').populate('stockEntries').lean(),
                PurchaseBill.find({ company: companyId }).populate('account').populate('items.item').populate('items.unit'),
                Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear'),
                req.storeManagementEnabled ? Store.find({ company: companyId, isActive: true }) : [],
                Rack.find({ company: companyId }).populate('store'),
                // Account.find({}).lean().exec(),
                BillCounter.findOne({
                    company: companyId,
                    fiscalYear: req.session.currentFiscalYear?.id,
                    transactionType: 'purchase'
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
                fiscalYear = currentFiscalYear._id.toString();
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

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

                // Get the latest puPrice and multiply by WSUnit (default to 1 if not available)
                const puPrice = latestStockEntry?.puPrice
                    ? Math.round(latestStockEntry.puPrice * (latestStockEntry.WSUnit || 1) * 100) / 100
                    : item.puPrice
                        ? Math.round(item.puPrice * (item.WSUnit || 1) * 100) / 100
                        : 0;

                return {
                    ...item,
                    stock: totalStock,
                    latestPuPrice: puPrice,  // This now includes WSUnit multiplication
                    latestStockEntry: latestStockEntry,
                };
            });

            // Calculate next bill number
            const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
            const fiscalYears = await FiscalYear.findById(fiscalYear);
            const prefix = fiscalYears.billPrefixes.purchase;
            const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

            // Group racks by store
            const racksByStore = {};
            racks.forEach(rack => {
                if (!racksByStore[rack.store._id]) {
                    racksByStore[rack.store._id] = [];
                }
                racksByStore[rack.store._id].push({
                    _id: rack._id,
                    name: rack.name,
                    description: rack.description
                });
            });

            // Fetch only the required company groups: Cash in Hand, Sundry Debtors, Sundry Creditors
            const relevantGroups = await CompanyGroup.find({
                name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
            }).exec();

            // Convert relevant group IDs to an array of ObjectIds
            const relevantGroupIds = relevantGroups.map(group => group._id);

            const accounts = await Account.find({
                company: companyId,
                // fiscalYear: fiscalYear,
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
                    purchaseBills: purchasebills.map(bill => ({
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
                    nextPurchaseBillNumber: nextBillNumber,
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
                    stores: stores.map(store => ({
                        _id: store._id,
                        name: store.name,
                        code: store.code,
                        location: store.location
                    })),
                    racksByStore,
                    userPreferences: {
                        theme: req.user.preferences?.theme || 'light'
                    },
                    permissions: {
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor',
                        storeManagementEnabled: req.storeManagementEnabled
                    }
                }
            };

            return res.json(responseData);
        }
    } catch (error) {
        console.error('Error in /purchase-bills route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Fetch all purchase bills
router.get('/purchase-register', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompany = await Company.findById(new ObjectId(companyId));
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

            // If no date range provided, return empty response with company info
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        company: company,
                        currentFiscalYear: currentFiscalYear,
                        bills: [],
                        fromDate: fromDate || '',
                        toDate: toDate || ''
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

            const bills = await PurchaseBill.find(query)
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
                    fromDate: fromDate,
                    toDate: toDate
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized trade type'
            });
        }
    } catch (error) {
        console.error('Error fetching purchase bills:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


router.post('/purchase', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkDemoPeriod, checkFiscalYearDateRange, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { accountId, items, vatPercentage, transactionDateNepali, transactionDateRoman, billDate, partyBillNumber, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount } = req.body;
            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear');
            const userId = req.user._id;
            const currentFiscalYear = req.session.currentFiscalYear.id
            const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;

            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let subTotal = 0;
            let vatAmount = 0;
            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let totalCCAmount = 0;
            let taxableCCAmount = 0;
            let nonTaxableCCAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            // Validation checks
            if (!companyId) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Company ID is required." });
            }
            if (!isVatExempt) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Invalid VAT selection." });
            }
            if (!paymentMode) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Invalid payment mode." });
            }

            const companyDateFormat = company ? company.dateFormat : 'english';
            if (companyDateFormat === 'nepali') {
                if (!transactionDateNepali) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Invalid transaction date." });
                }
                if (!nepaliDate) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Invalid invoice date." });
                }
            } else {
                if (!transactionDateRoman) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Invalid transaction date." });
                }
                if (!billDate) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Invalid invoice date." });
                }
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

                if (!item.batchNumber || !item.batchNumber.trim()) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Batch number is required for item ${product.name}` });
                }

                if (!item.expiryDate) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Expiry date is required for item ${product.name}` });
                }

                const itemTotal = parseFloat(item.puPrice) * parseFloat(item.quantity, 10);
                subTotal += itemTotal;

                const itemCCAmount = parseFloat(item.itemCCAmount) || 0;
                totalCCAmount += itemCCAmount;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemTotal;
                    taxableCCAmount += itemCCAmount;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemTotal;
                    nonTaxableCCAmount += itemCCAmount;
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

            // Apply discount proportionally to vatable and non-vatable items
            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

            const finalTaxableAmount = (totalTaxableAmount - discountForTaxable) + taxableCCAmount;
            const finalNonTaxableAmount = (totalNonTaxableAmount - discountForNonTaxable) + nonTaxableCCAmount;

            // Calculate VAT only for vatable items
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (finalTaxableAmount * vatPercentage) / 100;
            } else {
                vatAmount = 0;
            }

            let totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            // Check if round off is enabled in settings
            let roundOffForPurchase = await Settings.findOne({ company: companyId, userId }).session(session);
            if (!roundOffForPurchase) {
                roundOffForPurchase = { roundOffPurchase: false };
            }

            let roundOffAmount = 0;
            if (roundOffForPurchase.roundOffPurchase) {
                finalAmount = Math.round(finalAmount.toFixed(2));
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForPurchase.roundOffPurchase) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'purchase', session);

            // Create new purchase bill
            const newBill = new PurchaseBill({
                billNumber: billNumber,
                partyBillNumber,
                account: accountId,
                purchaseSalesType: 'Purchase',
                items: [],
                isVatExempt: isVatExemptBool,
                isVatAll,
                vatPercentage: isVatExemptBool ? 0 : vatPercentage,
                subTotal,
                discountPercentage: discount,
                discountAmount: discountForTaxable + discountForNonTaxable,
                nonVatPurchase: finalNonTaxableAmount,
                taxableAmount: finalTaxableAmount,
                totalCCAmount: totalCCAmount,
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
            const accountTransaction = await Transaction.findOne({ account: accountId }).sort({ transactionDate: -1 });
            if (accountTransaction) {
                previousBalance = accountTransaction.balance;
            }

            const uniqueId = uuidv4();

            // FIFO stock addition function
            async function addStock(product, batchNumber, expiryDate, WSUnit, quantity, bonus, price, puPrice, itemCCAmount, marginPercentage, mrp, currency, store, rack, uniqueId) {
                const quantityNumber = Number(quantity) + Number(bonus);
                const bonusNumber = Number(bonus);
                const parsedPrice = price !== undefined && price !== "" ? parseFloat(price) : 0;
                const parsedPuPrice = puPrice !== undefined && puPrice !== "" ? parseFloat(puPrice) : 0;
                const parsedItemCCAmount = itemCCAmount !== undefined && itemCCAmount !== "" ? parseFloat(itemCCAmount) : 0;
                const parsedMrp = mrp !== undefined && mrp !== "" ? parseFloat(mrp) : 0;
                const WSUnitNumber = WSUnit !== undefined && WSUnit !== "" && WSUnit !== null ? Number(WSUnit) : 1;
                const quantityWithOutBonus = Number(quantity);
                const puPriceWithOutBonus = parsedPuPrice * quantityWithOutBonus;
                const WsUnitWithNetQuantity = WSUnitNumber * quantityNumber;

                const itemTotal = parsedPuPrice * quantityNumber;
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parsedPuPrice - (parsedPuPrice * discount / 100);

                const stockEntry = {
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    WSUnit: WSUnitNumber,
                    quantity: WSUnitNumber ? quantityNumber * WSUnitNumber : 0,
                    bonus: WSUnitNumber ? bonusNumber * WSUnitNumber : 0,
                    batchNumber: batchNumber,
                    expiryDate: expiryDate,
                    price: WSUnitNumber ? parsedPrice / WSUnitNumber : 0,
                    puPrice: WSUnitNumber ? puPriceWithOutBonus / WsUnitWithNetQuantity : 0,
                    itemCCAmount: parsedItemCCAmount,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    mainUnitPuPrice: parsedPuPrice,
                    mrp: WSUnitNumber ? parsedMrp / WSUnitNumber : 0,
                    marginPercentage: marginPercentage,
                    currency: currency,
                    purchaseBillId: newBill._id,
                    store: store,
                    rack: rack,
                    uniqueUuId: uniqueId,
                    fiscalYear: currentFiscalYear,
                };

                product.stockEntries.push(stockEntry);
                product.stock = (product.stock || 0) + (quantityNumber * WSUnitNumber);
                product.WSUnit = WSUnitNumber;
                await product.save();
            }

            // Process bill items
            const billItems = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);
                const itemTotal = parseFloat(item.puPrice) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.puPrice) - (parseFloat(item.puPrice) * discount / 100);

                if (!product) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: `Item with id ${item.item} not found` });
                }

                await addStock(
                    product,
                    item.batchNumber,
                    item.expiryDate,
                    item.WSUnit,
                    item.quantity,
                    item.bonus,
                    item.price,
                    item.puPrice,
                    item.itemCCAmount,
                    item.marginPercentage,
                    item.mrp,
                    item.currency,
                    item.store,
                    item.rack,
                    uniqueId
                );

                billItems.push({
                    item: product._id,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    WSUnit: item.WSUnit,
                    quantity: item.quantity,
                    bonus: item.bonus,
                    Altbonus: item.bonus,
                    price: item.price,
                    puPrice: item.puPrice,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    Altquantity: item.quantity,
                    Altprice: item.price,
                    AltpuPrice: item.puPrice,
                    mainUnitPuPrice: item.puPrice,
                    mrp: item.mrp,
                    CCPercentage: item.CCPercentage,
                    itemCCAmount: item.itemCCAmount,
                    marginPercentage: item.marginPercentage,
                    currency: item.currency,
                    store: item.store,
                    rack: item.rack,
                    unit: item.unit,
                    vatStatus: product.vatStatus,
                    uniqueUuId: uniqueId
                });
            }

            // Create transactions for each item
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);
                const itemTotal = parseFloat(item.puPrice) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.puPrice) - (parseFloat(item.puPrice) * discount / 100);

                const transaction = new Transaction({
                    item: product,
                    unit: item.unit,
                    WSUnit: item.WSUnit,
                    price: item.price,
                    puPrice: item.puPrice,
                    discountPercentagePerItem: discountPercentagePerItem,
                    discountAmountPerItem: discountAmountPerItem,
                    netPuPrice: netPuPrice,
                    quantity: item.quantity,
                    account: accountId,
                    billNumber: billNumber,
                    partyBillNumber,
                    purchaseSalesType: 'Purchase',
                    isType: 'Purc',
                    type: 'Purc',
                    purchaseBillId: newBill._id,
                    debit: 0,
                    credit: newBill.totalAmount,
                    paymentMode: paymentMode,
                    balance: previousBalance + newBill.totalAmount,
                    date: nepaliDate ? nepaliDate : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear
                });

                await transaction.save();
            }

            // Create a transaction for the default Purchase Account
            const purchaseAmount = finalTaxableAmount + finalNonTaxableAmount;
            if (purchaseAmount > 0) {
                const purchaseAccount = await Account.findOne({ name: 'Purchase', company: companyId });
                if (purchaseAccount) {
                    const partyAccount = await Account.findById(accountId);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, error: 'Party account not found.' });
                    }
                    const purchaseTransaction = new Transaction({
                        account: purchaseAccount._id,
                        billNumber: billNumber,
                        partyBillNumber,
                        type: 'Purc',
                        purchaseBillId: newBill._id,
                        purchaseSalesType: partyAccount.name,
                        debit: purchaseAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + purchaseAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await purchaseTransaction.save();
                }
            }

            // Create a transaction for the VAT amount
            if (vatAmount > 0) {
                const vatAccount = await Account.findOne({ name: 'VAT', company: companyId });
                if (vatAccount) {
                    const partyAccount = await Account.findById(accountId);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, error: 'Party account not found.' });
                    }
                    const vatTransaction = new Transaction({
                        account: vatAccount._id,
                        billNumber: billNumber,
                        partyBillNumber,
                        isType: 'VAT',
                        type: 'Purc',
                        purchaseBillId: newBill._id,
                        purchaseSalesType: partyAccount.name,
                        debit: vatAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + vatAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await vatTransaction.save();
                }
            }

            // Create a transaction for the round-off amount
            if (roundOffAmount > 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId });
                if (roundOffAccount) {
                    const partyAccount = await Account.findById(accountId);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, error: 'Party account not found.' });
                    }
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        partyBillNumber,
                        isType: 'RoundOff',
                        type: 'Purc',
                        purchaseBillId: newBill._id,
                        purchaseSalesType: partyAccount.name,
                        debit: roundOffAmount,
                        credit: 0,
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save();
                }
            }

            if (roundOffAmount < 0) {
                const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId });
                if (roundOffAccount) {
                    const partyAccount = await Account.findById(accountId);
                    if (!partyAccount) {
                        await session.abortTransaction();
                        return res.status(400).json({ success: false, error: 'Party account not found.' });
                    }
                    const roundOffTransaction = new Transaction({
                        account: roundOffAccount._id,
                        billNumber: billNumber,
                        partyBillNumber,
                        isType: 'RoundOff',
                        type: 'Purc',
                        purchaseBillId: newBill._id,
                        purchaseSalesType: partyAccount.name,
                        debit: 0,
                        credit: Math.abs(roundOffAmount),
                        paymentMode: paymentMode,
                        balance: previousBalance + roundOffAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await roundOffTransaction.save();
                }
            }

            // If payment mode is cash, also create a transaction for the "Cash in Hand" account
            if (paymentMode === 'cash') {
                const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId });
                if (cashAccount) {
                    const cashTransaction = new Transaction({
                        account: cashAccount._id,
                        billNumber: billNumber,
                        partyBillNumber,
                        isType: 'Purc',
                        type: 'Purc',
                        purchaseBillId: newBill._id,
                        purchaseSalesType: 'Purchase',
                        debit: 0,
                        credit: finalAmount,
                        paymentMode: paymentMode,
                        balance: previousBalance + finalAmount,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await cashTransaction.save();
                }
            }

            // Update bill with items
            newBill.items = billItems;
            await newBill.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            if (req.query.print === 'true') {
                return res.status(200).json({
                    success: true,
                    message: 'Purchase bill saved successfully!',
                    billId: newBill._id,
                    redirectUrl: `/purchase-bills/${newBill._id}/direct-print`
                });
            } else {
                return res.status(200).json({
                    success: true,
                    message: 'Purchase bill saved successfully!',
                    billId: newBill._id,
                    redirectUrl: '/purchase-bills'
                });
            }
        } catch (error) {
            console.error("Error creating purchase bill:", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: 'Error creating purchase bill',
                error: error.message
            });
        }
    }
});


router.get('/purchase/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            // Fetch purchase bill with proper population
            const purchaseInvoice = await PurchaseBill.findOne({
                _id: billId,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate({
                    path: 'items.item',
                    select: 'name hscode uniqueNumber vatStatus unit PuPrice quantity bonus batchNumber expiryDate stockEntries category',
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

            if (!purchaseInvoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase invoice not found or does not belong to the selected company'
                });
            }

            const processedItems = purchaseInvoice.items.map(item => {
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
                const latestPuPrice = latestStockEntry.puPrice || itemData.PuPrice || 0;

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
                    latestPuPrice: Math.round(latestPuPrice * 100) / 100,
                    // Unit details (either from direct unit reference or item's unit)
                    unit: unit,
                    // Other fields from the purchase item
                    puPrice: item.puPrice,
                    quantity: item.quantity,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate?.toISOString().split('T')[0] || '',
                    WSUnit: item.WSUnit || 1,
                    bonus: item.bonus || 0,
                    amount: (item.quantity * item.puPrice).toFixed(2),
                    uniqueUuId: item.uniqueUuId || '',

                    // Include the original item reference ID
                    item: item.item?._id || null
                };
            });

            // Fetch all items for the company (for dropdown) with stock and latest price
            const allItems = await Item.find({ company: companyId })
                .populate([
                    { path: 'unit', select: 'name _id' },
                    { path: 'category', select: 'name _id' },
                    { path: 'stockEntries', select: 'quantity puPrice date' }
                ])
                .select('name hscode uniqueNumber vatStatus unit puPrice quantity stockEntries category')
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
                const latestPuPrice = latestStockEntry.puPrice || item.puPrice || 0;

                return {
                    ...item,
                    stock: totalStock,
                    latestPuPrice: Math.round(latestPuPrice * 100) / 100,
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
                    purchaseInvoice: {
                        ...purchaseInvoice,
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

router.put('/purchase/edit/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const billId = req.params.id;
            const { accountId, items, vatPercentage, transactionDateRoman, transactionDateNepali, partyBillNumber, billDate, nepaliDate, isVatExempt, discountPercentage, paymentMode, roundOffAmount: manualRoundOffAmount } = req.body;

            // Validate required fields
            if (!req.body.accountId || !req.body.items || !Array.isArray(req.body.items)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: accountId or items'
                });
            }

            // Debug: Log incoming data
            console.log('Incoming update data:', {
                body: req.body
            });

            const companyId = req.session.currentCompany;
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat vatEnabled').populate('fiscalYear');
            const currentFiscalYear = req.session.currentFiscalYear.id;
            const userId = req.user._id;

            // Validation checks
            if (!companyId) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Company ID is required'
                });
            }

            if (!isVatExempt) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid VAT selection'
                });
            }

            if (!paymentMode) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid payment mode'
                });
            }

            const companyDateFormat = company ? company.dateFormat : 'english';
            if (companyDateFormat === 'nepali') {
                if (!transactionDateNepali) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid transaction date'
                    });
                }
                if (!nepaliDate) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid invoice date'
                    });
                }
            } else {
                if (!transactionDateRoman) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid transaction date'
                    });
                }
                if (!billDate) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid invoice date'
                    });
                }
            }

            // Process items - ensure they have required fields
            const processedItems = req.body.items.map(item => {
                if (!item.item) {
                    throw new Error(`Item missing required field: item ID`);
                }
                if (!item.uniqueUuId) {
                    // For new items, generate a uniqueUuId
                    item.uniqueUuId = uuidv4();
                }
                return {
                    ...item,
                    unit: item.unit || null // Ensure unit is properly set
                };
            });

            // Debug: Log processed items
            console.log('Processed items:', processedItems);

            const accounts = await Account.findOne({ _id: accountId, company: companyId }).session(session);
            if (!accounts) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid account for this company'
                });
            }

            const existingBill = await PurchaseBill.findOne({ _id: billId, company: companyId }).session(session);
            if (!existingBill) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Purchase not found'
                });
            }

            // Check if stock is used
            let isStockUsed = false;
            for (const existingItem of existingBill.items) {
                const product = await Item.findById(existingItem.item).session(session);
                if (!product) continue;

                const stockEntry = product.stockEntries.find(entry =>
                    entry.batchNumber === existingItem.batchNumber &&
                    new Date(entry.date).toDateString() === new Date(existingBill.date).toDateString() &&
                    entry.uniqueUuId === existingItem.uniqueUuId
                );

                if (!stockEntry || stockEntry.quantity < existingItem.quantity * (existingItem.WSUnit || 1)) {
                    isStockUsed = true;
                    break;
                }
            }

            if (isStockUsed) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Could not edit, Stock is used!'
                });
            }

            // Process stock updates
            for (const existingItem of existingBill.items) {
                const product = await Item.findById(existingItem.item).session(session);
                if (!product) continue;

                const stockEntryIndex = product.stockEntries.findIndex(entry =>
                    entry.batchNumber === existingItem.batchNumber &&
                    entry.uniqueUuId === existingItem.uniqueUuId
                );

                if (stockEntryIndex !== -1) {
                    const stockEntry = product.stockEntries[stockEntryIndex];
                    const convertedQuantity = existingItem.quantity * (existingItem.WSUnit || 1);
                    const convertedBonus = (existingItem.bonus || 0) * (existingItem.WSUnit || 1);

                    stockEntry.quantity -= convertedQuantity;
                    stockEntry.bonus -= convertedBonus;

                    if (stockEntry.quantity <= 0 && stockEntry.bonus <= 0) {
                        product.stockEntries.splice(stockEntryIndex, 1);
                    }

                    await product.save({ session });
                }
            }

            // Process removed items
            const removedItems = existingBill.items.filter(existingItem => {
                return !items.some(item =>
                    item.item === existingItem.item &&
                    item.uniqueUuId === existingItem.uniqueUuId
                );
            });

            for (const removedItem of removedItems) {
                const product = await Item.findById(removedItem.item).session(session);
                if (!product) continue;

                const stockEntryIndex = product.stockEntries.findIndex(entry =>
                    entry.batchNumber === removedItem.batchNumber &&
                    entry.uniqueUuId === removedItem.uniqueUuId
                );

                if (stockEntryIndex !== -1) {
                    product.stockEntries.splice(stockEntryIndex, 1);
                    product.stock = product.stockEntries.reduce((total, entry) => total + entry.quantity + entry.bonus, 0);
                    await product.save({ session });
                }
            }

            existingBill.items = existingBill.items.filter(existingItem => {
                return items.some(item =>
                    item.item === existingItem.item &&
                    item.uniqueUuId === existingItem.uniqueUuId
                );
            });

            // Delete associated transactions
            await Transaction.deleteMany({ purchaseBillId: billId }).session(session);

            // Calculate amounts
            const isVatExemptBool = isVatExempt === 'true' || isVatExempt === true;
            const isVatAll = isVatExempt === 'all';
            const discount = parseFloat(discountPercentage) || 0;

            let totalTaxableAmount = 0;
            let totalNonTaxableAmount = 0;
            let totalCCAmount = 0;
            let taxableCCAmount = 0;
            let nonTaxableCCAmount = 0;
            let hasVatableItems = false;
            let hasNonVatableItems = false;

            for (const item of items) {
                const product = await Item.findById(item.item).session(session);
                if (!product) {
                    await session.abortTransaction();
                    return res.status(404).json({
                        success: false,
                        error: `Item with id ${item.item} not found`
                    });
                }
                const itemAmount = item.quantity * item.puPrice;
                const itemCCAmount = parseFloat(item.itemCCAmount) || 0;
                totalCCAmount += itemCCAmount;

                if (product.vatStatus === 'vatable') {
                    hasVatableItems = true;
                    totalTaxableAmount += itemAmount;
                    taxableCCAmount += itemCCAmount;
                } else {
                    hasNonVatableItems = true;
                    totalNonTaxableAmount += itemAmount;
                    nonTaxableCCAmount += itemCCAmount;
                }
            }

            // VAT validation
            if (isVatExempt !== 'all') {
                if (isVatExemptBool && hasVatableItems) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot save VAT exempt bill with vatable items'
                    });
                }

                if (!isVatExemptBool && hasNonVatableItems) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot save bill with non-vatable items when VAT is applied'
                    });
                }
            }

            const discountForTaxable = (totalTaxableAmount * discount) / 100;
            const discountForNonTaxable = (totalNonTaxableAmount * discount) / 100;

            const finalTaxableAmount = totalTaxableAmount - discountForTaxable;
            const finalNonTaxableAmount = totalNonTaxableAmount - discountForNonTaxable;
            const displayTaxableAmount = finalTaxableAmount + taxableCCAmount;
            const displayNonTaxableAmount = finalNonTaxableAmount + nonTaxableCCAmount;

            let vatAmount = 0;
            if (!isVatExemptBool || isVatAll || isVatExempt === 'all') {
                vatAmount = (displayTaxableAmount * vatPercentage) / 100;
            }

            let roundOffAmount = 0;
            let totalAmount = displayTaxableAmount + displayNonTaxableAmount + vatAmount;
            let finalAmount = totalAmount;

            const roundOffForPurchase = await Settings.findOne({ company: companyId, userId, fiscalYear: currentFiscalYear }) || { roundOffPurchase: false };

            if (roundOffForPurchase.roundOffPurchase) {
                finalAmount = Math.round(finalAmount.toFixed(2));
                roundOffAmount = finalAmount - totalAmount;
            } else if (manualRoundOffAmount && !roundOffForPurchase.roundOffPurchase) {
                roundOffAmount = parseFloat(manualRoundOffAmount);
                finalAmount = totalAmount + roundOffAmount;
            }

            // Update bill
            existingBill.account = accountId;
            existingBill.isVatExempt = isVatExemptBool;
            existingBill.vatPercentage = isVatExemptBool ? 0 : vatPercentage;
            existingBill.partyBillNumber = partyBillNumber;
            existingBill.subTotal = totalTaxableAmount + totalNonTaxableAmount;
            existingBill.discountPercentage = discount;
            existingBill.discountAmount = discountForTaxable + discountForNonTaxable;
            existingBill.nonVatSales = finalNonTaxableAmount;
            existingBill.taxableAmount = finalTaxableAmount;
            existingBill.vatAmount = vatAmount;
            existingBill.isVatAll = isVatAll;
            existingBill.totalAmount = finalAmount;
            existingBill.roundOffAmount = roundOffAmount;
            existingBill.paymentMode = paymentMode;
            existingBill.totalCCAmount = totalCCAmount;
            existingBill.date = nepaliDate ? nepaliDate : new Date(billDate);
            existingBill.transactionDate = transactionDateNepali ? transactionDateNepali : new Date(transactionDateRoman);

            // 6. Process the updated/added items and add new stock
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);
                if (!product) {
                    req.flash('error', `Item with id ${item.item} not found`);
                    await session.abortTransaction();
                    return res.redirect('/purchase-bills');
                }

                // Calculate converted quantities
                const WSUnit = item.WSUnit || 1;
                const convertedQuantity = item.quantity * WSUnit;
                const convertedBonus = (item.bonus || 0) * WSUnit;
                const totalQuantity = convertedQuantity + convertedBonus;

                // Calculate purchase price per unit (including bonus)
                let calculatedPuPrice = 0;
                if (totalQuantity > 0) {
                    calculatedPuPrice = (item.puPrice * item.quantity) / totalQuantity;
                } else {
                    calculatedPuPrice = item.puPrice;
                }

                // Find existing item in bill (if updating)
                const existingBillItemIndex = existingBill.items.findIndex(billItem =>
                    billItem.item && billItem.item.toString() === item.item &&
                    billItem.uniqueUuId === item.uniqueUuId
                );

                // Find or create stock entry
                let stockEntryIndex = product.stockEntries.findIndex(entry =>
                    entry.batchNumber === item.batchNumber &&
                    entry.uniqueUuId === item.uniqueUuId &&
                    entry.purchaseBillId.toString() === existingBill._id.toString()
                );

                if (stockEntryIndex === -1) {
                    // Create new stock entry
                    product.stockEntries.push({
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        WSUnit: WSUnit,
                        quantity: totalQuantity,
                        bonus: convertedBonus,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        price: item.price !== undefined ? item.price / WSUnit : undefined,
                        puPrice: calculatedPuPrice,
                        mainUnitPuPrice: item.puPrice,
                        mrp: item.mrp !== undefined ? item.mrp / WSUnit : undefined,
                        marginPercentage: item.marginPercentage,
                        currency: item.currency,
                        purchaseBillId: existingBill._id,
                        uniqueUuId: item.uniqueUuId,
                        fiscalYear: currentFiscalYear
                    });
                } else {
                    // Update existing stock entry
                    product.stockEntries[stockEntryIndex] = {
                        ...product.stockEntries[stockEntryIndex],
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        WSUnit: WSUnit,
                        quantity: convertedQuantity,
                        bonus: convertedBonus,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        price: item.price !== undefined ? item.price / WSUnit : product.stockEntries[stockEntryIndex].price,
                        puPrice: calculatedPuPrice,
                        mainUnitPuPrice: item.puPrice,
                        mrp: item.mrp !== undefined ? item.mrp / WSUnit : product.stockEntries[stockEntryIndex].mrp,
                        marginPercentage: item.marginPercentage !== undefined ? item.marginPercentage : product.stockEntries[stockEntryIndex].marginPercentage,
                        currency: item.currency !== undefined ? item.currency : product.stockEntries[stockEntryIndex].currency,
                        purchaseBillId: existingBill._id,
                        uniqueUuId: item.uniqueUuId,
                        fiscalYear: currentFiscalYear
                    };
                }

                // Update total stock
                product.stock += totalQuantity;
                await product.save({ session });

                // Update or create bill item
                if (existingBillItemIndex !== -1) {
                    existingBill.items[existingBillItemIndex] = {
                        ...existingBill.items[existingBillItemIndex],
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        WSUnit: WSUnit,
                        quantity: item.quantity,
                        bonus: item.bonus || 0,
                        price: item.price,
                        puPrice: item.puPrice,
                        mrp: item.mrp,
                        marginPercentage: item.marginPercentage,
                        currency: item.currency,
                        unit: item.unit,
                        vatStatus: product.vatStatus,
                        uniqueUuId: item.uniqueUuId
                    };
                } else {
                    existingBill.items.push({
                        item: product._id,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        WSUnit: WSUnit,
                        quantity: item.quantity,
                        bonus: item.bonus || 0,
                        price: item.price,
                        puPrice: item.puPrice,
                        mrp: item.mrp,
                        marginPercentage: item.marginPercentage,
                        currency: item.currency,
                        unit: item.unit,
                        vatStatus: product.vatStatus,
                        uniqueUuId: item.uniqueUuId || uuidv4()
                    });
                }
            }

            // Process items and create transactions
            const billItems = [...existingBill.items];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const product = await Item.findById(item.item).session(session);

                if (!product) {
                    await session.abortTransaction();
                    return res.status(404).json({
                        success: false,
                        error: `Item with id ${item.item} not found`
                    });
                }

                const itemTotal = parseFloat(item.puPrice) * parseFloat(item.quantity);
                const discountPercentagePerItem = discount;
                const discountAmountPerItem = (itemTotal * discount) / 100;
                const netPuPrice = parseFloat(item.puPrice) - (parseFloat(item.puPrice) * discount / 100);

                const existingBillItemIndex = billItems.findIndex(billItem =>
                    billItem.item && billItem.item.toString() === item.item
                );

                if (existingBillItemIndex !== -1) {
                    const existingBillItem = billItems[existingBillItemIndex];
                    billItems[existingBillItemIndex] = {
                        ...existingBillItem,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        CCPercentage: item.CCPercentage || 7.5,
                        itemCCAmount: item.itemCCAmount || 0,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        WSUnit: item.WSUnit,
                        quantity: Number(item.quantity),
                        price: item.price !== undefined && item.price !== "" ? item.price : existingBillItem.price,
                        puPrice: item.puPrice,
                        Altquantity: Number(item.quantity),
                        Altbonus: Number(item.bonus || 0),
                        Altprice: item.price !== undefined && item.price !== "" ? item.price : existingBillItem.Altprice,
                        AltpuPrice: item.puPrice,
                        mainUnitPuPrice: item.puPrice,
                        mrp: item.mrp !== undefined && item.mrp !== "" ? item.mrp : existingBillItem.mrp,
                        marginPercentage: item.marginPercentage !== undefined && item.marginPercentage !== "" ? item.marginPercentage : existingBillItem.marginPercentage,
                        currency: item.currency !== undefined && item.currency !== "" ? item.currency : existingBillItem.currency,
                        uniqueUuId: item.uniqueUuId !== undefined && item.uniqueUuId !== "" ? item.uniqueUuId : existingBillItem.uniqueUuId,
                        bonus: Number(item.bonus || 0),
                        unit: item.unit,
                        vatStatus: product.vatStatus,
                        discountPercentagePerItem: discountPercentagePerItem,
                        discountAmountPerItem: discountAmountPerItem,
                        netPuPrice: netPuPrice
                    };
                } else {
                    const newUniqueId = uuidv4();
                    billItems.push({
                        item: product._id,
                        CCPercentage: item.CCPercentage || 7.5,
                        itemCCAmount: item.itemCCAmount || 0,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                        WSUnit: item.WSUnit,
                        quantity: item.quantity,
                        Altbonus: item.bonus,
                        price: item.price,
                        puPrice: item.puPrice,
                        Altquantity: item.quantity,
                        Altprice: item.price,
                        AltpuPrice: item.puPrice,
                        mainUnitPuPrice: item.puPrice,
                        mrp: item.mrp,
                        marginPercentage: item.marginPercentage,
                        currency: item.currency,
                        unit: item.unit,
                        vatStatus: product.vatStatus,
                        uniqueUuId: newUniqueId,
                        bonus: item.bonus,
                        discountPercentagePerItem: discountPercentagePerItem,
                        discountAmountPerItem: discountAmountPerItem,
                        netPuPrice: netPuPrice
                    });
                    item.uniqueUuId = newUniqueId;
                }

                // Process transactions
                const existingTransaction = await Transaction.findOne({
                    item: product._id,
                    purchaseBillId: existingBill._id,
                }).session(session);

                if (existingTransaction) {
                    existingTransaction.batchNumber = item.batchNumber;
                    existingTransaction.quantity = item.quantity;
                    existingTransaction.bonus = item.bonus;
                    existingTransaction.puPrice = item.puPrice;
                    existingTransaction.discountPercentagePerItem = discountPercentagePerItem;
                    existingTransaction.discountAmountPerItem = discountAmountPerItem;
                    existingTransaction.netPuPrice = netPuPrice;
                    existingTransaction.unit = item.unit;
                    existingTransaction.credit = finalAmount;
                    existingTransaction.paymentMode = paymentMode;
                    existingTransaction.date = nepaliDate ? nepaliDate : new Date(billDate);
                    await existingTransaction.save({ session });
                } else {
                    const transaction = new Transaction({
                        item: product._id,
                        batchNumber: item.batchNumber,
                        account: accountId,
                        billNumber: existingBill.billNumber,
                        partyBillNumber: existingBill.partyBillNumber,
                        quantity: item.quantity,
                        puPrice: item.puPrice,
                        discountPercentagePerItem: discountPercentagePerItem,
                        discountAmountPerItem: discountAmountPerItem,
                        netPuPrice: netPuPrice,
                        unit: item.unit,
                        isType: 'Purc',
                        type: 'Purc',
                        purchaseBillId: existingBill._id,
                        purchaseSalesType: 'Purchase',
                        debit: 0,
                        credit: finalAmount,
                        paymentMode: paymentMode,
                        balance: 0,
                        date: nepaliDate ? nepaliDate : new Date(billDate),
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear
                    });
                    await transaction.save({ session });
                }

                // Additional transactions (Purchase, VAT, Round-off)
                const purchaseAmount = finalTaxableAmount + finalNonTaxableAmount;
                if (purchaseAmount > 0) {
                    const purchaseAccount = await Account.findOne({ name: 'Purchase', company: companyId });
                    if (purchaseAccount) {
                        const partyAccount = await Account.findById(accountId);
                        if (!partyAccount) {
                            await session.abortTransaction();
                            return res.status(404).json({
                                success: false,
                                error: 'Party account not found'
                            });
                        }
                        const purchaseTransaction = new Transaction({
                            account: purchaseAccount._id,
                            billNumber: existingBill.billNumber,
                            partyBillNumber: existingBill.partyBillNumber,
                            type: 'Purc',
                            purchaseBillId: existingBill._id,
                            purchaseSalesType: partyAccount.name,
                            debit: purchaseAmount,
                            credit: 0,
                            paymentMode: paymentMode,
                            balance: 0,
                            date: nepaliDate ? nepaliDate : new Date(billDate),
                            company: companyId,
                            user: userId,
                            fiscalYear: currentFiscalYear
                        });
                        await purchaseTransaction.save();
                    }
                }

                if (vatAmount > 0) {
                    const vatAccount = await Account.findOne({ name: 'VAT', company: companyId });
                    if (vatAccount) {
                        const partyAccount = await Account.findById(existingBill.account);
                        if (!partyAccount) {
                            await session.abortTransaction();
                            return res.status(404).json({
                                success: false,
                                error: 'Party account not found'
                            });
                        }
                        const vatTransaction = new Transaction({
                            account: vatAccount._id,
                            billNumber: existingBill.billNumber,
                            partyBillNumber: existingBill.partyBillNumber,
                            isType: 'VAT',
                            type: 'Purc',
                            purchaseBillId: existingBill._id,
                            purchaseSalesType: partyAccount.name,
                            debit: vatAmount,
                            credit: 0,
                            paymentMode: paymentMode,
                            balance: 0,
                            date: nepaliDate ? nepaliDate : new Date(billDate),
                            company: companyId,
                            user: userId,
                            fiscalYear: currentFiscalYear
                        });
                        await vatTransaction.save();
                    }
                }

                if (roundOffAmount > 0) {
                    const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId });
                    if (roundOffAccount) {
                        const partyAccount = await Account.findById(accountId);
                        if (!partyAccount) {
                            await session.abortTransaction();
                            return res.status(404).json({
                                success: false,
                                error: 'Party account not found'
                            });
                        }
                        const roundOffTransaction = new Transaction({
                            account: roundOffAccount._id,
                            billNumber: existingBill.billNumber,
                            partyBillNumber: existingBill.partyBillNumber,
                            isType: 'RoundOff',
                            type: 'Purc',
                            purchaseBillId: existingBill._id,
                            purchaseSalesType: partyAccount.name,
                            debit: roundOffAmount,
                            credit: 0,
                            paymentMode: paymentMode,
                            balance: 0,
                            date: nepaliDate ? nepaliDate : new Date(billDate),
                            company: companyId,
                            user: userId,
                            fiscalYear: currentFiscalYear
                        });
                        await roundOffTransaction.save();
                    }
                }

                if (roundOffAmount < 0) {
                    const roundOffAccount = await Account.findOne({ name: 'Rounded Off', company: companyId });
                    if (roundOffAccount) {
                        const partyAccount = await Account.findById(accountId);
                        if (!partyAccount) {
                            await session.abortTransaction();
                            return res.status(404).json({
                                success: false,
                                error: 'Party account not found'
                            });
                        }
                        const roundOffTransaction = new Transaction({
                            account: roundOffAccount._id,
                            billNumber: existingBill.billNumber,
                            partyBillNumber: existingBill.partyBillNumber,
                            isType: 'RoundOff',
                            type: 'Purc',
                            purchaseBillId: existingBill._id,
                            purchaseSalesType: partyAccount.name,
                            debit: 0,
                            credit: Math.abs(roundOffAmount),
                            paymentMode: paymentMode,
                            balance: 0,
                            date: nepaliDate ? nepaliDate : new Date(billDate),
                            company: companyId,
                            user: userId,
                            fiscalYear: currentFiscalYear
                        });
                        await roundOffTransaction.save();
                    }
                }

                if (paymentMode === 'cash') {
                    const cashAccount = await Account.findOne({ name: 'Cash in Hand', company: companyId });
                    if (cashAccount) {
                        const cashTransaction = new Transaction({
                            item: product._id,
                            account: cashAccount._id,
                            billNumber: existingBill.billNumber,
                            partyBillNumber: existingBill.partyBillNumber,
                            isType: 'Purc',
                            type: 'Purc',
                            purchaseBillId: existingBill._id,
                            partyBillNumber: existingBill.partyBillNumber,
                            purchaseSalesType: 'Purchase',
                            debit: finalAmount,
                            credit: 0,
                            paymentMode: paymentMode,
                            balance: 0,
                            date: nepaliDate ? nepaliDate : new Date(billDate),
                            company: companyId,
                            user: userId,
                            fiscalYear: currentFiscalYear
                        });
                        await cashTransaction.save();
                    }
                }
            }

            existingBill.items = billItems;
            await existingBill.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).json({
                success: true,
                message: 'Purchase updated successfully',
                data: {
                    billId: existingBill._id,
                    billNumber: existingBill.billNumber,
                    print: req.query.print === 'true'
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Error during edit:', error);
            return res.status(500).json({
                success: false,
                error: 'An error occurred while processing your request',
                details: error.message
            });
        }
    }
});

router.get('/purchase/:id/print', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
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

            const purchaseBillId = req.params.id;
            const bill = await PurchaseBill.findById(purchaseBillId)
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
                    purchaseBillId: new ObjectId(purchaseBillId)
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


router.get('/purchase-vat-report', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const companyId = req.session.currentCompany;
        const currentCompany = await Company.findById(new ObjectId(companyId));
        const companyDateFormat = currentCompany ? currentCompany.dateFormat : '';

        // Extract dates from query parameters
        let fromDate = req.query.fromDate ? req.query.fromDate : null;
        let toDate = req.query.toDate ? req.query.toDate : null;

        const today = new Date();
        const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
        const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

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
                    purchaseVatReport: [],
                    fromDate: req.query.fromDate || '',
                    toDate: req.query.toDate || '',
                    currentCompanyName: req.session.currentCompanyName,
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'Purchase VAT Report',
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

        const Bills = await PurchaseBill.find(query).populate('account').sort({ date: 1 });

        // Prepare VAT report data
        const purchaseVatReport = await Promise.all(Bills.map(async bill => {
            const account = await Account.findById(bill.account);
            return {
                billNumber: bill.billNumber,
                partyBillNumber: bill.partyBillNumber,
                date: bill.date,
                account: account.name,
                panNumber: account.pan,
                totalAmount: bill.totalAmount,
                discountAmount: bill.discountAmount,
                nonVatPurchase: bill.nonVatPurchase,
                taxableAmount: bill.taxableAmount,
                vatAmount: bill.vatAmount,
            };
        }));

        res.json({
            success: true,
            data: {
                company,
                currentFiscalYear,
                purchaseVatReport,
                companyDateFormat,
                nepaliDate,
                currentCompany,
                fromDate: req.query.fromDate,
                toDate: req.query.toDate,
                currentCompanyName: req.session.currentCompanyName,
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            },
            meta: {
                title: 'Purchase VAT Report',
                theme: req.user.preferences?.theme || 'light'
            }
        });

    } catch (error) {
        console.error('Error in purchase-vat-report:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;
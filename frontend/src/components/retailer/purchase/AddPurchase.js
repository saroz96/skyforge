import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NepaliDate from 'nepali-date';
import axios from 'axios';
import Header from '../Header';
import '../../../stylesheet/retailer/purchase/AddPurchase.css'
import NotificationToast from '../../NotificationToast'; // Adjust the path as needed
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/retailer/purchase/AddPurchase.css'


const AddPurchase = () => {
    const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();
    const navigate = useNavigate();
    const transactionDateRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const currentNepaliDate = new NepaliDate().format('YYYY/MM/DD');
    const [storeManagementEnabled, setStoreManagementEnabled] = useState(false);
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success' // or 'error'
    });
    const [dateErrors, setDateErrors] = useState({
        transactionDateNepali: '',
        nepaliDate: ''
    });
    const [formData, setFormData] = useState(draftSave?.formData || {
        accountId: '',
        accountName: '',
        accountAddress: '',
        accountPan: '',
        transactionDateNepali: currentNepaliDate,
        transactionDateRoman: new Date().toISOString().split('T')[0],
        nepaliDate: currentNepaliDate,
        billDate: new Date().toISOString().split('T')[0],
        billNumber: '',
        partyBillNumber: '',
        paymentMode: 'credit',
        isVatExempt: 'all',
        discountPercentage: 0,
        discountAmount: 0,
        roundOffAmount: 0,
        CCAmount: 0,
        vatPercentage: 13,
        items: []
    });

    const [items, setItems] = useState(draftSave?.items || []);
    const [allItems, setAllItems] = useState([]);
    const [accounts, setAccounts] = useState(draftSave?.accounts || []);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showSalesPriceModal, setShowSalesPriceModal] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [transactionType, setTransactionType] = useState('purchase');
    const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
    const [filteredItems, setFilteredItems] = useState([]);
    const itemDropdownRef = useRef(null);
    const [salesPriceData, setSalesPriceData] = useState({
        puPrice: 0,
        CCPercentage: 7.5,
        itemCCAmount: 0,
        marginPercentage: 0,
        currency: 'NPR',
        mrp: 0,
        salesPrice: 0
    });

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const [company, setCompany] = useState({
        dateFormat: 'english',
        vatEnabled: true,
        fiscalYear: {}
    });

    const [stores, setStores] = useState([]);
    const [racksByStore, setRacksByStore] = useState({});
    const [nextBillNumber, setNextBillNumber] = useState('');

    const accountSearchRef = useRef(null);
    const itemSearchRef = useRef(null);
    const accountModalRef = useRef(null);
    const transactionModalRef = useRef(null);

    useEffect(() => {
        // Save draft to session storage whenever form data or items change
        if (formData.accountId || items.length > 0) {
            setDraftSave({
                formData,
                items,
                accounts
            });
        }
    }, [formData, items, accounts, setDraftSave]);

    useEffect(() => {
        // Fetch initial data
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/retailer/purchase');
                const { data } = response;

                // Sort accounts alphabetically
                const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
                // Sort items alphabetically
                const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

                setCompany(data.data.company);
                setAllItems(sortedItems);
                setAccounts(sortedAccounts);
                setStores(data.data.stores || []);
                setRacksByStore(data.data.racksByStore || {});
                setNextBillNumber(data.data.nextPurchaseBillNumber);

                setStoreManagementEnabled(data.data.storeManagementEnabled || false);

                // Set initial bill number
                setFormData(prev => ({
                    ...prev,
                    billNumber: data.data.nextPurchaseBillNumber
                }));
                setIsInitialDataLoaded(true);
            } catch (error) {
                console.error('Error fetching initial data:', error);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (isInitialDataLoaded && transactionDateRef.current) {
            // Small timeout to ensure the field is rendered
            const timer = setTimeout(() => {
                transactionDateRef.current.focus();

                // For date inputs, we might need to select the text
                if (transactionDateRef.current.type === 'text') {
                }
            }, 50);

            return () => clearTimeout(timer);
        }
    }, [isInitialDataLoaded, company.dateFormat]);

    useEffect(() => {
        // Calculate totals whenever items or form data changes
        calculateTotal();
    }, [items, formData]);


    useEffect(() => {
        // When VAT selection changes, update the filtered items
        if (itemSearchRef.current?.value) {
            handleItemSearch({ target: { value: itemSearchRef.current.value } });
        } else {
            // If no search text, just filter based on VAT status
            const filtered = allItems.filter(item => {
                if (formData.isVatExempt === 'all') return true;
                if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
                if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
                return true;
            });
            setFilteredItems(filtered);
        }
    }, [formData.isVatExempt, allItems]);

    const handleAccountSearch = (e) => {
        const searchText = e.target.value.toLowerCase();
        const filtered = accounts.filter(account =>
            account.name.toLowerCase().includes(searchText) ||
            (account.uniqueNumber && account.uniqueNumber.toString().toLowerCase().includes(searchText))
        ).sort((a, b) => a.name.localeCompare(b.name));

        setFilteredAccounts(filtered);
    };

    const selectAccount = (account) => {
        setFormData({
            ...formData,
            accountId: account._id,
            accountName: `${account.uniqueNumber || ''} ${account.name}`.trim(),
            accountAddress: account.address,
            accountPan: account.pan
        });
        setShowAccountModal(false);
    };

    const handleItemSearch = (e) => {
        const query = e.target.value.toLowerCase();

        if (query.length === 0) {
            setFilteredItems([]);
            return;
        }

        // Filter based on VAT status selection
        let filtered = allItems.filter(item => {
            // First check if item matches search criteria
            const matchesSearch = item.name.toLowerCase().includes(query) ||
                (item.hscode && item.hscode.toString().toLowerCase().includes(query)) ||
                (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query)) ||
                (item.category && item.category.name.toLowerCase().includes(query));

            // Then filter based on VAT selection
            if (formData.isVatExempt === 'all') {
                return matchesSearch; // Show all items
            } else if (formData.isVatExempt === 'false') {
                return matchesSearch && item.vatStatus === 'vatable'; // Only vatable items
            } else if (formData.isVatExempt === 'true') {
                return matchesSearch && item.vatStatus === 'vatExempt'; // Only exempt items
            }
            return matchesSearch;
        })
            .sort((a, b) => a.name.localeCompare(b.name));

        setFilteredItems(filtered);
    };

    const addItemToBill = (item) => {
        const newItem = {
            item: item._id,
            uniqueNumber: item.uniqueNumber || 'N/A',
            hscode: item.hscode,
            name: item.name,
            category: item.category?.name || 'No Category',
            WSUnit: item.WSUnit || 1,
            batchNumber: 'XXX',
            expiryDate: getDefaultExpiryDate(),
            quantity: 0,
            bonus: 0,
            unit: item.unit,
            puPrice: item.latestPuPrice || 0,
            price: 0, // Added for sales price
            mrp: 0, // Added for MRP
            marginPercentage: 0, // Added
            currency: 'NPR', // Added
            CCPercentage: 0, // Added
            itemCCAmount: 0, // Added
            amount: 0,
            vatStatus: item.vatStatus,
            ...(storeManagementEnabled && {
                store: stores.length > 0 ? stores[0]._id : null,
                rack: null
            })
        };

        setItems([...items, newItem]);
        setShowItemDropdown(false);
        itemSearchRef.current.value = '';

        // Focus on the WS Unit field of the newly added item
        setTimeout(() => {
            const newItemIndex = items.length; // New item will be at this index
            const wsUnitInput = document.getElementById(`WSUnit-${newItemIndex}`);
            if (wsUnitInput) {
                wsUnitInput.focus();
                wsUnitInput.select(); // Optional: select the text for easy editing
            }
        }, 100); // Small timeout to allow React to render the new item
    };

    const getDefaultExpiryDate = () => {
        const today = new Date();
        today.setFullYear(today.getFullYear() + 2);
        return today.toISOString().split('T')[0];
    };

    const updateItemField = (index, field, value) => {
        const updatedItems = [...items];
        updatedItems[index][field] = value;

        // Calculate amount if quantity or price changes
        if (field === 'quantity' || field === 'puPrice') {
            updatedItems[index].amount = (updatedItems[index].quantity * updatedItems[index].puPrice).toFixed(2);
        }

        setItems(updatedItems);

        // Recalculate discounts if they have values
        if (formData.discountPercentage || formData.discountAmount) {
            const subTotal = calculateTotal(updatedItems).subTotal;

            if (formData.discountPercentage) {
                const discountAmount = (subTotal * formData.discountPercentage) / 100;
                setFormData(prev => ({
                    ...prev,
                    discountAmount: discountAmount.toFixed(2)
                }));
            } else if (formData.discountAmount) {
                const discountPercentage = subTotal > 0 ? (formData.discountAmount / subTotal) * 100 : 0;
                setFormData(prev => ({
                    ...prev,
                    discountPercentage: discountPercentage.toFixed(2)
                }));
            }
        }
    };


    const removeItem = (index) => {
        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (itemSearchRef.current && !itemSearchRef.current.contains(event.target)) {
                if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
                    setShowItemDropdown(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Update calculateTotal to optionally accept items parameter
    const calculateTotal = (itemsToCalculate = items) => {
        let subTotal = 0;
        let taxableAmount = 0;
        let nonTaxableAmount = 0;
        let totalCCAmount = 0;
        let taxableCCAmount = 0;
        let nonTaxableCCAmount = 0;

        itemsToCalculate.forEach(item => {
            subTotal += parseFloat(item.amount) || 0;
            totalCCAmount += parseFloat(item.itemCCAmount) || 0;

            if (item.vatStatus === 'vatable') {
                taxableAmount += parseFloat(item.amount) || 0;
                taxableCCAmount += parseFloat(item.itemCCAmount) || 0;
            } else {
                nonTaxableAmount += parseFloat(item.amount) || 0;
                nonTaxableCCAmount += parseFloat(item.itemCCAmount) || 0;
            }
        });

        const discountPercentage = parseFloat(formData.discountPercentage) || 0;
        const discountAmount = parseFloat(formData.discountAmount) || 0;

        const discountForTaxable = (taxableAmount * discountPercentage) / 100;
        const discountForNonTaxable = (nonTaxableAmount * discountPercentage) / 100;

        const finalTaxableAmount = taxableAmount - discountForTaxable + taxableCCAmount;
        const finalNonTaxableAmount = nonTaxableAmount - discountForNonTaxable + nonTaxableCCAmount;

        let vatAmount = 0;
        if (formData.isVatExempt === 'false' || formData.isVatExempt === 'all') {
            vatAmount = (finalTaxableAmount * formData.vatPercentage) / 100;
        }

        const roundOffAmount = parseFloat(formData.roundOffAmount) || 0;
        const totalAmount = finalTaxableAmount + finalNonTaxableAmount + vatAmount + roundOffAmount;

        return {
            subTotal,
            taxableAmount: finalTaxableAmount,
            nonTaxableAmount: finalNonTaxableAmount,
            vatAmount,
            totalAmount,
            totalCCAmount
        };
    };

    const handleDiscountPercentageChange = (e) => {
        const value = parseFloat(e.target.value) || 0;
        const subTotal = calculateTotal().subTotal;
        const discountAmount = (subTotal * value) / 100;

        setFormData({
            ...formData,
            discountPercentage: value,
            discountAmount: discountAmount.toFixed(2)
        });
    };

    const handleDiscountAmountChange = (e) => {
        const value = parseFloat(e.target.value) || 0;
        const subTotal = calculateTotal().subTotal;
        const discountPercentage = subTotal > 0 ? (value / subTotal) * 100 : 0;

        setFormData({
            ...formData,
            discountAmount: value,
            discountPercentage: discountPercentage.toFixed(2)
        });
    };

    const fetchLastTransactions = async (itemId) => {
        try {
            const response = await api.get(`/api/transactions/${itemId}/${formData.accountId}/purchase`);
            setTransactions(response.data);
            setTransactionType('purchase');
            setShowTransactionModal(true);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }
    };

    const fetchSalesTransactions = async () => {
        if (!items[selectedItemIndex]) return;

        try {
            const response = await api.get(`/api/transactions/sales-by-item-account?itemId=${items[selectedItemIndex]._id}&accountId=${formData.accountId}`);
            setTransactions(response.data);
            setTransactionType('sales');
        } catch (error) {
            console.error('Error fetching sales transactions:', error);
        }
    };

    const fetchPurchaseTransactions = async () => {
        if (!items[selectedItemIndex]) return;

        try {
            const response = await api.get(`/api/transactions/purchase-by-item-account?itemId=${items[selectedItemIndex]._id}&accountId=${formData.accountId}`);
            setTransactions(response.data);
            setTransactionType('purchase');
        } catch (error) {
            console.error('Error fetching purchase transactions:', error);
        }
    };
    const openSalesPriceModal = (index) => {
        setSelectedItemIndex(index);
        const item = items[index];

        // Get the item from allItems to access the full data including stockEntries
        const fullItem = allItems.find(i => i._id === item.item) || item;
        // Get the latest stock entry (sorted by date in descending order)
        const latestStockEntry = fullItem.stockEntries[fullItem.stockEntries.length - 1]

        // Calculate initial values
        const prevPuPrice = (latestStockEntry?.puPrice * latestStockEntry?.WSUnit) || 0;
        const currentPuPrice = item.puPrice;
        const CCPercentage = latestStockEntry?.CCPercentage || 7.5;
        const marginPercentage = latestStockEntry?.marginPercentage || 0;
        const currency = latestStockEntry?.currency || 'NPR';
        const mrp = latestStockEntry?.mrp || 0;
        const salesPrice = latestStockEntry?.price || currentPuPrice;

        // Calculate CC amount
        const itemCCAmount = ((currentPuPrice * CCPercentage / 100) * (item.bonus || 0));

        setSalesPriceData({
            prevPuPrice: prevPuPrice,
            puPrice: currentPuPrice,
            CCPercentage: CCPercentage,
            itemCCAmount: itemCCAmount,
            marginPercentage: marginPercentage,
            currency: currency,
            mrp: mrp,
            salesPrice: salesPrice
        });

        setShowSalesPriceModal(true);
    };

    const saveSalesPrice = () => {
        if (selectedItemIndex === -1) return;

        const updatedItems = [...items];
        updatedItems[selectedItemIndex] = {
            ...updatedItems[selectedItemIndex],
            price: salesPriceData.salesPrice,
            mrp: salesPriceData.mrp,
            marginPercentage: salesPriceData.marginPercentage,
            currency: salesPriceData.currency,
            CCPercentage: salesPriceData.CCPercentage,
            itemCCAmount: salesPriceData.itemCCAmount
        };

        setItems(updatedItems);
        setShowSalesPriceModal(false);

        // Focus back on the search field
        setTimeout(() => {
            itemSearchRef.current?.focus();
            itemSearchRef.current?.select();
        }, 0);
    };

    const resetForm = async () => {
        try {
            setIsLoading(true); // Show loading state while refreshing data

            // Fetch all fresh data from the backend
            const response = await api.get('/api/retailer/purchase');
            const { data } = response;

            // Update all necessary states
            const currentNepaliDate = new NepaliDate().format('YYYY/MM/DD');
            const currentRomanDate = new Date().toISOString().split('T')[0];

            setFormData({
                accountId: '',
                accountName: '',
                accountAddress: '',
                accountPan: '',
                transactionDateNepali: currentNepaliDate,
                transactionDateRoman: currentRomanDate,
                nepaliDate: currentNepaliDate,
                billDate: currentRomanDate,
                billNumber: data.data.nextPurchaseBillNumber,
                partyBillNumber: '',
                paymentMode: 'credit',
                isVatExempt: 'all',
                discountPercentage: 0,
                discountAmount: 0,
                roundOffAmount: 0,
                CCAmount: 0,
                vatPercentage: 13,
                items: []
            });

            // Update all data states with fresh data
            setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
            const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
            setAccounts(sortedAccounts);
            setFilteredAccounts(sortedAccounts); // Reset filtered accounts to original list
            setStores(data.data.stores || []);
            setRacksByStore(data.data.racksByStore || {});
            setNextBillNumber(data.data.nextPurchaseBillNumber);
            setItems([]);
            clearDraft();

            // Clear the account search input if it exists
            if (accountSearchRef.current) {
                accountSearchRef.current.value = '';
            }

            // Focus back to the date field
            setTimeout(() => {
                if (transactionDateRef.current) {
                    transactionDateRef.current.focus();
                }
            }, 100);
        } catch (err) {
            console.error('Error resetting form:', err);
            setNotification({
                show: true,
                message: 'Error refreshing form data',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e, print = false) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const billData = {
                ...formData,
                items: items.map(item => ({
                    item: item.item,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    WSUnit: item.WSUnit,
                    quantity: item.quantity,
                    bonus: item.bonus,
                    unit: item.unit?._id,
                    puPrice: item.puPrice,
                    price: item.price,
                    mrp: item.mrp,
                    marginPercentage: item.marginPercentage,
                    currency: item.currency,
                    CCPercentage: item.CCPercentage,
                    itemCCAmount: item.itemCCAmount,
                    vatStatus: item.vatStatus,
                    store: item.store,
                    rack: item.rack
                })),
                vatPercentage: formData.vatPercentage,
                transactionDateNepali: formData.transactionDateNepali,
                transactionDateRoman: formData.transactionDateRoman,
                billDate: formData.billDate,
                nepaliDate: formData.nepaliDate,
                partyBillNumber: formData.partyBillNumber,
                isVatExempt: formData.isVatExempt,
                discountPercentage: formData.discountPercentage,
                paymentMode: formData.paymentMode,
                roundOffAmount: formData.roundOffAmount,
                print
            };

            const response = await api.post('/api/retailer/purchase', billData);

            setNotification({
                show: true,
                message: 'Purchase saved successfully!',
                type: 'success'
            });

            setItems([]);
            clearDraft();

            if (print) {
                setIsSaving(false);
                navigate(`/api/retailer/purchase/${response.data.data.bill._id}/print`);
            } else {
                setItems([]);
                setIsSaving(false);
                resetForm()
                // Focus back to the first field
                setTimeout(() => {
                    if (transactionDateRef.current) {
                        transactionDateRef.current.focus();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error saving purchase bill:', error);
            setNotification({
                show: true,
                message: 'Failed to save purchase. Please try again.',
                type: 'error'
            });
            setIsSaving(false);
        }
    };
    const totals = calculateTotal();

    const handleKeyDown = (e, currentFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.target.form;
            const inputs = Array.from(form.querySelectorAll('input, select, textarea')).filter(
                el => !el.hidden && !el.disabled && el.offsetParent !== null
            );
            const currentIndex = inputs.findIndex(input => input.id === currentFieldId);

            if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            }
        }
    };

    return (
        <div className="container-fluid">
            <Header />
            <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                <div className="card-header">
                    Purchase Entry
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit} id="billForm" className="needs-validation" noValidate>
                        <div className="form-group row">
                            {company.dateFormat === 'nepali' ? (
                                <>
                                    <div className="col">
                                        <label htmlFor="transactionDateNepali">Transaction Date:</label>
                                        <input
                                            type="date"
                                            name="transactionDateNepali"
                                            id="transactionDateNepali"
                                            ref={company.dateFormat === 'nepali' ? transactionDateRef : null}
                                            autoComplete='off'
                                            className={`form-control ${dateErrors.transactionDateNepali ? 'is-invalid' : ''}`}
                                            value={formData.transactionDateNepali ?
                                                new Date(formData.transactionDateNepali).toISOString().split('T')[0] :
                                                ''}
                                            onChange={(e) => {
                                                setFormData({ ...formData, transactionDateNepali: e.target.value });
                                                setDateErrors(prev => ({ ...prev, transactionDateNepali: '' }));
                                            }}
                                            onBlur={(e) => {
                                                try {
                                                    const dateStr = e.target.value;
                                                    if (!dateStr) {
                                                        setDateErrors(prev => ({ ...prev, transactionDateNepali: 'Date is required' }));
                                                        return;
                                                    }
                                                    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                                                        return;
                                                    }
                                                    const [year, month, day] = dateStr.split('/').map(Number);
                                                    if (month < 1 || month > 12) throw new Error("Month must be between 1-12");
                                                    if (day < 1 || day > 33) throw new Error("Day must be between 1-32");
                                                    const nepaliDate = new NepaliDate(year, month - 1, day);

                                                    setFormData({
                                                        ...formData,
                                                        transactionDateNepali: nepaliDate.format('MM/DD/YYYY')
                                                    });
                                                    setDateErrors(prev => ({ ...prev, transactionDateNepali: '' }));
                                                } catch (error) {
                                                    setDateErrors(prev => ({
                                                        ...prev,
                                                        transactionDateNepali: error.message || 'Invalid Nepali date'
                                                    }));
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                // Prevent moving to next field if current date is invalid
                                                if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateNepali) {
                                                    e.preventDefault();
                                                    e.target.focus();
                                                } else if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'transactionDateNepali');
                                                }
                                            }}
                                            required
                                        />
                                        {dateErrors.transactionDateNepali && (
                                            <div className="invalid-feedback">
                                                {dateErrors.transactionDateNepali}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col">
                                        <label htmlFor="nepaliDate">Invoice Date:</label>
                                        <input
                                            type="date"
                                            name="nepaliDate"
                                            id="nepaliDate"
                                            autoComplete='off'
                                            className={`form-control ${dateErrors.nepaliDate ? 'is-invalid' : ''}`}
                                            value={formData.nepaliDate ?
                                                new Date(formData.nepaliDate).toISOString().split('T')[0] :
                                                ''}
                                            onChange={(e) => {
                                                setFormData({ ...formData, nepaliDate: e.target.value });
                                                setDateErrors(prev => ({ ...prev, nepaliDate: '' }));
                                            }}
                                            onBlur={(e) => {
                                                try {
                                                    const dateStr = e.target.value.trim();
                                                    if (!dateStr) {
                                                        setDateErrors(prev => ({ ...prev, nepaliDate: 'Date is required' }));
                                                        return;
                                                    }

                                                    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                                                        return;
                                                    }

                                                    const [year, month, day] = dateStr.split('/').map(Number);
                                                    if (month < 1 || month > 12) throw new Error("Month must be between 1-12");
                                                    if (day < 1 || day > 33) throw new Error("Day must be between 1-32");

                                                    const nepaliDate = new NepaliDate(year, month - 1, day);

                                                    if (
                                                        nepaliDate.getYear() !== year ||
                                                        nepaliDate.getMonth() + 1 !== month ||
                                                        nepaliDate.getDate() !== day
                                                    ) {
                                                        throw new Error("Invalid Nepali date");
                                                    }

                                                    setFormData({
                                                        ...formData,
                                                        nepaliDate: nepaliDate.format('MM/DD/YYYY')
                                                    });
                                                    setDateErrors(prev => ({ ...prev, nepaliDate: '' }));
                                                } catch (error) {
                                                    setDateErrors(prev => ({
                                                        ...prev,
                                                        nepaliDate: error.message || 'Invalid Nepali date'
                                                    }));
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                // Prevent moving to next field if current date is invalid
                                                if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.nepaliDate) {
                                                    e.preventDefault();
                                                    e.target.focus();
                                                } else if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'nepaliDate');
                                                }
                                            }}
                                            required
                                        />
                                        {dateErrors.nepaliDate && (
                                            <div className="invalid-feedback">
                                                {dateErrors.nepaliDate}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="col">
                                        <label htmlFor="transactionDateRoman">Transaction Date:</label>
                                        <input
                                            type="date"
                                            name="transactionDateRoman"
                                            id="transactionDateRoman"
                                            className="form-control"
                                            ref={company.dateFormat === 'nepali' ? transactionDateRef : null}
                                            value={formData.transactionDateRoman}
                                            onChange={(e) => setFormData({ ...formData, transactionDateRoman: e.target.value })}
                                            required
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'fieldId');
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="col">
                                        <label htmlFor="billDate">Invoice Date:</label>
                                        <input
                                            type="date"
                                            name="billDate"
                                            id="billDate"
                                            className="form-control"
                                            value={formData.billDate}
                                            onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                                            required
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'fieldId');
                                                }
                                            }}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="col">
                                <label htmlFor="billNumber">Vch. No:</label>
                                <input
                                    type="text"
                                    name="billNumber"
                                    id="billNumber"
                                    className="form-control"
                                    value={formData.billNumber}
                                    readOnly
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            document.getElementById('paymentMode')?.focus(); // Explicitly focus next field
                                        }
                                    }}
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="paymentMode">Payment Mode:</label>
                                <select
                                    className="form-control"
                                    name="paymentMode"
                                    id="paymentMode"
                                    value={formData.paymentMode}
                                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'paymentMode');
                                        }
                                    }}
                                >
                                    <option value="credit">credit</option>
                                    <option value="cash">cash</option>
                                </select>
                            </div>

                            <div className="col">
                                <label htmlFor="partyBillNumber">Party Inv. No:</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="partyBillNumber"
                                    name="partyBillNumber"
                                    value={formData.partyBillNumber}
                                    onChange={(e) => setFormData({ ...formData, partyBillNumber: e.target.value })}
                                    autoComplete='off'
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            document.getElementById('isVatExempt')?.focus(); // Explicitly focus next field
                                        }
                                    }}
                                    required
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="isVatExempt">VAT:</label>
                                <select
                                    className="form-control"
                                    name="isVatExempt"
                                    id="isVatExempt"
                                    value={formData.isVatExempt}
                                    onChange={(e) => setFormData({ ...formData, isVatExempt: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'isVatExempt');
                                        }
                                    }}
                                >
                                    {company.vatEnabled && <option value="all">All</option>}
                                    {company.vatEnabled && <option value="false">13%</option>}
                                    <option value="true">Exempt</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group row">
                            <div className="col-6">
                                <label htmlFor="account">Party Name:</label>
                                <input
                                    type="text"
                                    id="account"
                                    name="account"
                                    className="form-control"
                                    value={formData.accountName}
                                    onClick={() => setShowAccountModal(true)}
                                    onFocus={() => setShowAccountModal(true)}
                                    readOnly
                                    required
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'fieldId');
                                        }
                                    }}
                                />
                                <input type="hidden" id="accountId" name="accountId" value={formData.accountId} />
                            </div>

                            <div className="col">
                                <label htmlFor="address">Party Address:</label>
                                <input
                                    type="text"
                                    id="address"
                                    className="form-control"
                                    value={formData.accountAddress}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'address');
                                        }
                                    }}
                                    readOnly
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="pan">Vat No:</label>
                                <input
                                    type="text"
                                    id="pan"
                                    name="pan"
                                    className="form-control"
                                    value={formData.accountPan}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'pan');
                                        }
                                    }}
                                    readOnly
                                />
                            </div>
                        </div>

                        <hr style={{ border: "1px solid gray" }} />

                        <div id="bill-details-container" style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
                            <table className="table table-bordered compact-table" id="itemsTable">
                                <thead>
                                    <tr>
                                        <th>S.N.</th>
                                        <th>#</th>
                                        <th>HSN</th>
                                        <th>Description of Goods</th>
                                        <th>WS Unit</th>
                                        <th>Batch</th>
                                        <th>Expiry</th>
                                        {storeManagementEnabled && <th>Store</th>}
                                        {storeManagementEnabled && <th>Rack</th>}
                                        <th>Qty</th>
                                        <th>Bonus</th>
                                        <th>Unit</th>
                                        <th>Rate</th>
                                        <th>Amount</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="items">
                                    {items.map((item, index) => (
                                        <tr key={index} className={`item ${item.vatStatus === 'vatable' ? 'vatable-item' : 'non-vatable-item'}`}>
                                            <td>{index + 1}</td>
                                            <td>{item.uniqueNumber}</td>
                                            <td>
                                                <input type="hidden" name={`items[${index}][hscode]`} value={item.hscode} />
                                                {item.hscode}
                                            </td>
                                            <td className="col-2">
                                                <input type="hidden" name={`items[${index}][item]`} value={item._id} />
                                                {item.name}
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    name={`items[${index}][WSUnit]`}
                                                    className="form-control item-WSUnit"
                                                    id={`WSUnit-${index}`}  // This ID format is important
                                                    value={item.WSUnit}
                                                    onChange={(e) => updateItemField(index, 'WSUnit', e.target.value)}
                                                    required
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            // Move to next field (batchNumber in this case)
                                                            document.getElementById(`batchNumber-${index}`)?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    name={`items[${index}][batchNumber]`}
                                                    className="form-control item-batchNumber"
                                                    id={`batchNumber-${index}`}
                                                    value={item.batchNumber}
                                                    onChange={(e) => updateItemField(index, 'batchNumber', e.target.value)}
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    required
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            // Move to next field (batchNumber in this case)
                                                            document.getElementById(`expiryDate-${index}`)?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="date"
                                                    name={`items[${index}][expiryDate]`}
                                                    className="form-control item-expiryDate"
                                                    id={`expiryDate-${index}`}
                                                    value={item.expiryDate}
                                                    onChange={(e) => updateItemField(index, 'expiryDate', e.target.value)}
                                                    required
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            // Move to next field (batchNumber in this case)
                                                            document.getElementById(`quantity-${index}`)?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>

                                            {storeManagementEnabled && (
                                                <td>
                                                    <select
                                                        name={`items[${index}][store]`}
                                                        className="form-control item-store"
                                                        id={`store-${index}`}
                                                        value={item.store || ''}
                                                        onChange={(e) => updateItemField(index, 'store', e.target.value || null)}
                                                        required={storeManagementEnabled}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                document.getElementById(`rack-${index}`)?.focus();
                                                            }
                                                        }}
                                                    >
                                                        <option value="">Select Store</option>
                                                        {stores.map(store => (
                                                            <option key={store._id} value={store._id}>{store.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                            )}

                                            {storeManagementEnabled && (
                                                <td>
                                                    <select
                                                        name={`items[${index}][rack]`}
                                                        className="form-control item-rack"
                                                        id={`rack-${index}`}
                                                        value={item.rack || ''}
                                                        onChange={(e) => updateItemField(index, 'rack', e.target.value || null)}
                                                        required={storeManagementEnabled}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                document.getElementById(`quantity-${index}`)?.focus();
                                                            }
                                                        }}
                                                    >
                                                        <option value="">Select Rack</option>
                                                        {racksByStore[item.store]?.map(rack => (
                                                            <option key={rack._id} value={rack._id}>{rack.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                            )}

                                            <td>
                                                <input
                                                    type="number"
                                                    name={`items[${index}][quantity]`}
                                                    className="form-control item-quantity"
                                                    id={`quantity-${index}`}
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                    required
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            document.getElementById(`bonus-${index}`)?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    name={`items[${index}][bonus]`}
                                                    className="form-control item-bonus"
                                                    id={`bonus-${index}`}
                                                    value={item.bonus}
                                                    onChange={(e) => updateItemField(index, 'bonus', e.target.value)}
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            document.getElementById(`puPrice-${index}`)?.focus();
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                {item.unit?.name}
                                                <input type="hidden" name={`items[${index}][unit]`} value={item.unit?._id} />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    name={`items[${index}][puPrice]`}
                                                    className="form-control item-puPrice"
                                                    id={`puPrice-${index}`}
                                                    value={item.puPrice}
                                                    onChange={(e) => updateItemField(index, 'puPrice', e.target.value)}
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault(); // optional, prevent form submission if inside a <form>
                                                            openSalesPriceModal(index);
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td className="item-amount">{item.amount}</td>
                                            <td className="align-middle">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </td>
                                            <input type="hidden" name={`items[${index}][vatStatus]`} value={item.vatStatus} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="form-group row">
                            <div className="col">
                                <label htmlFor="itemSearch">Search Item</label>
                                <input
                                    type="text"
                                    id="itemSearch"
                                    className="form-control"
                                    placeholder="Search for an item"
                                    autoComplete='off'
                                    onChange={(e) => {
                                        handleItemSearch(e);
                                        setShowItemDropdown(true);
                                    }}
                                    onFocus={() => {
                                        setShowItemDropdown(true);
                                        document.querySelectorAll('.dropdown-item').forEach(item => {
                                            item.classList.remove('active');
                                        });
                                    }}
                                    ref={itemSearchRef}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            const firstItem = document.querySelector('.dropdown-item');
                                            if (firstItem) {
                                                firstItem.classList.add('active');
                                                firstItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            // Always prevent default to stop form submission
                                            e.preventDefault();

                                            // Handle adding item if one is selected
                                            const activeItem = document.querySelector('.dropdown-item.active');
                                            if (activeItem) {
                                                const index = parseInt(activeItem.getAttribute('data-index'));
                                                const filteredItem = filteredItems.length > 0 ? filteredItems[index] : allItems[index];
                                                if (filteredItem) {
                                                    addItemToBill(filteredItem);
                                                }
                                            }
                                            // Move to discount if search is empty AND there are items
                                            else if (!e.target.value && items.length > 0) {
                                                setShowItemDropdown(false); // Hide dropdown first
                                                setTimeout(() => {
                                                    document.getElementById('discountPercentage')?.focus();
                                                }, 0);
                                            }
                                        }
                                    }}
                                />
                                {showItemDropdown && (
                                    <div
                                        id="dropdownMenu"
                                        className="dropdown-menu show"
                                        style={{
                                            maxHeight: '280px',
                                            height: '280px',
                                            overflowY: 'auto',
                                            position: 'absolute',
                                            width: '100%',
                                            zIndex: 1000,
                                            border: '1px solid #ddd',
                                            borderRadius: '4px'
                                        }}
                                        ref={itemDropdownRef}
                                    >
                                        <div className="dropdown-header" style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(7, 1fr)',
                                            alignItems: 'center',
                                            padding: '0 10px',
                                            height: '40px',
                                            background: '#f0f0f0',
                                            fontWeight: 'bold',
                                            borderBottom: '1px solid #dee2e6'
                                        }}>
                                            <div><strong>#</strong></div>
                                            <div><strong>HSN</strong></div>
                                            <div><strong>Description</strong></div>
                                            <div><strong>Category</strong></div>
                                            <div><strong>Qty</strong></div>
                                            <div><strong>Unit</strong></div>
                                            <div><strong>Rate</strong></div>
                                        </div>

                                        {/* Show items or no items message */}
                                        {filteredItems.length > 0 ? (
                                            filteredItems
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((item, index) => (
                                                    <div
                                                        key={index}
                                                        data-index={index}
                                                        className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'} expiry-${calculateExpiryStatus(item)}`}
                                                        style={{
                                                            height: '40px',
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(7, 1fr)',
                                                            alignItems: 'center',
                                                            padding: '0 10px',
                                                            borderBottom: '1px solid #eee',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => addItemToBill(item)}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                addItemToBill(item);
                                                            } else if (e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                const nextItem = e.target.nextElementSibling;
                                                                if (nextItem) {
                                                                    e.target.classList.remove('active');
                                                                    nextItem.classList.add('active');
                                                                    nextItem.focus();
                                                                }
                                                            } else if (e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                const prevItem = e.target.previousElementSibling;
                                                                if (prevItem) {
                                                                    e.target.classList.remove('active');
                                                                    prevItem.classList.add('active');
                                                                    prevItem.focus();
                                                                } else {
                                                                    itemSearchRef.current.focus();
                                                                }
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            document.querySelectorAll('.dropdown-item').forEach(item => {
                                                                item.classList.remove('active');
                                                            });
                                                            e.target.classList.add('active');
                                                        }}
                                                    >
                                                        <div>{item.uniqueNumber || 'N/A'}</div>
                                                        <div>{item.hscode || 'N/A'}</div>
                                                        <div className="dropdown-items-name">{item.name}</div>
                                                        <div>{item.category?.name || 'No Category'}</div>
                                                        <div>{item.stock || 0}</div>
                                                        <div>{item.unit?.name || ''}</div>
                                                        <div>Rs.{item.latestPuPrice || 0}</div>
                                                    </div>
                                                ))
                                        ) : itemSearchRef.current?.value ? (
                                            <div className="text-center py-3 text-muted">
                                                No items found matching "{itemSearchRef.current.value}"
                                            </div>
                                        ) : allItems.length > 0 ? (
                                            allItems
                                                // Filter items based on VAT selection
                                                .filter(item => {
                                                    if (formData.isVatExempt === 'all') return true;
                                                    if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
                                                    if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
                                                    return true;
                                                })
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((item, index) => (
                                                    <div
                                                        key={index}
                                                        data-index={index}
                                                        className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'}`}
                                                        style={{
                                                            height: '40px',
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(7, 1fr)',
                                                            alignItems: 'center',
                                                            padding: '0 10px',
                                                            borderBottom: '1px solid #eee',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => addItemToBill(item)}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                addItemToBill(item);
                                                            } else if (e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                const nextItem = e.target.nextElementSibling;
                                                                if (nextItem) {
                                                                    e.target.classList.remove('active');
                                                                    nextItem.classList.add('active');
                                                                    nextItem.focus();
                                                                }
                                                            } else if (e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                const prevItem = e.target.previousElementSibling;
                                                                if (prevItem) {
                                                                    e.target.classList.remove('active');
                                                                    prevItem.classList.add('active');
                                                                    prevItem.focus();
                                                                } else {
                                                                    itemSearchRef.current.focus();
                                                                }
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            document.querySelectorAll('.dropdown-item').forEach(item => {
                                                                item.classList.remove('active');
                                                            });
                                                            e.target.classList.add('active');
                                                        }}
                                                    >
                                                        <div>{item.uniqueNumber || 'N/A'}</div>
                                                        <div>{item.hscode || 'N/A'}</div>
                                                        <div className="dropdown-items-name">{item.name}</div>
                                                        <div>{item.category?.name || 'No Category'}</div>
                                                        <div>{item.stock || 0}</div>
                                                        <div>{item.unit?.name || ''}</div>
                                                        <div>Rs.{item.latestPuPrice || 0}</div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-3 text-muted">
                                                No items available
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <hr style={{ border: "1px solid gray" }} />

                        <div className="table-responsive">
                            <table className="table table-bordered">
                                <thead>
                                    <tr>
                                        <th colSpan="6" className="text-center bg-light">Bill Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><label htmlFor="subTotal">Sub Total:</label></td>
                                        <td>
                                            <p className="form-control-plaintext">Rs. {totals.subTotal.toFixed(2)}</p>
                                        </td>
                                        <td><label htmlFor="discountPercentage">Discount %:</label></td>
                                        <td>
                                            <input
                                                type="number"
                                                step="any"
                                                name="discountPercentage"
                                                id="discountPercentage"
                                                className="form-control"
                                                value={formData.discountPercentage}
                                                onChange={handleDiscountPercentageChange}
                                                onFocus={(e) => {
                                                    e.target.select();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'discountPercentage');
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td><label htmlFor="discountAmount">Discount (Rs.):</label></td>
                                        <td>
                                            <input
                                                type="number"
                                                step="any"
                                                name="discountAmount"
                                                id="discountAmount"
                                                value={formData.discountAmount}
                                                className="form-control"
                                                onChange={handleDiscountAmountChange}
                                                onFocus={(e) => {
                                                    e.target.select();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'discountAmount');
                                                    }
                                                }}
                                            />
                                        </td>
                                    </tr>

                                    <tr id="taxableAmountRow">
                                        <td><label htmlFor="CCAmount">CC Charge</label></td>
                                        <td>
                                            <input
                                                type="number"
                                                name="CCAmount"
                                                id="CCAmount"
                                                className="form-control"
                                                value={totals.totalCCAmount.toFixed(2)}
                                                readOnly
                                                onFocus={(e) => {
                                                    e.target.select();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'CCAmount');
                                                    }
                                                }}
                                            />
                                        </td>
                                        {formData.isVatExempt !== 'true' && (
                                            <>
                                                <td><label htmlFor="taxableAmount">Taxable Amount:</label></td>
                                                <td>
                                                    <p className="form-control-plaintext">Rs. {totals.taxableAmount.toFixed(2)}</p>
                                                </td>
                                                <td className="d-none">
                                                    <input
                                                        type="number"
                                                        name="vatPercentage"
                                                        id="vatPercentage"
                                                        className="form-control"
                                                        value={formData.vatPercentage}
                                                        readOnly
                                                    />
                                                </td>
                                                <td><label htmlFor="vatAmount">VAT (13%):</label></td>
                                                <td>
                                                    <p className="form-control-plaintext">Rs. {totals.vatAmount.toFixed(2)}</p>
                                                </td>
                                            </>
                                        )}
                                        {/* Add empty cells to maintain table structure when exempt */}
                                        {formData.isVatExempt === 'true' && (
                                            <>
                                                <td colSpan="4"></td>
                                            </>
                                        )}
                                    </tr>
                                    <tr>
                                        <td><label htmlFor="roundOffAmount">Round Off:</label></td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-control"
                                                step="any"
                                                id="roundOffAmount"
                                                name="roundOffAmount"
                                                value={formData.roundOffAmount}
                                                onChange={(e) => setFormData({ ...formData, roundOffAmount: e.target.value })}
                                                onFocus={(e) => {
                                                    e.target.select();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        document.getElementById('saveBill')?.focus();
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td><label htmlFor="totalAmount">Total Amount:</label></td>
                                        <td>
                                            <p className="form-control-plaintext">Rs. {totals.totalAmount.toFixed(2)}</p>
                                        </td>
                                        <td><label htmlFor="amountInWords">In Words:</label></td>
                                        <td className="col-3">
                                            <p className="form-control-plaintext" id="amountInWords">
                                                {convertToRupeesAndPaisa(totals.totalAmount)} Only.
                                            </p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="d-flex justify-content-end mt-4">
                            <button
                                type="submit"
                                className="btn btn-primary mr-2 p-3"
                                id="saveBill"
                                disabled={isSaving}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                            >
                                {isSaving ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Saving...
                                    </>
                                ) : (
                                    <i className="bi bi-save"></i>
                                )}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary p-3"
                                onClick={(e) => handleSubmit(e, true)}
                                disabled={isSaving}
                            >
                                <i className="bi bi-printer"></i>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Account Modal */}
            {showAccountModal && (
                <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content" style={{ height: '500px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title" id="accountModalLabel">Select an Account</h5>
                                <button type="button" className="btn-close" onClick={() => setShowAccountModal(false)}></button>
                            </div>
                            <div className="p-3 bg-white sticky-top">
                                <input
                                    type="text"
                                    id="searchAccount"
                                    className="form-control form-control-sm"
                                    placeholder="Search Account"
                                    autoFocus
                                    autoComplete='off'
                                    onChange={handleAccountSearch}
                                    onKeyDown={(e) => {
                                        // Handle arrow keys and Enter in search input
                                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item');
                                            if (firstAccountItem) {
                                                firstAccountItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item.active');
                                            if (firstAccountItem) {
                                                const accountId = firstAccountItem.getAttribute('data-account-id');
                                                const account = filteredAccounts.length > 0
                                                    ? filteredAccounts.find(a => a._id === accountId)
                                                    : accounts.find(a => a._id === accountId);
                                                if (account) {
                                                    selectAccount(account);
                                                    document.getElementById('address').focus();
                                                }
                                            }
                                        }
                                    }}
                                    ref={accountSearchRef}
                                />
                            </div>
                            <div className="modal-body p-0">
                                <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
                                    <ul id="accountList" className="list-group">
                                        {filteredAccounts.length > 0 ? (
                                            filteredAccounts
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((account, index) => (
                                                    <li
                                                        key={account._id}
                                                        data-account-id={account._id}
                                                        className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
                                                        onClick={() => {
                                                            selectAccount(account);
                                                            document.getElementById('address').focus();
                                                        }}
                                                        style={{ cursor: 'pointer' }}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            // Handle keyboard navigation
                                                            if (e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                const nextItem = e.target.nextElementSibling;
                                                                if (nextItem) {
                                                                    e.target.classList.remove('active');
                                                                    nextItem.classList.add('active');
                                                                    nextItem.focus();
                                                                }
                                                            } else if (e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                const prevItem = e.target.previousElementSibling;
                                                                if (prevItem) {
                                                                    e.target.classList.remove('active');
                                                                    prevItem.classList.add('active');
                                                                    prevItem.focus();
                                                                } else {
                                                                    // If at top, go back to search input
                                                                    accountSearchRef.current.focus();
                                                                }
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                selectAccount(account);
                                                                document.getElementById('address').focus();
                                                            }
                                                        }}
                                                        onFocus={(e) => {
                                                            // Remove active class from all items and add to focused one
                                                            document.querySelectorAll('.account-item').forEach(item => {
                                                                item.classList.remove('active');
                                                            });
                                                            e.target.classList.add('active');
                                                        }}
                                                    >
                                                        <div className="d-flex justify-content-between small">
                                                            <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
                                                            <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
                                                        </div>
                                                    </li>
                                                ))
                                        ) : (
                                            // If search is active and no result found
                                            accountSearchRef.current?.value ? (
                                                <li className="list-group-item text-center text-muted small py-2">No accounts found</li>
                                            ) : (
                                                accounts
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((account, index) => (
                                                        <li
                                                            key={account._id}
                                                            data-account-id={account._id}
                                                            className={`list-group-item account-item py-2 ${index === 0 ? 'active' : ''}`}
                                                            onClick={() => {
                                                                selectAccount(account);
                                                                document.getElementById('address').focus();
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                            tabIndex={0}
                                                            onKeyDown={(e) => {
                                                                // Handle keyboard navigation
                                                                if (e.key === 'ArrowDown') {
                                                                    e.preventDefault();
                                                                    const nextItem = e.target.nextElementSibling;
                                                                    if (nextItem) {
                                                                        e.target.classList.remove('active');
                                                                        nextItem.classList.add('active');
                                                                        nextItem.focus();
                                                                    }
                                                                } else if (e.key === 'ArrowUp') {
                                                                    e.preventDefault();
                                                                    const prevItem = e.target.previousElementSibling;
                                                                    if (prevItem) {
                                                                        e.target.classList.remove('active');
                                                                        prevItem.classList.add('active');
                                                                        prevItem.focus();
                                                                    } else {
                                                                        // If at top, go back to search input
                                                                        accountSearchRef.current.focus();
                                                                    }
                                                                } else if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    selectAccount(account);
                                                                    document.getElementById('address').focus();
                                                                }
                                                            }}
                                                            onFocus={(e) => {
                                                                // Remove active class from all items and add to focused one
                                                                document.querySelectorAll('.account-item').forEach(item => {
                                                                    item.classList.remove('active');
                                                                });
                                                                e.target.classList.add('active');
                                                            }}
                                                        >
                                                            <div className="d-flex justify-content-between small">
                                                                <strong>{account.uniqueNumber || 'N/A'} {account.name}</strong>
                                                                <span>📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}</span>
                                                            </div>
                                                        </li>
                                                    ))
                                            )
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction Modal */}
            {showTransactionModal && (
                <div className="modal fade show" id="transactionModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="transactionModalLabel">Last Transactions</h5>
                                <button type="button" className="close" onClick={() => setShowTransactionModal(false)}>
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover mb-0">
                                        <thead>
                                            <tr className="sticky-top bg-light">
                                                <th>S.N.</th>
                                                <th>Date</th>
                                                <th>{transactionType === 'purchase' ? 'Vch. No.' : 'Inv. No.'}</th>
                                                <th>Type</th>
                                                <th>A/c Type</th>
                                                <th>Pay.Mode</th>
                                                <th>Qty.</th>
                                                <th>Unit</th>
                                                <th>Unit Rate</th>
                                                <th>Disc</th>
                                                <th>Nett. Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map((transaction, index) => (
                                                <tr
                                                    key={index}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => {
                                                        navigate(transactionType === 'purchase'
                                                            ? `/purchase-bills/${transaction.purchaseBillId._id}/print`
                                                            : `/bills/${transaction.billId._id}/print`);
                                                    }}
                                                >
                                                    <td>{index + 1}</td>
                                                    <td>{new Date(transaction.date).toLocaleDateString()}</td>
                                                    <td>{transaction.billNumber}</td>
                                                    <td>{transaction.type}</td>
                                                    <td>{transaction.purchaseSalesType}</td>
                                                    <td>{transaction.paymentMode}</td>
                                                    <td>{transaction.quantity}</td>
                                                    <td>{transaction.unit?.name || 'N/A'}</td>
                                                    <td>Rs.{Math.round(transaction.puPrice * 100) / 100}</td>
                                                    <td>{Math.round(transaction.discountPercentagePerItem * 100) / 100} %</td>
                                                    <td>Rs.{Math.round(transaction.netPuPrice * 100) / 100}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    id="showSalesTransactions"
                                    className="btn btn-info"
                                    onClick={fetchSalesTransactions}
                                >
                                    <i className="bi bi-receipt"></i> Show Sales Transactions
                                </button>
                                <button
                                    id="showPurchaseTransactions"
                                    className="btn btn-info"
                                    onClick={fetchPurchaseTransactions}
                                >
                                    <i className="bi bi-cart"></i> Show Purchase Transactions
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowTransactionModal(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sales Price Modal */}
            {showSalesPriceModal && (
                <div className="modal fade show" id="setSalesPriceModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="setSalesPriceModalLabel">Set Sales Price for New Batch</h5>
                                <button type="button" className="btn-close" onClick={() => setShowSalesPriceModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col">
                                        <label htmlFor="prevPuPrice" className="form-label">Prev. Price</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="prePuPrice"
                                            step="any"
                                            value={salesPriceData.prevPuPrice.toFixed(2)}
                                            readOnly
                                        />
                                    </div>
                                    <div className="col">
                                        <label htmlFor="puPrice" className="form-label">New Price</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="puPrice"
                                            step="any"
                                            value={salesPriceData.puPrice}
                                            readOnly
                                        />
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col">
                                        <label htmlFor="CCPercentage" className="form-label">CC (%)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="CCPercentage"
                                            autoFocus
                                            step="any"
                                            value={salesPriceData.CCPercentage}
                                            onFocus={(e) => {
                                                e.target.select();
                                            }}
                                            onChange={(e) => {
                                                const CCPercentage = parseFloat(e.target.value) || 0;
                                                const item = items[selectedItemIndex];
                                                const itemCCAmount = ((salesPriceData.puPrice * CCPercentage / 100) * (item.bonus || 0));

                                                setSalesPriceData({
                                                    ...salesPriceData,
                                                    CCPercentage: CCPercentage,
                                                    itemCCAmount: itemCCAmount
                                                });
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    document.getElementById('itemCCAmount')?.focus();
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="col">
                                        <label htmlFor="itemCCAmount" className="form-label">CC Charge</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="itemCCAmount"
                                            step="any"
                                            onFocus={(e) => {
                                                e.target.select();
                                            }}
                                            value={salesPriceData.itemCCAmount.toFixed(2)}
                                            readOnly // Make it read-only since it's calculated
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    document.getElementById('marginPercentage')?.focus();
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="marginPercentage" className="form-label">Margin Percentage (%)</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="marginPercentage"
                                        min="0"
                                        step="any"
                                        value={Math.round(salesPriceData.marginPercentage * 100) / 100}
                                        onFocus={(e) => {
                                            e.target.select();
                                        }}
                                        onChange={(e) => {
                                            const margin = parseFloat(e.target.value) || 0;
                                            const puPrice = parseFloat(salesPriceData.puPrice) || 0;
                                            const salesPrice = puPrice + (puPrice * margin / 100);

                                            setSalesPriceData({
                                                ...salesPriceData,
                                                marginPercentage: margin,
                                                salesPrice: parseFloat(salesPrice.toFixed(2))
                                            });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const margin = parseFloat(e.target.value) || 0;
                                                const puPrice = parseFloat(salesPriceData.puPrice) || 0;
                                                const salesPrice = puPrice + (puPrice * margin / 100);

                                                setSalesPriceData({
                                                    ...salesPriceData,
                                                    marginPercentage: margin,
                                                    salesPrice: parseFloat(salesPrice.toFixed(2))
                                                });
                                                document.getElementById('currency')?.focus();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="currency" className="form-label">Currency</label>
                                    <select
                                        className="form-select"
                                        id="currency"
                                        value={salesPriceData.currency}
                                        onChange={(e) => setSalesPriceData({ ...salesPriceData, currency: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('mrp')?.focus();
                                            }
                                        }}
                                    >
                                        <option value="NPR">NPR</option>
                                        <option value="INR">INR</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="mrp" className="form-label">MRP</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="mrp"
                                        step="any"
                                        value={salesPriceData.mrp}
                                        onFocus={(e) => {
                                            e.target.select();
                                        }}
                                        onChange={(e) => {
                                            const mrp = parseFloat(e.target.value) || 0;
                                            const salesPrice = salesPriceData.currency === 'INR' ? mrp * 1.6 : mrp;
                                            const margin = ((salesPrice - salesPriceData.puPrice) / salesPriceData.puPrice) * 100;
                                            setSalesPriceData({
                                                ...salesPriceData,
                                                mrp: mrp,
                                                salesPrice: salesPrice,
                                                marginPercentage: margin
                                            });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('salesPrice')?.focus();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="salesPrice" className="form-label">Sales Price</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="salesPrice"
                                        step="any"
                                        value={Math.round(salesPriceData.salesPrice * 100) / 100}
                                        onFocus={(e) => {
                                            e.target.select();
                                        }}
                                        onChange={(e) => {
                                            const salesPrice = parseFloat(e.target.value) || 0;
                                            const margin = ((salesPrice - salesPriceData.puPrice) / salesPriceData.puPrice) * 100;
                                            setSalesPriceData({
                                                ...salesPriceData,
                                                salesPrice: salesPrice,
                                                marginPercentage: margin
                                            });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('saveSalesPrice')?.focus();
                                            }
                                        }}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    id='saveSalesPriceClose'
                                    onClick={() => setShowSalesPriceModal(false)}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    id='saveSalesPrice'
                                    onClick={() => {
                                        saveSalesPrice();
                                    }}
                                >
                                    Save Sales Price
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </div>
    );
};

// Helper functions
function convertToRupeesAndPaisa(amount) {
    const rupees = Math.floor(amount);
    const paisa = Math.round((amount - rupees) * 100);

    let words = '';

    if (rupees > 0) {
        words += numberToWords(rupees) + ' Rupees';
    }

    if (paisa > 0) {
        words += (rupees > 0 ? ' and ' : '') + numberToWords(paisa) + ' Paisa';
    }

    return words || 'Zero Rupees';
}

function numberToWords(num) {
    const ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'
    ];

    const tens = [
        '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    const scales = ['', 'Thousand', 'Million', 'Billion'];

    function convertHundreds(num) {
        let words = '';

        if (num > 99) {
            words += ones[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }

        if (num > 19) {
            words += tens[Math.floor(num / 10)] + ' ';
            num %= 10;
        }

        if (num > 0) {
            words += ones[num] + ' ';
        }

        return words.trim();
    }

    if (num === 0) return 'Zero';
    if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

    let words = '';

    for (let i = 0; i < scales.length; i++) {
        let unit = Math.pow(1000, scales.length - i - 1);
        let currentNum = Math.floor(num / unit);

        if (currentNum > 0) {
            words += convertHundreds(currentNum) + ' ' + scales[scales.length - i - 1] + ' ';
        }

        num %= unit;
    }

    return words.trim();
}

export default AddPurchase;
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';
import axios from 'axios';
import Header from '../Header';
import '../../../stylesheet/retailer/salesReturn/AddCashSalesReturn.css';
import NotificationToast from '../../NotificationToast';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/noDateIcon.css'
import ProductModal from '../dashboard/modals/ProductModal';
import useDebounce from '../../../hooks/useDebounce';
import VirtualizedItemList from '../../VirtualizedItemList';

const AddCashSalesReturn = () => {
    const navigate = useNavigate();
    const transactionDateRef = useRef(null);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const addressRef = useRef(null);
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const itemsTableRef = useRef(null);

    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [dateErrors, setDateErrors] = useState({
        transactionDateNepali: '',
        nepaliDate: ''
    });

    // Add this state near your other state declarations
    const [printAfterSave, setPrintAfterSave] = useState(
        localStorage.getItem('printAfterSaveCashSalesReturn') === 'true' || false
    );

    const [formData, setFormData] = useState({
        accountId: '',
        accountName: '',
        accountAddress: '',
        accountPhone: '',
        transactionDateNepali: currentNepaliDate,
        transactionDateRoman: new Date().toISOString().split('T')[0],
        nepaliDate: currentNepaliDate,
        billDate: new Date().toISOString().split('T')[0],
        billNumber: '',
        paymentMode: 'cash',
        isVatExempt: 'all',
        discountPercentage: 0,
        discountAmount: 0,
        roundOffAmount: 0,
        vatPercentage: 13,
        items: []
    });

    const [items, setItems] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const itemDropdownRef = useRef(null);
    const [currentFocus, setCurrentFocus] = useState(0);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [showProductModal, setShowProductModal] = useState(false);
    // Add these state variables with your existing state declarations
    const [searchQuery, setSearchQuery] = useState('');
    const [lastSearchQuery, setLastSearchQuery] = useState(''); // Store the last search
    const [shouldShowLastSearchResults, setShouldShowLastSearchResults] = useState(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 50);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });

    const [nextBillNumber, setNextBillNumber] = useState('');

    const accountSearchRef = useRef(null);
    const itemSearchRef = useRef(null);
    const accountModalRef = useRef(null);
    const transactionModalRef = useRef(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/retailer/cash/sales-return');
                const { data } = response;

                const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
                const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

                setCompany(data.data.company);
                setAllItems(sortedItems);
                setAccounts(sortedAccounts);
                setNextBillNumber(data.data.nextSalesReturnBillNumber);

                setFormData(prev => ({
                    ...prev,
                    billNumber: data.data.nextSalesReturnBillNumber
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
            const timer = setTimeout(() => {
                transactionDateRef.current.focus();
            }, 50);

            return () => clearTimeout(timer);
        }
    }, [isInitialDataLoaded, company.dateFormat]);

    useEffect(() => {
        // Add F9 key handler here
        const handF9leKeyDown = (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                setShowProductModal(prev => !prev); // Toggle modal visibility
            }
        };
        window.addEventListener('keydown', handF9leKeyDown);
        return () => {
            window.removeEventListener('keydown', handF9leKeyDown);
        };
    }, []);

    useEffect(() => {
        calculateTotal();
    }, [items, formData]);

    useEffect(() => {
        if (itemSearchRef.current?.value) {
            handleItemSearch({ target: { value: itemSearchRef.current.value } });
        } else {
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
            (account.phone && account.phone.toLowerCase().includes(searchText)) ||
            (account.address && account.address.toLowerCase().includes(searchText))
        ).sort((a, b) => a.name.localeCompare(b.name));

        setFilteredAccounts(filtered);
    };

    const selectAccount = (account) => {
        setFormData({
            ...formData,
            accountId: account._id,
            accountName: account.name,
            accountAddress: account.address || '',
            accountPhone: account.phone || ''
        });
        setShowAccountModal(false);
    };

    // const handleItemSearch = (e) => {
    //     const query = e.target.value.toLowerCase();

    //     if (query.length === 0) {
    //         setFilteredItems([]);
    //         return;
    //     }

    //     let filtered = allItems.filter(item => {
    //         const matchesSearch = item.name.toLowerCase().includes(query) ||
    //             (item.hscode && item.hscode.toString().toLowerCase().includes(query)) ||
    //             (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query));

    //         if (formData.isVatExempt === 'all') {
    //             return matchesSearch;
    //         } else if (formData.isVatExempt === 'false') {
    //             return matchesSearch && item.vatStatus === 'vatable';
    //         } else if (formData.isVatExempt === 'true') {
    //             return matchesSearch && item.vatStatus === 'vatExempt';
    //         }
    //         return matchesSearch;
    //     }).sort((a, b) => a.name.localeCompare(b.name));

    //     setFilteredItems(filtered);
    // };

    const handleItemSearch = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchQuery(query);

        // When user starts typing, disable showing last search results
        if (query.length > 0) {
            setShouldShowLastSearchResults(false);
        }

        setShowItemDropdown(true);
    };

    const addItemToBill = (item) => {

        // Store the current search query before clearing
        if (itemSearchRef.current?.value) {
            setLastSearchQuery(itemSearchRef.current.value);
            setShouldShowLastSearchResults(true);
        }

        const newItem = {
            item: item._id,
            uniqueNumber: item.uniqueNumber || 'N/A',
            hscode: item.hscode,
            name: item.name,
            batchNumber: 'XXX',
            expiryDate: getDefaultExpiryDate(),
            quantity: 0,
            unit: item.unit,
            price: item.latestPrice || 0,
            amount: 0,
            vatStatus: item.vatStatus
        };

        setItems([...items, newItem]);
        setShowItemDropdown(false);
        // itemSearchRef.current.value = '';

        // Clear the input field but preserve the search query in memory
        setSearchQuery('');
        if (itemSearchRef.current) {
            itemSearchRef.current.value = '';
        }

        setTimeout(() => {
            document.getElementById(`batchNumber-${items.length}`)?.focus();
        }, 100);
    };

    const getDefaultExpiryDate = () => {
        const today = new Date();
        today.setFullYear(today.getFullYear() + 2);
        return today.toISOString().split('T')[0];
    };

    // Memoized filtered items calculation
    const memoizedFilteredItems = React.useMemo(() => {
        // If we should show last search results and there's a last search query
        if (shouldShowLastSearchResults && lastSearchQuery && !searchQuery) {
            return allItems.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(lastSearchQuery.toLowerCase()) ||
                    (item.hscode && item.hscode.toString().toLowerCase().includes(lastSearchQuery.toLowerCase())) ||
                    (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(lastSearchQuery.toLowerCase())) ||
                    (item.category && item.category.name.toLowerCase().includes(lastSearchQuery.toLowerCase()));

                if (formData.isVatExempt === 'all') return matchesSearch;
                if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
                if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
                return matchesSearch;
            });
        }

        // Normal search behavior
        if (!searchQuery && allItems.length > 0) {
            return allItems.filter(item => {
                if (formData.isVatExempt === 'all') return true;
                if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
                if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
                return true;
            });
        }

        if (searchQuery.length === 0) return [];

        return allItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.hscode && item.hscode.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.category && item.category.name.toLowerCase().includes(searchQuery.toLowerCase()));

            if (formData.isVatExempt === 'all') return matchesSearch;
            if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
            if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
            return matchesSearch;
        });
    }, [allItems, formData.isVatExempt, searchQuery, lastSearchQuery, shouldShowLastSearchResults]);

    const scrollToItemsTable = () => {
        if (itemsTableRef.current) {
            // Add a small delay to ensure the DOM is updated
            setTimeout(() => {
                itemsTableRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 100);
        }
    };

    // Update your search input's onFocus handler
    const handleSearchFocus = () => {
        setShowItemDropdown(true);

        // If we have a last search query and the input is empty, show those results
        if (lastSearchQuery && !searchQuery) {
            setShouldShowLastSearchResults(true);
        }

        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.remove('active');
        });

        scrollToItemsTable();
    };

    const updateItemField = (index, field, value) => {
        const updatedItems = [...items];
        updatedItems[index][field] = value;

        if (field === 'quantity' || field === 'price') {
            updatedItems[index].amount = (updatedItems[index].quantity * updatedItems[index].price).toFixed(2);
        }

        setItems(updatedItems);

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

    const calculateTotal = (itemsToCalculate = items) => {
        let subTotal = 0;
        let taxableAmount = 0;
        let nonTaxableAmount = 0;

        itemsToCalculate.forEach(item => {
            subTotal += parseFloat(item.amount) || 0;

            if (item.vatStatus === 'vatable') {
                taxableAmount += parseFloat(item.amount) || 0;
            } else {
                nonTaxableAmount += parseFloat(item.amount) || 0;
            }
        });

        const discountPercentage = parseFloat(formData.discountPercentage) || 0;
        const discountAmount = parseFloat(formData.discountAmount) || 0;

        const discountForTaxable = (taxableAmount * discountPercentage) / 100;
        const discountForNonTaxable = (nonTaxableAmount * discountPercentage) / 100;

        const finalTaxableAmount = taxableAmount - discountForTaxable;
        const finalNonTaxableAmount = nonTaxableAmount - discountForNonTaxable;

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
            totalAmount
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
            const response = await api.get(`/api/retailer/transactions/${itemId}/${formData.accountId}/sales`);
            setTransactions(response.data);
            setShowTransactionModal(true);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }
    };

    // Add this useEffect to reset search memory
    useEffect(() => {
        return () => {
            // Reset search memory when component unmounts
            setLastSearchQuery('');
            setShouldShowLastSearchResults(false);
        };
    }, []);

    const resetForm = async () => {
        try {
            setIsLoading(true); // Show loading state while refreshing data

            // Fetch fresh data from the backend
            const response = await api.get('/api/retailer/cash/sales-return');
            const { data } = response;

            // Update all necessary states
            const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
            const currentRomanDate = new Date().toISOString().split('T')[0];

            setFormData({
                cashAccount: '',
                cashAccountAddress: '',
                cashAccountPan: '',
                cashAccountEmail: '',
                cashAccountPhone: '',
                transactionDateNepali: currentNepaliDate,
                transactionDateRoman: currentRomanDate,
                nepaliDate: currentNepaliDate,
                billDate: currentRomanDate,
                billNumber: data.data.nextSalesReturnBillNumber,
                paymentMode: 'cash',
                isVatExempt: 'all',
                discountPercentage: 0,
                discountAmount: 0,
                roundOffAmount: 0,
                vatPercentage: 13,
                items: []
            });

            // Update all data states with fresh data
            setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
            const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
            setAccounts(sortedAccounts);
            setFilteredAccounts([]); // Reset filtered accounts
            setNextBillNumber(data.data.nextSalesReturnBillNumber);
            setItems([]);

            // Reset search memory
            setSearchQuery('');
            setLastSearchQuery('');
            setShouldShowLastSearchResults(false);

            if (itemSearchRef.current) {
                itemSearchRef.current.value = '';
            }

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


    // const handleSubmit = async (e, print = false) => {
    //     // Prevent default only if event exists (form submission)
    //     if (e) {
    //         e.preventDefault();
    //     }

    //     setIsSaving(true);

    //     try {
    //         const billData = {
    //             ...formData,
    //             items: items.map(item => ({
    //                 item: item.item,
    //                 batchNumber: item.batchNumber,
    //                 expiryDate: item.expiryDate,
    //                 quantity: item.quantity,
    //                 unit: item.unit?._id,
    //                 price: item.price,
    //                 vatStatus: item.vatStatus
    //             })),
    //             vatPercentage: formData.vatPercentage,
    //             transactionDateNepali: formData.transactionDateNepali,
    //             transactionDateRoman: formData.transactionDateRoman,
    //             billDate: formData.billDate,
    //             nepaliDate: formData.nepaliDate,
    //             isVatExempt: formData.isVatExempt,
    //             discountPercentage: formData.discountPercentage,
    //             paymentMode: formData.paymentMode,
    //             roundOffAmount: formData.roundOffAmount,
    //             print
    //         };

    //         const response = await api.post('/api/retailer/cash/sales-return', billData);

    //         setFormData({
    //             accountId: '',
    //             accountName: '',
    //             accountAddress: '',
    //             accountPhone: '',
    //             transactionDateNepali: currentNepaliDate,
    //             transactionDateRoman: new Date().toISOString().split('T')[0],
    //             nepaliDate: currentNepaliDate,
    //             billDate: new Date().toISOString().split('T')[0],
    //             billNumber: nextBillNumber,
    //             paymentMode: 'cash',
    //             isVatExempt: 'all',
    //             discountPercentage: 0,
    //             discountAmount: 0,
    //             roundOffAmount: 0,
    //             vatPercentage: 13,
    //             items: []
    //         });

    //         setNotification({
    //             show: true,
    //             message: 'Sales return saved successfully!',
    //             type: 'success'
    //         });

    //         setItems([]);

    //         if (print) {
    //             setIsSaving(false);
    //             navigate(`/api/retailer/sales-return/${response.data.data.bill._id}/print`);
    //         } else {
    //             setItems([]);
    //             setIsSaving(false);
    //             resetForm()
    //             // Focus back to the first field
    //             setTimeout(() => {
    //                 if (transactionDateRef.current) {
    //                     transactionDateRef.current.focus();
    //                 }
    //             }, 100);
    //         }
    //     } catch (error) {
    //         console.error('Error saving sales return:', error);
    //         setNotification({
    //             show: true,
    //             message: 'Failed to save sales return. Please try again.',
    //             type: 'error'
    //         });
    //         setIsSaving(false);
    //     }
    // };

    const handleSubmit = async (e, print = false) => {
        // Prevent default only if event exists (form submission)
        if (e) {
            e.preventDefault();
        }

        setIsSaving(true);

        try {
            const billData = {
                cashAccount: formData.cashAccount,
                cashAccountAddress: formData.cashAccountAddress,
                cashAccountPan: formData.cashAccountPan,
                cashAccountEmail: formData.cashAccountEmail,
                cashAccountPhone: formData.cashAccountPhone,
                items: items.map(item => ({
                    item: item.item,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: item.quantity,
                    unit: item.unit?._id,
                    price: item.price,
                    vatStatus: item.vatStatus
                })),
                vatPercentage: formData.vatPercentage,
                transactionDateNepali: formData.transactionDateNepali,
                transactionDateRoman: formData.transactionDateRoman,
                billDate: formData.billDate,
                nepaliDate: formData.nepaliDate,
                isVatExempt: formData.isVatExempt,
                discountPercentage: formData.discountPercentage,
                paymentMode: formData.paymentMode,
                roundOffAmount: formData.roundOffAmount,
                print
            };

            const response = await api.post('/api/retailer/cash/sales-return', billData);

            if (response.data.success) {
                setNotification({
                    show: true,
                    message: 'Sales return saved successfully!',
                    type: 'success'
                });

                if (print && response.data.data?.bill?._id) {
                    setIsSaving(false);
                    await printImmediately(response.data.data.bill._id);
                    setTimeout(() => {
                        resetForm();
                    }, 1000);
                } else {
                    setIsSaving(false);
                    resetForm();
                }

            } else {
                setNotification({
                    show: true,
                    message: response.data.error || 'Failed to save sales return',
                    type: 'error'
                });
                setIsSaving(false);
            }
        } catch (error) {
            console.error('Error saving sales return:', error);
            setNotification({
                show: true,
                message: error.response?.data?.error || 'Failed to save sales return. Please try again.',
                type: 'error'
            });
            setIsSaving(false);
        }
    };
    const handlePrintAfterSaveChange = (e) => {
        const isChecked = e.target.checked;
        setPrintAfterSave(isChecked);
        localStorage.setItem('printAfterSaveCashSalesReturn', isChecked);
    };

    const printImmediately = async (billId) => {
        try {
            const response = await api.get(`/api/retailer/sales-return/${billId}/print`);
            const printData = response.data.data;

            // Create a temporary div to hold the print content
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            document.body.appendChild(tempDiv);

            // Create the printable content
            tempDiv.innerHTML = `
        <div id="printableContent">
            <div class="print-invoice-container">
                <div class="print-invoice-header">
                    <div class="print-company-name">${printData.currentCompanyName}</div>
                    <div class="print-company-details">
                        ${printData.currentCompany.address} | Tel: ${printData.currentCompany.phone} | PAN: ${printData.currentCompany.pan}
                    </div>
                    <div class="print-invoice-title">SALES RETURN</div>
                </div>

                <div class="print-invoice-details">
                    <div>
                        <div><strong>M/S:</strong> ${printData.bill.cashAccount || 'Account Not Found'}</div>
                        <div><strong>Address:</strong> ${printData.bill.cashAccountAddress || 'N/A'}</div>
                        <div><strong>PAN:</strong> ${printData.bill.cashAccountPan || 'N/A'} | <strong>Tel:</strong> ${printData.bill.cashAccountPhone || 'N/A'}</div>
                        <div><strong>Email:</strong> ${printData.bill.cashAccountEmail || 'N/A'}</div>
                    </div>
                    <div>
                        <div><strong>Invoice No:</strong> ${printData.bill.billNumber}</div>
                        <div><strong>Transaction Date:</strong> ${new Date(printData.bill.transactionDate).toLocaleDateString()}</div>
                        <div><strong>Invoice Issue Date:</strong> ${new Date(printData.bill.date).toLocaleDateString()}</div>
                        <div><strong>Mode of Payment:</strong> ${printData.bill.paymentMode}</div>
                    </div>
                </div>

                <table class="print-invoice-table">
                    <thead>
                        <tr>
                            <th>S.N.</th>
                            <th>Code</th>
                            <th>HSN</th>
                            <th>Description of Goods</th>
                            <th>Unit</th>
                            <th>Batch</th>
                            <th>Expiry</th>
                            <th>Qty</th>
                            <th>Price (Rs.)</th>
                            <th>Total (Rs.)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${printData.bill.items.map((item, i) => `
                            <tr key="${i}">
                                <td>${i + 1}</td>
                                <td>${item.item.uniqueNumber}</td>
                                <td>${item.item.hscode}</td>
                                <td>
                                    ${item.item.vatStatus === 'vatExempt' ?
                    `${item.item.name} *` :
                    item.item.name
                }
                                </td>
                                <td>${item.item.unit?.name || ''}</td>
                                <td>${item.batchNumber}</td>
                                <td>${item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</td>
                                <td>${item.quantity}</td>
                                <td>${item.price.toFixed(2)}</td>
                                <td>${(item.quantity * item.price).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tr>
                        <td colSpan="11" style="borderBottom: '1px dashed #000'"></td>
                    </tr>
                </table>

                <table class="print-totals-table">
                    <tbody>
                        <tr>
                            <td><strong>Sub-Total:</strong></td>
                            <td class="print-text-right">${printData.bill.subTotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td><strong>Discount:</strong></td>
                            <td class="print-text-right">${printData.bill.discountAmount.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td><strong>Non-Taxable:</strong></td>
                            <td class="print-text-right">${printData.bill.nonVatSalesReturn.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td><strong>Taxable Amount:</strong></td>
                            <td class="print-text-right">${printData.bill.taxableAmount.toFixed(2)}</td>
                        </tr>
                        ${!printData.bill.isVatExempt ? `
                            <tr>
                                <td><strong>VAT (${printData.bill.vatPercentage}%):</strong></td>
                                <td class="print-text-right">${(printData.bill.taxableAmount * printData.bill.vatPercentage / 100).toFixed(2)}</td>
                            </tr>
                        ` : ''}
                        <tr>
                            <td><strong>Round Off:</strong></td>
                            <td class="print-text-right">${printData.bill.roundOffAmount.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td><strong>Grand Total:</strong></td>
                            <td class="print-text-right">${printData.bill.totalAmount.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="print-amount-in-words">
                    <strong>In Words:</strong> ${convertToRupeesAndPaisa(printData.bill.totalAmount)} Only.
                </div>
                <br /><br />
                <div class="print-signature-area">
                    <div class="print-signature-box">Received By</div>
                    <div class="print-signature-box">Prepared By: ${printData.bill.user.name}</div>
                    <div class="print-signature-box">For: ${printData.currentCompanyName}</div>
                </div>
            </div>
        </div>
    `;

            // Add print styles
            const styles = `
        @page {
            size: A4;
            margin: 5mm;
        }
        body {
            font-family: 'Arial Narrow', Arial, sans-serif;
            font-size: 9pt;
            line-height: 1.2;
            color: #000;
            background: white;
            margin: 0;
            padding: 0;
        }
        .print-invoice-container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            padding: 2mm;
        }
        .print-invoice-header {
            text-align: center;
            margin-bottom: 3mm;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
        }
        .print-invoice-title {
            font-size: 12pt;
            font-weight: bold;
            margin: 2mm 0;
            text-transform: uppercase;
        }
        .print-company-name {
            font-size: 16pt;
            font-weight: bold;
        }
        .print-company-details {
            font-size: 8pt;
            margin: 1mm 0;
            font-weight: bold;
        }
        .print-invoice-details {
            display: flex;
            justify-content: space-between;
            margin: 2mm 0;
            font-size: 8pt;
        }
        .print-invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin: 3mm 0;
            font-size: 8pt;
            border: none;
        }
        .print-invoice-table thead {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
        }
        .print-invoice-table th {
            background-color: transparent;
            border: none;
            padding: 1mm;
            text-align: left;
            font-weight: bold;
        }
        .print-invoice-table td {
            border: none;
            padding: 1mm;
            border-bottom: 1px solid #eee;
        }
        .print-text-right {
            text-align: right;
        }
        .print-text-center {
            text-align: center;
        }
        .print-amount-in-words {
            font-size: 8pt;
            margin: 2mm 0;
            padding: 1mm;
            border: 1px dashed #000;
        }
        .print-signature-area {
            display: flex;
            justify-content: space-between;
            margin-top: 5mm;
            font-size: 8pt;
        }
        .print-signature-box {
            text-align: center;
            width: 30%;
            border-top: 1px dashed #000;
            padding-top: 1mm;
            font-weight: bold;
        }
        .print-totals-table {
            width: 60%;
            margin-left: auto;
            border-collapse: collapse;
            font-size: 8pt;
        }
        .print-totals-table td {
            padding: 1mm;
        }
    `;

            // Create print window
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
        <html>
            <head>
                <title>Cash_Sales_Return_${printData.bill.billNumber}</title>
                <style>${styles}</style>
            </head>
            <body>
                ${tempDiv.innerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    };
                </script>
            </body>
        </html>
    `);
            printWindow.document.close();

            // Clean up
            document.body.removeChild(tempDiv);
        } catch (error) {
            console.error('Error fetching print data:', error);
            setNotification({
                show: true,
                message: 'Bill saved but failed to load print data',
                type: 'warning'
            });
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

    const handleItemSearchKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && filteredItems[currentFocus]) {
                addItemToBill(filteredItems[currentFocus]);
            } else if (!e.target.value && items.length > 0) {
                document.getElementById('discountPercentage')?.focus();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCurrentFocus(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCurrentFocus(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        }
    };

    const handleBatchKeydown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById(`expiryDate-${index}`)?.focus();
        }
    };

    const handleExpDateKeydown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById(`quantity-${index}`)?.focus();
        }
    };

    const handleQuantityKeydown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById(`price-${index}`)?.focus();
        }
    };

    const handlePriceKeydown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            itemSearchRef.current?.focus();
        }
    };

    const handleCloseButtonKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setShowTransactionModal(false);
            document.getElementById(`batchNumber-${items.length - 1}`)?.focus();
        }
    };

    // Memoized dropdown component
    const ItemDropdown = React.useMemo(() => {
        if (!showItemDropdown) return null;

        const itemsToShow = memoizedFilteredItems;

        // Determine what message to show
        let message = null;
        if (itemsToShow.length === 0) {
            if (shouldShowLastSearchResults && lastSearchQuery) {
                message = `No items found matching "${lastSearchQuery}"`;
            } else if (searchQuery) {
                message = `No items found matching "${searchQuery}"`;
            } else {
                message = "No items available";
            }
        }

        return (
            <div
                id="dropdownMenu"
                className="dropdown-menu show"
                style={{
                    maxHeight: '280px',
                    height: '280px',
                    overflow: 'hidden',
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

                {itemsToShow.length > 0 ? (
                    <VirtualizedItemList
                        items={itemsToShow}
                        onItemClick={addItemToBill}
                        searchRef={itemSearchRef}
                    />
                ) : (
                    <div className="text-center py-3 text-muted">
                        {message}
                    </div>
                )}
            </div>
        );
    }, [showItemDropdown, memoizedFilteredItems, searchQuery, lastSearchQuery, shouldShowLastSearchResults]);

    return (
        <div className="container-fluid">
            <Header />
            <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                <div className="card-header">
                    Cash Sales Return Entry
                    {formData.billNumber === '' && (
                        <span id="customAlertForBillNumber" style={{ color: 'red' }}>Invoice is required!</span>
                    )}
                    {dateErrors.transactionDateNepali && (
                        <span id="transactionDateError" style={{ color: 'red' }}>{dateErrors.transactionDateNepali}</span>
                    )}
                    {dateErrors.nepaliDate && (
                        <span id="nepaliDateError" style={{ color: 'red' }}>{dateErrors.nepaliDate}</span>
                    )}
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit} id="billForm" className="wow-form">
                        <div className="form-group row">
                            {company.dateFormat === 'nepali' ? (
                                <>
                                    <div className="col">
                                        <label htmlFor="transactionDateNepali">Transaction Date:</label>
                                        <input
                                            type="text"
                                            name="transactionDateNepali"
                                            id="transactionDateNepali"
                                            className={`form-control no-date-icon ${dateErrors.transactionDateNepali ? 'is-invalid' : ''}`}
                                            value={formData.transactionDateNepali}
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
                                                if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.transactionDateNepali) {
                                                    e.preventDefault();
                                                    e.target.focus();
                                                } else if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'transactionDateNepali');
                                                }
                                            }}
                                            required
                                            autoFocus
                                            ref={transactionDateRef}
                                        />
                                    </div>
                                    <div className="col">
                                        <label htmlFor="nepaliDate">Invoice Date:</label>
                                        <input
                                            type="text"
                                            name="nepaliDate"
                                            id="nepaliDate"
                                            className={`form-control no-date-icon ${dateErrors.nepaliDate ? 'is-invalid' : ''}`}
                                            value={formData.nepaliDate}
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
                                                if ((e.key === 'Tab' || e.key === 'Enter') && dateErrors.nepaliDate) {
                                                    e.preventDefault();
                                                    e.target.focus();
                                                } else if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'nepaliDate');
                                                }
                                            }}
                                            required
                                        />
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
                                            value={formData.transactionDateRoman}
                                            onChange={(e) => setFormData({ ...formData, transactionDateRoman: e.target.value })}
                                            required
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'transactionDateRoman');
                                                }
                                            }}
                                            autoFocus
                                            ref={transactionDateRef}
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
                                                    handleKeyDown(e, 'billDate');
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
                                    onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'billNumber');
                                        }
                                    }}
                                    required
                                />
                            </div>
                            <div className="col">
                                <label htmlFor="isVatExempt">VAT</label>
                                <select
                                    name="isVatExempt"
                                    id="isVatExempt"
                                    className="form-control"
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
                                <label htmlFor="account">Cash Account:</label>
                                <input
                                    type="text"
                                    id="account"
                                    name="account"
                                    className="form-control"
                                    value={formData.cashAccount}
                                    onChange={(e) => {
                                        setFormData({
                                            ...formData,
                                            cashAccount: e.target.value,
                                            cashAccountAddress: '',
                                            cashAccountPhone: ''
                                        });
                                    }}
                                    onClick={() => setShowAccountModal(true)}
                                    onFocus={() => setShowAccountModal(true)}
                                    readOnly
                                    required
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'account');
                                        }
                                    }}
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="cashAccountAddress">Address:</label>
                                <input
                                    type="text"
                                    id="cashAccountAddress"
                                    className="form-control"
                                    value={formData.cashAccountAddress}
                                    onChange={(e) => setFormData({ ...formData, cashAccountAddress: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'cashAccountAddress');
                                        }
                                    }}
                                    ref={addressRef}
                                    autoComplete='off'
                                />
                            </div>
                            <div className="col">
                                <label htmlFor="cashAccountPhone">Phone:</label>
                                <input
                                    type="text"
                                    id="cashAccountPhone"
                                    className="form-control"
                                    value={formData.cashAccountPhone}
                                    onChange={(e) => setFormData({ ...formData, cashAccountPhone: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'cashAccountPhone');
                                        }
                                    }}
                                    autoComplete='off'
                                />
                            </div>
                        </div>

                        <div id="bill-details-container" style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }} ref={itemsTableRef}>
                            <table className="table table-bordered compact-table" id="itemsTable">
                                <thead>
                                    <tr>
                                        <th>S.No.</th>
                                        <th>#</th>
                                        <th>HSN</th>
                                        <th>Description of Goods</th>
                                        <th>Batch</th>
                                        <th>Expiry</th>
                                        <th>Qty</th>
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
                                            <td className="col-3">
                                                <input type="hidden" name={`items[${index}][item]`} value={item.item} />
                                                {item.name}
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    name={`items[${index}][batchNumber]`}
                                                    className="form-control item-batchNumber"
                                                    id={`batchNumber-${index}`}
                                                    value={item.batchNumber}
                                                    onChange={(e) => updateItemField(index, 'batchNumber', e.target.value)}
                                                    onKeyDown={(e) => handleBatchKeydown(e, index)}
                                                    required
                                                    onFocus={(e) => e.target.select()}
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
                                                    onKeyDown={(e) => handleExpDateKeydown(e, index)}
                                                    required
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    name={`items[${index}][quantity]`}
                                                    className="form-control item-quantity"
                                                    id={`quantity-${index}`}
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                    onKeyDown={(e) => handleQuantityKeydown(e, index)}
                                                    required
                                                    min="1"
                                                    step="any"
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            </td>
                                            <td>
                                                {item.unit?.name}
                                                <input type="hidden" name={`items[${index}][unit]`} value={item.unit?._id} />
                                            </td>
                                            {/* <td>
                                                <input
                                                    type="number"
                                                    name={`items[${index}][price]`}
                                                    className="form-control item-price"
                                                    id={`price-${index}`}
                                                    value={item.price}
                                                    onChange={(e) => updateItemField(index, 'price', e.target.value)}
                                                    onKeyDown={(e) => handlePriceKeydown(e, index)}
                                                    step="any"
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            </td> */}
                                            <td>
                                                <input
                                                    type="number"
                                                    name={`items[${index}][price]`}
                                                    className="form-control item-price"
                                                    id={`price-${index}`}
                                                    value={item.price}
                                                    onChange={(e) => updateItemField(index, 'price', e.target.value)}
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const itemSearchInput = document.getElementById('itemSearch');
                                                            if (itemSearchInput) {
                                                                itemSearchInput.focus();
                                                                itemSearchInput.select();
                                                            }
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td className="item-amount">{item.amount}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn btn-danger"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <span aria-hidden="true">&times;</span>
                                                </button>
                                            </td>
                                            <input type="hidden" name={`items[${index}][vatStatus]`} value={item.vatStatus} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="row mb-3">
                            <div className="col-12">
                                <label htmlFor="itemSearch" className="form-label">Search Item</label>
                                <div className="position-relative">
                                    <input
                                        type="text"
                                        id="itemSearch"
                                        className="form-control"
                                        placeholder="Search item"
                                        autoComplete='off'
                                        value={searchQuery}
                                        onChange={handleItemSearch}
                                        onFocus={handleSearchFocus}
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
                                                e.preventDefault();
                                                const activeItem = document.querySelector('.dropdown-item.active');
                                                if (activeItem) {
                                                    const index = parseInt(activeItem.getAttribute('data-index'));
                                                    const itemToAdd = memoizedFilteredItems[index];
                                                    if (itemToAdd) {
                                                        addItemToBill(itemToAdd);
                                                    }
                                                } else if (!searchQuery && items.length > 0) {
                                                    setShowItemDropdown(false);
                                                    setTimeout(() => {
                                                        document.getElementById('discountPercentage')?.focus();
                                                    }, 0);
                                                }
                                            }
                                        }}
                                    />
                                    {ItemDropdown}
                                </div>
                            </div>
                        </div>
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
                                        <td className="text-right">
                                            <p className="form-control-plaintext">Rs. <span id="subTotal">{totals.subTotal.toFixed(2)}</span></p>
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
                                                onFocus={(e) => e.target.select()}
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
                                                onFocus={(e) => e.target.select()}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleKeyDown(e, 'discountAmount');
                                                    }
                                                }}
                                            />
                                        </td>
                                    </tr>

                                    {company.vatEnabled && formData.isVatExempt !== 'true' && (
                                        <tr id="taxableAmountRow">
                                            <td><label htmlFor="taxableAmount">Taxable Amount:</label></td>
                                            <td className="text-right">
                                                <p className="form-control-plaintext">Rs. <span id="taxableAmount">{totals.taxableAmount.toFixed(2)}</span></p>
                                            </td>
                                            <td><label htmlFor="vatPercentage">VAT (13%):</label></td>
                                            <td>
                                                <input
                                                    type="number"
                                                    name="vatPercentage"
                                                    id="vatPercentage"
                                                    className="form-control"
                                                    value={formData.vatPercentage}
                                                    readOnly
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleKeyDown(e, 'vatPercentage');
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td><label htmlFor="vatAmount">VAT Amount:</label></td>
                                            <td className="text-right">
                                                <p className="form-control-plaintext">Rs. <span id="vatAmount">{totals.vatAmount.toFixed(2)}</span></p>
                                            </td>
                                        </tr>
                                    )}
                                    {/* Add empty cells to maintain table structure when exempt */}
                                    {company.vatEnabled && formData.isVatExempt === 'true' && (
                                        <>
                                            <td colSpan="4"></td>
                                        </>
                                    )}

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
                                            <p className="form-control-plaintext">Rs. <span id="totalAmount">{totals.totalAmount.toFixed(2)}</span></p>
                                        </td>
                                        <td><label htmlFor="amountInWords">In Words:</label></td>
                                        <td className="text-right">
                                            <p className="form-control-plaintext" id="amountInWords">
                                                {convertToRupeesAndPaisa(totals.totalAmount)} Only.
                                            </p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* <div className="d-flex justify-content-end mt-4">
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
                        </div> */}

                        {/* Replace the current action buttons section with this: */}

                        {/* Action Buttons */}
                        <div className="d-flex justify-content-end mt-4">
                            {/* Add Print After Save Checkbox */}
                            <div className="form-check me-3 align-self-center">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="printAfterSave"
                                    checked={printAfterSave}
                                    onChange={handlePrintAfterSaveChange}
                                />
                                <label className="form-check-label" htmlFor="printAfterSave">
                                    Print after save
                                </label>
                            </div>

                            <div className="d-flex justify-content-end gap-2">
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    id="saveBill"
                                    onClick={(e) => handleSubmit(e, printAfterSave)}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-save me-1"></i> Save
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {showAccountModal && (
                <div className="modal fade show" id="accountModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content" style={{ height: '500px' }}>
                            <div className="modal-header">
                                <h5 className="modal-title" id="accountModalLabel">Select or Enter Cash Account</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowAccountModal(false)}
                                ></button>
                            </div>
                            <div className="p-3 bg-white sticky-top">
                                <input
                                    type="text"
                                    id="searchAccount"
                                    autoComplete='off'
                                    className="form-control form-control-lg"
                                    placeholder="Type to search or enter new account name"
                                    autoFocus
                                    value={formData.cashAccount}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            cashAccount: value,
                                            cashAccountAddress: '',
                                            cashAccountPhone: ''
                                        }));

                                        // Filter accounts based on search
                                        if (value === '') {
                                            setFilteredAccounts([]);
                                        } else {
                                            const filtered = accounts.filter(account =>
                                                account.name.toLowerCase().includes(value.toLowerCase())
                                            );
                                            setFilteredAccounts(filtered);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            const firstAccountItem = document.querySelector('.account-item');
                                            if (firstAccountItem) {
                                                firstAccountItem.focus();
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            // Always use the typed text when pressing Enter in the input
                                            setShowAccountModal(false);
                                            setTimeout(() => {
                                                addressRef.current?.focus();
                                            }, 100);
                                        }
                                    }}
                                    ref={accountSearchRef}
                                />
                            </div>
                            <div className="modal-body p-0">
                                <div className="overflow-auto" style={{ height: 'calc(400px - 120px)' }}>
                                    <ul id="accountList" className="list-group">
                                        {(filteredAccounts.length > 0 ? filteredAccounts : accounts).map((account, index) => (
                                            <li
                                                key={account._id}
                                                data-account-id={account._id}
                                                className={`list-group-item account-item py-2`}
                                                onClick={() => {
                                                    setFormData({
                                                        ...formData,
                                                        cashAccount: account.name,
                                                        cashAccountAddress: account.address,
                                                        cashAccountPhone: account.phone
                                                    });
                                                    setShowAccountModal(false);
                                                    setTimeout(() => {
                                                        addressRef.current?.focus();
                                                    }, 100);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                                tabIndex={0}
                                                onKeyDown={(e) => {
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
                                                            accountSearchRef.current?.focus();
                                                        }
                                                    } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        setFormData({
                                                            ...formData,
                                                            cashAccount: account.name,
                                                            cashAccountAddress: account.address,
                                                            cashAccountPhone: account.phone
                                                        });
                                                        setShowAccountModal(false);
                                                        setTimeout(() => {
                                                            addressRef.current?.focus();
                                                        }, 100);
                                                    }
                                                }}
                                                onFocus={(e) => {
                                                    document.querySelectorAll('.account-item').forEach(item => {
                                                        item.classList.remove('active');
                                                    });
                                                    e.target.classList.add('active');
                                                }}
                                            >
                                                <div className="d-flex justify-content-between small">
                                                    <strong>{account.name}</strong>
                                                    <span>📍 {account.address || 'N/A'} | 📞 {account.phone || 'N/A'}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setShowAccountModal(false);
                                        setTimeout(() => {
                                            addressRef.current?.focus();
                                        }, 100);
                                    }}
                                >
                                    Use Entered Name
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowAccountModal(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Transaction Modal */}
            {
                showTransactionModal && (
                    <div className="modal fade show" id="transactionModal" tabIndex="-1" style={{ display: 'block' }}>
                        <div className="modal-dialog modal-lg">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title" id="transactionModalLabel">Last Transactions</h5>
                                    <button type="button" className="close" onClick={() => setShowTransactionModal(false)}>
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <ul id="transactionList" className="list-group">
                                        {transactions.map((transaction, index) => (
                                            <li key={index} className="list-group-item">
                                                <div className="d-flex justify-content-between">
                                                    <div>
                                                        <strong>Date:</strong> {new Date(transaction.date).toLocaleDateString()}<br />
                                                        <strong>Bill No:</strong> {transaction.billNumber}<br />
                                                        <strong>Type:</strong> {transaction.type}
                                                    </div>
                                                    <div>
                                                        <strong>Qty:</strong> {transaction.quantity}<br />
                                                        <strong>Rate:</strong> Rs.{Math.round(transaction.price * 100) / 100}<br />
                                                        <strong>Unit:</strong> {transaction.unit?.name || 'N/A'}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        id="closeModalButton"
                                        onClick={() => setShowTransactionModal(false)}
                                        onKeyDown={handleCloseButtonKeydown}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}

            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </div >
    );
};

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

export default AddCashSalesReturn;
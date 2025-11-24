import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';
import axios from 'axios';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import '../../../stylesheet/retailer/sales/AddCashSalesOpen.css';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import '../../../stylesheet/noDateIcon.css'
import ProductModal from '../dashboard/modals/ProductModal';

import useDebounce from '../../../hooks/useDebounce';
import VirtualizedItemList from '../../VirtualizedItemList';

const AddCashSalesOpen = () => {
    const navigate = useNavigate();
    const [quantityErrors, setQuantityErrors] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [lastSearchQuery, setLastSearchQuery] = useState('');
    const [shouldShowLastSearchResults, setShouldShowLastSearchResults] = useState(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 50);
    const itemsTableRef = useRef(null);

    const [printAfterSave, setPrintAfterSave] = useState(
        localStorage.getItem('printAfterSave') === 'true' || false
    );

    const [stockValidation, setStockValidation] = useState({
        itemStockMap: new Map(), // Maps item ID to total available stock
        batchStockMap: new Map(), // Maps batch unique ID to available stock
        usedStockMap: new Map(), // Maps batch unique ID to used quantity across all entries
    });
    const [showProductModal, setShowProductModal] = useState(false);
    const transactionDateRef = useRef(null);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
    const addressRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [dateErrors, setDateErrors] = useState({
        transactionDateNepali: '',
        nepaliDate: ''
    });
    const [formData, setFormData] = useState({
        cashAccount: '',
        cashAccountId: '',
        cashAccountAddress: '',
        cashAccountPan: '',
        cashAccountEmail: '',
        cashAccountPhone: '',
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
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });
    const [nextBillNumber, setNextBillNumber] = useState('');
    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [companyGroups, setCompanyGroups] = useState([]);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [selectedItemForBatch, setSelectedItemForBatch] = useState(null);
    const [selectedBatch, setSelectedBatch] = useState({});

    const accountSearchRef = useRef(null);
    const itemSearchRef = useRef(null);
    const accountModalRef = useRef(null);
    const transactionModalRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        return () => {
            // Reset search memory when component unmounts
            setLastSearchQuery('');
            setShouldShowLastSearchResults(false);
        };
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/retailer/cash-sales/open');
                const { data } = response;

                const sortedAccounts = data.data.accounts.sort((a, b) => a.name.localeCompare(b.name));
                const sortedItems = data.data.items.sort((a, b) => a.name.localeCompare(b.name));

                setCompany(data.data.company);
                setAllItems(sortedItems);
                setAccounts(sortedAccounts);
                setNextBillNumber(data.data.nextSalesBillNumber);
                setCategories(data.data.categories);
                setUnits(data.data.units);
                setCompanyGroups(data.data.companyGroups);

                setFormData(prev => ({
                    ...prev,
                    billNumber: data.data.nextSalesBillNumber
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
        if (allItems.length > 0) {
            const newItemStockMap = new Map();
            const newBatchStockMap = new Map();

            allItems.forEach(item => {
                // Calculate total stock for each item
                const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
                newItemStockMap.set(item._id, totalStock);

                // Map each batch entry with its unique identifier
                item.stockEntries.forEach(entry => {
                    const batchKey = `${item._id}-${entry.batchNumber}-${entry.uniqueUuId}`;
                    newBatchStockMap.set(batchKey, entry.quantity || 0);
                });
            });

            setStockValidation(prev => ({
                ...prev,
                itemStockMap: newItemStockMap,
                batchStockMap: newBatchStockMap
            }));

            // Validate existing items after stock maps are initialized
            if (items.length > 0) {
                validateAllQuantities();
            }
        }
    }, [allItems]);

    // Function to calculate used stock across all items
    const calculateUsedStock = (items) => {
        const newUsedStockMap = new Map();

        items.forEach(item => {
            const batchKey = `${item.item}-${item.batchNumber}-${item.uniqueUuId}`;
            const currentUsed = newUsedStockMap.get(batchKey) || 0;
            const itemQuantity = parseFloat(item.quantity) || 0;

            newUsedStockMap.set(batchKey, currentUsed + itemQuantity);
        });

        return newUsedStockMap;
    };

    // Get available stock for display
    const getAvailableStockForDisplay = (item) => {
        if (!item) return 0;

        const batchKey = `${item.item}-${item.batchNumber}-${item.uniqueUuId}`;
        const availableStock = stockValidation.batchStockMap.get(batchKey);

        // Return 0 if stock data is not available yet
        return availableStock !== undefined ? availableStock : 0;
    };

    // Get remaining stock after accounting for all items in the bill
    const getRemainingStock = (item, itemsToCheck = items) => {
        if (!item) return 0;

        const batchKey = `${item.item}-${item.batchNumber}-${item.uniqueUuId}`;
        const availableStock = stockValidation.batchStockMap.get(batchKey);

        // Return 0 if stock data is not available yet
        if (availableStock === undefined) return 0;

        const usedStockMap = calculateUsedStock(itemsToCheck);
        const totalUsed = usedStockMap.get(batchKey) || 0;

        return availableStock - totalUsed;
    };

    const validateQuantity = (index, quantity, itemsToValidate = items) => {
        const item = itemsToValidate[index];
        if (!item) return true;

        const batchKey = `${item.item}-${item.batchNumber}-${item.uniqueUuId}`;
        const availableStock = stockValidation.batchStockMap.get(batchKey) || 0;

        // If stock data is not available yet, skip validation
        if (availableStock === 0 && !stockValidation.batchStockMap.has(batchKey)) {
            return true;
        }

        // Calculate total used quantity for this batch across all items
        const usedStockMap = calculateUsedStock(itemsToValidate);
        const totalUsed = usedStockMap.get(batchKey) || 0;

        // The quantity is valid if it doesn't exceed available stock
        return totalUsed <= availableStock;
    };

    const handleAccountSearch = (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm === '') {
            setFilteredAccounts([]);
        } else {
            const filtered = accounts.filter(account =>
                account.name.toLowerCase().includes(searchTerm)
            );
            setFilteredAccounts(filtered);
        }
    };

    const selectAccount = (account) => {
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

    //         if (formData.isVatExempt === 'all') return matchesSearch;
    //         if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
    //         if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
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

    const showBatchModalForItem = (item) => {

        // Store the search query when opening batch modal
        if (itemSearchRef.current?.value) {
            setLastSearchQuery(itemSearchRef.current.value);
            setShouldShowLastSearchResults(true);
        }

        setSelectedItemForBatch(item);
        setShowBatchModal(true);

        // Use setTimeout to ensure the modal is rendered before focusing
        setTimeout(() => {
            const firstBatchRow = document.querySelector('.batch-row');
            if (firstBatchRow) {
                firstBatchRow.classList.add('bg-primary', 'text-white');
                firstBatchRow.focus();
            }
        }, 100);
    };

    const formatDateForInput = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // const addItemToBill = (item, batchInfo) => {
    //     const totalStock = item.stockEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);

    //     if (totalStock === 0) {
    //         setNotification({
    //             show: true,
    //             message: `Item "${item.name}" has zero stock and cannot be added to the bill.`,
    //             type: 'error'
    //         });
    //         itemSearchRef.current.value = '';
    //         itemSearchRef.current.focus();
    //         return;
    //     }

    //     const newItem = {
    //         item: item._id,
    //         uniqueNumber: item.uniqueNumber || 'N/A',
    //         hscode: item.hscode,
    //         name: item.name,
    //         category: item.category?.name || 'No Category',
    //         batchNumber: batchInfo.batchNumber || '',
    //         expiryDate: batchInfo.expiryDate ? new Date(batchInfo.expiryDate).toISOString().split('T')[0] : '',
    //         quantity: 0,
    //         unit: item.unit,
    //         price: batchInfo.price || 0,
    //         puPrice: batchInfo.puPrice || 0,
    //         netPuPrice: batchInfo.netPuPrice || 0,
    //         amount: 0,
    //         vatStatus: item.vatStatus,
    //         uniqueUuId: batchInfo.uniqueUuId
    //     };

    //     setItems([...items, newItem]);
    //     setShowItemDropdown(false);
    //     itemSearchRef.current.value = '';

    //     setTimeout(() => {
    //         const quantityInput = document.getElementById(`quantity-${items.length}`);
    //         if (quantityInput) {
    //             quantityInput.focus();
    //             quantityInput.select();
    //         }
    //     }, 100);
    // };

    const addItemToBill = (item, batchInfo) => {

        // Store the search query when adding an item
        if (itemSearchRef.current?.value) {
            setLastSearchQuery(itemSearchRef.current.value);
            setShouldShowLastSearchResults(true);
        }

        const batchKey = `${item._id}-${batchInfo.batchNumber}-${batchInfo.uniqueUuId}`;
        const availableStock = stockValidation.batchStockMap.get(batchKey) || 0;

        if (availableStock === 0) {
            setNotification({
                show: true,
                message: `Item "${item.name}" has zero stock in this batch and cannot be added to the bill.`,
                type: 'error'
            });
            itemSearchRef.current.value = '';
            itemSearchRef.current.focus();
            return;
        }

        const newItem = {
            item: item._id,
            uniqueNumber: item.uniqueNumber || 'N/A',
            hscode: item.hscode,
            name: item.name,
            category: item.category?.name || 'No Category',
            batchNumber: batchInfo.batchNumber || '',
            expiryDate: batchInfo.expiryDate ? new Date(batchInfo.expiryDate).toISOString().split('T')[0] : '',
            quantity: 0,
            unit: item.unit,
            price: Math.round(batchInfo.price * 100) / 100 || 0,
            puPrice: batchInfo.puPrice || 0,
            netPuPrice: batchInfo.netPuPrice || 0,
            amount: 0,
            vatStatus: item.vatStatus,
            uniqueUuId: batchInfo.uniqueUuId
        };

        const updatedItems = [...items, newItem];
        setItems(updatedItems);
        setShowItemDropdown(false);
        itemSearchRef.current.value = '';

        // Clear search after adding item
        setSearchQuery('');
        if (itemSearchRef.current) {
            itemSearchRef.current.value = '';
        }

        // Show available stock info
        setNotification({
            show: true,
            message: `Available stock: ${availableStock}`,
            type: 'success'
        });

        // Focus on quantity field
        setTimeout(() => {
            const quantityInput = document.getElementById(`quantity-${updatedItems.length - 1}`);
            if (quantityInput) {
                quantityInput.focus();
                quantityInput.select();
            }
        }, 100);
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

    // const updateItemField = (index, field, value) => {
    //     const updatedItems = [...items];
    //     updatedItems[index][field] = value;

    //     if (field === 'quantity' || field === 'price') {
    //         updatedItems[index].amount = (updatedItems[index].quantity * updatedItems[index].price).toFixed(2);
    //     }

    //     setItems(updatedItems);
    // };
    const updateItemField = (index, field, value) => {
        const updatedItems = [...items];
        updatedItems[index][field] = value;

        if (field === 'quantity' || field === 'price') {
            if (field === 'quantity') {
                const item = updatedItems[index];
                const batchKey = `${item.item}-${item.batchNumber}-${item.uniqueUuId}`;

                // Only validate if stock data is available
                if (stockValidation.batchStockMap.has(batchKey)) {
                    const isValid = validateQuantity(index, value, updatedItems);
                    const remainingStock = getRemainingStock(item, updatedItems);
                    const availableStock = getAvailableStockForDisplay(item);

                    if (!isValid) {
                        setQuantityErrors(prev => ({
                            ...prev,
                            [index]: `Stock: ${availableStock} | Rem.: ${remainingStock}`
                        }));
                    } else {
                        setQuantityErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors[index];
                            return newErrors;
                        });
                    }
                }
            }

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

    // const removeItem = (index) => {
    //     const updatedItems = items.filter((_, i) => i !== index);
    //     setItems(updatedItems);
    // };

    const removeItem = (index) => {
        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);

        // Revalidate all quantities after removal
        setTimeout(() => {
            validateAllQuantities(updatedItems);
        }, 0);
    };

    const validateAllQuantities = (itemsToValidate = items) => {
        const newErrors = {};

        itemsToValidate.forEach((item, index) => {
            const batchKey = `${item.item}-${item.batchNumber}-${item.uniqueUuId}`;

            // Only validate if stock data is available
            if (stockValidation.batchStockMap.has(batchKey)) {
                const isValid = validateQuantity(index, item.quantity, itemsToValidate);
                if (!isValid) {
                    const remainingStock = getRemainingStock(item, itemsToValidate);
                    const availableStock = getAvailableStockForDisplay(item);
                    newErrors[index] = `Stock: ${availableStock} | Rem.: ${remainingStock}`;
                }
            }
        });

        setQuantityErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

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

    const resetForm = async () => {
        try {
            setIsLoading(true); // Show loading state while refreshing data

            // Fetch fresh data from the backend
            const response = await api.get('/api/retailer/cash-sales');
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
                billNumber: data.data.nextSalesBillNumber,
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
            setNextBillNumber(data.data.nextSalesBillNumber);
            setItems([]);
            setQuantityErrors({}); // Clear quantity errors

            // Clear search state
            setSearchQuery('');
            setLastSearchQuery('');
            setShouldShowLastSearchResults(false);

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
        // Validate all quantities before submitting
        const isValid = validateAllQuantities();
        if (!isValid) {
            setNotification({
                show: true,
                message: 'Please fix quantity errors before submitting',
                type: 'error'
            });

            // Focus on the first error
            const firstErrorIndex = Object.keys(quantityErrors)[0];
            if (firstErrorIndex !== undefined) {
                setTimeout(() => {
                    document.getElementById(`quantity-${firstErrorIndex}`)?.focus();
                }, 100);
            }

            return;
        }

        setIsSaving(true);

        try {
            const billData = {
                cashAccount: formData.cashAccount,
                cashAccountAddress: formData.cashAccountAddress,
                cashAccountPan: formData.cashAccountPan,
                cashAccountEmail: formData.cashAccountEmail,
                cashAccountPhone: formData.cashAccountPhone,
                vatPercentage: formData.vatPercentage,
                transactionDateRoman: formData.transactionDateRoman,
                transactionDateNepali: formData.transactionDateNepali,
                billDate: formData.billDate,
                nepaliDate: formData.nepaliDate,
                isVatExempt: formData.isVatExempt,
                discountPercentage: formData.discountPercentage,
                paymentMode: formData.paymentMode,
                roundOffAmount: formData.roundOffAmount,
                items: items.map(item => ({
                    item: item.item,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: item.quantity,
                    unit: item.unit?._id,
                    price: item.price,
                    puPrice: item.puPrice,
                    netPuPrice: item.netPuPrice || item.puPrice,
                    vatStatus: item.vatStatus,
                    uniqueUuId: item.uniqueUuId
                })),
                print
            };

            const response = await api.post('/api/retailer/cash-sales/open', billData);

            setNotification({
                show: true,
                message: 'Cash sales bill saved successfully!',
                type: 'success'
            });

            setItems([]);

            if (print && response.data.data?.bill?._id) {
                setItems([]);
                setIsSaving(false);
                resetForm()
                await printImmediately(response.data.data.bill._id);
            } else {
                setItems([]);
                setIsSaving(false);
                resetForm()
                setTimeout(() => {
                    if (transactionDateRef.current) {
                        transactionDateRef.current.focus();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error saving cash sales bill:', error);
            setNotification({
                show: true,
                message: error.response?.data?.error || 'Failed to save cash sales bill. Please try again.',
                type: 'error'
            });
            setIsSaving(false);
        }
    };

    const printImmediately = async (billId) => {
        try {
            const response = await api.get(`/api/retailer/sales/${billId}/print`);
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
                        <div class="print-invoice-title">${printData.firstBill ? 'TAX INVOICE' : 'INVOICE'}</div>
                    </div>

                    <div class="print-invoice-details">
                        <div>
                            <div><strong>M/S:</strong> ${printData.bill.account?.name || printData.bill.cashAccount || 'Account Not Found'}</div>
                            <div><strong>Address:</strong> ${printData.bill.account?.address || printData.bill.cashAccountAddress || 'N/A'}</div>
                            <div><strong>PAN:</strong> ${printData.bill.account?.pan || printData.bill.cashAccountPan || 'N/A'} | <strong>Tel:</strong> ${printData.bill.account?.phone || printData.bill.cashAccountPhone || 'N/A'}</div>
                            <div><strong>Email:</strong> ${printData.bill.account?.email || printData.bill.cashAccountEmail || 'N/A'}</div>
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
                                <th>#</th>
                                <th>HSN</th>
                                <th>Description of Goods</th>
                                <th>Unit</th>
                                <th>Batch</th>
                                <th>Expiry</th>
                                <th>Qty</th>
                                <th>Rate (Rs.)</th>
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
                            <td colSpan="10" style="border-bottom: 1px solid #000"></td>
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
                                <td class="print-text-right">${printData.bill.nonVatSales.toFixed(2)}</td>
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
                border-bottom: 1px solid #000;
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
                border-top: 1px solid #000;
                border-bottom: 1px solid #000;
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
                border-top: 1px solid #000;
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
                    <title>Sales_Invoice_${printData.bill.billNumber}</title>
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

    const handlePrintAfterSaveChange = (e) => {
        const isChecked = e.target.checked;
        setPrintAfterSave(isChecked);
        localStorage.setItem('printAfterSave', isChecked);
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

    const handleBatchRowClick = (batchInfo) => {
        if (!selectedItemForBatch) return;

        addItemToBill(selectedItemForBatch, {
            batchNumber: batchInfo.batchNumber,
            expiryDate: batchInfo.expiryDate,
            price: batchInfo.price,
            uniqueUuId: batchInfo.uniqueUuId,
            puPrice: batchInfo.puPrice,
            netPuPrice: batchInfo.netPuPrice
        });

        setShowBatchModal(false);
        setSelectedItemForBatch(null);
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
                        onItemClick={showBatchModalForItem}
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
                    <div className="row">
                        <div className="col-md-8 col-12">
                            Cash Sales Entry Open
                            {formData.billNumber === '' && (
                                <span style={{ color: 'red' }}>Invoice is required!</span>
                            )}
                            {dateErrors.transactionDateNepali && (
                                <span style={{ color: 'red' }}>{dateErrors.transactionDateNepali}</span>
                            )}
                            {dateErrors.nepaliDate && (
                                <span style={{ color: 'red' }}>{dateErrors.nepaliDate}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit} id="billForm" className="needs-validation" noValidate>
                        <div className="form-group row">
                            {company.dateFormat === 'nepali' ? (
                                <>
                                    <div className="col">
                                        <label htmlFor="transactionDateNepali">Transaction Date:</label>
                                        <input
                                            type="text"
                                            name="transactionDateNepali"
                                            id="transactionDateNepali"
                                            ref={company.dateFormat === 'nepali' ? transactionDateRef : null}
                                            className={`form-control no-date-icon ${dateErrors.transactionDateNepali ? 'is-invalid' : ''}`}
                                            value={formData.transactionDateNepali}
                                            onChange={(e) => {
                                                setFormData({ ...formData, transactionDateNepali: e.target.value });
                                                setDateErrors(prev => ({ ...prev, transactionDateNepali: '' }));
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
                                            ref={company.dateFormat === 'nepali' ? transactionDateRef : null}
                                            value={formData.transactionDateRoman}
                                            onChange={(e) => setFormData({ ...formData, transactionDateRoman: e.target.value })}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'transactionDateRoman');
                                                }
                                            }}
                                            required
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
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleKeyDown(e, 'billDate');
                                                }
                                            }}
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            <div className="col">
                                <label htmlFor="billNumber">Inv. No:</label>
                                <input
                                    type="text"
                                    id="billNumber"
                                    className="form-control"
                                    value={formData.billNumber || nextBillNumber}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'billNumber');
                                        }
                                    }}
                                    readOnly
                                />
                            </div>

                            <div className="col">
                                <label htmlFor="isVatExempt">VAT</label>
                                <select
                                    className="form-control"
                                    id="isVatExempt"
                                    name="isVatExempt"
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
                            <div className="col-5">
                                <label htmlFor="cashAccount">Party Name:</label>
                                <input
                                    type="text"
                                    id="cashAccount"
                                    name="cashAccount"
                                    className="form-control"
                                    value={formData.cashAccount}
                                    onChange={(e) => setFormData({ ...formData, cashAccount: e.target.value })}
                                    onClick={() => setShowAccountModal(true)}
                                    onFocus={() => setShowAccountModal(true)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'account');
                                        }
                                    }}
                                    required
                                />
                                <input type="hidden" id="accountId" name="accountId" value={formData.cashAccountId} />
                            </div>
                            <div className="col">
                                <label htmlFor="cashAccountAddress">Address:</label>
                                <input
                                    type="text"
                                    id="cashAccountAddress"
                                    name="cashAccountAddress"
                                    className="form-control"
                                    value={formData.cashAccountAddress}
                                    onChange={(e) => setFormData({ ...formData, cashAccountAddress: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'cashAccountAddress');
                                        }
                                    }}
                                    ref={addressRef}
                                />
                            </div>
                            <div className="col">
                                <label htmlFor="cashAccountPhone">Phone:</label>
                                <input
                                    type="tel"
                                    id="cashAccountPhone"
                                    name="cashAccountPhone"
                                    className="form-control"
                                    value={formData.cashAccountPhone}
                                    onChange={(e) => setFormData({ ...formData, cashAccountPhone: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'cashAccountPhone');
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <hr style={{ border: "1px solid gray" }} />

                        <div id="bill-details-container" style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }} ref={itemsTableRef}>
                            <table className="table table-bordered compact-table" id="itemsTable">
                                <thead>
                                    <tr>
                                        <th>S.N.</th>
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
                                    {items.map((item, index) => {
                                        const availableStock = getAvailableStockForDisplay(item);
                                        const remainingStock = getRemainingStock(item);
                                        return (
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
                                                        required
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                document.getElementById(`expiryDate-${index}`)?.focus();
                                                            }
                                                        }}
                                                        readOnly
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
                                                                document.getElementById(`quantity-${index}`)?.focus();
                                                            }
                                                        }}
                                                        readOnly
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        name={`items[${index}][quantity]`}
                                                        className={`form-control item-quantity ${quantityErrors[index] ? 'is-invalid' : ''}`}
                                                        id={`quantity-${index}`}
                                                        value={item.quantity}
                                                        onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                        required
                                                        min="0"
                                                        max={availableStock}
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                // Only move to next field if quantity is valid
                                                                if (!quantityErrors[index]) {
                                                                    document.getElementById(`price-${index}`)?.focus();
                                                                } else {
                                                                    // Keep focus on quantity field if there's an error
                                                                    e.target.focus();
                                                                    e.target.select();
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    {quantityErrors[index] && (
                                                        <div className="invalid-feedback d-block small">
                                                            {quantityErrors[index]}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {item.unit?.name}
                                                    <input type="hidden" name={`items[${index}][unit]`} value={item.unit?._id} />
                                                </td>
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
                                                                itemSearchRef.current?.focus();
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
                                                <input type="hidden" name={`items[${index}][puPrice]`} value={item.puPrice} />
                                                <input type="hidden" name={`items[${index}][netPuPrice]`} value={item.netPuPrice} />
                                                <input type="hidden" name={`items[${index}][uniqueUuId]`} value={item.uniqueUuId} />
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <hr style={{ border: "1px solid gray" }} />

                        <div className="row mb-3">
                            <div className="col-12">
                                <label htmlFor="itemSearch" className="form-label">Search Item</label>
                                <div className="position-relative">
                                    <input
                                        type="text"
                                        id="itemSearch"
                                        className="form-control"
                                        placeholder="Search for an item"
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
                                                        showBatchModalForItem(itemToAdd);
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

                                    {company.vatEnabled && formData.isVatExempt !== 'true' && (
                                        <>
                                            <tr id="taxableAmountRow">
                                                <td><label htmlFor="taxableAmount">Taxable Amount:</label></td>
                                                <td>
                                                    <p className="form-control-plaintext">Rs. {totals.taxableAmount.toFixed(2)}</p>
                                                </td>
                                                <td><label htmlFor="vatPercentage">VAT %:</label></td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        id="vatPercentage"
                                                        className="form-control"
                                                        value={formData.vatPercentage}
                                                        onFocus={(e) => {
                                                            e.target.select();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleKeyDown(e, 'vatPercentage');
                                                            }
                                                        }}
                                                        readOnly
                                                    />
                                                </td>
                                                <td><label htmlFor="vatAmount">VAT Amount:</label></td>
                                                <td>
                                                    <p className="form-control-plaintext">Rs. {totals.vatAmount.toFixed(2)}</p>
                                                </td>
                                            </tr>
                                        </>
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
                                                onChange={(e) => setFormData({ ...formData, roundOffAmount: parseFloat(e.target.value) || 0 })}
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
                                        <td>
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
                                type="button"
                                className="btn btn-primary mr-2 p-3"
                                id="saveBill"
                                onClick={(e) => handleSubmit(e, false)}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
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

                        {/* Action Buttons */}
                        <div className="d-flex justify-content-end gap-2">
                            {/* Print After Save Checkbox */}
                            <div className="form-check mb-3">
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

                            {/* Action Buttons */}
                            <div className="d-flex justify-content-end gap-2">
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={resetForm}
                                    disabled={isSaving}
                                >
                                    <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    id="saveBill"
                                    disabled={isSaving}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSubmit(e, printAfterSave);
                                        }
                                    }}
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
                                        {filteredAccounts.length > 0 ? (
                                            filteredAccounts.map((account, index) => (
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
                                            ))
                                        ) : accountSearchRef.current?.value ? (
                                            <li className="list-group-item text-center py-4 text-muted">
                                                No accounts found matching "{accountSearchRef.current.value}"
                                            </li>
                                        ) : (
                                            accounts.map((account, index) => (
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
                                            ))
                                        )}
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

            {showBatchModal && selectedItemForBatch && (
                <div className="modal fade show" id="batchModal" tabIndex="-1" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                            {/* Modal Header */}
                            <div className="modal-header py-2" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                <h5 className="modal-title mb-0 mx-auto fw-semibold" style={{ fontSize: '1.1rem' }}>
                                    <i className="bi bi-box-seam me-2"></i>
                                    Batch Information: {selectedItemForBatch.name}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close position-absolute"
                                    style={{ right: '1rem', top: '0.75rem' }}
                                    onClick={() => setShowBatchModal(false)}
                                    aria-label="Close"
                                ></button>
                            </div>

                            {/* Modal Body */}
                            <div className="modal-body p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                {selectedItemForBatch.stockEntries.every(entry => entry.quantity === 0) ? (
                                    <div className="d-flex justify-content-center align-items-center py-4">
                                        <div className="alert alert-warning d-flex align-items-center py-2 px-3 mb-0 w-75 text-center">
                                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                            <span>This item is currently out of stock</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-sm table-hover mb-0">
                                            <thead className="table-light">
                                                <tr className="text-center">
                                                    <th className="py-2">Batch</th>
                                                    <th className="py-2">Expiry</th>
                                                    <th className="py-2">Qty</th>
                                                    <th className="py-2">S.P</th>
                                                    <th className="py-2">C.P</th>
                                                    <th className="py-2">%</th>
                                                    <th className="py-2">MRP</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedItemForBatch.stockEntries
                                                    .filter(entry => entry.quantity > 0)
                                                    .map((entry, index) => (
                                                        <tr
                                                            key={index}
                                                            className={`batch-row text-center ${index === 0 ? 'bg-primary text-white' : ''}`}
                                                            style={{ height: '42px', cursor: 'pointer' }}
                                                            onClick={() => handleBatchRowClick({
                                                                batchNumber: entry.batchNumber,
                                                                expiryDate: entry.expiryDate,
                                                                price: entry.price,
                                                                puPrice: entry.puPrice,
                                                                netPuPrice: entry.netPuPrice,
                                                                uniqueUuId: entry.uniqueUuId
                                                            })}
                                                            tabIndex={0}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleBatchRowClick({
                                                                        batchNumber: entry.batchNumber,
                                                                        expiryDate: entry.expiryDate,
                                                                        price: entry.price,
                                                                        puPrice: entry.puPrice,
                                                                        netPuPrice: entry.netPuPrice,
                                                                        uniqueUuId: entry.uniqueUuId
                                                                    });
                                                                } else if (e.key === 'ArrowDown') {
                                                                    e.preventDefault();
                                                                    const nextRow = e.currentTarget.nextElementSibling;
                                                                    if (nextRow) {
                                                                        e.currentTarget.classList.remove('bg-primary', 'text-white');
                                                                        nextRow.classList.add('bg-primary', 'text-white');
                                                                        nextRow.focus();
                                                                    }
                                                                } else if (e.key === 'ArrowUp') {
                                                                    e.preventDefault();
                                                                    const prevRow = e.currentTarget.previousElementSibling;
                                                                    if (prevRow) {
                                                                        e.currentTarget.classList.remove('bg-primary', 'text-white');
                                                                        prevRow.classList.add('bg-primary', 'text-white');
                                                                        prevRow.focus();
                                                                    } else {
                                                                        e.currentTarget.focus();
                                                                    }
                                                                }
                                                            }}
                                                            onFocus={(e) => {
                                                                document.querySelectorAll('.batch-row').forEach(row => {
                                                                    row.classList.remove('bg-primary', 'text-white');
                                                                });
                                                                e.currentTarget.classList.add('bg-primary', 'text-white');
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                document.querySelectorAll('.batch-row').forEach(row => {
                                                                    row.classList.remove('bg-primary', 'text-white');
                                                                });
                                                                e.currentTarget.classList.add('bg-primary', 'text-white');
                                                            }}
                                                        >
                                                            <td className="py-2 align-middle">{entry.batchNumber || 'N/A'}</td>
                                                            <td className="py-2 align-middle">{formatDateForInput(entry.expiryDate)}</td>
                                                            <td className="py-2 align-middle fw-semibold">{entry.quantity}</td>
                                                            <td className="py-2 align-middle">{Math.round(entry.price * 100) / 100}</td>
                                                            <td className="py-2 align-middle">{Math.round(entry.puPrice * 100) / 100}</td>
                                                            <td className="py-2 align-middle">{Math.round(entry.marginPercentage * 100) / 100}</td>
                                                            <td className="py-2 align-middle">{Math.round(entry.mrp * 100) / 100}</td>
                                                        </tr>
                                                    ))
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="modal-footer py-2 justify-content-center" style={{ backgroundColor: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm py-1 px-3 d-flex align-items-center"
                                    onClick={() => setShowBatchModal(false)}
                                >
                                    <i className="bi bi-x-circle me-1"></i>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
        </div>
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

export default AddCashSalesOpen;
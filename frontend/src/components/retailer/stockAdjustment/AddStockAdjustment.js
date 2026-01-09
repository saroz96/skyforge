import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date';
import NepaliDate from 'nepali-date-converter';
import axios from 'axios';
import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
import Header from '../Header';
import NotificationToast from '../../NotificationToast';
import '../../../stylesheet/noDateIcon.css'
import VirtualizedItemList from '../../VirtualizedItemList';
import useDebounce from '../../../hooks/useDebounce';
import ProductModal from '../dashboard/modals/ProductModal';

const AddStockAdjustment = () => {
    const navigate = useNavigate();
    const transactionDateRef = useRef(null);
    const nepaliDateRef = useRef(null);
    const marginPercentageRef = useRef(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [dateErrors, setDateErrors] = useState({
        nepaliDate: '',
        billDate: ''
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [lastSearchQuery, setLastSearchQuery] = useState('');
    const [shouldShowLastSearchResults, setShouldShowLastSearchResults] = useState(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 50);

    const [formData, setFormData] = useState({
        adjustmentType: 'xcess',
        nepaliDate: currentNepaliDate,
        billDate: new Date().toISOString().split('T')[0],
        billNumber: '',
        isVatExempt: 'all',
        note: '',
        vatPercentage: 13,
        items: []
    });

    const [items, setItems] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [company, setCompany] = useState({
        dateFormat: 'english',
        vatEnabled: true,
        fiscalYear: {}
    });
    const [nextBillNumber, setNextBillNumber] = useState('');
    const itemDropdownRef = useRef(null);
    const itemSearchRef = useRef(null);

    // Modals state
    const [showSalesPriceModal, setShowSalesPriceModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
    const [selectedItemForBatch, setSelectedItemForBatch] = useState(null);
    const [salesPriceData, setSalesPriceData] = useState({
        puPrice: 0,
        marginPercentage: 0,
        currency: 'NPR',
        mrp: 0,
        salesPrice: 0
    });

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
                const response = await api.get('/api/retailer/stockAdjustments/new');
                const { data } = response;

                setCompany(data.data.company);
                setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
                setNextBillNumber(data.data.nextBillNumber);

                setFormData(prev => ({
                    ...prev,
                    billNumber: data.data.nextBillNumber
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
        calculateTotal();
    }, [items, formData]);

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

    // useEffect(() => {
    //     if (itemSearchRef.current?.value) {
    //         handleItemSearch({ target: { value: itemSearchRef.current.value } });
    //     } else {
    //         const filtered = allItems.filter(item => {
    //             if (formData.isVatExempt === 'all') return true;
    //             if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
    //             if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
    //             return true;
    //         });
    //         setFilteredItems(filtered);
    //     }
    // }, [formData.isVatExempt, allItems]);

    // const handleItemSearch = (e) => {
    //     const query = e.target.value.toLowerCase();

    //     if (query.length === 0) {
    //         setFilteredItems([]);
    //         return;
    //     }

    //     let filtered = allItems.filter(item => {
    //         const matchesSearch = item.name.toLowerCase().includes(query) ||
    //             (item.hscode && item.hscode.toString().toLowerCase().includes(query)) ||
    //             (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query)) ||
    //             (item.category && item.category.name.toLowerCase().includes(query));

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

    const handleSearchFocus = () => {
        setShowItemDropdown(true);

        // If we have a last search query and the input is empty, show those results
        if (lastSearchQuery && !searchQuery) {
            setShouldShowLastSearchResults(true);
        }

        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.remove('active');
        });
    };

    const addItemToBill = (item, batchInfo = null) => {

        // Store the search query when adding an item
        if (itemSearchRef.current?.value) {
            setLastSearchQuery(itemSearchRef.current.value);
            setShouldShowLastSearchResults(true);
        }

        let newItem;

        if (formData.adjustmentType === 'xcess') {
            // For xcess type, create a new item with default values
            newItem = {
                item: item._id,
                uniqueNumber: item.uniqueNumber || 'N/A',
                hscode: item.hscode,
                name: item.name,
                category: item.category?.name || 'No Category',
                batchNumber: 'XXX',
                expiryDate: getDefaultExpiryDate(),
                quantity: 0,
                unit: item.unit,
                puPrice: item.latestPuPrice || 0,
                price: item.latestPuPrice || 0, // Default price same as puPrice
                mrp: 0,
                amount: 0,
                vatStatus: item.vatStatus,
                reason: '',
                uniqueUuId: ''
            };
        } else {
            // For short type, use the batch info
            newItem = {
                item: item._id,
                uniqueNumber: item.uniqueNumber || 'N/A',
                hscode: item.hscode,
                name: item.name,
                category: item.category?.name || 'No Category',
                batchNumber: batchInfo.batchNumber || '',
                expiryDate: batchInfo.expiryDate ? formatDateForInput(batchInfo.expiryDate) : '',
                quantity: 0,
                unit: item.unit,
                puPrice: batchInfo.puPrice || 0,
                price: batchInfo.price || 0,
                mrp: batchInfo.mrp || 0,
                amount: 0,
                vatStatus: item.vatStatus,
                reason: '',
                uniqueUuId: batchInfo.uniqueUuId || ''
            };
        }

        setItems([...items, newItem]);
        setShowItemDropdown(false);
        itemSearchRef.current.value = '';

        // Clear search after adding item
        setSearchQuery('');
        if (itemSearchRef.current) {
            itemSearchRef.current.value = '';
        }

        setTimeout(() => {
            const newItemIndex = items.length;
            const batchNumberInput = document.getElementById(`batchNumber-${newItemIndex}`);
            if (batchNumberInput) {
                batchNumberInput.focus();
                batchNumberInput.select();
            }
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



    const updateItemField = (index, field, value) => {
        const updatedItems = [...items];
        updatedItems[index][field] = value;

        if (field === 'quantity' || field === 'puPrice') {
            updatedItems[index].amount = (updatedItems[index].quantity * updatedItems[index].puPrice).toFixed(2);
        }

        setItems(updatedItems);
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

    const calculateTotal = () => {
        let subTotal = 0;
        let taxableAmount = 0;
        let nonTaxableAmount = 0;

        items.forEach(item => {
            const amount = parseFloat(item.amount) || 0;
            subTotal += amount;

            if (item.vatStatus === 'vatable') {
                taxableAmount += amount;
            } else {
                nonTaxableAmount += amount;
            }
        });

        const vatPercentage = parseFloat(formData.vatPercentage) || 13;
        const vatAmount = (formData.isVatExempt === 'false' || formData.isVatExempt === 'all') ?
            (taxableAmount * vatPercentage) / 100 : 0;

        const totalAmount = taxableAmount + nonTaxableAmount + vatAmount;

        return {
            subTotal,
            taxableAmount,
            nonTaxableAmount,
            vatAmount,
            totalAmount
        };
    };

    const resetForm = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/api/retailer/stockAdjustments/new');
            const { data } = response;

            const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
            const currentRomanDate = new Date().toISOString().split('T')[0];

            setFormData({
                adjustmentType: 'xcess',
                nepaliDate: currentNepaliDate,
                billDate: currentRomanDate,
                billNumber: data.data.nextBillNumber,
                isVatExempt: 'all',
                note: '',
                vatPercentage: 13,
                items: []
            });

            setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
            setNextBillNumber(data.data.nextBillNumber);
            setItems([]);
            setFilteredItems([]);

            // Clear the item search input if it exists
            if (itemSearchRef.current) {
                itemSearchRef.current.value = '';
            }

            // Focus back to the date field
            setTimeout(() => {
                if (company.dateFormat === 'nepali' && nepaliDateRef.current) {
                    nepaliDateRef.current.focus();
                } else if (transactionDateRef.current) {
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
            const adjustmentData = {
                ...formData,
                items: items.map(item => ({
                    item: item.item,
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    quantity: item.quantity,
                    unit: item.unit?._id,
                    puPrice: item.puPrice,
                    price: item.price,
                    mrp: item.mrp,
                    reason: item.reason ? [item.reason] : [],
                    vatStatus: item.vatStatus,
                    uniqueUuId: item.uniqueUuId
                })),
                print
            };

            const response = await api.post('/api/retailer/stockAdjustments/new', adjustmentData);

            setNotification({
                show: true,
                message: 'Stock adjustment saved successfully!',
                type: 'success'
            });

            setItems([]);

            if (print) {
                setIsSaving(false);
                navigate(`/stockAdjustments/${response.data.data.adjustmentId}/print`);
            } else {
                setIsSaving(false);
                resetForm();
            }
        } catch (error) {
            console.error('Error saving stock adjustment:', error);
            setNotification({
                show: true,
                message: 'Failed to save stock adjustment. Please try again.',
                type: 'error'
            });
            setIsSaving(false);
        }
    };

    // Sales Price Modal functions
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
        const marginPercentage = latestStockEntry?.marginPercentage || 0;
        const currency = latestStockEntry?.currency || 'NPR';
        const mrp = latestStockEntry?.mrp || 0;
        const salesPrice = latestStockEntry?.price || currentPuPrice;

        setSalesPriceData({
            prevPuPrice: prevPuPrice,
            puPrice: currentPuPrice,
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
        };

        setItems(updatedItems);
        setShowSalesPriceModal(false);

        setTimeout(() => {
            const nextField = document.getElementById(`reason-${selectedItemIndex}`);
            if (nextField) {
                nextField.focus();
            }
        }, 0);
    };

    useEffect(() => {
        if (showSalesPriceModal && marginPercentageRef.current) {
            // Use setTimeout to ensure the modal is fully rendered before focusing
            setTimeout(() => {
                marginPercentageRef.current.focus();
                marginPercentageRef.current.select();
            }, 100);
        }
    }, [showSalesPriceModal]);

    // Batch Modal functions
    // const showBatchModalForItem = (item) => {
    //     setSelectedItemForBatch(item);
    //     setShowBatchModal(true);
    // };

    const showBatchModalForItem = (item) => {
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

    const handleBatchRowClick = (batchInfo) => {
        if (!selectedItemForBatch) return;

        addItemToBill(selectedItemForBatch, {
            batchNumber: batchInfo.batchNumber,
            expiryDate: batchInfo.expiryDate,
            puPrice: batchInfo.puPrice,
            price: batchInfo.price,
            mrp: batchInfo.mrp,
            uniqueUuId: batchInfo.uniqueUuId
        });

        setShowBatchModal(false);
        setSelectedItemForBatch(null);
    };

    const formatDateForInput = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
                className="dropdown-menu show w-100"
                style={{
                    maxHeight: '280px',
                    height: '280px',
                    overflow: 'hidden',
                    position: 'absolute',
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
                        onItemClick={(item) => {
                            if (formData.adjustmentType === 'short') {
                                showBatchModalForItem(item);
                            } else {
                                addItemToBill(item);
                            }
                        }}
                        searchRef={itemSearchRef}
                    />
                ) : (
                    <div className="text-center py-3 text-muted">
                        {message}
                    </div>
                )}
            </div>
        );
    }, [showItemDropdown, memoizedFilteredItems, searchQuery, lastSearchQuery, shouldShowLastSearchResults, formData.adjustmentType]);


    return (
        <div className="container-fluid">
            <Header />
            <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                <div className="card-header">
                    Stock Adjustment
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit} id="adjustmentForm" className="needs-validation" noValidate>
                        <div className="form-group row">
                            {company.dateFormat === 'nepali' ? (
                                <>
                                    <div className="col">
                                        <label htmlFor="nepaliDate">Date:</label>
                                        <input
                                            type="text"
                                            name="nepaliDate"
                                            id="nepaliDate"
                                            autoComplete='off'
                                            ref={nepaliDateRef}
                                            autoFocus
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
                                        {dateErrors.nepaliDate && (
                                            <div className="invalid-feedback">
                                                {dateErrors.nepaliDate}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="col">
                                    <label htmlFor="billDate">Date:</label>
                                    <input
                                        type="date"
                                        name="billDate"
                                        id="billDate"
                                        className="form-control"
                                        ref={company.dateFormat === 'english' ? transactionDateRef : null}
                                        autoFocus
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
                            )}

                            <div className="col">
                                <label htmlFor="adjustmentType">Type:</label>
                                <select
                                    id="adjustmentType"
                                    name="adjustmentType"
                                    className="form-control"
                                    value={formData.adjustmentType}
                                    onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleKeyDown(e, 'adjustmentType');
                                        }
                                    }}
                                >
                                    <option value="xcess">Xcess</option>
                                    <option value="short">Short</option>
                                </select>
                            </div>

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
                                            document.getElementById('isVatExempt')?.focus();
                                        }
                                    }}
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

                        <hr style={{ border: "1px solid gray" }} />

                        <div id="bill-details-container" style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
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
                                        <th>Reason</th>
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
                                                <input type="hidden" name={`items[${index}][item]`} value={item._id} />
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
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    autoComplete='off'
                                                    required
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
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
                                                            document.getElementById(`quantity-${index}`)?.focus();
                                                        }
                                                    }}
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
                                                    required
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
                                                    value={Math.round(item.puPrice * 100) / 100}
                                                    onChange={(e) => updateItemField(index, 'puPrice', e.target.value)}
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (formData.adjustmentType === 'xcess') {
                                                                openSalesPriceModal(index);
                                                            } else {
                                                                document.getElementById(`reason-${index}`)?.focus();
                                                            }
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td className="item-amount">{item.amount}</td>
                                            <td>
                                                <select
                                                    name={`items[${index}][reason]`}
                                                    className="form-control"
                                                    id={`reason-${index}`}
                                                    value={item.reason}
                                                    onChange={(e) => updateItemField(index, 'reason', e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            document.getElementById('itemSearch')?.focus();
                                                        }
                                                    }}
                                                >
                                                    <option value="">Select Reason</option>
                                                    {formData.adjustmentType === 'short' ? (
                                                        <>
                                                            <option value="Expired">Expired</option>
                                                            <option value="Damage">Damage</option>
                                                            <option value="Donate">Donate</option>
                                                        </>
                                                    ) : (
                                                        <option value="Bonus">Bonus</option>
                                                    )}
                                                </select>
                                            </td>
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
                                            <input type="hidden" name={`items[${index}][uniqueUuId]`} value={item.uniqueUuId} />
                                            <input type="hidden" name={`items[${index}][mrp]`} value={item.mrp} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* <div className="form-group row">
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
                                            e.preventDefault();
                                            const activeItem = document.querySelector('.dropdown-item.active');
                                            if (activeItem) {
                                                const index = parseInt(activeItem.getAttribute('data-index'));
                                                const filteredItem = filteredItems.length > 0 ? filteredItems[index] : allItems[index];
                                                if (filteredItem) {
                                                    if (formData.adjustmentType === 'short') {
                                                        showBatchModalForItem(filteredItem);
                                                    } else {
                                                        addItemToBill(filteredItem);
                                                    }
                                                }
                                            } else if (!e.target.value && items.length > 0) {
                                                setShowItemDropdown(false);
                                                setTimeout(() => {
                                                    document.getElementById('note')?.focus();
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
                                                        onClick={() => {
                                                            if (formData.adjustmentType === 'short') {
                                                                showBatchModalForItem(item);
                                                            } else {
                                                                addItemToBill(item);
                                                            }
                                                        }}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (formData.adjustmentType === 'short') {
                                                                    showBatchModalForItem(item);
                                                                } else {
                                                                    addItemToBill(item);
                                                                }
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
                                                        onClick={() => {
                                                            if (formData.adjustmentType === 'short') {
                                                                showBatchModalForItem(item);
                                                            } else {
                                                                addItemToBill(item);
                                                            }
                                                        }}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (formData.adjustmentType === 'short') {
                                                                    showBatchModalForItem(item);
                                                                } else {
                                                                    addItemToBill(item);
                                                                }
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
                        </div> */}

                        {/* Item Search */}
                        <div className="row mb-3">
                            <div className="col-12">
                                <label htmlFor="itemSearch" className="form-label">Search Item</label>
                                <div className="position-relative">
                                    <input
                                        type="text"
                                        id="itemSearch"
                                        className="form-control form-control-sm"
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
                                                        if (formData.adjustmentType === 'short') {
                                                            showBatchModalForItem(itemToAdd);
                                                        } else {
                                                            addItemToBill(itemToAdd);
                                                        }
                                                    }
                                                } else if (!searchQuery && items.length > 0) {
                                                    setShowItemDropdown(false);
                                                    setTimeout(() => {
                                                        document.getElementById('note')?.focus();
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
                                        <th colSpan="6" className="text-center bg-light">Adjustment Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><label htmlFor="subTotal">Sub Total:</label></td>
                                        <td>
                                            <p className="form-control-plaintext">Rs. {totals.subTotal.toFixed(2)}</p>
                                        </td>
                                        <td colSpan="4"></td>
                                    </tr>

                                    {company.vatEnabled && formData.isVatExempt !== 'true' && (
                                        <>
                                            <tr id="taxableAmountRow">
                                                <td><label htmlFor="taxableAmount">Taxable Amount:</label></td>
                                                <td>
                                                    <p className="form-control-plaintext">Rs. {totals.taxableAmount.toFixed(2)}</p>
                                                </td>
                                                <td><label htmlFor="vatPercentage">VAT (13%):</label></td>
                                                <td className='d-none'>
                                                    <input
                                                        type="number"
                                                        name="vatPercentage"
                                                        id="vatPercentage"
                                                        className="form-control"
                                                        value={formData.vatPercentage}
                                                        readOnly
                                                    />
                                                </td>
                                                <td className='d-none'><label htmlFor="vatAmount">VAT Amount:</label></td>
                                                <td>
                                                    <p className="form-control-plaintext">Rs. {totals.vatAmount.toFixed(2)}</p>
                                                </td>
                                            </tr>
                                        </>
                                    )}
                                    {company.vatEnabled && formData.isVatExempt === 'true' && (
                                        <td colSpan="4"></td>
                                    )}
                                    <tr>
                                        <td><label htmlFor="totalAmount">Total Amount:</label></td>
                                        <td>
                                            <p className="form-control-plaintext">Rs. {totals.totalAmount.toFixed(2)}</p>
                                        </td>
                                        <td><label htmlFor="amountInWords">In Words:</label></td>
                                        <td colSpan="3">
                                            <p className="form-control-plaintext" id="amountInWords">
                                                {convertToRupeesAndPaisa(totals.totalAmount)} Only.
                                            </p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="form-group">
                            <label htmlFor="note">Description:</label>
                            <input
                                type="text"
                                className="form-control"
                                id="note"
                                name="note"
                                value={formData.note}
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                placeholder="add note"
                                autoComplete='off'
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.getElementById('saveBill')?.focus();
                                    }
                                }}
                            />
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
                                            value={salesPriceData.prevPuPrice || ''}
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
                                                document.getElementById('currency')?.focus();
                                            }
                                        }}
                                        ref={marginPercentageRef}
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
            {/* 
            {showBatchModal && selectedItemForBatch && (
                <div className="modal fade show" id="batchModal" tabIndex="-1" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header py-2">
                                <h5 className="modal-title mb-0" style={{ fontSize: '1rem' }}>Batch Info: {selectedItemForBatch.name}</h5>
                                <button
                                    type="button"
                                    className="close p-0"
                                    style={{ fontSize: '1.5rem' }}
                                    onClick={() => setShowBatchModal(false)}
                                >
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className="modal-body p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                {selectedItemForBatch.stockEntries.every(entry => entry.quantity === 0) ? (
                                    <div className="alert alert-warning py-1 px-2 mb-0" style={{ fontSize: '0.85rem' }}>
                                        Out of Stock
                                    </div>
                                ) : (
                                    <table className="table table-sm mb-0">
                                        <thead>
                                            <tr className="small">
                                                <th className="py-1">Batch</th>
                                                <th className="py-1">Expiry</th>
                                                <th className="py-1">Qty</th>
                                                <th className="py-1">S.P</th>
                                                <th className="py-1">C.P</th>
                                                <th className="py-1">%</th>
                                                <th className="py-1">Mrp</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedItemForBatch.stockEntries
                                                .filter(entry => entry.quantity > 0)
                                                .map((entry, index) => (
                                                    <tr
                                                        key={index}
                                                        className={`batch-row small ${index === 0 ? 'bg-primary text-white' : ''}`}
                                                        style={{ height: '30px', cursor: 'pointer' }}
                                                        onClick={() => handleBatchRowClick({
                                                            batchNumber: entry.batchNumber,
                                                            expiryDate: entry.expiryDate,
                                                            price: entry.price,
                                                            puPrice: entry.puPrice,
                                                            mrp: entry.mrp,
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
                                                                    mrp: entry.mrp,
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
                                                        <td className="py-1">{entry.batchNumber || 'N/A'}</td>
                                                        <td className="py-1">{formatDateForInput(entry.expiryDate)}</td>
                                                        <td className="py-1">{entry.quantity}</td>
                                                        <td className="py-1">{Math.round(entry.price * 100) / 100}</td>
                                                        <td className="py-1">{Math.round(entry.puPrice * 100) / 100}</td>
                                                        <td className="py-1">{Math.round(entry.marginPercentage * 100) / 100}</td>
                                                        <td className="py-1">{Math.round(entry.mrp * 100) / 100}</td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="modal-footer py-1">
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm py-0 px-2"
                                    onClick={() => setShowBatchModal(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )} */}

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
                                                    <th className="py-2">Batch No.</th>
                                                    <th className="py-2">Expiry Date</th>
                                                    <th className="py-2">Quantity</th>
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
                                                                mrp: entry.mrp,
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
                                                                        mrp: entry.mrp,
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
            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />

            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
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

export default AddStockAdjustment;
//-------------------------------second approach-------------------------------------
// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date-converter';
// import axios from 'axios';
// import Header from '../Header';
// import NotificationToast from '../../NotificationToast';
// import '../../../stylesheet/noDateIcon.css';
// import useDebounce from '../../../hooks/useDebounce';
// import ProductModal from '../dashboard/modals/ProductModal';

// const AddStockAdjustment = () => {
//     const navigate = useNavigate();
//     const transactionDateRef = useRef(null);
//     const nepaliDateRef = useRef(null);
//     const [showProductModal, setShowProductModal] = useState(false);
//     const [isLoading, setIsLoading] = useState(true);
//     const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
//     const [isSaving, setIsSaving] = useState(false);
//     const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//     const [notification, setNotification] = useState({
//         show: false,
//         message: '',
//         type: 'success'
//     });
//     const [dateErrors, setDateErrors] = useState({
//         nepaliDate: '',
//         billDate: ''
//     });

//     // Search states
//     const [searchQuery, setSearchQuery] = useState('');
//     const debouncedSearchQuery = useDebounce(searchQuery, 50);
//     const [showItemDropdown, setShowItemDropdown] = useState(false);

//     // Form data
//     const [formData, setFormData] = useState({
//         adjustmentType: 'xcess',
//         nepaliDate: currentNepaliDate,
//         billDate: new Date().toISOString().split('T')[0],
//         billNumber: '',
//         isVatExempt: 'all',
//         note: '',
//         vatPercentage: 13,
//         items: []
//     });

//     // Items states
//     const [items, setItems] = useState([]); // Added items in table
//     const [allItems, setAllItems] = useState([]); // All items from API
//     const [filteredItems, setFilteredItems] = useState([]); // Filtered for dropdown

//     // Current item being filled (single row above table)
//     const [currentItem, setCurrentItem] = useState({
//         item: null,
//         itemId: '',
//         uniqueNumber: '',
//         hscode: '',
//         name: '',
//         category: '',
//         batchNumber: '',
//         expiryDate: '',
//         quantity: 1,
//         unit: { _id: '', name: '' },
//         puPrice: 0,
//         price: 0,
//         mrp: 0,
//         amount: 0,
//         vatStatus: 'vatable',
//         reason: '',
//         uniqueUuId: ''
//     });

//     const [company, setCompany] = useState({
//         dateFormat: 'english',
//         vatEnabled: true,
//         fiscalYear: {}
//     });
//     const [nextBillNumber, setNextBillNumber] = useState('');
//     const itemDropdownRef = useRef(null);
//     const itemSearchRef = useRef(null);

//     // Batch modal state
//     const [showBatchModal, setShowBatchModal] = useState(false);
//     const [selectedItemForBatch, setSelectedItemForBatch] = useState(null);

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     // Keyboard shortcuts
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             // F9 - Product modal
//             if (e.key === 'F9') {
//                 e.preventDefault();
//                 setShowProductModal(prev => !prev);
//             }

//             // F2 - Focus search
//             if (e.key === 'F2') {
//                 e.preventDefault();
//                 if (itemSearchRef.current) {
//                     itemSearchRef.current.focus();
//                     itemSearchRef.current.select();
//                 }
//             }

//             // F5 - Save
//             if (e.key === 'F5' && items.length > 0) {
//                 e.preventDefault();
//                 handleSubmit(e);
//             }

//             // F6 - Save & Print
//             if (e.key === 'F6' && items.length > 0) {
//                 e.preventDefault();
//                 handleSubmit(e, true);
//             }

//             // F11 - New
//             if (e.key === 'F11') {
//                 e.preventDefault();
//                 resetForm();
//             }

//             // Escape - Close dropdown
//             if (e.key === 'Escape' && showItemDropdown) {
//                 setShowItemDropdown(false);
//             }
//         };

//         window.addEventListener('keydown', handleKeyDown);
//         return () => window.removeEventListener('keydown', handleKeyDown);
//     }, [items, showItemDropdown]);

//     // Fetch initial data
//     useEffect(() => {
//         const fetchInitialData = async () => {
//             try {
//                 const response = await api.get('/api/retailer/stockAdjustments/new');
//                 const { data } = response;

//                 setCompany(data.data.company);
//                 setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
//                 setNextBillNumber(data.data.nextBillNumber);

//                 setFormData(prev => ({
//                     ...prev,
//                     billNumber: data.data.nextBillNumber
//                 }));
//                 setIsInitialDataLoaded(true);
//                 setIsLoading(false);
//             } catch (error) {
//                 console.error('Error fetching initial data:', error);
//                 setIsLoading(false);
//             }
//         };
//         fetchInitialData();
//     }, []);

//     // Focus on date field after load
//     useEffect(() => {
//         if (isInitialDataLoaded && transactionDateRef.current) {
//             setTimeout(() => {
//                 if (company.dateFormat === 'nepali' && nepaliDateRef.current) {
//                     nepaliDateRef.current.focus();
//                 } else if (transactionDateRef.current) {
//                     transactionDateRef.current.focus();
//                 }
//             }, 100);
//         }
//     }, [isInitialDataLoaded, company.dateFormat]);

//     // Calculate totals when items change
//     useEffect(() => {
//         calculateTotal();
//     }, [items]);

//     // Item search handler
//     const handleItemSearch = (e) => {
//         const query = e.target.value.toLowerCase();
//         setSearchQuery(query);

//         if (query.length > 0) {
//             const filtered = allItems.filter(item => {
//                 const matchesSearch = item.name.toLowerCase().includes(query) ||
//                     (item.hscode && item.hscode.toString().toLowerCase().includes(query)) ||
//                     (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query));

//                 if (formData.isVatExempt === 'all') return matchesSearch;
//                 if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
//                 if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
//                 return matchesSearch;
//             });
//             setFilteredItems(filtered);
//             setShowItemDropdown(true);
//         } else {
//             setFilteredItems([]);
//             setShowItemDropdown(false);
//         }
//     };

//     // Handle item selection from dropdown
//     const handleItemSelect = (item) => {
//         if (formData.adjustmentType === 'short') {
//             setSelectedItemForBatch(item);
//             setShowBatchModal(true);
//         } else {
//             setCurrentItem({
//                 ...currentItem,
//                 itemId: item._id,
//                 uniqueNumber: item.uniqueNumber || 'N/A',
//                 hscode: item.hscode || '',
//                 name: item.name,
//                 category: item.category?.name || 'No Category',
//                 unit: item.unit || { _id: '', name: '' },
//                 puPrice: item.latestPuPrice || 0,
//                 price: item.latestPuPrice || 0,
//                 vatStatus: item.vatStatus,
//                 quantity: 1,
//                 batchNumber: 'XXX',
//                 expiryDate: getDefaultExpiryDate(),
//                 amount: (item.latestPuPrice || 0) * 1
//             });
//             setSearchQuery('');
//             setShowItemDropdown(false);

//             // Focus on batch number field
//             setTimeout(() => {
//                 document.getElementById('currentBatchNumber')?.focus();
//                 document.getElementById('currentBatchNumber')?.select();
//             }, 50);
//         }
//     };

//     // Get default expiry date (2 years from now)
//     const getDefaultExpiryDate = () => {
//         const today = new Date();
//         today.setFullYear(today.getFullYear() + 2);
//         return today.toISOString().split('T')[0];
//     };

//     // Handle batch row click
//     const handleBatchRowClick = (batchInfo) => {
//         if (!selectedItemForBatch) return;

//         const item = selectedItemForBatch;
//         setCurrentItem({
//             ...currentItem,
//             itemId: item._id,
//             uniqueNumber: item.uniqueNumber || 'N/A',
//             hscode: item.hscode || '',
//             name: item.name,
//             category: item.category?.name || 'No Category',
//             unit: item.unit || { _id: '', name: '' },
//             batchNumber: batchInfo.batchNumber || '',
//             expiryDate: batchInfo.expiryDate ? formatDateForInput(batchInfo.expiryDate) : '',
//             puPrice: batchInfo.puPrice || 0,
//             price: batchInfo.price || 0,
//             mrp: batchInfo.mrp || 0,
//             vatStatus: item.vatStatus,
//             quantity: 1,
//             uniqueUuId: batchInfo.uniqueUuId || '',
//             amount: (batchInfo.puPrice || 0) * 1
//         });

//         setShowBatchModal(false);
//         setSelectedItemForBatch(null);
//         setSearchQuery('');

//         setTimeout(() => {
//             document.getElementById('currentQuantity')?.focus();
//             document.getElementById('currentQuantity')?.select();
//         }, 50);
//     };

//     // Format date for input
//     const formatDateForInput = (date) => {
//         if (!date) return '';
//         const d = new Date(date);
//         const year = d.getFullYear();
//         const month = String(d.getMonth() + 1).padStart(2, '0');
//         const day = String(d.getDate()).padStart(2, '0');
//         return `${year}-${month}-${day}`;
//     };

//     // Update current item field
//     const updateCurrentItemField = (field, value) => {
//         const updatedItem = { ...currentItem, [field]: value };

//         // Recalculate amount if quantity or price changes
//         if (field === 'quantity' || field === 'puPrice') {
//             const quantity = field === 'quantity' ? parseFloat(value) || 0 : updatedItem.quantity;
//             const puPrice = field === 'puPrice' ? parseFloat(value) || 0 : updatedItem.puPrice;
//             updatedItem.amount = (quantity * puPrice).toFixed(2);
//         }

//         setCurrentItem(updatedItem);
//     };

//     // Add current item to table
//     const addCurrentItemToTable = () => {
//         // Validate required fields
//         if (!currentItem.itemId || !currentItem.name) {
//             setNotification({
//                 show: true,
//                 message: 'Please select an item first',
//                 type: 'error'
//             });
//             itemSearchRef.current?.focus();
//             return;
//         }

//         if (!currentItem.batchNumber) {
//             setNotification({
//                 show: true,
//                 message: 'Please enter batch number',
//                 type: 'error'
//             });
//             document.getElementById('currentBatchNumber')?.focus();
//             return;
//         }

//         if (!currentItem.quantity || currentItem.quantity <= 0) {
//             setNotification({
//                 show: true,
//                 message: 'Please enter valid quantity',
//                 type: 'error'
//             });
//             document.getElementById('currentQuantity')?.focus();
//             return;
//         }

//         // Add to items array
//         const newItem = {
//             ...currentItem,
//             item: currentItem.itemId,
//             unit: currentItem.unit._id,
//             amount: parseFloat(currentItem.amount) || 0
//         };

//         setItems([...items, newItem]);

//         // Reset current item
//         resetCurrentItem();

//         // Focus back on search
//         setTimeout(() => {
//             itemSearchRef.current?.focus();
//             itemSearchRef.current?.select();
//         }, 50);
//     };

//     // Reset current item
//     const resetCurrentItem = () => {
//         setCurrentItem({
//             item: null,
//             itemId: '',
//             uniqueNumber: '',
//             hscode: '',
//             name: '',
//             category: '',
//             batchNumber: '',
//             expiryDate: '',
//             quantity: 1,
//             unit: { _id: '', name: '' },
//             puPrice: 0,
//             price: 0,
//             mrp: 0,
//             amount: 0,
//             vatStatus: 'vatable',
//             reason: '',
//             uniqueUuId: ''
//         });
//         setSearchQuery('');
//     };

//     // Remove item from table
//     const removeItem = (index) => {
//         const updatedItems = items.filter((_, i) => i !== index);
//         setItems(updatedItems);
//     };

//     // Calculate totals
//     const calculateTotal = () => {
//         let subTotal = 0;
//         let taxableAmount = 0;
//         let nonTaxableAmount = 0;

//         items.forEach(item => {
//             const amount = parseFloat(item.amount) || 0;
//             subTotal += amount;

//             if (item.vatStatus === 'vatable') {
//                 taxableAmount += amount;
//             } else {
//                 nonTaxableAmount += amount;
//             }
//         });

//         const vatPercentage = parseFloat(formData.vatPercentage) || 13;
//         const vatAmount = (formData.isVatExempt === 'false' || formData.isVatExempt === 'all') ?
//             (taxableAmount * vatPercentage) / 100 : 0;

//         const totalAmount = taxableAmount + nonTaxableAmount + vatAmount;

//         return {
//             subTotal: subTotal.toFixed(2),
//             taxableAmount: taxableAmount.toFixed(2),
//             nonTaxableAmount: nonTaxableAmount.toFixed(2),
//             vatAmount: vatAmount.toFixed(2),
//             totalAmount: totalAmount.toFixed(2)
//         };
//     };

//     // Handle form submit
//     const handleSubmit = async (e, print = false) => {
//         e.preventDefault();

//         if (items.length === 0) {
//             setNotification({
//                 show: true,
//                 message: 'Please add at least one item',
//                 type: 'error'
//             });
//             return;
//         }

//         setIsSaving(true);

//         try {
//             const adjustmentData = {
//                 ...formData,
//                 items: items.map(item => ({
//                     item: item.itemId || item.item,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     quantity: item.quantity,
//                     unit: item.unit._id || item.unit,
//                     puPrice: item.puPrice,
//                     price: item.price || item.puPrice,
//                     mrp: item.mrp,
//                     reason: item.reason ? [item.reason] : [],
//                     vatStatus: item.vatStatus,
//                     uniqueUuId: item.uniqueUuId
//                 })),
//                 print
//             };

//             const response = await api.post('/api/retailer/stockAdjustments/new', adjustmentData);

//             setNotification({
//                 show: true,
//                 message: 'Stock adjustment saved successfully!',
//                 type: 'success'
//             });

//             if (print) {
//                 navigate(`/stockAdjustments/${response.data.data.adjustmentId}/print`);
//             } else {
//                 resetForm();
//             }
//         } catch (error) {
//             console.error('Error saving stock adjustment:', error);
//             setNotification({
//                 show: true,
//                 message: 'Failed to save stock adjustment. Please try again.',
//                 type: 'error'
//             });
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     // Reset form
//     const resetForm = async () => {
//         try {
//             setIsLoading(true);
//             const response = await api.get('/api/retailer/stockAdjustments/new');
//             const { data } = response;

//             const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//             const currentRomanDate = new Date().toISOString().split('T')[0];

//             setFormData({
//                 adjustmentType: 'xcess',
//                 nepaliDate: currentNepaliDate,
//                 billDate: currentRomanDate,
//                 billNumber: data.data.nextBillNumber,
//                 isVatExempt: 'all',
//                 note: '',
//                 vatPercentage: 13,
//                 items: []
//             });

//             setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
//             setNextBillNumber(data.data.nextBillNumber);
//             setItems([]);
//             resetCurrentItem();
//             setFilteredItems([]);

//             // Focus back to search
//             setTimeout(() => {
//                 itemSearchRef.current?.focus();
//                 itemSearchRef.current?.select();
//             }, 100);
//         } catch (err) {
//             console.error('Error resetting form:', err);
//             setNotification({
//                 show: true,
//                 message: 'Error refreshing form data',
//                 type: 'error'
//             });
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     // Handle Enter key navigation
//     const handleEnterKey = (e, nextFieldId) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();

//             if (nextFieldId === 'addToTable') {
//                 addCurrentItemToTable();
//             } else if (nextFieldId === 'saveBill') {
//                 if (currentItem.itemId) {
//                     addCurrentItemToTable();
//                     setTimeout(() => {
//                         document.getElementById('saveBill')?.focus();
//                     }, 50);
//                 } else {
//                     document.getElementById('saveBill')?.focus();
//                 }
//             } else {
//                 const nextField = document.getElementById(nextFieldId);
//                 if (nextField) {
//                     nextField.focus();
//                     if (nextField.type !== 'select-one') {
//                         nextField.select();
//                     }
//                 }
//             }
//         }
//     };

//     // Calculate totals
//     const totals = calculateTotal();

//     return (
//         <div className="container-fluid">
//             <Header />
//             <div className="card mt-4 shadow-lg p-4 expanded-card">
//                 <div className="card-header d-flex justify-content-between align-items-center">
//                     <h5 className="mb-0">Stock Adjustment</h5>
//                     <div className="text-muted">
//                         Bill No: <span className="fw-bold">{formData.billNumber}</span>
//                     </div>
//                 </div>
//                 <div className="card-body">
//                     <form onSubmit={handleSubmit} id="adjustmentForm" className="needs-validation" noValidate>
//                         {/* Header Information */}
//                         <div className="row mb-4">
//                             <div className="col-md-2">
//                                 <label className="form-label">Date</label>
//                                 {company.dateFormat === 'nepali' ? (
//                                     <input
//                                         type="text"
//                                         className="form-control no-date-icon"
//                                         value={formData.nepaliDate}
//                                         onChange={(e) => setFormData({ ...formData, nepaliDate: e.target.value })}
//                                         onKeyDown={(e) => handleEnterKey(e, 'adjustmentType')}
//                                     />
//                                 ) : (
//                                     <input
//                                         type="date"
//                                         className="form-control"
//                                         value={formData.billDate}
//                                         onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
//                                         onKeyDown={(e) => handleEnterKey(e, 'adjustmentType')}
//                                     />
//                                 )}
//                             </div>
//                             <div className="col-md-2">
//                                 <label className="form-label">Type</label>
//                                 <select
//                                     className="form-select"
//                                     id="adjustmentType"
//                                     value={formData.adjustmentType}
//                                     onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value })}
//                                     onKeyDown={(e) => handleEnterKey(e, 'isVatExempt')}
//                                 >
//                                     <option value="xcess">Xcess</option>
//                                     <option value="short">Short</option>
//                                 </select>
//                             </div>
//                             <div className="col-md-2">
//                                 <label className="form-label">VAT</label>
//                                 <select
//                                     className="form-select"
//                                     id="isVatExempt"
//                                     value={formData.isVatExempt}
//                                     onChange={(e) => setFormData({ ...formData, isVatExempt: e.target.value })}
//                                     onKeyDown={(e) => handleEnterKey(e, 'itemSearch')}
//                                 >
//                                     {company.vatEnabled && <option value="all">All</option>}
//                                     {company.vatEnabled && <option value="false">13%</option>}
//                                     <option value="true">Exempt</option>
//                                 </select>
//                             </div>
//                             <div className="col-md-6">
//                                 <label className="form-label">Description</label>
//                                 <input
//                                     type="text"
//                                     className="form-control"
//                                     value={formData.note}
//                                     onChange={(e) => setFormData({ ...formData, note: e.target.value })}
//                                     placeholder="Enter note (optional)"
//                                     onKeyDown={(e) => handleEnterKey(e, 'itemSearch')}
//                                 />
//                             </div>
//                         </div>

//                         {/* Current Item Entry Row (Like MediPro) */}
//                         <div className="card mb-4 border-primary">
//                             <div className="card-header bg-primary text-white py-2">
//                                 <h6 className="mb-0">Current Item Entry (Press Enter after each field)</h6>
//                             </div>
//                             <div className="card-body">
//                                 <div className="row g-3 align-items-end">
//                                     {/* Item Search */}
//                                     <div className="col-md-3">
//                                         <label className="form-label">Item Search (F2)</label>
//                                         <div className="position-relative">
//                                             <input
//                                                 type="text"
//                                                 id="itemSearch"
//                                                 className="form-control"
//                                                 placeholder="Search item..."
//                                                 value={searchQuery}
//                                                 onChange={handleItemSearch}
//                                                 onFocus={() => setShowItemDropdown(true)}
//                                                 onKeyDown={(e) => {
//                                                     if (e.key === 'Enter' && filteredItems.length > 0) {
//                                                         e.preventDefault();
//                                                         handleItemSelect(filteredItems[0]);
//                                                     } else {
//                                                         handleEnterKey(e, 'currentBatchNumber');
//                                                     }
//                                                 }}
//                                                 ref={itemSearchRef}
//                                                 autoComplete="off"
//                                             />
//                                             {showItemDropdown && filteredItems.length > 0 && (
//                                                 <div
//                                                     className="dropdown-menu show w-100"
//                                                     style={{
//                                                         maxHeight: '250px',
//                                                         overflowY: 'auto',
//                                                         zIndex: 1000
//                                                     }}
//                                                     ref={itemDropdownRef}
//                                                 >
//                                                     {filteredItems.map((item, index) => (
//                                                         <button
//                                                             key={index}
//                                                             type="button"
//                                                             className="dropdown-item"
//                                                             onClick={() => handleItemSelect(item)}
//                                                         >
//                                                             <div className="d-flex justify-content-between">
//                                                                 <span>{item.name}</span>
//                                                                 <span className="text-muted">{item.uniqueNumber || 'N/A'}</span>
//                                                             </div>
//                                                             <small className="text-muted">
//                                                                 HSN: {item.hscode || 'N/A'} | Stock: {item.stock || 0} | Rate: Rs.{item.latestPuPrice || 0}
//                                                             </small>
//                                                         </button>
//                                                     ))}
//                                                 </div>
//                                             )}
//                                         </div>
//                                     </div>

//                                     {/* Batch Number */}
//                                     <div className="col-md-2">
//                                         <label className="form-label">Batch No.</label>
//                                         <input
//                                             type="text"
//                                             id="currentBatchNumber"
//                                             className="form-control"
//                                             placeholder="Batch"
//                                             value={currentItem.batchNumber}
//                                             onChange={(e) => updateCurrentItemField('batchNumber', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentExpiryDate')}
//                                             autoComplete="off"
//                                         />
//                                     </div>

//                                     {/* Expiry Date */}
//                                     <div className="col-md-2">
//                                         <label className="form-label">Expiry Date</label>
//                                         <input
//                                             type="date"
//                                             id="currentExpiryDate"
//                                             className="form-control"
//                                             value={currentItem.expiryDate}
//                                             onChange={(e) => updateCurrentItemField('expiryDate', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentQuantity')}
//                                         />
//                                     </div>

//                                     {/* Quantity */}
//                                     <div className="col-md-1">
//                                         <label className="form-label">Qty</label>
//                                         <input
//                                             type="number"
//                                             id="currentQuantity"
//                                             className="form-control text-center"
//                                             min="1"
//                                             step="1"
//                                             value={currentItem.quantity}
//                                             onChange={(e) => updateCurrentItemField('quantity', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentPuPrice')}
//                                         />
//                                     </div>

//                                     {/* Unit */}
//                                     <div className="col-md-1">
//                                         <label className="form-label">Unit</label>
//                                         <input
//                                             type="text"
//                                             className="form-control text-center"
//                                             value={currentItem.unit?.name || ''}
//                                             readOnly
//                                             style={{ backgroundColor: '#f8f9fa' }}
//                                         />
//                                     </div>

//                                     {/* Rate */}
//                                     <div className="col-md-1">
//                                         <label className="form-label">Rate</label>
//                                         <input
//                                             type="number"
//                                             id="currentPuPrice"
//                                             className="form-control text-end"
//                                             step="0.01"
//                                             value={currentItem.puPrice}
//                                             onChange={(e) => updateCurrentItemField('puPrice', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentAmount')}
//                                         />
//                                     </div>

//                                     {/* Amount */}
//                                     <div className="col-md-1">
//                                         <label className="form-label">Amount</label>
//                                         <input
//                                             type="text"
//                                             id="currentAmount"
//                                             className="form-control text-end"
//                                             value={currentItem.amount}
//                                             readOnly
//                                             style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentReason')}
//                                         />
//                                     </div>

//                                     {/* Reason */}
//                                     <div className="col-md-2">
//                                         <label className="form-label">Reason</label>
//                                         <select
//                                             id="currentReason"
//                                             className="form-select"
//                                             value={currentItem.reason}
//                                             onChange={(e) => updateCurrentItemField('reason', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'addToTable')}
//                                         >
//                                             <option value="">Select Reason</option>
//                                             {formData.adjustmentType === 'short' ? (
//                                                 <>
//                                                     <option value="Expired">Expired</option>
//                                                     <option value="Damage">Damage</option>
//                                                     <option value="Donate">Donate</option>
//                                                 </>
//                                             ) : (
//                                                 <option value="Bonus">Bonus</option>
//                                             )}
//                                         </select>
//                                     </div>

//                                     {/* Add Button */}
//                                     <div className="col-md-1">
//                                         <label className="form-label">&nbsp;</label>
//                                         <button
//                                             type="button"
//                                             id="addToTable"
//                                             className="btn btn-success w-100"
//                                             onClick={addCurrentItemToTable}
//                                             disabled={!currentItem.itemId}
//                                             onKeyDown={(e) => handleEnterKey(e, 'itemSearch')}
//                                         >
//                                             <i className="bi bi-plus-lg"></i> Add
//                                         </button>
//                                     </div>
//                                 </div>

//                                 {/* Current Item Info */}
//                                 {currentItem.name && (
//                                     <div className="mt-3 p-2 bg-light rounded">
//                                         <div className="row">
//                                             <div className="col-md-4">
//                                                 <strong>Item:</strong> {currentItem.name}
//                                             </div>
//                                             <div className="col-md-2">
//                                                 <strong>Code:</strong> {currentItem.uniqueNumber}
//                                             </div>
//                                             <div className="col-md-2">
//                                                 <strong>HSN:</strong> {currentItem.hscode}
//                                             </div>
//                                             <div className="col-md-2">
//                                                 <strong>Category:</strong> {currentItem.category}
//                                             </div>
//                                             <div className="col-md-2">
//                                                 <strong>VAT:</strong> {currentItem.vatStatus === 'vatable' ? '13%' : 'Exempt'}
//                                             </div>
//                                         </div>
//                                     </div>
//                                 )}
//                             </div>
//                         </div>

//                         {/* Items Table (Added Items) */}
//                         <div className="table-responsive mb-4" style={{ maxHeight: '350px', overflowY: 'auto' }}>
//                             <table className="table table-bordered table-hover">
//                                 <thead className="table-light sticky-top">
//                                     <tr>
//                                         <th width="5%">S.N.</th>
//                                         <th width="8%">Code</th>
//                                         <th width="8%">HSN</th>
//                                         <th>Description</th>
//                                         <th width="10%">Batch</th>
//                                         <th width="10%">Expiry</th>
//                                         <th width="8%">Qty</th>
//                                         <th width="8%">Unit</th>
//                                         <th width="10%">Rate</th>
//                                         <th width="10%">Amount</th>
//                                         <th width="12%">Reason</th>
//                                         <th width="5%">Action</th>
//                                     </tr>
//                                 </thead>
//                                 <tbody>
//                                     {items.length === 0 ? (
//                                         <tr>
//                                             <td colSpan="12" className="text-center text-muted py-4">
//                                                 No items added yet. Search and add items using the form above.
//                                             </td>
//                                         </tr>
//                                     ) : (
//                                         items.map((item, index) => (
//                                             <tr key={index} className={item.vatStatus === 'vatable' ? 'table-primary' : 'table-warning'}>
//                                                 <td className="text-center">{index + 1}</td>
//                                                 <td className="text-center">{item.uniqueNumber}</td>
//                                                 <td className="text-center">{item.hscode}</td>
//                                                 <td>{item.name}</td>
//                                                 <td>{item.batchNumber}</td>
//                                                 <td>{item.expiryDate}</td>
//                                                 <td className="text-end">{item.quantity}</td>
//                                                 <td className="text-center">{item.unit?.name || item.unit}</td>
//                                                 <td className="text-end">Rs. {parseFloat(item.puPrice).toFixed(2)}</td>
//                                                 <td className="text-end fw-bold">Rs. {parseFloat(item.amount).toFixed(2)}</td>
//                                                 <td>{item.reason}</td>
//                                                 <td className="text-center">
//                                                     <button
//                                                         type="button"
//                                                         className="btn btn-sm btn-danger"
//                                                         onClick={() => removeItem(index)}
//                                                     >
//                                                         <i className="bi bi-trash"></i>
//                                                     </button>
//                                                 </td>
//                                             </tr>
//                                         ))
//                                     )}
//                                 </tbody>
//                             </table>
//                         </div>

//                         {/* Totals Section */}
//                         <div className="row mb-4">
//                             <div className="col-md-8">
//                                 <div className="card">
//                                     <div className="card-header py-2">
//                                         <strong>Amount in Words</strong>
//                                     </div>
//                                     <div className="card-body py-3">
//                                         <em>{convertToRupeesAndPaisa(parseFloat(totals.totalAmount))} Only.</em>
//                                     </div>
//                                 </div>
//                             </div>
//                             <div className="col-md-4">
//                                 <div className="card">
//                                     <div className="card-header py-2">
//                                         <strong>Totals</strong>
//                                     </div>
//                                     <div className="card-body py-3">
//                                         <table className="table table-sm mb-0">
//                                             <tbody>
//                                                 <tr>
//                                                     <td>Sub Total:</td>
//                                                     <td className="text-end">Rs. {totals.subTotal}</td>
//                                                 </tr>
//                                                 {company.vatEnabled && formData.isVatExempt !== 'true' && (
//                                                     <>
//                                                         <tr>
//                                                             <td>Taxable Amount:</td>
//                                                             <td className="text-end">Rs. {totals.taxableAmount}</td>
//                                                         </tr>
//                                                         <tr>
//                                                             <td>VAT (13%):</td>
//                                                             <td className="text-end">Rs. {totals.vatAmount}</td>
//                                                         </tr>
//                                                     </>
//                                                 )}
//                                                 <tr className="table-active">
//                                                     <td><strong>Total Amount:</strong></td>
//                                                     <td className="text-end"><strong>Rs. {totals.totalAmount}</strong></td>
//                                                 </tr>
//                                             </tbody>
//                                         </table>
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>

//                         {/* Action Buttons */}
//                         <div className="d-flex justify-content-end gap-3">
//                             <button
//                                 type="button"
//                                 className="btn btn-secondary px-4"
//                                 onClick={resetForm}
//                                 disabled={isSaving}
//                             >
//                                 <i className="bi bi-x-circle me-2"></i> Cancel (F11)
//                             </button>
//                             <button
//                                 type="submit"
//                                 id="saveBill"
//                                 className="btn btn-primary px-4"
//                                 disabled={isSaving || items.length === 0}
//                                 onKeyDown={(e) => handleEnterKey(e, 'saveBill')}
//                             >
//                                 {isSaving ? (
//                                     <>
//                                         <span className="spinner-border spinner-border-sm me-2"></span>
//                                         Saving...
//                                     </>
//                                 ) : (
//                                     <>
//                                         <i className="bi bi-save me-2"></i> Save (F5)
//                                     </>
//                                 )}
//                             </button>
//                             <button
//                                 type="button"
//                                 className="btn btn-success px-4"
//                                 onClick={(e) => handleSubmit(e, true)}
//                                 disabled={isSaving || items.length === 0}
//                             >
//                                 <i className="bi bi-printer me-2"></i> Save & Print (F6)
//                             </button>
//                         </div>
//                     </form>
//                 </div>
//             </div>

//             {/* Batch Modal */}
//             {showBatchModal && selectedItemForBatch && (
//                 <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
//                     <div className="modal-dialog modal-lg modal-dialog-centered">
//                         <div className="modal-content">
//                             <div className="modal-header py-2">
//                                 <h6 className="modal-title mb-0">Select Batch - {selectedItemForBatch.name}</h6>
//                                 <button type="button" className="btn-close btn-sm" onClick={() => setShowBatchModal(false)}></button>
//                             </div>
//                             <div className="modal-body p-0">
//                                 <div className="table-responsive">
//                                     <table className="table table-sm mb-0">
//                                         <thead className="table-light">
//                                             <tr className="text-center">
//                                                 <th>Batch</th>
//                                                 <th>Expiry</th>
//                                                 <th>Qty</th>
//                                                 <th>S.P</th>
//                                                 <th>C.P</th>
//                                                 <th>%</th>
//                                                 <th>MRP</th>
//                                             </tr>
//                                         </thead>
//                                         <tbody>
//                                             {selectedItemForBatch.stockEntries
//                                                 .filter(entry => entry.quantity > 0)
//                                                 .map((entry, index) => (
//                                                     <tr
//                                                         key={index}
//                                                         className="batch-row text-center"
//                                                         style={{ cursor: 'pointer' }}
//                                                         onClick={() => handleBatchRowClick({
//                                                             batchNumber: entry.batchNumber,
//                                                             expiryDate: entry.expiryDate,
//                                                             price: entry.price,
//                                                             puPrice: entry.puPrice,
//                                                             mrp: entry.mrp,
//                                                             uniqueUuId: entry.uniqueUuId
//                                                         })}
//                                                     >
//                                                         <td>{entry.batchNumber || 'N/A'}</td>
//                                                         <td>{formatDateForInput(entry.expiryDate)}</td>
//                                                         <td>{entry.quantity}</td>
//                                                         <td>{Math.round(entry.price * 100) / 100}</td>
//                                                         <td>{Math.round(entry.puPrice * 100) / 100}</td>
//                                                         <td>{Math.round(entry.marginPercentage * 100) / 100}</td>
//                                                         <td>{Math.round(entry.mrp * 100) / 100}</td>
//                                                     </tr>
//                                                 ))}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>
//                             <div className="modal-footer py-2">
//                                 <button
//                                     type="button"
//                                     className="btn btn-secondary btn-sm"
//                                     onClick={() => setShowBatchModal(false)}
//                                 >
//                                     Close
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}

//             <NotificationToast
//                 show={notification.show}
//                 message={notification.message}
//                 type={notification.type}
//                 onClose={() => setNotification({ ...notification, show: false })}
//             />

//             {showProductModal && (
//                 <ProductModal onClose={() => setShowProductModal(false)} />
//             )}
//         </div>
//     );
// };

// // Helper functions (keep existing)
// function convertToRupeesAndPaisa(amount) {
//     const rupees = Math.floor(amount);
//     const paisa = Math.round((amount - rupees) * 100);

//     let words = '';

//     if (rupees > 0) {
//         words += numberToWords(rupees) + ' Rupees';
//     }

//     if (paisa > 0) {
//         words += (rupees > 0 ? ' and ' : '') + numberToWords(paisa) + ' Paisa';
//     }

//     return words || 'Zero Rupees';
// }

// function numberToWords(num) {
//     const ones = [
//         '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
//         'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
//         'Seventeen', 'Eighteen', 'Nineteen'
//     ];

//     const tens = [
//         '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
//     ];

//     const scales = ['', 'Thousand', 'Million', 'Billion'];

//     function convertHundreds(num) {
//         let words = '';

//         if (num > 99) {
//             words += ones[Math.floor(num / 100)] + ' Hundred ';
//             num %= 100;
//         }

//         if (num > 19) {
//             words += tens[Math.floor(num / 10)] + ' ';
//             num %= 10;
//         }

//         if (num > 0) {
//             words += ones[num] + ' ';
//         }

//         return words.trim();
//     }

//     if (num === 0) return 'Zero';
//     if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

//     let words = '';

//     for (let i = 0; i < scales.length; i++) {
//         let unit = Math.pow(1000, scales.length - i - 1);
//         let currentNum = Math.floor(num / unit);

//         if (currentNum > 0) {
//             words += convertHundreds(currentNum) + ' ' + scales[scales.length - i - 1] + ' ';
//         }

//         num %= unit;
//     }

//     return words.trim();
// }

// export default AddStockAdjustment;

//---------------------------Third Approach--------------------------------

// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date-converter';
// import axios from 'axios';
// import { calculateExpiryStatus } from '../dashboard/modals/ExpiryStatus';
// import Header from '../Header';
// import NotificationToast from '../../NotificationToast';
// import '../../../stylesheet/noDateIcon.css';
// import VirtualizedItemList from '../../VirtualizedItemList';
// import useDebounce from '../../../hooks/useDebounce';
// import ProductModal from '../dashboard/modals/ProductModal';

// const AddStockAdjustment = () => {
//     const navigate = useNavigate();
//     const transactionDateRef = useRef(null);
//     const nepaliDateRef = useRef(null);
//     const [showProductModal, setShowProductModal] = useState(false);
//     const [isLoading, setIsLoading] = useState(true);
//     const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
//     const [isSaving, setIsSaving] = useState(false);
//     const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//     const [notification, setNotification] = useState({
//         show: false,
//         message: '',
//         type: 'success'
//     });
//     const [dateErrors, setDateErrors] = useState({
//         nepaliDate: '',
//         billDate: ''
//     });

//     // Search states
//     const [searchQuery, setSearchQuery] = useState('');
//     const [lastSearchQuery, setLastSearchQuery] = useState('');
//     const [shouldShowLastSearchResults, setShouldShowLastSearchResults] = useState(false);
//     const debouncedSearchQuery = useDebounce(searchQuery, 50);

//     // Form data
//     const [formData, setFormData] = useState({
//         adjustmentType: 'xcess',
//         nepaliDate: currentNepaliDate,
//         billDate: new Date().toISOString().split('T')[0],
//         billNumber: '',
//         isVatExempt: 'all',
//         note: '',
//         vatPercentage: 13,
//         items: []
//     });

//     // Items states
//     const [items, setItems] = useState([]);
//     const [allItems, setAllItems] = useState([]);
//     const [filteredItems, setFilteredItems] = useState([]);
//     const [showItemDropdown, setShowItemDropdown] = useState(false);
//     const [company, setCompany] = useState({
//         dateFormat: 'english',
//         vatEnabled: true,
//         fiscalYear: {}
//     });
//     const [nextBillNumber, setNextBillNumber] = useState('');
//     const itemDropdownRef = useRef(null);
//     const itemSearchRef = useRef(null);

//     // Current item entry row (MediPro style)
//     const [currentItem, setCurrentItem] = useState({
//         item: null,
//         itemId: '',
//         uniqueNumber: '',
//         hscode: '',
//         name: '',
//         category: '',
//         batchNumber: '',
//         expiryDate: '',
//         quantity: 1,
//         unit: { _id: '', name: '' },
//         puPrice: 0,
//         price: 0,
//         mrp: 0,
//         amount: 0,
//         vatStatus: 'vatable',
//         reason: '',
//         uniqueUuId: ''
//     });

//     // Batch modal state
//     const [showBatchModal, setShowBatchModal] = useState(false);
//     const [selectedItemForBatch, setSelectedItemForBatch] = useState(null);

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     // Keyboard shortcuts
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             // F9 - Product modal
//             if (e.key === 'F9') {
//                 e.preventDefault();
//                 setShowProductModal(prev => !prev);
//             }

//             // F2 - Focus search
//             if (e.key === 'F2') {
//                 e.preventDefault();
//                 if (itemSearchRef.current) {
//                     itemSearchRef.current.focus();
//                     itemSearchRef.current.select();
//                 }
//             }

//             // F5 - Save
//             if (e.key === 'F5' && items.length > 0) {
//                 e.preventDefault();
//                 document.getElementById('saveBill')?.click();
//             }

//             // F6 - Save & Print
//             if (e.key === 'F6' && items.length > 0) {
//                 e.preventDefault();
//                 document.getElementById('savePrint')?.click();
//             }

//             // F11 - New
//             if (e.key === 'F11') {
//                 e.preventDefault();
//                 resetForm();
//             }

//             // Escape - Close dropdown
//             if (e.key === 'Escape') {
//                 if (showItemDropdown) {
//                     setShowItemDropdown(false);
//                 }
//                 if (showBatchModal) {
//                     setShowBatchModal(false);
//                 }
//             }
//         };

//         window.addEventListener('keydown', handleKeyDown);
//         return () => window.removeEventListener('keydown', handleKeyDown);
//     }, [items, showItemDropdown, showBatchModal]);

//     // Fetch initial data
//     useEffect(() => {
//         const fetchInitialData = async () => {
//             try {
//                 const response = await api.get('/api/retailer/stockAdjustments/new');
//                 const { data } = response;

//                 setCompany(data.data.company);
//                 setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
//                 setNextBillNumber(data.data.nextBillNumber);

//                 setFormData(prev => ({
//                     ...prev,
//                     billNumber: data.data.nextBillNumber
//                 }));
//                 setIsInitialDataLoaded(true);
//             } catch (error) {
//                 console.error('Error fetching initial data:', error);
//             }
//         };
//         fetchInitialData();
//     }, []);

//     // Focus on date field after load
//     useEffect(() => {
//         if (isInitialDataLoaded && transactionDateRef.current) {
//             setTimeout(() => {
//                 if (company.dateFormat === 'nepali' && nepaliDateRef.current) {
//                     nepaliDateRef.current.focus();
//                 } else if (transactionDateRef.current) {
//                     transactionDateRef.current.focus();
//                 }
//             }, 100);
//         }
//     }, [isInitialDataLoaded, company.dateFormat]);

//     // Calculate totals
//     const calculateTotal = () => {
//         let subTotal = 0;
//         let taxableAmount = 0;
//         let nonTaxableAmount = 0;

//         items.forEach(item => {
//             const amount = parseFloat(item.amount) || 0;
//             subTotal += amount;

//             if (item.vatStatus === 'vatable') {
//                 taxableAmount += amount;
//             } else {
//                 nonTaxableAmount += amount;
//             }
//         });

//         const vatPercentage = parseFloat(formData.vatPercentage) || 13;
//         const vatAmount = (formData.isVatExempt === 'false' || formData.isVatExempt === 'all') ?
//             (taxableAmount * vatPercentage) / 100 : 0;

//         const totalAmount = taxableAmount + nonTaxableAmount + vatAmount;

//         return {
//             subTotal: subTotal.toFixed(2),
//             taxableAmount: taxableAmount.toFixed(2),
//             nonTaxableAmount: nonTaxableAmount.toFixed(2),
//             vatAmount: vatAmount.toFixed(2),
//             totalAmount: totalAmount.toFixed(2)
//         };
//     };

//     // Item search handler
//     const handleItemSearch = (e) => {
//         const query = e.target.value.toLowerCase();
//         setSearchQuery(query);

//         // When user starts typing, disable showing last search results
//         if (query.length > 0) {
//             setShouldShowLastSearchResults(false);
//         }

//         setShowItemDropdown(true);
//     };

//     const handleSearchFocus = () => {
//         setShowItemDropdown(true);

//         // If we have a last search query and the input is empty, show those results
//         if (lastSearchQuery && !searchQuery) {
//             setShouldShowLastSearchResults(true);
//         }

//         document.querySelectorAll('.dropdown-item').forEach(item => {
//             item.classList.remove('active');
//         });
//     };

//     // Memoized filtered items calculation
//     const memoizedFilteredItems = React.useMemo(() => {
//         if (shouldShowLastSearchResults && lastSearchQuery && !searchQuery) {
//             return allItems.filter(item => {
//                 const matchesSearch = item.name.toLowerCase().includes(lastSearchQuery.toLowerCase()) ||
//                     (item.hscode && item.hscode.toString().toLowerCase().includes(lastSearchQuery.toLowerCase())) ||
//                     (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(lastSearchQuery.toLowerCase())) ||
//                     (item.category && item.category.name.toLowerCase().includes(lastSearchQuery.toLowerCase()));

//                 if (formData.isVatExempt === 'all') return matchesSearch;
//                 if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
//                 if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
//                 return matchesSearch;
//             });
//         }

//         if (!searchQuery && allItems.length > 0) {
//             return allItems.filter(item => {
//                 if (formData.isVatExempt === 'all') return true;
//                 if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
//                 if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
//                 return true;
//             });
//         }

//         if (searchQuery.length === 0) return [];

//         return allItems.filter(item => {
//             const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                 (item.hscode && item.hscode.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
//                 (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
//                 (item.category && item.category.name.toLowerCase().includes(searchQuery.toLowerCase()));

//             if (formData.isVatExempt === 'all') return matchesSearch;
//             if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
//             if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
//             return matchesSearch;
//         });
//     }, [allItems, formData.isVatExempt, searchQuery, lastSearchQuery, shouldShowLastSearchResults]);

//     // Handle item selection
//     const handleItemSelect = (item) => {
//         // Store search query
//         if (itemSearchRef.current?.value) {
//             setLastSearchQuery(itemSearchRef.current.value);
//             setShouldShowLastSearchResults(true);
//         }

//         if (formData.adjustmentType === 'short') {
//             setSelectedItemForBatch(item);
//             setShowBatchModal(true);
//         } else {
//             setCurrentItem({
//                 ...currentItem,
//                 itemId: item._id,
//                 uniqueNumber: item.uniqueNumber || 'N/A',
//                 hscode: item.hscode || '',
//                 name: item.name,
//                 category: item.category?.name || 'No Category',
//                 unit: item.unit || { _id: '', name: '' },
//                 puPrice: item.latestPuPrice || 0,
//                 price: item.latestPuPrice || 0,
//                 vatStatus: item.vatStatus,
//                 quantity: 1,
//                 batchNumber: 'XXX',
//                 expiryDate: getDefaultExpiryDate(),
//                 amount: (item.latestPuPrice || 0) * 1
//             });

//             setSearchQuery('');
//             setShowItemDropdown(false);

//             // Focus on batch number
//             setTimeout(() => {
//                 document.getElementById('currentBatchNumber')?.focus();
//                 document.getElementById('currentBatchNumber')?.select();
//             }, 50);
//         }
//     };

//     // Get default expiry date
//     const getDefaultExpiryDate = () => {
//         const today = new Date();
//         today.setFullYear(today.getFullYear() + 2);
//         return today.toISOString().split('T')[0];
//     };

//     // Format date for input
//     const formatDateForInput = (date) => {
//         if (!date) return '';
//         const d = new Date(date);
//         const year = d.getFullYear();
//         const month = String(d.getMonth() + 1).padStart(2, '0');
//         const day = String(d.getDate()).padStart(2, '0');
//         return `${year}-${month}-${day}`;
//     };

//     // Update current item field
//     const updateCurrentItemField = (field, value) => {
//         const updatedItem = { ...currentItem, [field]: value };

//         // Recalculate amount
//         if (field === 'quantity' || field === 'puPrice') {
//             const quantity = field === 'quantity' ? parseFloat(value) || 0 : updatedItem.quantity;
//             const puPrice = field === 'puPrice' ? parseFloat(value) || 0 : updatedItem.puPrice;
//             updatedItem.amount = (quantity * puPrice).toFixed(2);
//         }

//         setCurrentItem(updatedItem);
//     };

//     // Add current item to table
//     const addCurrentItemToTable = () => {
//         // Validate
//         if (!currentItem.itemId) {
//             setNotification({
//                 show: true,
//                 message: 'Please select an item first',
//                 type: 'error'
//             });
//             itemSearchRef.current?.focus();
//             return;
//         }

//         // Add to items array
//         const newItem = {
//             ...currentItem,
//             item: currentItem.itemId,
//             unit: currentItem.unit._id,
//             amount: parseFloat(currentItem.amount) || 0
//         };

//         setItems([...items, newItem]);

//         // Reset current item
//         resetCurrentItem();

//         // Focus back on search
//         setTimeout(() => {
//             itemSearchRef.current?.focus();
//             itemSearchRef.current?.select();
//         }, 50);
//     };

//     // Reset current item
//     const resetCurrentItem = () => {
//         setCurrentItem({
//             item: null,
//             itemId: '',
//             uniqueNumber: '',
//             hscode: '',
//             name: '',
//             category: '',
//             batchNumber: '',
//             expiryDate: '',
//             quantity: 1,
//             unit: { _id: '', name: '' },
//             puPrice: 0,
//             price: 0,
//             mrp: 0,
//             amount: 0,
//             vatStatus: 'vatable',
//             reason: '',
//             uniqueUuId: ''
//         });
//         setSearchQuery('');
//     };

//     // Remove item from table
//     const removeItem = (index) => {
//         const updatedItems = items.filter((_, i) => i !== index);
//         setItems(updatedItems);
//     };

//     // Handle batch row click
//     const handleBatchRowClick = (batchInfo) => {
//         if (!selectedItemForBatch) return;

//         const item = selectedItemForBatch;
//         setCurrentItem({
//             ...currentItem,
//             itemId: item._id,
//             uniqueNumber: item.uniqueNumber || 'N/A',
//             hscode: item.hscode || '',
//             name: item.name,
//             category: item.category?.name || 'No Category',
//             unit: item.unit || { _id: '', name: '' },
//             batchNumber: batchInfo.batchNumber || '',
//             expiryDate: batchInfo.expiryDate ? formatDateForInput(batchInfo.expiryDate) : '',
//             puPrice: batchInfo.puPrice || 0,
//             price: batchInfo.price || 0,
//             mrp: batchInfo.mrp || 0,
//             vatStatus: item.vatStatus,
//             quantity: 1,
//             uniqueUuId: batchInfo.uniqueUuId || '',
//             amount: (batchInfo.puPrice || 0) * 1
//         });

//         setShowBatchModal(false);
//         setSelectedItemForBatch(null);
//         setSearchQuery('');

//         setTimeout(() => {
//             document.getElementById('currentQuantity')?.focus();
//             document.getElementById('currentQuantity')?.select();
//         }, 50);
//     };

//     // Handle form submit
//     const handleSubmit = async (e, print = false) => {
//         e.preventDefault();

//         if (items.length === 0) {
//             setNotification({
//                 show: true,
//                 message: 'Please add at least one item',
//                 type: 'error'
//             });
//             return;
//         }

//         setIsSaving(true);

//         try {
//             const adjustmentData = {
//                 ...formData,
//                 items: items.map(item => ({
//                     item: item.itemId || item.item,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     quantity: item.quantity,
//                     unit: item.unit._id || item.unit,
//                     puPrice: item.puPrice,
//                     price: item.price || item.puPrice,
//                     mrp: item.mrp,
//                     reason: item.reason ? [item.reason] : [],
//                     vatStatus: item.vatStatus,
//                     uniqueUuId: item.uniqueUuId
//                 })),
//                 print
//             };

//             const response = await api.post('/api/retailer/stockAdjustments/new', adjustmentData);

//             setNotification({
//                 show: true,
//                 message: 'Stock adjustment saved successfully!',
//                 type: 'success'
//             });

//             if (print) {
//                 navigate(`/stockAdjustments/${response.data.data.adjustmentId}/print`);
//             } else {
//                 resetForm();
//             }
//         } catch (error) {
//             console.error('Error saving stock adjustment:', error);
//             setNotification({
//                 show: true,
//                 message: 'Failed to save stock adjustment. Please try again.',
//                 type: 'error'
//             });
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     // Reset form
//     const resetForm = async () => {
//         try {
//             setIsLoading(true);
//             const response = await api.get('/api/retailer/stockAdjustments/new');
//             const { data } = response;

//             const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//             const currentRomanDate = new Date().toISOString().split('T')[0];

//             setFormData({
//                 adjustmentType: 'xcess',
//                 nepaliDate: currentNepaliDate,
//                 billDate: currentRomanDate,
//                 billNumber: data.data.nextBillNumber,
//                 isVatExempt: 'all',
//                 note: '',
//                 vatPercentage: 13,
//                 items: []
//             });

//             setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
//             setNextBillNumber(data.data.nextBillNumber);
//             setItems([]);
//             resetCurrentItem();

//             // Focus on date field
//             setTimeout(() => {
//                 if (company.dateFormat === 'nepali' && nepaliDateRef.current) {
//                     nepaliDateRef.current.focus();
//                 } else if (transactionDateRef.current) {
//                     transactionDateRef.current.focus();
//                 }
//             }, 100);
//         } catch (err) {
//             console.error('Error resetting form:', err);
//             setNotification({
//                 show: true,
//                 message: 'Error refreshing form data',
//                 type: 'error'
//             });
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     // Handle Enter key navigation
//     const handleEnterKey = (e, nextFieldId) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();

//             if (nextFieldId === 'addToTable') {
//                 addCurrentItemToTable();
//             } else if (nextFieldId === 'note') {
//                 const noteField = document.getElementById('note');
//                 if (noteField) {
//                     noteField.focus();
//                     noteField.select();
//                 }
//             } else {
//                 const nextField = document.getElementById(nextFieldId);
//                 if (nextField) {
//                     nextField.focus();
//                     if (nextField.type !== 'select-one') {
//                         nextField.select();
//                     }
//                 }
//             }
//         }
//     };

//     const totals = calculateTotal();

//     return (
//         <div className="container-fluid">
//             <Header />
//             <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
//                 <div className="card-header">
//                     Stock Adjustment
//                 </div>
//                 <div className="card-body">
//                     <form onSubmit={handleSubmit} id="adjustmentForm" className="needs-validation" noValidate>
//                         {/* Header Information */}
//                         <div className="form-group row mb-3">
//                             {company.dateFormat === 'nepali' ? (
//                                 <>
//                                     <div className="col">
//                                         <label htmlFor="nepaliDate">Date:</label>
//                                         <input
//                                             type="text"
//                                             name="nepaliDate"
//                                             id="nepaliDate"
//                                             autoComplete='off'
//                                             ref={nepaliDateRef}
//                                             autoFocus
//                                             className={`form-control no-date-icon ${dateErrors.nepaliDate ? 'is-invalid' : ''}`}
//                                             value={formData.nepaliDate}
//                                             onChange={(e) => {
//                                                 setFormData({ ...formData, nepaliDate: e.target.value });
//                                                 setDateErrors(prev => ({ ...prev, nepaliDate: '' }));
//                                             }}
//                                             onKeyDown={(e) => handleEnterKey(e, 'adjustmentType')}
//                                             required
//                                         />
//                                     </div>
//                                 </>
//                             ) : (
//                                 <div className="col">
//                                     <label htmlFor="billDate">Date:</label>
//                                     <input
//                                         type="date"
//                                         name="billDate"
//                                         id="billDate"
//                                         className="form-control"
//                                         ref={company.dateFormat === 'english' ? transactionDateRef : null}
//                                         autoFocus
//                                         value={formData.billDate}
//                                         onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
//                                         onKeyDown={(e) => handleEnterKey(e, 'adjustmentType')}
//                                         required
//                                     />
//                                 </div>
//                             )}

//                             <div className="col">
//                                 <label htmlFor="adjustmentType">Type:</label>
//                                 <select
//                                     id="adjustmentType"
//                                     name="adjustmentType"
//                                     className="form-control"
//                                     value={formData.adjustmentType}
//                                     onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value })}
//                                     onKeyDown={(e) => handleEnterKey(e, 'billNumber')}
//                                 >
//                                     <option value="xcess">Xcess</option>
//                                     <option value="short">Short</option>
//                                 </select>
//                             </div>

//                             <div className="col">
//                                 <label htmlFor="billNumber">Vch. No:</label>
//                                 <input
//                                     type="text"
//                                     name="billNumber"
//                                     id="billNumber"
//                                     className="form-control"
//                                     value={formData.billNumber}
//                                     readOnly
//                                     onKeyDown={(e) => handleEnterKey(e, 'isVatExempt')}
//                                 />
//                             </div>

//                             <div className="col">
//                                 <label htmlFor="isVatExempt">VAT:</label>
//                                 <select
//                                     className="form-control"
//                                     name="isVatExempt"
//                                     id="isVatExempt"
//                                     value={formData.isVatExempt}
//                                     onChange={(e) => setFormData({ ...formData, isVatExempt: e.target.value })}
//                                     onKeyDown={(e) => handleEnterKey(e, 'itemSearch')}
//                                 >
//                                     {company.vatEnabled && <option value="all">All</option>}
//                                     {company.vatEnabled && <option value="false">13%</option>}
//                                     <option value="true">Exempt</option>
//                                 </select>
//                             </div>
//                         </div>

//                         <hr style={{ border: "1px solid gray" }} />

//                         {/* Current Item Entry Row (MediPro Style) */}
//                         <div className="card mb-3 border-primary">
//                             <div className="card-header bg-primary text-white py-2">
//                                 <i className="bi bi-plus-circle me-2"></i>Current Item Entry (Press Enter to navigate)
//                             </div>
//                             <div className="card-body py-2">
//                                 <div className="row g-2 align-items-end">
//                                     {/* Item Search */}
//                                     <div className="col-md-2">
//                                         <label className="form-label small mb-1">Search Item (F2)</label>
//                                         <input
//                                             type="text"
//                                             id="itemSearch"
//                                             className="form-control form-control-sm"
//                                             placeholder="Search item..."
//                                             value={searchQuery}
//                                             onChange={handleItemSearch}
//                                             onFocus={handleSearchFocus}
//                                             ref={itemSearchRef}
//                                             onKeyDown={(e) => {
//                                                 if (e.key === 'Enter' && memoizedFilteredItems.length > 0) {
//                                                     e.preventDefault();
//                                                     handleItemSelect(memoizedFilteredItems[0]);
//                                                 } else if (e.key === 'Enter') {
//                                                     handleEnterKey(e, 'currentBatchNumber');
//                                                 }
//                                             }}
//                                             autoComplete="off"
//                                         />
//                                     </div>

//                                     {/* Batch Number */}
//                                     <div className="col-md-2">
//                                         <label className="form-label small mb-1">Batch No.</label>
//                                         <input
//                                             type="text"
//                                             id="currentBatchNumber"
//                                             className="form-control form-control-sm"
//                                             placeholder="Batch"
//                                             value={currentItem.batchNumber}
//                                             onChange={(e) => updateCurrentItemField('batchNumber', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentExpiryDate')}
//                                             autoComplete="off"
//                                         />
//                                     </div>

//                                     {/* Expiry Date */}
//                                     <div className="col-md-2">
//                                         <label className="form-label small mb-1">Expiry Date</label>
//                                         <input
//                                             type="date"
//                                             id="currentExpiryDate"
//                                             className="form-control form-control-sm"
//                                             value={currentItem.expiryDate}
//                                             onChange={(e) => updateCurrentItemField('expiryDate', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentQuantity')}
//                                         />
//                                     </div>

//                                     {/* Quantity */}
//                                     <div className="col-md-1">
//                                         <label className="form-label small mb-1">Qty</label>
//                                         <input
//                                             type="number"
//                                             id="currentQuantity"
//                                             className="form-control form-control-sm text-center"
//                                             min="1"
//                                             step="1"
//                                             value={currentItem.quantity}
//                                             onChange={(e) => updateCurrentItemField('quantity', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentPuPrice')}
//                                         />
//                                     </div>

//                                     {/* Unit */}
//                                     <div className="col-md-1">
//                                         <label className="form-label small mb-1">Unit</label>
//                                         <input
//                                             type="text"
//                                             className="form-control form-control-sm text-center"
//                                             value={currentItem.unit?.name || ''}
//                                             readOnly
//                                             style={{ backgroundColor: '#f8f9fa' }}
//                                         />
//                                     </div>

//                                     {/* Rate */}
//                                     <div className="col-md-1">
//                                         <label className="form-label small mb-1">Rate</label>
//                                         <input
//                                             type="number"
//                                             id="currentPuPrice"
//                                             className="form-control form-control-sm text-end"
//                                             step="0.01"
//                                             value={currentItem.puPrice}
//                                             onChange={(e) => updateCurrentItemField('puPrice', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentAmount')}
//                                         />
//                                     </div>

//                                     {/* Amount */}
//                                     <div className="col-md-1">
//                                         <label className="form-label small mb-1">Amount</label>
//                                         <input
//                                             type="text"
//                                             id="currentAmount"
//                                             className="form-control form-control-sm text-end"
//                                             value={currentItem.amount}
//                                             readOnly
//                                             style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}
//                                             onKeyDown={(e) => handleEnterKey(e, 'currentReason')}
//                                         />
//                                     </div>

//                                     {/* Reason */}
//                                     <div className="col-md-2">
//                                         <label className="form-label small mb-1">Reason</label>
//                                         <select
//                                             id="currentReason"
//                                             className="form-control form-control-sm"
//                                             value={currentItem.reason}
//                                             onChange={(e) => updateCurrentItemField('reason', e.target.value)}
//                                             onKeyDown={(e) => handleEnterKey(e, 'addToTable')}
//                                         >
//                                             <option value="">Select Reason</option>
//                                             {formData.adjustmentType === 'short' ? (
//                                                 <>
//                                                     <option value="Expired">Expired</option>
//                                                     <option value="Damage">Damage</option>
//                                                     <option value="Donate">Donate</option>
//                                                 </>
//                                             ) : (
//                                                 <option value="Bonus">Bonus</option>
//                                             )}
//                                         </select>
//                                     </div>

//                                     {/* Add Button */}
//                                     <div className="col-md-1">
//                                         <label className="form-label small mb-1">&nbsp;</label>
//                                         <button
//                                             type="button"
//                                             id="addToTable"
//                                             className="btn btn-sm btn-success w-100"
//                                             onClick={addCurrentItemToTable}
//                                             disabled={!currentItem.itemId}
//                                         >
//                                             <i className="bi bi-plus-lg"></i> Add
//                                         </button>
//                                     </div>
//                                 </div>

//                                 {/* Current Item Info */}
//                                 {currentItem.name && (
//                                     <div className="mt-2 p-2 bg-light rounded">
//                                         <div className="row">
//                                             <div className="col-md-4">
//                                                 <strong>Item:</strong> {currentItem.name}
//                                             </div>
//                                             <div className="col-md-2">
//                                                 <strong>Code:</strong> {currentItem.uniqueNumber}
//                                             </div>
//                                             <div className="col-md-2">
//                                                 <strong>HSN:</strong> {currentItem.hscode}
//                                             </div>
//                                             <div className="col-md-2">
//                                                 <strong>Category:</strong> {currentItem.category}
//                                             </div>
//                                             <div className="col-md-2">
//                                                 <strong>VAT:</strong> {currentItem.vatStatus === 'vatable' ? '13%' : 'Exempt'}
//                                             </div>
//                                         </div>
//                                     </div>
//                                 )}
//                             </div>
//                         </div>

//                         {/* Item Search Dropdown */}
//                         {showItemDropdown && (
//                             <div
//                                 id="dropdownMenu"
//                                 className="dropdown-menu show w-100"
//                                 style={{
//                                     maxHeight: '280px',
//                                     height: '280px',
//                                     overflow: 'hidden',
//                                     position: 'absolute',
//                                     zIndex: 1000,
//                                     border: '1px solid #ddd',
//                                     borderRadius: '4px'
//                                 }}
//                                 ref={itemDropdownRef}
//                             >
//                                 <div className="dropdown-header" style={{
//                                     display: 'grid',
//                                     gridTemplateColumns: 'repeat(7, 1fr)',
//                                     alignItems: 'center',
//                                     padding: '0 10px',
//                                     height: '40px',
//                                     background: '#f0f0f0',
//                                     fontWeight: 'bold',
//                                     borderBottom: '1px solid #dee2e6'
//                                 }}>
//                                     <div><strong>#</strong></div>
//                                     <div><strong>HSN</strong></div>
//                                     <div><strong>Description</strong></div>
//                                     <div><strong>Category</strong></div>
//                                     <div><strong>Qty</strong></div>
//                                     <div><strong>Unit</strong></div>
//                                     <div><strong>Rate</strong></div>
//                                 </div>

//                                 {memoizedFilteredItems.length > 0 ? (
//                                     <VirtualizedItemList
//                                         items={memoizedFilteredItems}
//                                         onItemClick={(item) => handleItemSelect(item)}
//                                         searchRef={itemSearchRef}
//                                     />
//                                 ) : (
//                                     <div className="text-center py-3 text-muted">
//                                         {searchQuery ? `No items found matching "${searchQuery}"` : "No items available"}
//                                     </div>
//                                 )}
//                             </div>
//                         )}

//                         {/* Items Table */}
//                         <div id="bill-details-container" style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
//                             <table className="table table-bordered compact-table" id="itemsTable">
//                                 <thead>
//                                     <tr>
//                                         <th>S.N.</th>
//                                         <th>#</th>
//                                         <th>HSN</th>
//                                         <th>Description of Goods</th>
//                                         <th>Batch</th>
//                                         <th>Expiry</th>
//                                         <th>Qty</th>
//                                         <th>Unit</th>
//                                         <th>Rate</th>
//                                         <th>Amount</th>
//                                         <th>Reason</th>
//                                         <th>Action</th>
//                                     </tr>
//                                 </thead>
//                                 <tbody id="items">
//                                     {items.length === 0 ? (
//                                         <tr>
//                                             <td colSpan="12" className="text-center text-muted py-4">
//                                                 No items added. Search and add items using the form above.
//                                             </td>
//                                         </tr>
//                                     ) : (
//                                         items.map((item, index) => (
//                                             <tr key={index} className={`item ${item.vatStatus === 'vatable' ? 'vatable-item' : 'non-vatable-item'}`}>
//                                                 <td>{index + 1}</td>
//                                                 <td>{item.uniqueNumber}</td>
//                                                 <td>
//                                                     <input type="hidden" name={`items[${index}][hscode]`} value={item.hscode} />
//                                                     {item.hscode}
//                                                 </td>
//                                                 <td className="col-3">
//                                                     <input type="hidden" name={`items[${index}][item]`} value={item.itemId || item.item} />
//                                                     {item.name}
//                                                 </td>
//                                                 <td>{item.batchNumber}</td>
//                                                 <td>{item.expiryDate}</td>
//                                                 <td>{item.quantity}</td>
//                                                 <td>{item.unit?.name || item.unit}</td>
//                                                 <td>{Math.round(item.puPrice * 100) / 100}</td>
//                                                 <td className="item-amount">{item.amount}</td>
//                                                 <td>{item.reason}</td>
//                                                 <td className="align-middle">
//                                                     <button
//                                                         type="button"
//                                                         className="btn btn-sm btn-danger"
//                                                         onClick={() => removeItem(index)}
//                                                     >
//                                                         <i className="bi bi-trash"></i>
//                                                     </button>
//                                                 </td>
//                                                 <input type="hidden" name={`items[${index}][vatStatus]`} value={item.vatStatus} />
//                                                 <input type="hidden" name={`items[${index}][uniqueUuId]`} value={item.uniqueUuId} />
//                                                 <input type="hidden" name={`items[${index}][mrp]`} value={item.mrp} />
//                                             </tr>
//                                         ))
//                                     )}
//                                 </tbody>
//                             </table>
//                         </div>

//                         <hr style={{ border: "1px solid gray" }} />

//                         {/* Totals Section */}
//                         <div className="table-responsive">
//                             <table className="table table-bordered">
//                                 <thead>
//                                     <tr>
//                                         <th colSpan="6" className="text-center bg-light">Adjustment Details</th>
//                                     </tr>
//                                 </thead>
//                                 <tbody>
//                                     <tr>
//                                         <td><label htmlFor="subTotal">Sub Total:</label></td>
//                                         <td>
//                                             <p className="form-control-plaintext">Rs. {totals.subTotal}</p>
//                                         </td>
//                                         <td colSpan="4"></td>
//                                     </tr>

//                                     {company.vatEnabled && formData.isVatExempt !== 'true' && (
//                                         <>
//                                             <tr id="taxableAmountRow">
//                                                 <td><label htmlFor="taxableAmount">Taxable Amount:</label></td>
//                                                 <td>
//                                                     <p className="form-control-plaintext">Rs. {totals.taxableAmount}</p>
//                                                 </td>
//                                                 <td><label htmlFor="vatPercentage">VAT (13%):</label></td>
//                                                 <td className='d-none'>
//                                                     <input
//                                                         type="number"
//                                                         name="vatPercentage"
//                                                         id="vatPercentage"
//                                                         className="form-control"
//                                                         value={formData.vatPercentage}
//                                                         readOnly
//                                                     />
//                                                 </td>
//                                                 <td className='d-none'><label htmlFor="vatAmount">VAT Amount:</label></td>
//                                                 <td>
//                                                     <p className="form-control-plaintext">Rs. {totals.vatAmount}</p>
//                                                 </td>
//                                             </tr>
//                                         </>
//                                     )}
//                                     {company.vatEnabled && formData.isVatExempt === 'true' && (
//                                         <td colSpan="4"></td>
//                                     )}
//                                     <tr>
//                                         <td><label htmlFor="totalAmount">Total Amount:</label></td>
//                                         <td>
//                                             <p className="form-control-plaintext">Rs. {totals.totalAmount}</p>
//                                         </td>
//                                         <td><label htmlFor="amountInWords">In Words:</label></td>
//                                         <td colSpan="3">
//                                             <p className="form-control-plaintext" id="amountInWords">
//                                                 {convertToRupeesAndPaisa(parseFloat(totals.totalAmount))} Only.
//                                             </p>
//                                         </td>
//                                     </tr>
//                                 </tbody>
//                             </table>
//                         </div>

//                         {/* Note */}
//                         <div className="form-group">
//                             <label htmlFor="note">Description:</label>
//                             <input
//                                 type="text"
//                                 className="form-control"
//                                 id="note"
//                                 name="note"
//                                 value={formData.note}
//                                 onChange={(e) => setFormData({ ...formData, note: e.target.value })}
//                                 placeholder="add note"
//                                 autoComplete='off'
//                                 onKeyDown={(e) => {
//                                     if (e.key === 'Enter') {
//                                         e.preventDefault();
//                                         document.getElementById('saveBill')?.focus();
//                                     }
//                                 }}
//                             />
//                         </div>

//                         {/* Action Buttons */}
//                         <div className="d-flex justify-content-end mt-4">
//                             <button
//                                 type="submit"
//                                 className="btn btn-primary mr-2 p-3"
//                                 id="saveBill"
//                                 disabled={isSaving}
//                             >
//                                 {isSaving ? (
//                                     <>
//                                         <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
//                                         Saving...
//                                     </>
//                                 ) : (
//                                     <i className="bi bi-save"></i>
//                                 )}
//                             </button>
//                             <button
//                                 type="button"
//                                 className="btn btn-secondary p-3"
//                                 id="savePrint"
//                                 onClick={(e) => handleSubmit(e, true)}
//                                 disabled={isSaving}
//                             >
//                                 <i className="bi bi-printer"></i>
//                             </button>
//                         </div>
//                     </form>
//                 </div>
//             </div>

//             {/* Batch Modal */}
//             {showBatchModal && selectedItemForBatch && (
//                 <div className="modal fade show" id="batchModal" tabIndex="-1" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
//                     <div className="modal-dialog modal-lg modal-dialog-centered">
//                         <div className="modal-content" style={{ borderRadius: '8px', overflow: 'hidden' }}>
//                             <div className="modal-header py-2" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
//                                 <h5 className="modal-title mb-0 mx-auto fw-semibold" style={{ fontSize: '1.1rem' }}>
//                                     <i className="bi bi-box-seam me-2"></i>
//                                     Batch Information: {selectedItemForBatch.name}
//                                 </h5>
//                                 <button
//                                     type="button"
//                                     className="btn-close position-absolute"
//                                     style={{ right: '1rem', top: '0.75rem' }}
//                                     onClick={() => setShowBatchModal(false)}
//                                     aria-label="Close"
//                                 ></button>
//                             </div>

//                             <div className="modal-body p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
//                                 {selectedItemForBatch.stockEntries.every(entry => entry.quantity === 0) ? (
//                                     <div className="d-flex justify-content-center align-items-center py-4">
//                                         <div className="alert alert-warning d-flex align-items-center py-2 px-3 mb-0 w-75 text-center">
//                                             <i className="bi bi-exclamation-triangle-fill me-2"></i>
//                                             <span>This item is currently out of stock</span>
//                                         </div>
//                                     </div>
//                                 ) : (
//                                     <div className="table-responsive">
//                                         <table className="table table-sm table-hover mb-0">
//                                             <thead className="table-light">
//                                                 <tr className="text-center">
//                                                     <th className="py-2">Batch No.</th>
//                                                     <th className="py-2">Expiry Date</th>
//                                                     <th className="py-2">Quantity</th>
//                                                     <th className="py-2">S.P</th>
//                                                     <th className="py-2">C.P</th>
//                                                     <th className="py-2">%</th>
//                                                     <th className="py-2">MRP</th>
//                                                 </tr>
//                                             </thead>
//                                             <tbody>
//                                                 {selectedItemForBatch.stockEntries
//                                                     .filter(entry => entry.quantity > 0)
//                                                     .map((entry, index) => (
//                                                         <tr
//                                                             key={index}
//                                                             className={`batch-row text-center ${index === 0 ? 'bg-primary text-white' : ''}`}
//                                                             style={{ height: '42px', cursor: 'pointer' }}
//                                                             onClick={() => handleBatchRowClick({
//                                                                 batchNumber: entry.batchNumber,
//                                                                 expiryDate: entry.expiryDate,
//                                                                 price: entry.price,
//                                                                 puPrice: entry.puPrice,
//                                                                 mrp: entry.mrp,
//                                                                 uniqueUuId: entry.uniqueUuId
//                                                             })}
//                                                             tabIndex={0}
//                                                             onKeyDown={(e) => {
//                                                                 if (e.key === 'Enter') {
//                                                                     e.preventDefault();
//                                                                     handleBatchRowClick({
//                                                                         batchNumber: entry.batchNumber,
//                                                                         expiryDate: entry.expiryDate,
//                                                                         price: entry.price,
//                                                                         puPrice: entry.puPrice,
//                                                                         mrp: entry.mrp,
//                                                                         uniqueUuId: entry.uniqueUuId
//                                                                     });
//                                                                 }
//                                                             }}
//                                                         >
//                                                             <td className="py-2 align-middle">{entry.batchNumber || 'N/A'}</td>
//                                                             <td className="py-2 align-middle">{formatDateForInput(entry.expiryDate)}</td>
//                                                             <td className="py-2 align-middle fw-semibold">{entry.quantity}</td>
//                                                             <td className="py-2 align-middle">{Math.round(entry.price * 100) / 100}</td>
//                                                             <td className="py-2 align-middle">{Math.round(entry.puPrice * 100) / 100}</td>
//                                                             <td className="py-2 align-middle">{Math.round(entry.marginPercentage * 100) / 100}</td>
//                                                             <td className="py-2 align-middle">{Math.round(entry.mrp * 100) / 100}</td>
//                                                         </tr>
//                                                     ))
//                                                 }
//                                             </tbody>
//                                         </table>
//                                     </div>
//                                 )}
//                             </div>

//                             <div className="modal-footer py-2 justify-content-center" style={{ backgroundColor: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
//                                 <button
//                                     type="button"
//                                     className="btn btn-primary btn-sm py-1 px-3 d-flex align-items-center"
//                                     onClick={() => setShowBatchModal(false)}
//                                 >
//                                     <i className="bi bi-x-circle me-1"></i>
//                                     Close
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}

//             <NotificationToast
//                 show={notification.show}
//                 message={notification.message}
//                 type={notification.type}
//                 onClose={() => setNotification({ ...notification, show: false })}
//             />

//             {/* Product modal */}
//             {showProductModal && (
//                 <ProductModal onClose={() => setShowProductModal(false)} />
//             )}
//         </div>
//     );
// };

// // Helper functions
// function convertToRupeesAndPaisa(amount) {
//     const rupees = Math.floor(amount);
//     const paisa = Math.round((amount - rupees) * 100);

//     let words = '';

//     if (rupees > 0) {
//         words += numberToWords(rupees) + ' Rupees';
//     }

//     if (paisa > 0) {
//         words += (rupees > 0 ? ' and ' : '') + numberToWords(paisa) + ' Paisa';
//     }

//     return words || 'Zero Rupees';
// }

// function numberToWords(num) {
//     const ones = [
//         '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
//         'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
//         'Seventeen', 'Eighteen', 'Nineteen'
//     ];

//     const tens = [
//         '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
//     ];

//     const scales = ['', 'Thousand', 'Million', 'Billion'];

//     function convertHundreds(num) {
//         let words = '';

//         if (num > 99) {
//             words += ones[Math.floor(num / 100)] + ' Hundred ';
//             num %= 100;
//         }

//         if (num > 19) {
//             words += tens[Math.floor(num / 10)] + ' ';
//             num %= 10;
//         }

//         if (num > 0) {
//             words += ones[num] + ' ';
//         }

//         return words.trim();
//     }

//     if (num === 0) return 'Zero';
//     if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

//     let words = '';

//     for (let i = 0; i < scales.length; i++) {
//         let unit = Math.pow(1000, scales.length - i - 1);
//         let currentNum = Math.floor(num / unit);

//         if (currentNum > 0) {
//             words += convertHundreds(currentNum) + ' ' + scales[scales.length - i - 1] + ' ';
//         }

//         num %= unit;
//     }

//     return words.trim();
// }

// export default AddStockAdjustment;

//-----------Forth Approach---------------------------------------------

// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import NepaliDate from 'nepali-date-converter';
// import axios from 'axios';
// import Header from '../Header';
// import NotificationToast from '../../NotificationToast';
// import '../../../stylesheet/noDateIcon.css';
// import VirtualizedItemList from '../../VirtualizedItemList';
// import useDebounce from '../../../hooks/useDebounce';
// import ProductModal from '../dashboard/modals/ProductModal';

// const AddStockAdjustment = () => {
//     const navigate = useNavigate();
//     const transactionDateRef = useRef(null);
//     const nepaliDateRef = useRef(null);
//     const [showProductModal, setShowProductModal] = useState(false);
//     const [isSaving, setIsSaving] = useState(false);
//     const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//     const [notification, setNotification] = useState({
//         show: false,
//         message: '',
//         type: 'success'
//     });

//     // Search states
//     const [searchQuery, setSearchQuery] = useState('');
//     const [lastSearchQuery, setLastSearchQuery] = useState('');
//     const [shouldShowLastSearchResults, setShouldShowLastSearchResults] = useState(false);
//     const [showItemDropdown, setShowItemDropdown] = useState(false);

//     // Form data
//     const [formData, setFormData] = useState({
//         adjustmentType: 'xcess',
//         nepaliDate: currentNepaliDate,
//         billDate: new Date().toISOString().split('T')[0],
//         billNumber: '',
//         isVatExempt: 'all',
//         note: '',
//         vatPercentage: 13,
//         items: []
//     });

//     // Items states
//     const [items, setItems] = useState([]);
//     const [allItems, setAllItems] = useState([]);
//     const [company, setCompany] = useState({
//         dateFormat: 'english',
//         vatEnabled: true,
//         fiscalYear: {}
//     });
//     const [nextBillNumber, setNextBillNumber] = useState('');
//     const itemDropdownRef = useRef(null);
//     const itemSearchRef = useRef(null);

//     // Current item entry row
//     const [currentItem, setCurrentItem] = useState({
//         itemId: '',
//         uniqueNumber: '',
//         hscode: '',
//         name: '',
//         category: '',
//         batchNumber: '',
//         expiryDate: '',
//         quantity: 1,
//         unit: { _id: '', name: '' },
//         puPrice: 0,
//         price: 0,
//         mrp: 0,
//         amount: 0,
//         vatStatus: 'vatable',
//         reason: '',
//         uniqueUuId: ''
//     });

//     // Batch modal state
//     const [showBatchModal, setShowBatchModal] = useState(false);
//     const [selectedItemForBatch, setSelectedItemForBatch] = useState(null);

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     // Keyboard shortcuts
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             // Prevent default for F keys
//             if ([112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122].includes(e.keyCode)) {
//                 e.preventDefault();
//             }

//             switch (e.key) {
//                 case 'F2':
//                     itemSearchRef.current?.focus();
//                     itemSearchRef.current?.select();
//                     break;
//                 case 'F5':
//                     if (items.length > 0) document.getElementById('saveBill')?.click();
//                     break;
//                 case 'F6':
//                     if (items.length > 0) document.getElementById('savePrint')?.click();
//                     break;
//                 case 'F9':
//                     setShowProductModal(prev => !prev);
//                     break;
//                 case 'F11':
//                     resetForm();
//                     break;
//                 case 'Escape':
//                     if (showItemDropdown) setShowItemDropdown(false);
//                     if (showBatchModal) setShowBatchModal(false);
//                     break;
//                 case 'Enter':
//                     // Don't prevent default here to allow form submission
//                     break;
//             }
//         };

//         window.addEventListener('keydown', handleKeyDown);
//         return () => window.removeEventListener('keydown', handleKeyDown);
//     }, [items, showItemDropdown, showBatchModal]);

//     // Fetch initial data
//     useEffect(() => {
//         const fetchInitialData = async () => {
//             try {
//                 const response = await api.get('/api/retailer/stockAdjustments/new');
//                 const { data } = response;

//                 setCompany(data.data.company);
//                 setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
//                 setNextBillNumber(data.data.nextBillNumber);

//                 setFormData(prev => ({
//                     ...prev,
//                     billNumber: data.data.nextBillNumber
//                 }));

//                 // Set current expiry date to 2 years from now
//                 const today = new Date();
//                 today.setFullYear(today.getFullYear() + 2);
//                 const defaultExpiry = today.toISOString().split('T')[0];
//                 setCurrentItem(prev => ({ ...prev, expiryDate: defaultExpiry }));
//             } catch (error) {
//                 console.error('Error fetching initial data:', error);
//                 setNotification({
//                     show: true,
//                     message: 'Failed to load initial data',
//                     type: 'error'
//                 });
//             }
//         };
//         fetchInitialData();
//     }, []);

//     // Focus management
//     useEffect(() => {
//         const timer = setTimeout(() => {
//             if (company.dateFormat === 'nepali' && nepaliDateRef.current) {
//                 nepaliDateRef.current.focus();
//             } else if (transactionDateRef.current) {
//                 transactionDateRef.current.focus();
//             }
//         }, 100);
//         return () => clearTimeout(timer);
//     }, [company.dateFormat]);

//     // Memoized filtered items
//     const memoizedFilteredItems = React.useMemo(() => {
//         if (!searchQuery.trim()) {
//             return allItems.filter(item => {
//                 if (formData.isVatExempt === 'all') return true;
//                 if (formData.isVatExempt === 'false') return item.vatStatus === 'vatable';
//                 if (formData.isVatExempt === 'true') return item.vatStatus === 'vatExempt';
//                 return true;
//             });
//         }

//         const query = searchQuery.toLowerCase();
//         return allItems.filter(item => {
//             const matchesSearch = item.name.toLowerCase().includes(query) ||
//                 (item.hscode && item.hscode.toString().toLowerCase().includes(query)) ||
//                 (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query)) ||
//                 (item.category && item.category.name.toLowerCase().includes(query));

//             if (formData.isVatExempt === 'all') return matchesSearch;
//             if (formData.isVatExempt === 'false') return matchesSearch && item.vatStatus === 'vatable';
//             if (formData.isVatExempt === 'true') return matchesSearch && item.vatStatus === 'vatExempt';
//             return matchesSearch;
//         }).slice(0, 50); // Limit results for performance
//     }, [allItems, formData.isVatExempt, searchQuery]);

//     // Item search handler
//     const handleItemSearch = (e) => {
//         const query = e.target.value;
//         setSearchQuery(query);
//         setShowItemDropdown(query.length > 0);
//     };

//     // Handle item selection
//     const handleItemSelect = (item) => {
//         if (itemSearchRef.current?.value) {
//             setLastSearchQuery(itemSearchRef.current.value);
//         }

//         if (formData.adjustmentType === 'short') {
//             setSelectedItemForBatch(item);
//             setShowBatchModal(true);
//         } else {
//             const newItem = {
//                 ...currentItem,
//                 itemId: item._id,
//                 uniqueNumber: item.uniqueNumber || 'N/A',
//                 hscode: item.hscode || '',
//                 name: item.name,
//                 category: item.category?.name || 'No Category',
//                 unit: item.unit || { _id: '', name: '' },
//                 puPrice: item.latestPuPrice || 0,
//                 price: item.latestPuPrice || 0,
//                 vatStatus: item.vatStatus,
//                 quantity: 1,
//                 batchNumber: 'XXX',
//                 amount: (item.latestPuPrice || 0) * 1
//             };

//             setCurrentItem(newItem);
//             setSearchQuery('');
//             setShowItemDropdown(false);

//             setTimeout(() => {
//                 document.getElementById('currentBatchNumber')?.focus();
//                 document.getElementById('currentBatchNumber')?.select();
//             }, 50);
//         }
//     };

//     // Update current item field
//     const updateCurrentItemField = (field, value) => {
//         const updatedItem = { ...currentItem, [field]: value };

//         // Recalculate amount
//         if (field === 'quantity' || field === 'puPrice') {
//             const quantity = field === 'quantity' ? parseFloat(value) || 0 : updatedItem.quantity;
//             const puPrice = field === 'puPrice' ? parseFloat(value) || 0 : updatedItem.puPrice;
//             updatedItem.amount = (quantity * puPrice).toFixed(2);
//         }

//         setCurrentItem(updatedItem);
//     };

//     // Add current item to table
//     const addCurrentItemToTable = () => {
//         if (!currentItem.itemId) {
//             setNotification({
//                 show: true,
//                 message: 'Please select an item first',
//                 type: 'warning'
//             });
//             itemSearchRef.current?.focus();
//             return;
//         }

//         if (!currentItem.batchNumber.trim()) {
//             setNotification({
//                 show: true,
//                 message: 'Please enter batch number',
//                 type: 'warning'
//             });
//             document.getElementById('currentBatchNumber')?.focus();
//             return;
//         }

//         const newItem = {
//             ...currentItem,
//             item: currentItem.itemId,
//             unit: currentItem.unit._id,
//             amount: parseFloat(currentItem.amount) || 0
//         };

//         setItems(prev => [...prev, newItem]);

//         // Reset current item but keep expiry date
//         const today = new Date();
//         today.setFullYear(today.getFullYear() + 2);
//         const defaultExpiry = today.toISOString().split('T')[0];

//         setCurrentItem({
//             itemId: '',
//             uniqueNumber: '',
//             hscode: '',
//             name: '',
//             category: '',
//             batchNumber: '',
//             expiryDate: defaultExpiry,
//             quantity: 1,
//             unit: { _id: '', name: '' },
//             puPrice: 0,
//             price: 0,
//             mrp: 0,
//             amount: 0,
//             vatStatus: 'vatable',
//             reason: '',
//             uniqueUuId: ''
//         });

//         setSearchQuery('');

//         setTimeout(() => {
//             itemSearchRef.current?.focus();
//             itemSearchRef.current?.select();
//         }, 50);
//     };

//     // Handle batch selection
//     const handleBatchRowClick = (batchInfo) => {
//         if (!selectedItemForBatch) return;

//         const item = selectedItemForBatch;
//         const newItem = {
//             ...currentItem,
//             itemId: item._id,
//             uniqueNumber: item.uniqueNumber || 'N/A',
//             hscode: item.hscode || '',
//             name: item.name,
//             category: item.category?.name || 'No Category',
//             unit: item.unit || { _id: '', name: '' },
//             batchNumber: batchInfo.batchNumber || '',
//             expiryDate: batchInfo.expiryDate ? formatDateForInput(batchInfo.expiryDate) : '',
//             puPrice: batchInfo.puPrice || 0,
//             price: batchInfo.price || 0,
//             mrp: batchInfo.mrp || 0,
//             vatStatus: item.vatStatus,
//             quantity: 1,
//             uniqueUuId: batchInfo.uniqueUuId || '',
//             amount: (batchInfo.puPrice || 0) * 1
//         };

//         setCurrentItem(newItem);
//         setShowBatchModal(false);
//         setSelectedItemForBatch(null);
//         setSearchQuery('');

//         setTimeout(() => {
//             document.getElementById('currentQuantity')?.focus();
//             document.getElementById('currentQuantity')?.select();
//         }, 50);
//     };

//     // Handle form submit
//     const handleSubmit = async (e, print = false) => {
//         e.preventDefault();

//         if (items.length === 0) {
//             setNotification({
//                 show: true,
//                 message: 'Please add at least one item',
//                 type: 'warning'
//             });
//             return;
//         }

//         setIsSaving(true);

//         try {
//             const adjustmentData = {
//                 ...formData,
//                 items: items.map(item => ({
//                     item: item.itemId || item.item,
//                     batchNumber: item.batchNumber,
//                     expiryDate: item.expiryDate,
//                     quantity: item.quantity,
//                     unit: item.unit._id || item.unit,
//                     puPrice: item.puPrice,
//                     price: item.price || item.puPrice,
//                     mrp: item.mrp,
//                     reason: item.reason ? [item.reason] : [],
//                     vatStatus: item.vatStatus,
//                     uniqueUuId: item.uniqueUuId
//                 })),
//                 print
//             };

//             const response = await api.post('/api/retailer/stockAdjustments/new', adjustmentData);

//             setNotification({
//                 show: true,
//                 message: 'Stock adjustment saved successfully!',
//                 type: 'success'
//             });

//             if (print) {
//                 navigate(`/stockAdjustments/${response.data.data.adjustmentId}/print`);
//             } else {
//                 resetForm();
//             }
//         } catch (error) {
//             console.error('Error saving stock adjustment:', error);
//             setNotification({
//                 show: true,
//                 message: error.response?.data?.message || 'Failed to save stock adjustment',
//                 type: 'error'
//             });
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     // Reset form
//     const resetForm = async () => {
//         try {
//             const response = await api.get('/api/retailer/stockAdjustments/new');
//             const { data } = response;

//             const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//             const currentRomanDate = new Date().toISOString().split('T')[0];
//             const today = new Date();
//             today.setFullYear(today.getFullYear() + 2);
//             const defaultExpiry = today.toISOString().split('T')[0];

//             setFormData({
//                 adjustmentType: 'xcess',
//                 nepaliDate: currentNepaliDate,
//                 billDate: currentRomanDate,
//                 billNumber: data.data.nextBillNumber,
//                 isVatExempt: 'all',
//                 note: '',
//                 vatPercentage: 13,
//                 items: []
//             });

//             setAllItems(data.data.items.sort((a, b) => a.name.localeCompare(b.name)));
//             setNextBillNumber(data.data.nextBillNumber);
//             setItems([]);

//             setCurrentItem({
//                 itemId: '',
//                 uniqueNumber: '',
//                 hscode: '',
//                 name: '',
//                 category: '',
//                 batchNumber: '',
//                 expiryDate: defaultExpiry,
//                 quantity: 1,
//                 unit: { _id: '', name: '' },
//                 puPrice: 0,
//                 price: 0,
//                 mrp: 0,
//                 amount: 0,
//                 vatStatus: 'vatable',
//                 reason: '',
//                 uniqueUuId: ''
//             });

//             setSearchQuery('');

//             setTimeout(() => {
//                 if (company.dateFormat === 'nepali' && nepaliDateRef.current) {
//                     nepaliDateRef.current.focus();
//                 } else if (transactionDateRef.current) {
//                     transactionDateRef.current.focus();
//                 }
//             }, 100);
//         } catch (err) {
//             console.error('Error resetting form:', err);
//             setNotification({
//                 show: true,
//                 message: 'Error refreshing form data',
//                 type: 'error'
//             });
//         }
//     };

//     // Calculate totals
//     const calculateTotal = () => {
//         let subTotal = 0;
//         let taxableAmount = 0;
//         let nonTaxableAmount = 0;

//         items.forEach(item => {
//             const amount = parseFloat(item.amount) || 0;
//             subTotal += amount;

//             if (item.vatStatus === 'vatable') {
//                 taxableAmount += amount;
//             } else {
//                 nonTaxableAmount += amount;
//             }
//         });

//         const vatPercentage = parseFloat(formData.vatPercentage) || 13;
//         const vatAmount = (formData.isVatExempt === 'false' || formData.isVatExempt === 'all') ?
//             (taxableAmount * vatPercentage) / 100 : 0;

//         const totalAmount = taxableAmount + nonTaxableAmount + vatAmount;

//         return {
//             subTotal: subTotal.toFixed(2),
//             taxableAmount: taxableAmount.toFixed(2),
//             nonTaxableAmount: nonTaxableAmount.toFixed(2),
//             vatAmount: vatAmount.toFixed(2),
//             totalAmount: totalAmount.toFixed(2)
//         };
//     };

//     const totals = calculateTotal();

//     return (
//         <div className="container-fluid px-3 py-2">
//             <Header />

//             {/* Quick Info Bar */}
//             <div className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
//                 <div>
//                     <span className="badge bg-primary me-2">F2: Search</span>
//                     <span className="badge bg-success me-2">F5: Save</span>
//                     <span className="badge bg-warning me-2">F6: Print</span>
//                     <span className="badge bg-info me-2">F9: Products</span>
//                     <span className="badge bg-danger">F11: New</span>
//                 </div>
//                 <div className="text-end">
//                     <small className="text-muted">
//                         Bill: <strong>{formData.billNumber}</strong> |
//                         Items: <strong>{items.length}</strong> |
//                         Total: <strong>Rs. {totals.totalAmount}</strong>
//                     </small>
//                 </div>
//             </div>

//             {/* Main Card */}
//             <div className="card shadow-sm border-0">
//                 <div className="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
//                     <h6 className="mb-0">
//                         <i className="bi bi-clipboard-plus me-2"></i>
//                         Stock Adjustment
//                     </h6>
//                     <div className="small">
//                         {items.length} Items | Rs. {totals.totalAmount}
//                     </div>
//                 </div>

//                 <div className="card-body p-3">
//                     {/* Header Row - Compact */}
//                     <div className="row g-2 mb-3">
//                         <div className="col-md-2">
//                             <label className="form-label small fw-bold mb-1">Date</label>
//                             {company.dateFormat === 'nepali' ? (
//                                 <input
//                                     type="text"
//                                     className="form-control form-control-sm no-date-icon"
//                                     value={formData.nepaliDate}
//                                     onChange={(e) => setFormData({ ...formData, nepaliDate: e.target.value })}
//                                     ref={nepaliDateRef}
//                                 />
//                             ) : (
//                                 <input
//                                     type="date"
//                                     className="form-control form-control-sm"
//                                     value={formData.billDate}
//                                     onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
//                                     ref={transactionDateRef}
//                                 />
//                             )}
//                         </div>

//                         <div className="col-md-2">
//                             <label className="form-label small fw-bold mb-1">Type</label>
//                             <select
//                                 className="form-select form-select-sm"
//                                 value={formData.adjustmentType}
//                                 onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value })}
//                             >
//                                 <option value="xcess">Xcess</option>
//                                 <option value="short">Short</option>
//                             </select>
//                         </div>

//                         <div className="col-md-2">
//                             <label className="form-label small fw-bold mb-1">VAT</label>
//                             <select
//                                 className="form-select form-select-sm"
//                                 value={formData.isVatExempt}
//                                 onChange={(e) => setFormData({ ...formData, isVatExempt: e.target.value })}
//                             >
//                                 {company.vatEnabled && <option value="all">All</option>}
//                                 {company.vatEnabled && <option value="false">13%</option>}
//                                 <option value="true">Exempt</option>
//                             </select>
//                         </div>

//                         <div className="col-md-6">
//                             <label className="form-label small fw-bold mb-1">Description (Optional)</label>
//                             <input
//                                 type="text"
//                                 className="form-control form-control-sm"
//                                 value={formData.note}
//                                 onChange={(e) => setFormData({ ...formData, note: e.target.value })}
//                                 placeholder="Enter description..."
//                             />
//                         </div>
//                     </div>

//                     {/* Current Item Entry - Compact */}
//                     <div className="card border-secondary mb-3">
//                         <div className="card-header bg-secondary text-white py-1">
//                             <small><i className="bi bi-keyboard me-1"></i>ENTER to navigate between fields | TAB to next item</small>
//                         </div>
//                         <div className="card-body p-2">
//                             <div className="row g-1 align-items-center">
//                                 {/* Item Search */}
//                                 <div className="col-md-2">
//                                     <div className="input-group input-group-sm">
//                                         <span className="input-group-text bg-primary text-white">
//                                             <i className="bi bi-search"></i>
//                                         </span>
//                                         <input
//                                             type="text"
//                                             className="form-control"
//                                             placeholder="Search item (F2)"
//                                             value={searchQuery}
//                                             onChange={handleItemSearch}
//                                             onFocus={() => setShowItemDropdown(true)}
//                                             ref={itemSearchRef}
//                                             onKeyDown={(e) => {
//                                                 if (e.key === 'Enter' && memoizedFilteredItems.length > 0) {
//                                                     e.preventDefault();
//                                                     handleItemSelect(memoizedFilteredItems[0]);
//                                                 } else if (e.key === 'Enter') {
//                                                     e.preventDefault();
//                                                     document.getElementById('currentBatchNumber')?.focus();
//                                                 }
//                                             }}
//                                         />
//                                     </div>
//                                 </div>

//                                 {/* Batch Number */}
//                                 <div className="col-md-1">
//                                     <input
//                                         type="text"
//                                         id="currentBatchNumber"
//                                         className="form-control form-control-sm"
//                                         placeholder="Batch"
//                                         value={currentItem.batchNumber}
//                                         onChange={(e) => updateCurrentItemField('batchNumber', e.target.value)}
//                                         onKeyDown={(e) => {
//                                             if (e.key === 'Enter') {
//                                                 e.preventDefault();
//                                                 document.getElementById('currentExpiryDate')?.focus();
//                                             }
//                                         }}
//                                     />
//                                 </div>

//                                 {/* Expiry Date */}
//                                 <div className="col-md-1">
//                                     <input
//                                         type="date"
//                                         id="currentExpiryDate"
//                                         className="form-control form-control-sm"
//                                         value={currentItem.expiryDate}
//                                         onChange={(e) => updateCurrentItemField('expiryDate', e.target.value)}
//                                         onKeyDown={(e) => {
//                                             if (e.key === 'Enter') {
//                                                 e.preventDefault();
//                                                 document.getElementById('currentQuantity')?.focus();
//                                             }
//                                         }}
//                                     />
//                                 </div>

//                                 {/* Quantity */}
//                                 <div className="col-md-1">
//                                     <input
//                                         type="number"
//                                         id="currentQuantity"
//                                         className="form-control form-control-sm text-center"
//                                         min="1"
//                                         step="1"
//                                         value={currentItem.quantity}
//                                         onChange={(e) => updateCurrentItemField('quantity', e.target.value)}
//                                         onKeyDown={(e) => {
//                                             if (e.key === 'Enter') {
//                                                 e.preventDefault();
//                                                 document.getElementById('currentPuPrice')?.focus();
//                                             }
//                                         }}
//                                     />
//                                 </div>

//                                 {/* Unit */}
//                                 <div className="col-md-1">
//                                     <input
//                                         type="text"
//                                         className="form-control form-control-sm text-center bg-light"
//                                         value={currentItem.unit?.name || ''}
//                                         readOnly
//                                     />
//                                 </div>

//                                 {/* Rate */}
//                                 <div className="col-md-1">
//                                     <input
//                                         type="number"
//                                         id="currentPuPrice"
//                                         className="form-control form-control-sm text-end"
//                                         step="0.01"
//                                         value={currentItem.puPrice}
//                                         onChange={(e) => updateCurrentItemField('puPrice', e.target.value)}
//                                         onKeyDown={(e) => {
//                                             if (e.key === 'Enter') {
//                                                 e.preventDefault();
//                                                 document.getElementById('currentAmount')?.focus();
//                                             }
//                                         }}
//                                     />
//                                 </div>

//                                 {/* Amount */}
//                                 <div className="col-md-1">
//                                     <input
//                                         type="text"
//                                         id="currentAmount"
//                                         className="form-control form-control-sm text-end bg-light fw-bold"
//                                         value={currentItem.amount}
//                                         readOnly
//                                         onKeyDown={(e) => {
//                                             if (e.key === 'Enter') {
//                                                 e.preventDefault();
//                                                 document.getElementById('currentReason')?.focus();
//                                             }
//                                         }}
//                                     />
//                                 </div>

//                                 {/* Reason */}
//                                 <div className="col-md-2">
//                                     <select
//                                         id="currentReason"
//                                         className="form-select form-select-sm"
//                                         value={currentItem.reason}
//                                         onChange={(e) => updateCurrentItemField('reason', e.target.value)}
//                                         onKeyDown={(e) => {
//                                             if (e.key === 'Enter') {
//                                                 e.preventDefault();
//                                                 document.getElementById('addToTable')?.focus();
//                                             }
//                                         }}
//                                     >
//                                         <option value="">Reason</option>
//                                         {formData.adjustmentType === 'short' ? (
//                                             <>
//                                                 <option value="Expired">Expired</option>
//                                                 <option value="Damage">Damage</option>
//                                                 <option value="Donate">Donate</option>
//                                             </>
//                                         ) : (
//                                             <option value="Bonus">Bonus</option>
//                                         )}
//                                     </select>
//                                 </div>

//                                 {/* Add Button */}
//                                 <div className="col-md-1">
//                                     <button
//                                         type="button"
//                                         id="addToTable"
//                                         className="btn btn-sm btn-success w-100"
//                                         onClick={addCurrentItemToTable}
//                                         disabled={!currentItem.itemId}
//                                         onKeyDown={(e) => {
//                                             if (e.key === 'Enter') {
//                                                 e.preventDefault();
//                                                 addCurrentItemToTable();
//                                             }
//                                         }}
//                                     >
//                                         <i className="bi bi-plus-lg"></i> Add
//                                     </button>
//                                 </div>

//                                 {/* Clear Button */}
//                                 <div className="col-md-1">
//                                     <button
//                                         type="button"
//                                         className="btn btn-sm btn-outline-secondary w-100"
//                                         onClick={() => {
//                                             const today = new Date();
//                                             today.setFullYear(today.getFullYear() + 2);
//                                             const defaultExpiry = today.toISOString().split('T')[0];

//                                             setCurrentItem({
//                                                 itemId: '',
//                                                 uniqueNumber: '',
//                                                 hscode: '',
//                                                 name: '',
//                                                 category: '',
//                                                 batchNumber: '',
//                                                 expiryDate: defaultExpiry,
//                                                 quantity: 1,
//                                                 unit: { _id: '', name: '' },
//                                                 puPrice: 0,
//                                                 price: 0,
//                                                 mrp: 0,
//                                                 amount: 0,
//                                                 vatStatus: 'vatable',
//                                                 reason: '',
//                                                 uniqueUuId: ''
//                                             });
//                                             itemSearchRef.current?.focus();
//                                         }}
//                                     >
//                                         <i className="bi bi-x"></i> Clear
//                                     </button>
//                                 </div>
//                             </div>

//                             {/* Current Item Info */}
//                             {currentItem.name && (
//                                 <div className="mt-2 p-1 bg-info bg-opacity-10 rounded border border-info border-opacity-25">
//                                     <div className="row g-1 small">
//                                         <div className="col-md-3">
//                                             <span className="badge bg-info me-1">Item:</span>
//                                             <strong>{currentItem.name}</strong>
//                                         </div>
//                                         <div className="col-md-2">
//                                             <span className="badge bg-secondary me-1">Code:</span>
//                                             {currentItem.uniqueNumber}
//                                         </div>
//                                         <div className="col-md-2">
//                                             <span className="badge bg-secondary me-1">HSN:</span>
//                                             {currentItem.hscode}
//                                         </div>
//                                         <div className="col-md-2">
//                                             <span className="badge bg-secondary me-1">Category:</span>
//                                             {currentItem.category}
//                                         </div>
//                                         <div className="col-md-2">
//                                             <span className="badge bg-secondary me-1">VAT:</span>
//                                             {currentItem.vatStatus === 'vatable' ? '13%' : 'Exempt'}
//                                         </div>
//                                     </div>
//                                 </div>
//                             )}
//                         </div>
//                     </div>

//                     {/* Item Dropdown */}
//                     {showItemDropdown && memoizedFilteredItems.length > 0 && (
//                         <div
//                             className="border rounded shadow-sm mb-2"
//                             style={{
//                                 maxHeight: '250px',
//                                 overflow: 'hidden',
//                                 position: 'relative',
//                                 zIndex: 1000,
//                                 backgroundColor: 'white'
//                             }}
//                             ref={itemDropdownRef}
//                         >
//                             <VirtualizedItemList
//                                 items={memoizedFilteredItems}
//                                 onItemClick={handleItemSelect}
//                                 searchRef={itemSearchRef}
//                                 compact={true}
//                             />
//                         </div>
//                     )}

//                     {/* Items Table - Compact */}
//                     <div className="table-responsive mb-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
//                         <table className="table table-sm table-hover table-bordered mb-0">
//                             <thead className="table-light sticky-top">
//                                 <tr className="small">
//                                     <th width="4%" className="text-center">#</th>
//                                     <th width="8%" className="text-center">Code</th>
//                                     <th width="8%" className="text-center">HSN</th>
//                                     <th>Description</th>
//                                     <th width="8%" className="text-center">Batch</th>
//                                     <th width="8%" className="text-center">Expiry</th>
//                                     <th width="6%" className="text-center">Qty</th>
//                                     <th width="6%" className="text-center">Unit</th>
//                                     <th width="8%" className="text-end">Rate</th>
//                                     <th width="8%" className="text-end">Amount</th>
//                                     <th width="10%" className="text-center">Reason</th>
//                                     <th width="4%" className="text-center">Action</th>
//                                 </tr>
//                             </thead>
//                             <tbody>
//                                 {items.length === 0 ? (
//                                     <tr>
//                                         <td colSpan="12" className="text-center text-muted py-3 small">
//                                             <i className="bi bi-info-circle me-1"></i>
//                                             No items added. Search and add items using the form above.
//                                         </td>
//                                     </tr>
//                                 ) : (
//                                     items.map((item, index) => (
//                                         <tr
//                                             key={index}
//                                             className={item.vatStatus === 'vatable' ? 'table-primary' : 'table-warning'}
//                                         >
//                                             <td className="text-center">{index + 1}</td>
//                                             <td className="text-center">{item.uniqueNumber}</td>
//                                             <td className="text-center">{item.hscode}</td>
//                                             <td className="small">{item.name}</td>
//                                             <td className="text-center">{item.batchNumber}</td>
//                                             <td className="text-center small">{item.expiryDate}</td>
//                                             <td className="text-center">{item.quantity}</td>
//                                             <td className="text-center small">{item.unit?.name || item.unit}</td>
//                                             <td className="text-end">Rs. {Math.round(item.puPrice * 100) / 100}</td>
//                                             <td className="text-end fw-bold">Rs. {item.amount}</td>
//                                             <td className="text-center small">{item.reason}</td>
//                                             <td className="text-center">
//                                                 <button
//                                                     type="button"
//                                                     className="btn btn-sm btn-outline-danger"
//                                                     onClick={() => {
//                                                         const updatedItems = items.filter((_, i) => i !== index);
//                                                         setItems(updatedItems);
//                                                     }}
//                                                     title="Remove item"
//                                                 >
//                                                     <i className="bi bi-trash"></i>
//                                                 </button>
//                                             </td>
//                                         </tr>
//                                     ))
//                                 )}
//                             </tbody>
//                         </table>
//                     </div>

//                     {/* Totals Section - Compact */}
//                     <div className="row g-2">
//                         <div className="col-md-8">
//                             <div className="card border-0 bg-light">
//                                 <div className="card-body p-2">
//                                     <small className="text-muted">
//                                         <strong>Amount in Words:</strong> {convertToRupeesAndPaisa(parseFloat(totals.totalAmount))} Only.
//                                     </small>
//                                 </div>
//                             </div>
//                         </div>
//                         <div className="col-md-4">
//                             <div className="card border-primary">
//                                 <div className="card-header bg-primary text-white py-1 small">
//                                     <strong>Adjustment Summary</strong>
//                                 </div>
//                                 <div className="card-body p-2">
//                                     <table className="table table-sm mb-0">
//                                         <tbody>
//                                             <tr>
//                                                 <td className="border-0 small">Sub Total:</td>
//                                                 <td className="border-0 text-end">Rs. {totals.subTotal}</td>
//                                             </tr>
//                                             {company.vatEnabled && formData.isVatExempt !== 'true' && (
//                                                 <>
//                                                     <tr>
//                                                         <td className="border-0 small">Taxable:</td>
//                                                         <td className="border-0 text-end">Rs. {totals.taxableAmount}</td>
//                                                     </tr>
//                                                     <tr>
//                                                         <td className="border-0 small">VAT (13%):</td>
//                                                         <td className="border-0 text-end">Rs. {totals.vatAmount}</td>
//                                                     </tr>
//                                                 </>
//                                             )}
//                                             <tr className="table-success">
//                                                 <td className="border-0 small"><strong>Total:</strong></td>
//                                                 <td className="border-0 text-end"><strong>Rs. {totals.totalAmount}</strong></td>
//                                             </tr>
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Action Buttons */}
//                     <div className="d-flex justify-content-end gap-2 mt-3">
//                         <button
//                             type="button"
//                             className="btn btn-outline-secondary btn-sm"
//                             onClick={resetForm}
//                             disabled={isSaving}
//                         >
//                             <i className="bi bi-x-circle me-1"></i> Cancel (F11)
//                         </button>
//                         <button
//                             type="submit"
//                             className="btn btn-primary btn-sm"
//                             id="saveBill"
//                             onClick={handleSubmit}
//                             disabled={isSaving || items.length === 0}
//                         >
//                             {isSaving ? (
//                                 <>
//                                     <span className="spinner-border spinner-border-sm me-1"></span>
//                                     Saving...
//                                 </>
//                             ) : (
//                                 <>
//                                     <i className="bi bi-save me-1"></i> Save (F5)
//                                 </>
//                             )}
//                         </button>
//                         <button
//                             type="button"
//                             className="btn btn-success btn-sm"
//                             id="savePrint"
//                             onClick={(e) => handleSubmit(e, true)}
//                             disabled={isSaving || items.length === 0}
//                         >
//                             <i className="bi bi-printer me-1"></i> Save & Print (F6)
//                         </button>
//                     </div>
//                 </div>
//             </div>

//             {/* Batch Modal */}
//             {showBatchModal && selectedItemForBatch && (
//                 <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
//                     <div className="modal-dialog modal-dialog-centered">
//                         <div className="modal-content">
//                             <div className="modal-header py-2">
//                                 <h6 className="modal-title mb-0">
//                                     <i className="bi bi-box me-1"></i>
//                                     {selectedItemForBatch.name}
//                                 </h6>
//                                 <button
//                                     type="button"
//                                     className="btn-close btn-sm"
//                                     onClick={() => setShowBatchModal(false)}
//                                 ></button>
//                             </div>
//                             <div className="modal-body p-0">
//                                 {selectedItemForBatch.stockEntries?.every(entry => entry.quantity === 0) ? (
//                                     <div className="alert alert-warning m-2 py-1">
//                                         <i className="bi bi-exclamation-triangle me-1"></i>
//                                         Out of Stock
//                                     </div>
//                                 ) : (
//                                     <div className="table-responsive">
//                                         <table className="table table-sm mb-0">
//                                             <thead className="table-light">
//                                                 <tr className="small text-center">
//                                                     <th>Batch</th>
//                                                     <th>Expiry</th>
//                                                     <th>Qty</th>
//                                                     <th>S.P</th>
//                                                     <th>C.P</th>
//                                                 </tr>
//                                             </thead>
//                                             <tbody>
//                                                 {selectedItemForBatch.stockEntries
//                                                     ?.filter(entry => entry.quantity > 0)
//                                                     .map((entry, index) => (
//                                                         <tr
//                                                             key={index}
//                                                             className="small text-center hover-bg"
//                                                             style={{ cursor: 'pointer' }}
//                                                             onClick={() => handleBatchRowClick({
//                                                                 batchNumber: entry.batchNumber,
//                                                                 expiryDate: entry.expiryDate,
//                                                                 price: entry.price,
//                                                                 puPrice: entry.puPrice,
//                                                                 mrp: entry.mrp,
//                                                                 uniqueUuId: entry.uniqueUuId
//                                                             })}
//                                                         >
//                                                             <td>{entry.batchNumber || 'N/A'}</td>
//                                                             <td>{formatDateForInput(entry.expiryDate)}</td>
//                                                             <td>{entry.quantity}</td>
//                                                             <td>Rs. {Math.round(entry.price * 100) / 100}</td>
//                                                             <td>Rs. {Math.round(entry.puPrice * 100) / 100}</td>
//                                                         </tr>
//                                                     ))}
//                                             </tbody>
//                                         </table>
//                                     </div>
//                                 )}
//                             </div>
//                             <div className="modal-footer py-1">
//                                 <button
//                                     type="button"
//                                     className="btn btn-sm btn-outline-secondary"
//                                     onClick={() => setShowBatchModal(false)}
//                                 >
//                                     Close
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}

//             <NotificationToast
//                 show={notification.show}
//                 message={notification.message}
//                 type={notification.type}
//                 onClose={() => setNotification({ ...notification, show: false })}
//             />

//             {showProductModal && (
//                 <ProductModal onClose={() => setShowProductModal(false)} />
//             )}
//         </div>
//     );
// };

// // Helper functions
// const formatDateForInput = (date) => {
//     if (!date) return '';
//     const d = new Date(date);
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     const day = String(d.getDate()).padStart(2, '0');
//     return `${year}-${month}-${day}`;
// };

// const convertToRupeesAndPaisa = (amount) => {
//     const rupees = Math.floor(amount);
//     const paisa = Math.round((amount - rupees) * 100);

//     let words = '';

//     if (rupees > 0) {
//         words += numberToWords(rupees) + ' Rupees';
//     }

//     if (paisa > 0) {
//         words += (rupees > 0 ? ' and ' : '') + numberToWords(paisa) + ' Paisa';
//     }

//     return words || 'Zero Rupees';
// };

// const numberToWords = (num) => {
//     const ones = [
//         '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
//         'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
//         'Seventeen', 'Eighteen', 'Nineteen'
//     ];

//     const tens = [
//         '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
//     ];

//     const scales = ['', 'Thousand', 'Million', 'Billion'];

//     const convertHundreds = (n) => {
//         let words = '';

//         if (n > 99) {
//             words += ones[Math.floor(n / 100)] + ' Hundred ';
//             n %= 100;
//         }

//         if (n > 19) {
//             words += tens[Math.floor(n / 10)] + ' ';
//             n %= 10;
//         }

//         if (n > 0) {
//             words += ones[n] + ' ';
//         }

//         return words.trim();
//     };

//     if (num === 0) return 'Zero';
//     if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

//     let words = '';

//     for (let i = 0; i < scales.length; i++) {
//         let unit = Math.pow(1000, scales.length - i - 1);
//         let currentNum = Math.floor(num / unit);

//         if (currentNum > 0) {
//             words += convertHundreds(currentNum) + ' ' + scales[scales.length - i - 1] + ' ';
//         }

//         num %= unit;
//     }

//     return words.trim();
// };

// export default AddStockAdjustment;

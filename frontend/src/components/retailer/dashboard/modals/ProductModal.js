// ProductModal.js
// import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import axios from 'axios';
// import { Modal } from 'react-bootstrap';
// import { usePageNotRefreshContext } from '../../PageNotRefreshContext';
// import VirtualizedProductList from '../../../VirtualizedProductList';
// import ProductDetailsModal from './ProductDetailsModal';
// import BatchUpdateModal from './BatchUpdateModal';

// const ProductModal = ({ onClose }) => {
//     const { productDraftSave, setProductDraftSave } = usePageNotRefreshContext();

//     // Add states for virtualized list
//     const [isSearching, setIsSearching] = useState(false);
//     const [searchResults, setSearchResults] = useState([]);
//     const [searchPage, setSearchPage] = useState(1);
//     const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
//     const [totalSearchProducts, setTotalSearchProducts] = useState(0);
//     const [productSearchQuery, setProductSearchQuery] = useState('');

//     // Other states
//     const [selectedProduct, setSelectedProduct] = useState(null);
//     const [showDetailsModal, setShowDetailsModal] = useState(false);
//     const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);
//     const [batchToUpdate, setBatchToUpdate] = useState(null);

//     const searchInputRef = useRef(null);

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     // Fetch products from backend with search functionality
//     const fetchProductsFromBackend = useCallback(async (searchTerm = '', page = 1) => {
//         try {
//             setIsSearching(true);
//             const response = await api.get('/api/retailer/items/search', {
//                 params: {
//                     search: searchTerm,
//                     page: page,
//                     limit: searchTerm.trim() ? 15 : 25,
//                     sortBy: searchTerm.trim() ? 'relevance' : 'name'
//                 }
//             });

//             if (response.data.success) {
//                 const productsWithStock = response.data.items.map(item => ({
//                     ...item,
//                     currentStock: item.currentStock || 0,
//                     latestPrice: item.stockEntries && item.stockEntries.length > 0
//                         ? item.stockEntries.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.price || 0
//                         : 0
//                 }));

//                 if (page === 1) {
//                     setSearchResults(productsWithStock);
//                 } else {
//                     setSearchResults(prev => [...prev, ...productsWithStock]);
//                 }
//                 setHasMoreSearchResults(response.data.pagination.hasNextPage);
//                 setTotalSearchProducts(response.data.pagination.totalItems);
//                 setSearchPage(page);
//             }
//         } catch (error) {
//             console.error('Error fetching products:', error);
//         } finally {
//             setIsSearching(false);
//         }
//     }, []);

//     // Load more products for infinite scrolling
//     const loadMoreSearchProducts = useCallback(() => {
//         if (!isSearching) {
//             fetchProductsFromBackend(productSearchQuery, searchPage + 1);
//         }
//     }, [isSearching, productSearchQuery, searchPage, fetchProductsFromBackend]);

//     // Fetch products when modal opens
//     useEffect(() => {
//         setSearchPage(1);
//         fetchProductsFromBackend(productSearchQuery, 1);
//     }, [productSearchQuery]);

//     // Load initial products when modal opens
//     useEffect(() => {
//         // Try to load from draft first
//         if (productDraftSave?.products) {
//             setSearchResults(productDraftSave.products);
//             setTotalSearchProducts(productDraftSave.products?.length || 0);
//             setProductSearchQuery(productDraftSave.searchQuery || '');
//         } else {
//             // Fetch fresh data
//             fetchProductsFromBackend('', 1);
//         }
//     }, []);

//     // Save to draft when data changes
//     useEffect(() => {
//         setProductDraftSave({
//             products: searchResults,
//             searchQuery: productSearchQuery,
//             page: searchPage
//         });
//     }, [searchResults, productSearchQuery, searchPage, setProductDraftSave]);

//     const handleSearch = (e) => {
//         setProductSearchQuery(e.target.value);
//     };

//     const handleProductSelect = (product) => {
//         setSelectedProduct(product);
//         setShowDetailsModal(true);
//     };

//     // const handleBatchUpdate = (batchIndex) => {
//     //     setBatchToUpdate({
//     //         index: batchIndex,
//     //         ...selectedProduct.stockEntries[batchIndex]
//     //     });
//     //     setShowBatchUpdateModal(true);
//     // };

//     // In ProductModal.js, update the handleBatchUpdate function:
//     const handleBatchUpdate = (batchIndex) => {
//         console.log('handleBatchUpdate called with index:', batchIndex);

//         // Make sure we have the selected product
//         if (!selectedProduct) {
//             console.error('No selected product found');
//             return;
//         }

//         // Find the batch data for this index
//         const batchData = selectedProduct.stockEntries && selectedProduct.stockEntries[batchIndex];

//         if (!batchData) {
//             console.error('Batch data not found for index:', batchIndex);
//             console.error('Stock entries:', selectedProduct.stockEntries);
//             return;
//         }

//         console.log('Setting batch to update:', {
//             index: batchIndex,
//             batchNumber: batchData.batchNumber,
//             expiryDate: batchData.expiryDate,
//             price: batchData.price
//         });

//         setBatchToUpdate({
//             index: batchIndex,
//             batchNumber: batchData.batchNumber,
//             expiryDate: batchData.expiryDate,
//             price: batchData.price,
//             ...batchData
//         });
//         setShowBatchUpdateModal(true);
//     };

//     const handleKeyNavigation = (e) => {
//         if (e.key === 'Escape') {
//             e.preventDefault();
//             onClose();
//         }
//     };

//     const handleModalKeyDown = (e) => {
//         if (e.key === 'Escape') {
//             e.preventDefault();
//             onClose();
//         } else if (e.key === 'ArrowDown') {
//             e.preventDefault();
//             // Focus on first item in the list
//             const firstItem = document.querySelector('.dropdown-item');
//             if (firstItem) {
//                 firstItem.focus();
//             }
//         }
//     };

//     // Determine which data to display
//     const displayProducts = useMemo(() => {
//         if (productSearchQuery.trim()) {
//             return searchResults.slice(0, 15); // Limit to 15 when searching
//         }
//         return searchResults;
//     }, [searchResults, productSearchQuery]);

//     return (
//         <>
//             <div className="modal fade show" id="productModal" tabIndex="-1" style={{ display: 'block' }}>
//                 <div className="modal-dialog modal-xl modal-dialog-centered">
//                     <div className="modal-content" style={{ height: '440px' }}>
//                         <div className="modal-header py-1">
//                             <p className="modal-title mb-0" id="productModalLabel" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
//                                 Product Details
//                             </p>
//                             <button
//                                 type="button"
//                                 className="btn-close"
//                                 onClick={onClose}
//                                 style={{ fontSize: '0.7rem' }}
//                             ></button>
//                         </div>
//                         <div className="p-2 bg-white sticky-top">
//                             <input
//                                 ref={searchInputRef}
//                                 type="text"
//                                 id="searchProduct"
//                                 className="form-control form-control-sm"
//                                 placeholder="Search items by item code, name & category..."
//                                 autoFocus
//                                 autoComplete='off'
//                                 value={productSearchQuery}
//                                 onChange={handleSearch}
//                                 onKeyDown={handleModalKeyDown}
//                                 style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
//                             />
//                         </div>
//                         <div className="modal-body p-0">
//                             <div style={{ height: 'calc(400px - 100px)' }}>
//                                 <div
//                                     className="w-100 h-100"
//                                     style={{
//                                         border: '1px solid #dee2e6',
//                                         borderRadius: '0.25rem',
//                                         overflow: 'hidden'
//                                     }}
//                                 >
//                                     <div className="dropdown-header" style={{
//                                         display: 'grid',
//                                         gridTemplateColumns: 'repeat(7, 1fr)',
//                                         alignItems: 'center',
//                                         padding: '0 8px',
//                                         height: '20px',
//                                         background: '#f0f0f0',
//                                         fontWeight: 'bold',
//                                         borderBottom: '1px solid #dee2e6',
//                                         position: 'sticky',
//                                         top: 0,
//                                         zIndex: 1,
//                                         fontSize: '0.7rem'
//                                     }}>
//                                         <div><strong>#</strong></div>
//                                         <div><strong>HSN</strong></div>
//                                         <div><strong>Description</strong></div>
//                                         <div><strong>Category</strong></div>
//                                         <div><strong>Stock</strong></div>
//                                         <div><strong>Unit</strong></div>
//                                         <div><strong>Rate</strong></div>
//                                     </div>

//                                     {displayProducts.length > 0 ? (
//                                         <VirtualizedProductList
//                                             products={displayProducts}
//                                             onProductClick={handleProductSelect}
//                                             searchRef={searchInputRef}
//                                             hasMore={hasMoreSearchResults && !productSearchQuery.trim()}
//                                             isSearching={isSearching}
//                                             onLoadMore={loadMoreSearchProducts}
//                                             totalProducts={totalSearchProducts}
//                                             page={searchPage}
//                                             searchQuery={productSearchQuery}
//                                         />
//                                     ) : (
//                                         <div className="text-center py-3 text-muted" style={{ fontSize: '0.75rem' }}>
//                                             {isSearching ? 'Loading products...' : 'No products found'}
//                                         </div>
//                                     )}
//                                 </div>
//                             </div>
//                         </div>
//                         <div className="modal-footer py-1" style={{ fontSize: '0.75rem' }}>
//                             <div className="d-flex justify-content-between w-100">
//                                 <div>
//                                     Showing {displayProducts.length} of {totalSearchProducts} products
//                                     {productSearchQuery.trim() && displayProducts.length >= 15 && ' (Showing first 15 matches)'}
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {showDetailsModal && selectedProduct && (
//                 <ProductDetailsModal
//                     product={selectedProduct}
//                     onClose={() => setShowDetailsModal(false)}
//                     onBatchUpdate={handleBatchUpdate}
//                 />
//             )}

//             {showBatchUpdateModal && batchToUpdate && (
//                 <BatchUpdateModal
//                     product={selectedProduct}
//                     batch={batchToUpdate}
//                     onClose={() => setShowBatchUpdateModal(false)}
//                     onUpdate={() => fetchProductsFromBackend(productSearchQuery, 1)}
//                 />
//             )}

//             {/* Backdrop */}
//             <div className="modal-backdrop fade show" onClick={onClose}></div>
//         </>
//     );
// };

// export default ProductModal;

//----------------------------------------------------------end

// ProductModal.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { usePageNotRefreshContext } from '../../PageNotRefreshContext';
import VirtualizedProductList from '../../../VirtualizedProductList';
import ProductDetailsModal from './ProductDetailsModal';
import BatchUpdateModal from './BatchUpdateModal';

const ProductModal = ({ onClose }) => {
    const { productDraftSave, setProductDraftSave } = usePageNotRefreshContext();

    // Add states for virtualized list
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchPage, setSearchPage] = useState(1);
    const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
    const [totalSearchProducts, setTotalSearchProducts] = useState(0);
    const [productSearchQuery, setProductSearchQuery] = useState('');

    // Other states
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);
    const [batchToUpdate, setBatchToUpdate] = useState(null);

    const searchInputRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Fetch products from backend with search functionality
    const fetchProductsFromBackend = useCallback(async (searchTerm = '', page = 1) => {
        try {
            setIsSearching(true);
            const response = await api.get('/api/retailer/items/search', {
                params: {
                    search: searchTerm,
                    page: page,
                    limit: searchTerm.trim() ? 15 : 25,
                    sortBy: searchTerm.trim() ? 'relevance' : 'name'
                }
            });

            if (response.data.success) {
                const productsWithStock = response.data.items.map(item => ({
                    ...item,
                    currentStock: item.currentStock || 0,
                    latestPrice: item.stockEntries && item.stockEntries.length > 0
                        ? item.stockEntries.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.price || 0
                        : 0
                }));

                if (page === 1) {
                    setSearchResults(productsWithStock);
                } else {
                    setSearchResults(prev => [...prev, ...productsWithStock]);
                }
                setHasMoreSearchResults(response.data.pagination.hasNextPage);
                setTotalSearchProducts(response.data.pagination.totalItems);
                setSearchPage(page);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Load more products for infinite scrolling
    const loadMoreSearchProducts = useCallback(() => {
        if (!isSearching) {
            fetchProductsFromBackend(productSearchQuery, searchPage + 1);
        }
    }, [isSearching, productSearchQuery, searchPage, fetchProductsFromBackend]);

    // Fetch products when modal opens
    useEffect(() => {
        setSearchPage(1);
        fetchProductsFromBackend(productSearchQuery, 1);
    }, [productSearchQuery]);

    // Load initial products when modal opens
    useEffect(() => {
        // Try to load from draft first
        if (productDraftSave?.products) {
            setSearchResults(productDraftSave.products);
            setTotalSearchProducts(productDraftSave.products?.length || 0);
            setProductSearchQuery(productDraftSave.searchQuery || '');
        } else {
            // Fetch fresh data
            fetchProductsFromBackend('', 1);
        }
    }, []);

    // Save to draft when data changes
    useEffect(() => {
        setProductDraftSave({
            products: searchResults,
            searchQuery: productSearchQuery,
            page: searchPage
        });
    }, [searchResults, productSearchQuery, searchPage, setProductDraftSave]);

    const handleSearch = (e) => {
        setProductSearchQuery(e.target.value);
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setShowDetailsModal(true);
    };

    const handleBatchUpdate = (batchIndex) => {
        console.log('handleBatchUpdate called with index:', batchIndex);

        // Make sure we have the selected product
        if (!selectedProduct) {
            console.error('No selected product found');
            return;
        }

        // Find the batch data for this index
        const batchData = selectedProduct.stockEntries && selectedProduct.stockEntries[batchIndex];

        if (!batchData) {
            console.error('Batch data not found for index:', batchIndex);
            console.error('Stock entries:', selectedProduct.stockEntries);
            return;
        }

        console.log('Setting batch to update:', {
            index: batchIndex,
            batchNumber: batchData.batchNumber,
            expiryDate: batchData.expiryDate,
            price: batchData.price
        });

        setBatchToUpdate({
            index: batchIndex,
            batchNumber: batchData.batchNumber,
            expiryDate: batchData.expiryDate,
            price: batchData.price,
            ...batchData
        });
        setShowBatchUpdateModal(true);
    };

    const handleModalKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            // Focus on first item in the list
            const firstItem = document.querySelector('.dropdown-item');
            if (firstItem) {
                firstItem.focus();
            }
        }
    };

    // Determine which data to display
    const displayProducts = useMemo(() => {
        if (productSearchQuery.trim()) {
            return searchResults.slice(0, 15); // Limit to 15 when searching
        }
        return searchResults;
    }, [searchResults, productSearchQuery]);

    return (
        <>
            {/* Product Selection Modal */}
            <div className="modal fade show" id="productModal" tabIndex="-1" style={{ display: 'block' }}>
                <div className="modal-dialog modal-xl modal-dialog-centered">
                    <div className="modal-content" style={{ height: '440px' }}>
                        <div className="modal-header py-1">
                            <p className="modal-title mb-0" id="productModalLabel" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                Product Details
                            </p>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={onClose}
                                style={{ fontSize: '0.7rem' }}
                            ></button>
                        </div>
                        <div className="p-2 bg-white sticky-top">
                            <input
                                ref={searchInputRef}
                                type="text"
                                id="searchProduct"
                                className="form-control form-control-sm"
                                placeholder="Search items by item code, name & category..."
                                autoFocus
                                autoComplete='off'
                                value={productSearchQuery}
                                onChange={handleSearch}
                                onKeyDown={handleModalKeyDown}
                                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                            />
                        </div>
                        <div className="modal-body p-0">
                            <div style={{ height: 'calc(400px - 100px)' }}>
                                <div
                                    className="w-100 h-100"
                                    style={{
                                        border: '1px solid #dee2e6',
                                        borderRadius: '0.25rem',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div className="dropdown-header" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(7, 1fr)',
                                        alignItems: 'center',
                                        padding: '0 8px',
                                        height: '20px',
                                        background: '#f0f0f0',
                                        fontWeight: 'bold',
                                        borderBottom: '1px solid #dee2e6',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1,
                                        fontSize: '0.7rem'
                                    }}>
                                        <div><strong>#</strong></div>
                                        <div><strong>HSN</strong></div>
                                        <div><strong>Description</strong></div>
                                        <div><strong>Category</strong></div>
                                        <div><strong>Stock</strong></div>
                                        <div><strong>Unit</strong></div>
                                        <div><strong>Rate</strong></div>
                                    </div>

                                    {displayProducts.length > 0 ? (
                                        <VirtualizedProductList
                                            products={displayProducts}
                                            onProductClick={handleProductSelect}
                                            searchRef={searchInputRef}
                                            hasMore={hasMoreSearchResults && !productSearchQuery.trim()}
                                            isSearching={isSearching}
                                            onLoadMore={loadMoreSearchProducts}
                                            totalProducts={totalSearchProducts}
                                            page={searchPage}
                                            searchQuery={productSearchQuery}
                                        />
                                    ) : (
                                        <div className="text-center py-3 text-muted" style={{ fontSize: '0.75rem' }}>
                                            {isSearching ? 'Loading products...' : 'No products found'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer py-1" style={{ fontSize: '0.75rem' }}>
                            <div className="d-flex justify-content-between w-100">
                                <div>
                                    Showing {displayProducts.length} of {totalSearchProducts} products
                                    {productSearchQuery.trim() && displayProducts.length >= 15 && ' (Showing first 15 matches)'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Details Modal */}
            {showDetailsModal && selectedProduct && (
                <div className="modal fade show" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header py-2">
                                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                                    {selectedProduct.name} Details
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowDetailsModal(false)}
                                    style={{ fontSize: '0.7rem' }}
                                ></button>
                            </div>
                            <div className="modal-body" style={{ fontSize: '0.8rem' }}>
                                <ProductDetailsModal
                                    product={selectedProduct}
                                    onClose={() => setShowDetailsModal(false)}
                                    onBatchUpdate={handleBatchUpdate}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop fade show" onClick={() => setShowDetailsModal(false)}></div>
                </div>
            )}

            {/* Batch Update Modal */}
            {showBatchUpdateModal && batchToUpdate && (
                <div className="modal fade show" style={{ display: 'block' }}>
                    <div className="modal-dialog modal-md modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header py-2">
                                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                                    Update Batch Details
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowBatchUpdateModal(false)}
                                    style={{ fontSize: '0.7rem' }}
                                ></button>
                            </div>
                            <div className="modal-body" style={{ fontSize: '0.8rem' }}>
                                <BatchUpdateModal
                                    product={selectedProduct}
                                    batch={batchToUpdate}
                                    onClose={() => setShowBatchUpdateModal(false)}
                                    onUpdate={() => fetchProductsFromBackend(productSearchQuery, 1)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop fade show" onClick={() => setShowBatchUpdateModal(false)}></div>
                </div>
            )}

            {/* Main Modal Backdrop */}
            <div className="modal-backdrop fade show" onClick={onClose}></div>
        </>
    );
};

export default ProductModal;
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProductList from './ProductList';
import ProductDetailsModal from './ProductDetailsModal';
import BatchUpdateModal from './BatchUpdateModal';
import { Modal } from 'react-bootstrap';

const ProductModal = ({ onClose }) => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentFocus, setCurrentFocus] = useState(0);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);
    const [batchToUpdate, setBatchToUpdate] = useState(null);
    const productListRef = useRef(null);
    const searchInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, [showDetailsModal, showBatchUpdateModal]);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get('/api/retailer/products');
            if (response.data.success) {
                setProducts(response.data.data);
                setFilteredProducts(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setIsLoading(false);
        }

    };

    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchQuery(query);
        const filtered = products.filter(product =>
            product.name.toLowerCase().includes(query) ||
            (product.category && product.category.toLowerCase().includes(query)) ||
            product.uniqueNumber.toString().toLowerCase().includes(query)
        );
        setFilteredProducts(filtered);
        setCurrentFocus(0);
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setShowDetailsModal(true);
    };

    const handleBatchUpdate = (batchIndex) => {
        setBatchToUpdate({
            index: batchIndex,
            ...selectedProduct.stockEntries[batchIndex]
        });
        setShowBatchUpdateModal(true);
    };

    const handleKeyNavigation = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const newFocus = Math.min(currentFocus + 1, filteredProducts.length - 1);
            setCurrentFocus(newFocus);
            scrollToHighlightedRow(newFocus);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const newFocus = Math.max(currentFocus - 1, 0);
            setCurrentFocus(newFocus);
            scrollToHighlightedRow(newFocus);
        } else if (e.key === 'Enter' && filteredProducts[currentFocus]) {
            e.preventDefault();
            handleProductSelect(filteredProducts[currentFocus]);
        }
    };

    const scrollToHighlightedRow = (index) => {
        if (productListRef.current && productListRef.current.children[index]) {
            const container = productListRef.current;
            const row = container.children[index];
            const containerHeight = container.clientHeight;
            const rowHeight = row.clientHeight;
            const rowTop = row.offsetTop;
            const rowBottom = rowTop + rowHeight;
            const scrollTop = container.scrollTop;
            const scrollBottom = scrollTop + containerHeight;

            // If row is above the visible area
            if (rowTop < scrollTop) {
                container.scrollTop = rowTop;
            }
            // If row is below the visible area
            else if (rowBottom > scrollBottom) {
                container.scrollTop = rowBottom - containerHeight;
            }
        }
    };

    return (
        <>
            {isLoading && (
                <div className="text-center py-2">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            )}
            <Modal
                show={true}
                onHide={onClose}
                size="xl"
                centered
                backdrop="static"
                // className="custom-product-modal"
                dialogClassName="mw-100"
                style={{ maxWidth: '95vw' }}
            >
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>Product Details</Modal.Title>
                </Modal.Header>

                <Modal.Body style={{
                    overflowY: 'auto',
                    height: '600px', // Fixed height
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div className="form-group mb-4">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="form-control"
                            placeholder="Search items by item code, name & category..."
                            value={searchQuery}
                            onChange={handleSearch}
                            onKeyDown={(e) => {
                                // Only handle navigation keys in the search input
                                if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
                                    handleKeyNavigation(e);
                                }
                                // Allow F9 to pass through
                                if (e.key === 'F9') {
                                    return;
                                }
                            }}
                            autoFocus
                        />
                    </div>

                    <div
                        ref={productListRef}
                        style={{
                            overflowY: 'auto',
                            flex: '1', // Takes remaining space
                            minHeight: '200px', // Minimum height
                            position: 'relative'
                        }}
                        tabIndex="0"
                        onKeyDown={handleKeyNavigation}
                    >
                        <ProductList
                            products={filteredProducts}
                            currentFocus={currentFocus}
                            onProductSelect={handleProductSelect}
                            onKeyNavigation={handleKeyNavigation}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer className="d-flex justify-content-between">
                    <div className="expiry-summary">
                        <small>
                            <span className="expiry-status expired me-2">Expired</span>
                            <span className="expiry-status danger me-2">Critical (≤30 days)</span>
                            <span className="expiry-status warning me-2">Warning (≤90 days)</span>
                        </small>
                    </div>
                    <button type="button" className="btn btn-danger" onClick={onClose}>Close</button>
                </Modal.Footer>
            </Modal>

            {showDetailsModal && selectedProduct && (
                <ProductDetailsModal
                    product={selectedProduct}
                    onClose={() => setShowDetailsModal(false)}
                    onBatchUpdate={handleBatchUpdate}
                />
            )}

            {showBatchUpdateModal && batchToUpdate && (
                <BatchUpdateModal
                    product={selectedProduct}
                    batch={batchToUpdate}
                    onClose={() => setShowBatchUpdateModal(false)}
                    onUpdate={fetchProducts}
                />
            )}
        </>
    );
};

export default ProductModal;
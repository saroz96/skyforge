// ProductList.jsx
import React, { useEffect, useRef } from 'react';
import '../../../../stylesheet/retailer/dashboard/modals/ProductList.css'
import { calculateExpiryStatus } from './ExpiryStatus';

const ProductList = ({ products, currentFocus, onProductSelect, onKeyNavigation }) => {
    const listRef = useRef(null);

    const handleKeyDown = (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
            e.preventDefault();
            onKeyNavigation(e);
        }
    };

    useEffect(() => {
        if (listRef.current && products.length > 0) {
            const row = listRef.current.children[currentFocus];
            if (row) {
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [currentFocus, products]);

    return (
        <div id="productDetailsContainer" style={{ height: '100%' }}>
            <ul id="productDetailsHeader" className="list-group list-group-horizontal">
                <li className="product-cell" style={{ textAlign: 'left' }}>#</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>HSN</li>
                <li className="product-cell product-name" style={{ textAlign: 'left' }}>Description of Goods</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>Company</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>Category</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>Rate</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>Stock</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>Unit</li>
                <li className="product-cell" style={{ textAlign: 'left' }}>%</li>
            </ul>

            <ul ref={listRef} id="productDetailsList"
                className="list-group"
                style={{
                    height: 'calc(600px - 40px)', // Adjust based on your header height
                    overflowY: 'auto',
                    position: 'relative'
                }}
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                {products.length === 0 ? (
                    <li className="list-group-item text-center py-4 text-muted">
                        No products found
                    </li>
                ) : (
                    products.map((product, index) => {
                        const expiryStatus = calculateExpiryStatus(product);
                        const rowClass = [
                            'list-group-item',
                            'product-row',
                            index === currentFocus ? 'active' : '',
                            product.vatStatus === 'vatable' ? 'vatable' : '',
                            product.vatStatus === 'vatExempt' ? 'vatExempt' : '',
                            `expiry-${expiryStatus}`
                        ].filter(Boolean).join(' ');

                        return (
                            <li
                                key={product.id}
                                className={rowClass}
                                onClick={() => onProductSelect(product)}
                                style={{
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.uniqueNumber}</div>
                                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.hscode}</div>
                                <div className="product-cell product-name" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.name}</div>
                                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.company}</div>
                                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.category}</div>
                                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>Rs.{Math.round(product.rate * 100) / 100}</div>
                                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.stock}</div>
                                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.unit}</div>
                                <div className="product-cell" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>{product.margin}</div>
                            </li>
                        );
                    })
                )}
            </ul>
        </div>
    );
};

export default ProductList;
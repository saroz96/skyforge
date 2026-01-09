
// // src/components/VirtualizedItemList.js
// import React, { useState, useEffect, useRef, memo } from 'react';

// const ItemRow = memo(({ item, index, style, onItemClick, searchRef }) => {
//   const handleClick = () => onItemClick(item);

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter') {
//       e.preventDefault();
//       onItemClick(item);
//     } else if (e.key === 'ArrowDown') {
//       e.preventDefault();
//       const nextItem = e.target.nextElementSibling;
//       if (nextItem) {
//         e.target.classList.remove('active');
//         nextItem.classList.add('active');
//         nextItem.focus();
//       }
//     } else if (e.key === 'ArrowUp') {
//       e.preventDefault();
//       const prevItem = e.target.previousElementSibling;
//       if (prevItem) {
//         e.target.classList.remove('active');
//         prevItem.classList.add('active');
//         prevItem.focus();
//       } else {
//         searchRef.current?.focus();
//       }
//     }
//   };

//   const handleFocus = (e) => {
//     document.querySelectorAll('.dropdown-item').forEach(item => {
//       item.classList.remove('active');
//     });
//     e.target.classList.add('active');
//   };

//   return (
//     <div
//       data-index={index}
//       className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'}`}
//       style={{
//         ...style,
//         display: 'grid',
//         gridTemplateColumns: 'repeat(7, 1fr)',
//         alignItems: 'center',
//         padding: '0 8px',
//         borderBottom: '1px solid #eee',
//         cursor: 'pointer',
//         fontSize: '12px' // Reduced font size
//       }}
//       onClick={handleClick}
//       tabIndex={0}
//       onKeyDown={handleKeyDown}
//       onFocus={handleFocus}
//     >
//       <div>{item.uniqueNumber || 'N/A'}</div>
//       <div>{item.hscode || 'N/A'}</div>
//       <div className="dropdown-items-name">{item.name}</div>
//       <div>{item.category?.name || 'No Category'}</div>
//       <div>{item.stock || 0}</div>
//       <div>{item.unit?.name || ''}</div>
//       <div>Rs.{item.latestPuPrice ? item.latestPuPrice : item.latestPrice || 0}</div>
//     </div>
//   );
// });

// const VirtualizedItemList = memo(({ items, onItemClick, searchRef }) => {
//   const [visibleRange, setVisibleRange] = useState({ start: 0, end: 25 });
//   const itemHeight = 28; // Reduced from 40 to 32 (20% smaller)
//   const containerRef = useRef(null);

//   useEffect(() => {
//     const handleScroll = () => {
//       if (!containerRef.current) return;

//       const scrollTop = containerRef.current.scrollTop;
//       const start = Math.floor(scrollTop / itemHeight);
//       const end = start + 25; // Reduced buffer items

//       setVisibleRange({
//         start: Math.max(0, start - 3), // Reduced buffer
//         end: Math.min(items.length, end + 3) // Reduced buffer
//       });
//     };

//     const container = containerRef.current;
//     if (container) {
//       container.addEventListener('scroll', handleScroll);
//       handleScroll(); // Initial calculation

//       return () => container.removeEventListener('scroll', handleScroll);
//     }
//   }, [items.length]);

//   const visibleItems = items.slice(visibleRange.start, visibleRange.end);
//   const totalHeight = items.length * itemHeight;
//   const offsetY = visibleRange.start * itemHeight;

//   return (
//     <div
//       ref={containerRef}
//       style={{
//         height: '160px', // Reduced from 240px to 160px (33% smaller)
//         overflow: 'auto',
//         position: 'relative'
//       }}
//     >
//       <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
//         <div style={{ transform: `translateY(${offsetY}px)` }}>
//           {visibleItems.map((item, index) => {
//             const actualIndex = visibleRange.start + index;
//             return (
//               <ItemRow
//                 key={item._id}
//                 item={item}
//                 index={actualIndex}
//                 style={{
//                   height: `${itemHeight}px`,
//                   lineHeight: `${itemHeight}px` // Added for better vertical alignment
//                 }}
//                 onItemClick={onItemClick}
//                 searchRef={searchRef}
//               />
//             );
//           })}
//         </div>
//       </div>
//     </div>
//   );
// });

// export default VirtualizedItemList;
//-------------------------------------------------------------------------------------------end

// import React, { useState, useEffect, useRef, memo, useCallback } from 'react';

// const ItemRow = memo(({ item, index, style, onItemClick, searchRef }) => {
//   const handleClick = () => onItemClick(item);

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter') {
//       e.preventDefault();
//       onItemClick(item);
//     } else if (e.key === 'ArrowDown') {
//       e.preventDefault();
//       const nextItem = e.target.nextElementSibling;
//       if (nextItem) {
//         e.target.classList.remove('active');
//         nextItem.classList.add('active');
//         nextItem.focus();
//       }
//     } else if (e.key === 'ArrowUp') {
//       e.preventDefault();
//       const prevItem = e.target.previousElementSibling;
//       if (prevItem) {
//         e.target.classList.remove('active');
//         prevItem.classList.add('active');
//         prevItem.focus();
//       } else {
//         searchRef.current?.focus();
//       }
//     }
//   };

//   const handleFocus = (e) => {
//     document.querySelectorAll('.dropdown-item').forEach(item => {
//       item.classList.remove('active');
//     });
//     e.target.classList.add('active');
//   };

//   return (
//     <div
//       data-index={index}
//       className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'}`}
//       style={{
//         ...style,
//         display: 'grid',
//         gridTemplateColumns: 'repeat(7, 1fr)',
//         alignItems: 'center',
//         padding: '0 8px',
//         borderBottom: '1px solid #eee',
//         cursor: 'pointer',
//         fontSize: '12px'
//       }}
//       onClick={handleClick}
//       tabIndex={0}
//       onKeyDown={handleKeyDown}
//       onFocus={handleFocus}
//     >
//       <div>{item.uniqueNumber || 'N/A'}</div>
//       <div>{item.hscode || 'N/A'}</div>
//       <div className="dropdown-items-name">{item.name}</div>
//       <div>{item.category?.name || 'No Category'}</div>
//       <div>{item.currentStock || 0}</div>
//       <div>{item.unit?.name || ''}</div>
//       <div>Rs.{item.latestPuPrice || item.latestPrice || 0}</div>
//     </div>
//   );
// });

// const VirtualizedItemList = memo(({
//   items,
//   onItemClick,
//   searchRef,
//   hasMore = false,
//   isSearching = false,
//   onLoadMore = () => { },
//   page = 1
// }) => {
//   const [visibleRange, setVisibleRange] = useState({ start: 0, end: 25 });
//   const itemHeight = 28;
//   const containerRef = useRef(null);
//   const loadingRef = useRef(false);
//   const observerRef = useRef(null);

//   // Handle scroll for infinite loading
//   const handleScroll = useCallback(() => {
//     if (!containerRef.current || isSearching || loadingRef.current || !hasMore) return;

//     const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
//     const scrollPosition = scrollTop + clientHeight;

//     // Calculate visible range for virtualization
//     const start = Math.floor(scrollTop / itemHeight);
//     const end = start + 25;

//     setVisibleRange({
//       start: Math.max(0, start - 3),
//       end: Math.min(items.length, end + 3)
//     });

//     // Load more when near bottom (within 100px)
//     if (scrollHeight - scrollPosition < 100) {
//       loadingRef.current = true;
//       onLoadMore();
//     }
//   }, [items.length, hasMore, isSearching, onLoadMore]);

//   // Reset loading flag when search state changes
//   useEffect(() => {
//     if (!isSearching) {
//       loadingRef.current = false;
//     }
//   }, [isSearching]);

//   // Setup scroll event listener
//   useEffect(() => {
//     const container = containerRef.current;
//     if (container) {
//       container.addEventListener('scroll', handleScroll);
//       handleScroll(); // Initial calculation

//       return () => container.removeEventListener('scroll', handleScroll);
//     }
//   }, [handleScroll]);

//   // Setup Intersection Observer for more precise infinite scroll
//   useEffect(() => {
//     if (!hasMore || isSearching) return;

//     const handleObserver = (entries) => {
//       const target = entries[0];
//       if (target.isIntersecting && !loadingRef.current) {
//         loadingRef.current = true;
//         onLoadMore();
//       }
//     };

//     observerRef.current = new IntersectionObserver(handleObserver, {
//       root: containerRef.current,
//       rootMargin: '100px',
//       threshold: 0.1
//     });

//     // Observe the last item
//     const lastItem = containerRef.current?.querySelector('.dropdown-item:last-child');
//     if (lastItem) {
//       observerRef.current.observe(lastItem);
//     }

//     return () => {
//       if (observerRef.current) {
//         observerRef.current.disconnect();
//       }
//     };
//   }, [items.length, hasMore, isSearching, onLoadMore, page]);

//   const visibleItems = items.slice(visibleRange.start, visibleRange.end);
//   const totalHeight = items.length * itemHeight;
//   const offsetY = visibleRange.start * itemHeight;

//   return (
//     <div
//       ref={containerRef}
//       style={{
//         height: '160px',
//         overflow: 'auto',
//         position: 'relative',
//         scrollBehavior: 'smooth'
//       }}
//     >
//       <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
//         <div style={{ transform: `translateY(${offsetY}px)` }}>
//           {visibleItems.map((item, index) => {
//             const actualIndex = visibleRange.start + index;
//             return (
//               <ItemRow
//                 key={item._id || `${item.uniqueNumber}-${actualIndex}`}
//                 item={item}
//                 index={actualIndex}
//                 style={{
//                   height: `${itemHeight}px`,
//                   lineHeight: `${itemHeight}px`
//                 }}
//                 onItemClick={onItemClick}
//                 searchRef={searchRef}
//               />
//             );
//           })}

//           {/* Empty state */}
//           {items.length === 0 && !isSearching && (
//             <div
//               className="empty-state"
//               style={{
//                 height: `${itemHeight * 3}px`,
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 color: '#6c757d',
//                 fontSize: '12px',
//                 gridColumn: '1 / -1',
//                 textAlign: 'center',
//                 padding: '20px'
//               }}
//             >
//               No items found. Try a different search.
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Loading overlay for initial load */}
//       {items.length === 0 && isSearching && (
//         <div
//           style={{
//             position: 'absolute',
//             top: 0,
//             left: 0,
//             right: 0,
//             bottom: 0,
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             background: 'rgba(255, 255, 255, 0.8)',
//             zIndex: 10
//           }}
//         >
//           <div className="text-center">
//             <div className="spinner-border spinner-border-sm text-primary" role="status">
//               <span className="visually-hidden">Loading...</span>
//             </div>
//             <div style={{ fontSize: '11px', marginTop: '8px', color: '#666' }}>
//               Loading items...
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// });

// export default VirtualizedItemList;

//---------------------------------------------------------------------end

// src/components/VirtualizedItemList.js
// import React, { useState, useEffect, useRef, memo, useCallback } from 'react';

// const ItemRow = memo(({ item, index, style, onItemClick, searchRef }) => {
//   const handleClick = () => onItemClick(item);

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter') {
//       e.preventDefault();
//       onItemClick(item);
//     } else if (e.key === 'ArrowDown') {
//       e.preventDefault();
//       const nextItem = e.target.nextElementSibling;
//       if (nextItem) {
//         e.target.classList.remove('active');
//         nextItem.classList.add('active');
//         nextItem.focus();
//       }
//     } else if (e.key === 'ArrowUp') {
//       e.preventDefault();
//       const prevItem = e.target.previousElementSibling;
//       if (prevItem) {
//         e.target.classList.remove('active');
//         prevItem.classList.add('active');
//         prevItem.focus();
//       } else {
//         searchRef.current?.focus();
//       }
//     }
//   };

//   const handleFocus = (e) => {
//     document.querySelectorAll('.dropdown-item').forEach(item => {
//       item.classList.remove('active');
//     });
//     e.target.classList.add('active');
//   };

//   return (
//     <div
//       data-index={index}
//       className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'}`}
//       style={{
//         ...style,
//         display: 'grid',
//         gridTemplateColumns: 'repeat(7, 1fr)',
//         alignItems: 'center',
//         padding: '0 8px',
//         borderBottom: '1px solid #eee',
//         cursor: 'pointer',
//         fontSize: '12px'
//       }}
//       onClick={handleClick}
//       tabIndex={0}
//       onKeyDown={handleKeyDown}
//       onFocus={handleFocus}
//     >
//       <div>{item.uniqueNumber || 'N/A'}</div>
//       <div>{item.hscode || 'N/A'}</div>
//       <div className="dropdown-items-name">{item.name}</div>
//       <div>{item.category?.name || 'No Category'}</div>
//       <div>{item.stock || 0}</div>
//       <div>{item.unit?.name || ''}</div>
//       <div>Rs.{item.latestPuPrice ? item.latestPuPrice : item.latestPrice || 0}</div>
//     </div>
//   );
// });

// const VirtualizedItemList = memo(({ items, onItemClick, searchRef }) => {
//   const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 }); // Initial 50 items
//   const [displayedItemsCount, setDisplayedItemsCount] = useState(50); // Track how many items are displayed
//   const itemHeight = 28;
//   const containerRef = useRef(null);
//   const loadingRef = useRef(false);
//   const initialLoadDone = useRef(false);

//   // Reset displayed items when items array changes
//   useEffect(() => {
//     setDisplayedItemsCount(50);
//     setVisibleRange({ start: 0, end: 50 });
//     initialLoadDone.current = false;
//   }, [items.length]);

//   // Load more items when reaching near the bottom
//   const loadMoreItems = useCallback(() => {
//     if (loadingRef.current || displayedItemsCount >= items.length) return;

//     loadingRef.current = true;

//     // Load next 50 items (or remaining items if less than 50)
//     const nextCount = Math.min(displayedItemsCount + 50, items.length);

//     setTimeout(() => {
//       setDisplayedItemsCount(nextCount);
//       loadingRef.current = false;
//     }, 100); // Small delay to prevent too rapid loading
//   }, [displayedItemsCount, items.length]);

//   useEffect(() => {
//     const handleScroll = () => {
//       if (!containerRef.current) return;

//       const container = containerRef.current;
//       const scrollTop = container.scrollTop;
//       const clientHeight = container.clientHeight;
//       const scrollHeight = container.scrollHeight;

//       // Update visible range based on current scroll position
//       const start = Math.floor(scrollTop / itemHeight);
//       const visibleItemsCount = Math.ceil(clientHeight / itemHeight);
//       const end = Math.min(start + visibleItemsCount, displayedItemsCount);

//       setVisibleRange({
//         start: Math.max(0, start - 5), // Small buffer for smooth scrolling
//         end: Math.min(displayedItemsCount, end + 5) // Small buffer
//       });

//       // Load more items when scrolled near bottom (80% threshold)
//       if (!loadingRef.current && displayedItemsCount < items.length) {
//         const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

//         if (scrollPercentage > 0.8) {
//           loadMoreItems();
//         }
//       }
//     };

//     const container = containerRef.current;
//     if (container) {
//       container.addEventListener('scroll', handleScroll);

//       // Initial calculation - only show first 50 items
//       if (!initialLoadDone.current && items.length > 0) {
//         const initialVisibleItems = Math.min(50, items.length);
//         setVisibleRange({ 
//           start: 0, 
//           end: Math.min(initialVisibleItems + 5, items.length) 
//         });
//         initialLoadDone.current = true;
//       }

//       handleScroll();

//       return () => container.removeEventListener('scroll', handleScroll);
//     }
//   }, [items.length, displayedItemsCount, loadMoreItems]);

//   // Current items to display (capped at displayedItemsCount)
//   const itemsToDisplay = items.slice(0, displayedItemsCount);
//   const visibleItems = itemsToDisplay.slice(visibleRange.start, visibleRange.end);
//   const totalHeight = itemsToDisplay.length * itemHeight;
//   const offsetY = visibleRange.start * itemHeight;

//   return (
//     <div
//       ref={containerRef}
//       style={{
//         height: '160px',
//         overflow: 'auto',
//         position: 'relative'
//       }}
//     >
//       <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
//         <div style={{ transform: `translateY(${offsetY}px)` }}>
//           {visibleItems.map((item, index) => {
//             const actualIndex = visibleRange.start + index;
//             return (
//               <ItemRow
//                 key={item._id}
//                 item={item}
//                 index={actualIndex}
//                 style={{
//                   height: `${itemHeight}px`,
//                   lineHeight: `${itemHeight}px`
//                 }}
//                 onItemClick={onItemClick}
//                 searchRef={searchRef}
//               />
//             );
//           })}
//         </div>
//       </div>

//       {/* Loading indicator when more items are being loaded */}
//       {displayedItemsCount < items.length && (
//         <div style={{
//           position: 'absolute',
//           bottom: 0,
//           left: 0,
//           right: 0,
//           textAlign: 'center',
//           padding: '4px',
//           backgroundColor: 'rgba(255, 255, 255, 0.9)',
//           fontSize: '11px',
//           color: '#666'
//         }}>
//           Loading more items... ({displayedItemsCount} of {items.length})
//         </div>
//       )}
//     </div>
//   );
// });

// export default VirtualizedItemList;

//------------------------------------------------------------------------------end

// import React, { useState, useEffect, useRef, memo, useCallback } from 'react';

// const ItemRow = memo(({ item, index, style, onItemClick, searchRef }) => {
//   const handleClick = () => onItemClick(item);

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter') {
//       e.preventDefault();
//       onItemClick(item);
//     } else if (e.key === 'ArrowDown') {
//       e.preventDefault();
//       const nextItem = e.target.nextElementSibling;
//       if (nextItem) {
//         e.target.classList.remove('active');
//         nextItem.classList.add('active');
//         nextItem.focus();
//       }
//     } else if (e.key === 'ArrowUp') {
//       e.preventDefault();
//       const prevItem = e.target.previousElementSibling;
//       if (prevItem) {
//         e.target.classList.remove('active');
//         prevItem.classList.add('active');
//         prevItem.focus();
//       } else {
//         searchRef.current?.focus();
//       }
//     }
//   };

//   const handleFocus = (e) => {
//     document.querySelectorAll('.dropdown-item').forEach(item => {
//       item.classList.remove('active');
//     });
//     e.target.classList.add('active');
//   };

//   return (
//     <div
//       data-index={index}
//       className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'}`}
//       style={{
//         ...style,
//         display: 'grid',
//         gridTemplateColumns: 'repeat(7, 1fr)',
//         alignItems: 'center',
//         padding: '0 8px',
//         borderBottom: '1px solid #eee',
//         cursor: 'pointer',
//         fontSize: '12px'
//       }}
//       onClick={handleClick}
//       tabIndex={0}
//       onKeyDown={handleKeyDown}
//       onFocus={handleFocus}
//     >
//       <div>{item.uniqueNumber || 'N/A'}</div>
//       <div>{item.hscode || 'N/A'}</div>
//       <div className="dropdown-items-name">{item.name}</div>
//       <div>{item.category?.name || 'No Category'}</div>
//       <div>{item.stock || 0}</div>
//       <div>{item.unit?.name || ''}</div>
//       <div>Rs.{item.latestPrice || 0}</div>
//     </div>
//   );
// });

// const VirtualizedItemList = memo(({
//   items,
//   onItemClick,
//   searchRef,
//   hasMore,
//   isSearching,
//   onLoadMore,
//   totalItems,
//   page
// }) => {
//   const itemHeight = 28;
//   const containerRef = useRef(null);
//   const loadingRef = useRef(false);

//   // Load more items when reaching near the bottom
//   const loadMoreItems = useCallback(() => {
//     if (loadingRef.current || !hasMore || isSearching) return;

//     loadingRef.current = true;
//     onLoadMore();
//     // Reset loading after a delay
//     setTimeout(() => {
//       loadingRef.current = false;
//     }, 500);
//   }, [hasMore, isSearching, onLoadMore]);

//   useEffect(() => {
//     const handleScroll = () => {
//       if (!containerRef.current) return;

//       const container = containerRef.current;
//       const scrollTop = container.scrollTop;
//       const clientHeight = container.clientHeight;
//       const scrollHeight = container.scrollHeight;

//       // Load more items when scrolled near bottom (90% threshold)
//       if (!loadingRef.current && hasMore) {
//         const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

//         if (scrollPercentage > 0.9) {
//           loadMoreItems();
//         }
//       }
//     };

//     const container = containerRef.current;
//     if (container) {
//       container.addEventListener('scroll', handleScroll);
//       return () => container.removeEventListener('scroll', handleScroll);
//     }
//   }, [hasMore, loadMoreItems]);

//   return (
//     <div
//       ref={containerRef}
//       style={{
//         height: '160px',
//         overflow: 'auto',
//         position: 'relative'
//       }}
//     >
//       <div style={{ position: 'relative' }}>
//         {items.map((item, index) => (
//           <ItemRow
//             key={item._id || index}
//             item={item}
//             index={index}
//             style={{
//               height: `${itemHeight}px`,
//               lineHeight: `${itemHeight}px`
//             }}
//             onItemClick={onItemClick}
//             searchRef={searchRef}
//           />
//         ))}
//       </div>
//     </div>
//   );
// });

// export default VirtualizedItemList;

//----------------------------------------------------------------------------------------------end

import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { calculateExpiryStatus } from './retailer/dashboard/modals/ExpiryStatus';

const ItemRow = memo(({ item, index, style, onItemClick, searchRef }) => {
  const handleClick = () => onItemClick(item);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onItemClick(item);
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
        searchRef.current?.focus();
      }
    }
  };

  const handleFocus = (e) => {
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.classList.remove('active');
    });
    e.target.classList.add('active');
  };

  const formatter = new Intl.NumberFormat('en-NP', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

  // Calculate expiry status
  const expiryStatus = calculateExpiryStatus(item);

  // Build CSS class string
  const rowClasses = [
    'dropdown-item',
    item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt',
    `expiry-${expiryStatus}`
  ].filter(Boolean).join(' ');



  return (
    <div
      data-index={index}
      className={rowClasses}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        alignItems: 'center',
        padding: '0 8px',
        borderBottom: '1px solid #eee',
        cursor: 'pointer',
        fontSize: '12px'
      }}
      onClick={handleClick}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    >
      <div>{item.uniqueNumber || 'N/A'}</div>
      <div>{item.hscode || 'N/A'}</div>
      <div className="dropdown-items-name">{item.name}</div>
      <div>{item.category?.name || 'No Category'}</div>
      <div>{item.stock || 0}</div>
      <div>{item.unit?.name || ''}</div>
      {/* <div>Rs.{item.latestPrice || 0}</div> */}
      <div>Rs.{formatter.format(item.latestPrice || 0)}</div>
    </div>
  );
});

const VirtualizedItemList = memo(({
  items,
  onItemClick,
  searchRef,
  hasMore,
  isSearching,
  onLoadMore,
  totalItems,
  page,
  searchQuery = ''
}) => {
  const itemHeight = 28;
  const containerRef = useRef(null);
  const loadingRef = useRef(false);
  const [visibleItems, setVisibleItems] = useState([]);

  // Filter items based on search state - limit to 15 when searching
  const displayedItems = useMemo(() => {
    if (!searchQuery.trim()) {
      // When not searching, show all items
      return items;
    }
    // When searching, show only first 15 items
    return items.slice(0, 15);
  }, [items, searchQuery]);

  // Update visible items based on display limit
  useEffect(() => {
    if (!searchQuery.trim()) {
      // When not searching, show all items
      setVisibleItems(items);
    } else {
      // When searching, limit to 15
      setVisibleItems(items.slice(0, 15));
    }
  }, [items, searchQuery]);

  // Load more items when reaching near the bottom
  const loadMoreItems = useCallback(() => {
    if (loadingRef.current || !hasMore || isSearching) return;

    loadingRef.current = true;
    onLoadMore();
    // Reset loading after a delay
    setTimeout(() => {
      loadingRef.current = false;
    }, 500);
  }, [hasMore, isSearching, onLoadMore]);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const clientHeight = container.clientHeight;
      const scrollHeight = container.scrollHeight;

      // Load more items when scrolled near bottom (90% threshold)
      if (!loadingRef.current && hasMore) {
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

        if (scrollPercentage > 0.9) {
          loadMoreItems();
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [hasMore, loadMoreItems]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '160px',
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div style={{ position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <ItemRow
            key={item._id || index}
            item={item}
            index={index}
            style={{
              height: `${itemHeight}px`,
              lineHeight: `${itemHeight}px`
            }}
            onItemClick={onItemClick}
            searchRef={searchRef}
          />
        ))}
      </div>
    </div>
  );
});

export default VirtualizedItemList;

//-----------------------------------------------------------------------------end

// import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';

// const ItemRow = memo(({ item, index, style, onItemClick, searchRef, setNotification }) => {
//   const handleClick = () => {
//     // Calculate total stock from stockEntries
//     const totalStock = item.stockEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;
    
//     if (totalStock === 0) {
//       // Show notification for zero stock using the setNotification function
//       setNotification({
//         show: true,
//         message: `Out of stock.`,
//         type: 'error'
//       });
//       return; // Prevent selection
//     }
    
//     onItemClick(item);
//   };

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter') {
//       e.preventDefault();
//       handleClick();
//     } else if (e.key === 'ArrowDown') {
//       e.preventDefault();
//       const nextItem = e.target.nextElementSibling;
//       if (nextItem) {
//         e.target.classList.remove('active');
//         nextItem.classList.add('active');
//         nextItem.focus();
//       }
//     } else if (e.key === 'ArrowUp') {
//       e.preventDefault();
//       const prevItem = e.target.previousElementSibling;
//       if (prevItem) {
//         e.target.classList.remove('active');
//         prevItem.classList.add('active');
//         prevItem.focus();
//       } else {
//         searchRef.current?.focus();
//       }
//     }
//   };

//   const handleFocus = (e) => {
//     document.querySelectorAll('.dropdown-item').forEach(item => {
//       item.classList.remove('active');
//     });
//     e.target.classList.add('active');
//   };

//   return (
//     <div
//       data-index={index}
//       className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'}`}
//       style={{
//         ...style,
//         display: 'grid',
//         gridTemplateColumns: 'repeat(7, 1fr)',
//         alignItems: 'center',
//         padding: '0 8px',
//         borderBottom: '1px solid #eee',
//         cursor: 'pointer',
//         fontSize: '12px'
//       }}
//       onClick={handleClick}
//       tabIndex={0}
//       onKeyDown={handleKeyDown}
//       onFocus={handleFocus}
//     >
//       <div>{item.uniqueNumber || 'N/A'}</div>
//       <div>{item.hscode || 'N/A'}</div>
//       <div className="dropdown-items-name">{item.name}</div>
//       <div>{item.category?.name || 'No Category'}</div>
//       <div>{item.stock || 0}</div>
//       <div>{item.unit?.name || ''}</div>
//       <div>Rs.{item.latestPrice || 0}</div>
//     </div>
//   );
// });

// const VirtualizedItemList = memo(({
//   items,
//   onItemClick,
//   searchRef,
//   hasMore,
//   isSearching,
//   onLoadMore,
//   totalItems,
//   page,
//   searchQuery = '',
//   setNotification // Add this prop to receive setNotification function
// }) => {
//   const itemHeight = 28;
//   const containerRef = useRef(null);
//   const loadingRef = useRef(false);
//   const [visibleItems, setVisibleItems] = useState([]);

//   // Filter items based on search state - limit to 15 when searching
//   const displayedItems = useMemo(() => {
//     if (!searchQuery.trim()) {
//       // When not searching, show all items
//       return items;
//     }
//     // When searching, show only first 15 items
//     return items.slice(0, 15);
//   }, [items, searchQuery]);

//   // Update visible items based on display limit
//   useEffect(() => {
//     if (!searchQuery.trim()) {
//       // When not searching, show all items
//       setVisibleItems(items);
//     } else {
//       // When searching, limit to 15
//       setVisibleItems(items.slice(0, 15));
//     }
//   }, [items, searchQuery]);

//   // Load more items when reaching near the bottom
//   const loadMoreItems = useCallback(() => {
//     if (loadingRef.current || !hasMore || isSearching) return;

//     loadingRef.current = true;
//     onLoadMore();
//     // Reset loading after a delay
//     setTimeout(() => {
//       loadingRef.current = false;
//     }, 500);
//   }, [hasMore, isSearching, onLoadMore]);

//   useEffect(() => {
//     const handleScroll = () => {
//       if (!containerRef.current) return;

//       const container = containerRef.current;
//       const scrollTop = container.scrollTop;
//       const clientHeight = container.clientHeight;
//       const scrollHeight = container.scrollHeight;

//       // Load more items when scrolled near bottom (90% threshold)
//       if (!loadingRef.current && hasMore) {
//         const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

//         if (scrollPercentage > 0.9) {
//           loadMoreItems();
//         }
//       }
//     };

//     const container = containerRef.current;
//     if (container) {
//       container.addEventListener('scroll', handleScroll);
//       return () => container.removeEventListener('scroll', handleScroll);
//     }
//   }, [hasMore, loadMoreItems]);

//   return (
//     <div
//       ref={containerRef}
//       style={{
//         height: '160px',
//         overflow: 'auto',
//         position: 'relative'
//       }}
//     >
//       <div style={{ position: 'relative' }}>
//         {visibleItems.map((item, index) => (
//           <ItemRow
//             key={item._id || index}
//             item={item}
//             index={index}
//             style={{
//               height: `${itemHeight}px`,
//               lineHeight: `${itemHeight}px`
//             }}
//             onItemClick={onItemClick}
//             searchRef={searchRef}
//             setNotification={setNotification} // Pass the setNotification function
//           />
//         ))}
//       </div>
//     </div>
//   );
// });

// export default VirtualizedItemList;
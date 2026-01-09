// import React, { useState, useRef, useEffect } from 'react';

// const VirtualizedAccountList = ({ 
//     accounts, 
//     onAccountClick, 
//     searchRef, 
//     hasMore, 
//     isSearching, 
//     onLoadMore,
//     totalAccounts,
//     page,
//     searchQuery
// }) => {
//     const [containerHeight, setContainerHeight] = useState(300);
//     const [itemHeight, setItemHeight] = useState(32);
//     const [visibleStartIndex, setVisibleStartIndex] = useState(0);
//     const containerRef = useRef(null);
//     const observerRef = useRef(null);

//     // Calculate visible items
//     const visibleItemCount = Math.ceil(containerHeight / itemHeight);
//     const visibleEndIndex = Math.min(visibleStartIndex + visibleItemCount + 5, accounts.length);
//     const visibleAccounts = accounts.slice(visibleStartIndex, visibleEndIndex);

//     // Handle scroll
//     const handleScroll = () => {
//         if (!containerRef.current) return;

//         const scrollTop = containerRef.current.scrollTop;
//         const newStartIndex = Math.floor(scrollTop / itemHeight);

//         if (newStartIndex !== visibleStartIndex) {
//             setVisibleStartIndex(newStartIndex);
//         }

//         // Check if we're near the bottom
//         const scrollHeight = containerRef.current.scrollHeight;
//         const clientHeight = containerRef.current.clientHeight;

//         if (scrollTop + clientHeight >= scrollHeight - 50) {
//             if (hasMore && !isSearching) {
//                 onLoadMore();
//             }
//         }
//     };

//     // Initialize container height
//     useEffect(() => {
//         if (containerRef.current) {
//             const height = containerRef.current.clientHeight;
//             setContainerHeight(height);
//         }
//     }, []);

//     // Setup intersection observer for lazy loading
//     useEffect(() => {
//         if (observerRef.current) {
//             observerRef.current.disconnect();
//         }

//         observerRef.current = new IntersectionObserver((entries) => {
//             if (entries[0].isIntersecting && hasMore && !isSearching) {
//                 onLoadMore();
//             }
//         }, { threshold: 0.1 });

//         const sentinel = document.querySelector('.sentinel');
//         if (sentinel && observerRef.current) {
//             observerRef.current.observe(sentinel);
//         }

//         return () => {
//             if (observerRef.current) {
//                 observerRef.current.disconnect();
//             }
//         };
//     }, [hasMore, isSearching, onLoadMore]);

//     // Handle keyboard navigation
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             if (!searchRef?.current || document.activeElement !== searchRef.current) return;

//             if (e.key === 'ArrowDown') {
//                 e.preventDefault();
//                 const firstAccountItem = document.querySelector('.account-item');
//                 if (firstAccountItem) {
//                     firstAccountItem.focus();
//                 }
//             }
//         };

//         document.addEventListener('keydown', handleKeyDown);
//         return () => {
//             document.removeEventListener('keydown', handleKeyDown);
//         };
//     }, [searchRef]);

//     return (
//         <div 
//             ref={containerRef}
//             className="account-list-container"
//             onScroll={handleScroll}
//             style={{ 
//                 height: '100%', 
//                 overflowY: 'auto',
//                 position: 'relative'
//             }}
//         >
//             {/* Spacer for virtualized items */}
//             <div 
//                 style={{ 
//                     height: `${visibleStartIndex * itemHeight}px`,
//                     width: '100%'
//                 }} 
//             />

//             {/* Visible accounts */}
//             {visibleAccounts.map((account, index) => {
//                 const actualIndex = visibleStartIndex + index;
//                 return (
//                     <div
//                         key={account._id || actualIndex}
//                         className={`account-item list-group-item py-1 px-2 ${actualIndex === 0 ? 'active' : ''}`}
//                         data-account-id={account._id}
//                         onClick={() => onAccountClick(account)}
//                         style={{
//                             cursor: 'pointer',
//                             fontSize: '0.75rem',
//                             minHeight: `${itemHeight}px`,
//                             position: 'absolute',
//                             top: `${(visibleStartIndex + index) * itemHeight}px`,
//                             left: 0,
//                             right: 0,
//                             borderBottom: '1px solid #dee2e6'
//                         }}
//                         tabIndex={0}
//                         onKeyDown={(e) => {
//                             if (e.key === 'Enter') {
//                                 e.preventDefault();
//                                 onAccountClick(account);
//                             } else if (e.key === 'ArrowDown') {
//                                 e.preventDefault();
//                                 const nextItem = document.querySelector(`.account-item:nth-child(${actualIndex + 2})`);
//                                 if (nextItem) {
//                                     e.target.classList.remove('active');
//                                     nextItem.classList.add('active');
//                                     nextItem.focus();
//                                 }
//                             } else if (e.key === 'ArrowUp') {
//                                 e.preventDefault();
//                                 const prevItem = document.querySelector(`.account-item:nth-child(${actualIndex})`);
//                                 if (prevItem) {
//                                     e.target.classList.remove('active');
//                                     prevItem.classList.add('active');
//                                     prevItem.focus();
//                                 } else {
//                                     searchRef?.current?.focus();
//                                 }
//                             } else if (e.key === 'Escape') {
//                                 e.preventDefault();
//                                 searchRef?.current?.focus();
//                             }
//                         }}
//                         onFocus={(e) => {
//                             document.querySelectorAll('.account-item').forEach(item => {
//                                 item.classList.remove('active');
//                             });
//                             e.target.classList.add('active');
//                         }}
//                     >
//                         <div className="d-flex justify-content-between align-items-center" style={{ lineHeight: '1.2' }}>
//                             <div>
//                                 <strong style={{ fontSize: '0.8rem' }}>
//                                     {account.uniqueNumber || 'N/A'} {account.name}
//                                 </strong>
//                                 <div style={{ fontSize: '0.7rem', color: '#6c757d' }}>
//                                     📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}
//                                 </div>
//                             </div>
//                             <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
//                                 Balance: Rs. {account.balance?.toFixed(2) || '0.00'}
//                             </div>
//                         </div>
//                     </div>
//                 );
//             })}

//             {/* Loading indicator or end message */}
//             <div className="sentinel" style={{ height: '50px', position: 'relative' }}>
//                 {isSearching ? (
//                     <div className="text-center py-2">
//                         <div className="spinner-border spinner-border-sm" role="status">
//                             <span className="visually-hidden">Loading...</span>
//                         </div>
//                         <small className="text-muted">Loading more accounts...</small>
//                     </div>
//                 ) : hasMore ? (
//                     <div className="text-center py-2">
//                         <small className="text-muted">
//                             Scroll down to load more ({accounts.length} of {totalAccounts} accounts shown)
//                         </small>
//                     </div>
//                 ) : accounts.length > 0 ? (
//                     <div className="text-center py-2">
//                         <small className="text-muted">
//                             Showing all {totalAccounts} accounts
//                         </small>
//                     </div>
//                 ) : (
//                     <div className="text-center py-3 text-muted">
//                         {searchQuery ? 'No accounts found' : 'No accounts available'}
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default VirtualizedAccountList;

//-------------------------------------------------------------------end

// import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';

// const AccountRow = memo(({ account, index, style, onAccountClick, searchRef }) => {
//   const handleClick = () => onAccountClick(account);

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter') {
//       e.preventDefault();
//       onAccountClick(account);
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
//     } else if (e.key === 'Escape') {
//       e.preventDefault();
//       // Focus will be handled by parent component
//     }
//   };

//   const handleFocus = (e) => {
//     document.querySelectorAll('.account-item').forEach(item => {
//       item.classList.remove('active');
//     });
//     e.target.classList.add('active');
//   };

//   return (
//     <div
//       data-index={index}
//       className="account-item list-group-item py-1 px-2"
//       style={{
//         ...style,
//         cursor: 'pointer',
//         fontSize: '0.75rem',
//         borderBottom: '1px solid #dee2e6',
//         display: 'flex',
//         flexDirection: 'column',
//         justifyContent: 'center'
//       }}
//       onClick={handleClick}
//       tabIndex={0}
//       onKeyDown={handleKeyDown}
//       onFocus={handleFocus}
//     >
//       <div className="d-flex justify-content-between align-items-center" style={{ lineHeight: '1.2' }}>
//         <div>
//           <strong style={{ fontSize: '0.8rem' }}>
//             {account.uniqueNumber || 'N/A'} {account.name}
//           </strong>
//           <div style={{ fontSize: '0.7rem', color: '#6c757d' }}>
//             📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'}
//           </div>
//         </div>
//         <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
//           Balance: Rs. {account.balance?.toFixed(2) || '0.00'}
//         </div>
//       </div>
//     </div>
//   );
// });

// const VirtualizedAccountList = memo(({
//   accounts,
//   onAccountClick,
//   searchRef,
//   hasMore,
//   isSearching,
//   onLoadMore,
//   totalAccounts,
//   page,
//   searchQuery = ''
// }) => {
//   const itemHeight = 48; // Slightly larger for account items
//   const containerRef = useRef(null);
//   const loadingRef = useRef(false);
//   const [visibleAccounts, setVisibleAccounts] = useState([]);

//   // Filter accounts based on search state
//   const displayedAccounts = useMemo(() => {
//     if (!searchQuery.trim()) {
//       // When not searching, show all accounts
//       return accounts;
//     }
//     // When searching, show only first 15 items
//     return accounts.slice(0, 15);
//   }, [accounts, searchQuery]);

//   // Update visible accounts based on display limit
//   useEffect(() => {
//     if (!searchQuery.trim()) {
//       // When not searching, show all accounts
//       setVisibleAccounts(accounts);
//     } else {
//       // When searching, limit to 15
//       setVisibleAccounts(accounts.slice(0, 15));
//     }
//   }, [accounts, searchQuery]);

//   // Handle scroll for keyboard navigation from search input
//   useEffect(() => {
//     const handleKeyDown = (e) => {
//       if (!searchRef?.current || document.activeElement !== searchRef.current) return;

//       if (e.key === 'ArrowDown') {
//         e.preventDefault();
//         const firstAccountItem = containerRef.current?.querySelector('.account-item');
//         if (firstAccountItem) {
//           // Remove active class from all items
//           containerRef.current?.querySelectorAll('.account-item').forEach(item => {
//             item.classList.remove('active');
//           });

//           // Add active class to first item
//           firstAccountItem.classList.add('active');
//           firstAccountItem.focus();

//           // Scroll to the first item
//           if (containerRef.current) {
//             containerRef.current.scrollTop = 0;
//           }
//         }
//       }
//     };

//     document.addEventListener('keydown', handleKeyDown);
//     return () => {
//       document.removeEventListener('keydown', handleKeyDown);
//     };
//   }, [searchRef]);

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

//   // Scroll handler for infinite scrolling
//   useEffect(() => {
//     const handleScroll = () => {
//       if (!containerRef.current || loadingRef.current) return;

//       const container = containerRef.current;
//       const scrollTop = container.scrollTop;
//       const clientHeight = container.clientHeight;
//       const scrollHeight = container.scrollHeight;

//       // Load more items when scrolled near bottom (90% threshold)
//       if (hasMore && !isSearching) {
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
//   }, [hasMore, isSearching, loadMoreItems]);

//   return (
//     <div
//       ref={containerRef}
//       style={{
//         height: 'calc(320px - 40px)', // Match the modal body height
//         overflowY: 'auto',
//         position: 'relative'
//       }}
//     >
//       <div style={{ position: 'relative' }}>
//         {visibleAccounts.map((account, index) => (
//           <AccountRow
//             key={account._id || index}
//             account={account}
//             index={index}
//             style={{
//               height: `${itemHeight}px`,
//               lineHeight: 'normal'
//             }}
//             onAccountClick={onAccountClick}
//             searchRef={searchRef}
//           />
//         ))}
//       </div>
//     </div>
//   );
// });

// export default VirtualizedAccountList;

//----------------------------------------------------------------------end

// import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';

// const AccountRow = memo(({ account, index, style, onAccountClick, searchRef }) => {
//     const handleClick = () => onAccountClick(account);

//     const handleKeyDown = (e) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();
//             onAccountClick(account);
//         } else if (e.key === 'ArrowDown') {
//             e.preventDefault();
//             const nextItem = e.target.nextElementSibling;
//             if (nextItem) {
//                 e.target.classList.remove('active');
//                 nextItem.classList.add('active');
//                 nextItem.focus();
//             }
//         } else if (e.key === 'ArrowUp') {
//             e.preventDefault();
//             const prevItem = e.target.previousElementSibling;
//             if (prevItem) {
//                 e.target.classList.remove('active');
//                 prevItem.classList.add('active');
//                 prevItem.focus();
//             } else {
//                 searchRef.current?.focus();
//             }
//         } else if (e.key === 'Escape') {
//             e.preventDefault();
//             // Focus will be handled by parent component
//         }
//     };

//     const handleFocus = (e) => {
//         document.querySelectorAll('.account-item').forEach(item => {
//             item.classList.remove('active');
//         });
//         e.target.classList.add('active');
//     };

//     return (
//         <div
//             data-index={index}
//             className="account-item list-group-item py-1 px-2"
//             style={{
//                 ...style,
//                 cursor: 'pointer',
//                 fontSize: '0.75rem',
//                 borderBottom: '1px solid #dee2e6',
//                 display: 'flex',
//                 flexDirection: 'column',
//                 justifyContent: 'center'
//             }}
//             onClick={handleClick}
//             tabIndex={0}
//             onKeyDown={handleKeyDown}
//             onFocus={handleFocus}
//         >
//             <div className="d-flex justify-content-between align-items-center" style={{ lineHeight: '1.2' }}>
//                 <strong style={{ fontSize: '0.8rem' }}>
//                     {account.uniqueNumber || 'N/A'} {account.name}
//                 </strong>
//                 <span style={{ fontSize: '0.7rem' }}>
//                     📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'} | Balance: Rs. {account.balance?.toFixed(2) || '0.00'}
//                 </span>
//             </div>
//         </div>
//     );
// });

// const VirtualizedAccountList = memo(({
//     accounts,
//     onAccountClick,
//     searchRef,
//     hasMore,
//     isSearching,
//     onLoadMore,
//     totalAccounts,
//     page,
//     searchQuery = ''
// }) => {
//     const itemHeight = 32; // Reduced height since we're using single line
//     const containerRef = useRef(null);
//     const loadingRef = useRef(false);
//     const [visibleAccounts, setVisibleAccounts] = useState([]);

//     // Filter accounts based on search state
//     const displayedAccounts = useMemo(() => {
//         if (!searchQuery.trim()) {
//             // When not searching, show all accounts
//             return accounts;
//         }
//         // When searching, show only first 15 items
//         return accounts.slice(0, 15);
//     }, [accounts, searchQuery]);

//     // Update visible accounts based on display limit
//     useEffect(() => {
//         if (!searchQuery.trim()) {
//             // When not searching, show all accounts
//             setVisibleAccounts(accounts);
//         } else {
//             // When searching, limit to 15
//             setVisibleAccounts(accounts.slice(0, 15));
//         }
//     }, [accounts, searchQuery]);

//     // Handle scroll for keyboard navigation from search input
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             if (!searchRef?.current || document.activeElement !== searchRef.current) return;

//             if (e.key === 'ArrowDown') {
//                 e.preventDefault();
//                 const firstAccountItem = containerRef.current?.querySelector('.account-item');
//                 if (firstAccountItem) {
//                     // Remove active class from all items
//                     containerRef.current?.querySelectorAll('.account-item').forEach(item => {
//                         item.classList.remove('active');
//                     });

//                     // Add active class to first item
//                     firstAccountItem.classList.add('active');
//                     firstAccountItem.focus();

//                     // Scroll to the first item
//                     if (containerRef.current) {
//                         containerRef.current.scrollTop = 0;
//                     }
//                 }
//             }
//         };

//         document.addEventListener('keydown', handleKeyDown);
//         return () => {
//             document.removeEventListener('keydown', handleKeyDown);
//         };
//     }, [searchRef]);

//     // Load more items when reaching near the bottom
//     const loadMoreItems = useCallback(() => {
//         if (loadingRef.current || !hasMore || isSearching) return;

//         loadingRef.current = true;
//         onLoadMore();
//         // Reset loading after a delay
//         setTimeout(() => {
//             loadingRef.current = false;
//         }, 500);
//     }, [hasMore, isSearching, onLoadMore]);

//     // Scroll handler for infinite scrolling
//     useEffect(() => {
//         const handleScroll = () => {
//             if (!containerRef.current || loadingRef.current) return;

//             const container = containerRef.current;
//             const scrollTop = container.scrollTop;
//             const clientHeight = container.clientHeight;
//             const scrollHeight = container.scrollHeight;

//             // Load more items when scrolled near bottom (90% threshold)
//             if (hasMore && !isSearching) {
//                 const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

//                 if (scrollPercentage > 0.9) {
//                     loadMoreItems();
//                 }
//             }
//         };

//         const container = containerRef.current;
//         if (container) {
//             container.addEventListener('scroll', handleScroll);
//             return () => container.removeEventListener('scroll', handleScroll);
//         }
//     }, [hasMore, isSearching, loadMoreItems]);

//     return (
//         <div
//             ref={containerRef}
//             style={{
//                 height: 'calc(320px - 40px)', // Match the modal body height
//                 overflowY: 'auto',
//                 position: 'relative'
//             }}
//         >
//             <div style={{ position: 'relative' }}>
//                 {visibleAccounts.map((account, index) => (
//                     <AccountRow
//                         key={account._id || index}
//                         account={account}
//                         index={index}
//                         style={{
//                             height: `${itemHeight}px`,
//                             lineHeight: 'normal'
//                         }}
//                         onAccountClick={onAccountClick}
//                         searchRef={searchRef}
//                     />
//                 ))}
//             </div>
//         </div>
//     );
// });

// export default VirtualizedAccountList;

//--------------------------------------------------------------------------end

// import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';

// const AccountRow = memo(({ account, index, style, onAccountClick, searchRef }) => {
//     const handleClick = () => onAccountClick(account);

//     const handleKeyDown = (e) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();
//             onAccountClick(account);
//         } else if (e.key === 'ArrowDown') {
//             e.preventDefault();
//             const nextItem = e.target.nextElementSibling;
//             if (nextItem) {
//                 e.target.classList.remove('active');
//                 nextItem.classList.add('active');
//                 nextItem.focus();
//             }
//         } else if (e.key === 'ArrowUp') {
//             e.preventDefault();
//             const prevItem = e.target.previousElementSibling;
//             if (prevItem) {
//                 e.target.classList.remove('active');
//                 prevItem.classList.add('active');
//                 prevItem.focus();
//             } else {
//                 searchRef.current?.focus();
//             }
//         } else if (e.key === 'Escape') {
//             e.preventDefault();
//             // Focus will be handled by parent component
//         }
//     };

//     const handleFocus = (e) => {
//         document.querySelectorAll('.account-item').forEach(item => {
//             item.classList.remove('active');
//         });
//         e.target.classList.add('active');
//     };

//     return (
//         <div
//             data-index={index}
//             className="account-item list-group-item py-1 px-2"
//             style={{
//                 ...style,
//                 cursor: 'pointer',
//                 fontSize: '0.75rem',
//                 borderBottom: '1px solid #dee2e6',
//                 display: 'flex',
//                 flexDirection: 'column',
//                 justifyContent: 'center'
//             }}
//             onClick={handleClick}
//             tabIndex={0}
//             onKeyDown={handleKeyDown}
//             onFocus={handleFocus}
//         >
//             <div className="d-flex justify-content-between align-items-center" style={{ lineHeight: '1.2' }}>
//                 <strong style={{ fontSize: '0.8rem' }}>
//                     {account.uniqueNumber || 'N/A'} {account.name}
//                 </strong>
//                 <span style={{ fontSize: '0.7rem' }}>
//                     📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'} | Balance: Rs. {account.balance?.toFixed(2) || '0.00'}
//                 </span>
//             </div>
//         </div>
//     );
// });

// const VirtualizedAccountList = memo(({
//     accounts,
//     onAccountClick,
//     searchRef,
//     hasMore,
//     isSearching,
//     onLoadMore,
//     totalAccounts,
//     page,
//     searchQuery = ''
// }) => {
//     const itemHeight = 32;
//     const containerRef = useRef(null);
//     const loadingRef = useRef(false);
//     const [visibleAccounts, setVisibleAccounts] = useState([]);

//     // Filter accounts based on search state
//     const displayedAccounts = useMemo(() => {
//         if (!searchQuery.trim()) {
//             return accounts;
//         }
//         return accounts.slice(0, 15);
//     }, [accounts, searchQuery]);

//     // Update visible accounts based on display limit
//     useEffect(() => {
//         if (!searchQuery.trim()) {
//             setVisibleAccounts(accounts);
//         } else {
//             setVisibleAccounts(accounts.slice(0, 15));
//         }
//     }, [accounts, searchQuery]);

//     // Handle scroll for keyboard navigation from search input
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             if (!searchRef?.current || document.activeElement !== searchRef.current) return;

//             if (e.key === 'ArrowDown') {
//                 e.preventDefault();
//                 const firstAccountItem = containerRef.current?.querySelector('.account-item');
//                 if (firstAccountItem) {
//                     containerRef.current?.querySelectorAll('.account-item').forEach(item => {
//                         item.classList.remove('active');
//                     });

//                     firstAccountItem.classList.add('active');
//                     firstAccountItem.focus();

//                     if (containerRef.current) {
//                         containerRef.current.scrollTop = 0;
//                     }
//                 }
//             }
//         };

//         document.addEventListener('keydown', handleKeyDown);
//         return () => {
//             document.removeEventListener('keydown', handleKeyDown);
//         };
//     }, [searchRef]);

//     // Load more items when reaching near the bottom
//     const loadMoreItems = useCallback(() => {
//         if (loadingRef.current || !hasMore || isSearching) return;

//         loadingRef.current = true;
//         onLoadMore();
//         setTimeout(() => {
//             loadingRef.current = false;
//         }, 500);
//     }, [hasMore, isSearching, onLoadMore]);

//     // Scroll handler for infinite scrolling
//     useEffect(() => {
//         const handleScroll = () => {
//             if (!containerRef.current || loadingRef.current) return;

//             const container = containerRef.current;
//             const scrollTop = container.scrollTop;
//             const clientHeight = container.clientHeight;
//             const scrollHeight = container.scrollHeight;

//             if (hasMore && !isSearching) {
//                 const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

//                 if (scrollPercentage > 0.9) {
//                     loadMoreItems();
//                 }
//             }
//         };

//         const container = containerRef.current;
//         if (container) {
//             container.addEventListener('scroll', handleScroll);
//             return () => container.removeEventListener('scroll', handleScroll);
//         }
//     }, [hasMore, isSearching, loadMoreItems]);

//     // Show no accounts found message
//     if (accounts.length === 0) {
//         return (
//             <div style={{
//                 height: 'calc(320px - 40px)',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 backgroundColor: '#f8f9fa'
//             }}>
//                 <div className="text-center text-muted">
//                     <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
//                         {searchQuery ? 'No accounts found' : 'No accounts available'}
//                     </div>
//                     <div className="small">
//                         <small className="text-info">
//                             {searchQuery ? 'Try a different search term' : 'Press F6 to create a new account'}
//                         </small>
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div
//             ref={containerRef}
//             style={{
//                 height: 'calc(320px - 40px)',
//                 overflowY: 'auto',
//                 position: 'relative'
//             }}
//         >
//             <div style={{ position: 'relative' }}>
//                 {visibleAccounts.map((account, index) => (
//                     <AccountRow
//                         key={account._id || index}
//                         account={account}
//                         index={index}
//                         style={{
//                             height: `${itemHeight}px`,
//                             lineHeight: 'normal'
//                         }}
//                         onAccountClick={onAccountClick}
//                         searchRef={searchRef}
//                     />
//                 ))}
//             </div>
//         </div>
//     );
// });

// export default VirtualizedAccountList;

//-----------------------------------------------------------------------------end

import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';

const AccountRow = memo(({ account, index, style, onAccountClick, searchRef }) => {
    const handleClick = () => onAccountClick(account);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onAccountClick(account);
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
        } else if (e.key === 'Escape') {
            e.preventDefault();
            // Focus will be handled by parent component
        }
    };

    const handleFocus = (e) => {
        document.querySelectorAll('.account-item').forEach(item => {
            item.classList.remove('active');
        });
        e.target.classList.add('active');
    };

    return (
        <div
            data-index={index}
            data-account-id={account._id}
            className="account-item list-group-item py-1 px-2"
            style={{
                ...style,
                cursor: 'pointer',
                fontSize: '0.75rem',
                borderBottom: '1px solid #dee2e6',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
            }}
            onClick={handleClick}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
        >
            <div className="d-flex justify-content-between align-items-center" style={{ lineHeight: '1.2' }}>
                <strong style={{ fontSize: '0.8rem' }}>
                    {account.uniqueNumber || 'N/A'} {account.name}
                </strong>
                <span style={{ fontSize: '0.7rem' }}>
                    📍 {account.address || 'N/A'} | 🆔 PAN: {account.pan || 'N/A'} | Balance: Rs. {account.balance?.toFixed(2) || '0.00'}
                </span>
            </div>
        </div>
    );
});

const VirtualizedAccountList = memo(({
    accounts,
    onAccountClick,
    searchRef,
    hasMore,
    isSearching,
    onLoadMore,
    totalAccounts,
    page,
    searchQuery = ''
}) => {
    const itemHeight = 32;
    const containerRef = useRef(null);
    const loadingRef = useRef(false);
    const [visibleAccounts, setVisibleAccounts] = useState([]);

    // Filter accounts based on search state
    const displayedAccounts = useMemo(() => {
        if (!searchQuery.trim()) {
            return accounts;
        }
        return accounts.slice(0, 15);
    }, [accounts, searchQuery]);

    // Update visible accounts based on display limit
    useEffect(() => {
        if (!searchQuery.trim()) {
            setVisibleAccounts(accounts);
        } else {
            setVisibleAccounts(accounts.slice(0, 15));
        }
    }, [accounts, searchQuery]);

    // Handle scroll for keyboard navigation from search input
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!searchRef?.current || document.activeElement !== searchRef.current) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const firstAccountItem = containerRef.current?.querySelector('.account-item');
                if (firstAccountItem) {
                    containerRef.current?.querySelectorAll('.account-item').forEach(item => {
                        item.classList.remove('active');
                    });

                    firstAccountItem.classList.add('active');
                    firstAccountItem.focus();

                    if (containerRef.current) {
                        containerRef.current.scrollTop = 0;
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [searchRef]);

    // Load more items when reaching near the bottom
    const loadMoreItems = useCallback(() => {
        if (loadingRef.current || !hasMore || isSearching) return;

        loadingRef.current = true;
        onLoadMore();
        setTimeout(() => {
            loadingRef.current = false;
        }, 500);
    }, [hasMore, isSearching, onLoadMore]);

    // Scroll handler for infinite scrolling
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current || loadingRef.current) return;

            const container = containerRef.current;
            const scrollTop = container.scrollTop;
            const clientHeight = container.clientHeight;
            const scrollHeight = container.scrollHeight;

            if (hasMore && !isSearching) {
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
    }, [hasMore, isSearching, loadMoreItems]);

    // Show no accounts found message
    if (accounts.length === 0) {
        return (
            <div style={{
                height: 'calc(320px - 40px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8f9fa'
            }}>
                <div className="text-center text-muted">
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        {searchQuery ? 'No accounts found' : 'No accounts available'}
                    </div>
                    <div className="small">
                        <small className="text-info">
                            {searchQuery ? 'Try a different search term' : 'Press F6 to create a new account'}
                        </small>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                height: 'calc(320px - 40px)',
                overflowY: 'auto',
                position: 'relative'
            }}
        >
            <div style={{ position: 'relative' }}>
                {visibleAccounts.map((account, index) => (
                    <AccountRow
                        key={account._id || index}
                        account={account}
                        index={index}
                        style={{
                            height: `${itemHeight}px`,
                            lineHeight: 'normal'
                        }}
                        onAccountClick={onAccountClick}
                        searchRef={searchRef}
                    />
                ))}
            </div>
        </div>
    );
});

export default VirtualizedAccountList;
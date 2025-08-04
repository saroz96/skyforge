import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';
import { BiSun, BiMoon } from 'react-icons/bi';
import '../../stylesheet/retailer/Header.css';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import Footer from './Footer';

const Header = () => {
  const { logout, currentUser, hasPermission } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [companyData, setCompanyData] = useState({
    name: '',
    renewalDate: null
  });
  const [fiscalYear, setFiscalYear] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch user data
        const userRes = await axios.get('/api/auth/me');
        const userData = userRes.data.user;
        setUser(userData);

        // Fetch company and fiscal year data in parallel
        const [companyRes, fiscalRes] = await Promise.all([
          axios.get('/api/auth/my-company'),
        ]);

        setCompanyData({
          name: companyRes.data.currentCompanyName,
          renewalDate: companyRes.data.company?.renewalDate
        });

        setFiscalYear(companyRes.data.currentFiscalYear || fiscalRes.data);

        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const isAdminOrSupervisor = currentUser?.isAdmin || currentUser?.role === 'Supervisor' || user?.role === 'ADMINISTRATOR' || user?.role === 'Admin';

  return (
    <div className='header-container'>
      <Footer
        currentCompanyName={companyData.name}
        user={user}
        currentFiscalYear={fiscalYear}
        company={companyData}
      />
      <header className="header">
        <div className="header-row container-fluid" role="navigation">
          {/* Desktop Menu */}
          <div className="header-right">
            <ul className="main-menu">
              <li className="menu-item">
                <Link to="/retailerDashboard/indexv1" className="active" id="home">
                  Home
                </Link>
              </li>

              {/* Accounts Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                user?.menuPermissions?.get('AccountsHeader')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Accounts
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                          user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('Account')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/accounts">Account</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('AccountGroup')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/account-group">Account Group</Link>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* Items Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                user?.menuPermissions?.get('itemsHeader')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Items
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                          user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('createItem')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/items">Item</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                          user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('category')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/categories">Category</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                          user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('company')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/items-company">Company</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                          user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('unit')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/units">Unit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                          user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('mainUnit')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/mainUnits">Main Unit</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' ||
                          user?.role === 'Purchase' || user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('composition')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/compositions">Composition</Link>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* Sales Department Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                user?.menuPermissions?.get('salesDepartment')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Sales Department
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('salesQuotation')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Sales Quotation</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/retailer/sales-quotation">Add</Link>
                                </li>
                                <li className="menu-item">
                                  <Link to="#">Edit</Link>
                                </li>
                                <li className="menu-item">
                                  <Link to="/retailer/sales-quotation/list">List</Link>
                                </li>
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('creditSales')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Credit Sales</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/credit-sales">Add Sales</Link>
                                </li>
                                <li className="menu-item">
                                  <Link to="/api/retailer/credit-sales/open">Add Sales Open</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                                  user?.menuPermissions?.get('creditSalesModify')) && (
                                    <li className="menu-item">
                                      <Link to="/sales-bills/finds">Edit Sales</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('cashSales')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Cash Sales</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/cash-sales">Add Sales</Link>
                                </li>
                                <li className="menu-item">
                                  <Link to="/api/retailer/cash-sales/open">Add Sales Open</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                                  user?.menuPermissions?.get('cashSalesModify')) && (
                                    <li className="menu-item">
                                      <Link to="/cash-sales/sales-bills/finds">Edit Sales</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('salesRegister')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/sales-register">Sales Register</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('creditSalesRtn')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Credit Sales Rtn</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/sales-return">Add</Link>
                                </li>
                                <li className="menu-item">
                                  <Link to="/sales-return/finds">Edit</Link>
                                </li>
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('cashSalesRtn')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Cash Sales Rtn</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/cash/sales-return">Add</Link>
                                </li>
                                <li className="menu-item">
                                  <Link to="/cash-sales-return/sales-return/finds">Edit</Link>
                                </li>
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Sales' || user?.isAdmin ||
                          user?.menuPermissions?.get('salesRtnRegister')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/sales-return/register">Sales Rtn Register</Link>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* Purchase Department Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                user?.role === 'Account' || user?.isAdmin ||
                user?.menuPermissions?.get('purchaseDepartment')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Purchase Department
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                          user?.role === 'Account' || user?.isAdmin ||
                          user?.menuPermissions?.get('createPurchase')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Purchase</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/purchase">Add</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                                  user?.role === 'Account' || user?.isAdmin ||
                                  user?.menuPermissions?.get('purchaseModify')) && (
                                    <li className="menu-item">
                                      <Link to="/api/retailer/purchase/finds">Edit</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                                  user?.role === 'Account' || user?.isAdmin ||
                                  user?.menuPermissions?.get('purchaseRegister')) && (
                                    <li className="menu-item">
                                      <Link to="/api/retailer/purchase-register">Purchase Register</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                          user?.isAdmin || user?.menuPermissions?.get('createPurchaseRtn')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Purchase Return</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/purchase-return">Add</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                                  user?.isAdmin || user?.menuPermissions?.get('purchaseRtnModify')) && (
                                    <li className="menu-item">
                                      <Link to="/purchase-return/finds">Edit</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                                  user?.isAdmin || user?.menuPermissions?.get('purchaseRtnRegister')) && (
                                    <li className="menu-item">
                                      <Link to="/api/retailer/purchase-return/register">Purchase Rtn Register</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* Inventory Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase'
                || user?.role === 'Sales' || user?.role === 'Account' ||
                user?.isAdmin || user?.menuPermissions?.get('inventoryHeader')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Inventory
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase'
                          || user?.role === 'Sales' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('itemLedger')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/items-ledger">Item Ledger</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('createStockAdj')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Stock Adjustment</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/stockAdjustments/new">Add</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                                  user?.isAdmin || user?.menuPermissions?.get('stockAdjRegister')) && (
                                    <li className="menu-item">
                                      <Link to="/api/retailer/stockAdjustments/register">Stock Adj. Register</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('storeRackSubHeader')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Store/Rack</Link>
                              <ul className="sub-menu">
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                                  user?.isAdmin || user?.menuPermissions?.get('store')) && (
                                    <li className="menu-item">
                                      <Link to="/retailer/store/management">Store</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                                  user?.isAdmin || user?.menuPermissions?.get('rack')) && (
                                    <li className="menu-item">
                                      <Link to="/retailer/rack/management">Rack</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('stockStatus')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/stock-status">Stock Status</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                          user?.isAdmin || user?.menuPermissions?.get('reorderLevel')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/items/reorder">Re Order Level</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' ||
                          user?.isAdmin || user?.menuPermissions?.get('itemSalesReport')) && (
                            <li className="menu-item">
                              <Link to="/api/sold-items">Item Sales Report</Link>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* Account Department Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' || user?.role === 'Account' ||
                user?.isAdmin || user?.menuPermissions?.get('accountDepartment')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Account Department
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('payment')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Payment</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/payments">Add</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('paymentModify')) && (
                                    <li className="menu-item">
                                      <Link to="/api/retailer/payments/finds">Edit</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Purchase' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('paymentRegister')) && (
                                    <li className="menu-item">
                                      <Link to="/api/retailer/payments/register">List</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('receipt')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Receipt</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/api/retailer/receipts">Add</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('receiptModify')) && (
                                    <li className="menu-item">
                                      <Link to="/api/retailer/receipts/finds">Edit</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('receiptRegister')) && (
                                    <li className="menu-item">
                                      <Link to="/api/retailer/receipts/register">List</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('journal')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Journal</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/journal/new">Add</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('journalModify')) && (
                                    <li className="menu-item">
                                      <Link to="/journals/finds">Edit</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('journalRegister')) && (
                                    <li className="menu-item">
                                      <Link to="/journal/list">List</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('debitNote')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Debit Note</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/debit-note/new">Add</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('debitNoteModify')) && (
                                    <li className="menu-item">
                                      <Link to="/debitnote/finds">Edit</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('debitNoteRegister')) && (
                                    <li className="menu-item">
                                      <Link to="/debit-note/list">List</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('creditNote')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Credit Note</Link>
                              <ul className="sub-menu">
                                <li className="menu-item">
                                  <Link to="/credit-note/new">Add</Link>
                                </li>
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('creditNoteModify')) && (
                                    <li className="menu-item">
                                      <Link to="/creditnote/finds">Edit</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('creditNoteRegister')) && (
                                    <li className="menu-item">
                                      <Link to="/credit-note/list">List</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* Outstanding Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                user?.isAdmin || user?.menuPermissions?.get('outstandingHeader')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Outstanding
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('ageingSubHeader')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Ageing</Link>
                              <ul className="sub-menu">
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('ageingFIFO')) && (
                                    <li className="menu-item">
                                      <Link to="/aging/accounts">Ageing(FIFO)</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('ageingDayWise')) && (
                                    <li className="menu-item">
                                      <Link to="/day-count-aging">Day Wise</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('ageingAllParty')) && (
                                    <li className="menu-item">
                                      <Link to="/ageing-all/accounts">All Party</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('statements')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/statement">Statements</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                          user?.isAdmin || user?.menuPermissions?.get('reportsSubHeader')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Reports</Link>
                              <ul className="sub-menu">
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('dailyProfitSaleAnalysis')) && (
                                    <li className="menu-item">
                                      <Link to="/retailer/daily-profit/sales-analysis">Daily Profit/Sale Analysis</Link>
                                    </li>
                                  )}
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' || user?.role === 'Account' ||
                                  user?.isAdmin || user?.menuPermissions?.get('invoiceWiseProfitLoss')) && (
                                    <li className="menu-item">
                                      <Link to="/retailer/invoice-wise-profit-loss">Invoice Wise Profit & Loss</Link>
                                    </li>
                                  )}
                              </ul>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* Vat Summary Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                user?.isAdmin || user?.menuPermissions?.get('vatSummaryHeader')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Vat Summary
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('salesVatRegister')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/sales-vat-report">Sales Vat Register</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('salesRtnVatRegister')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/salesReturn-vat-report">Sales Return Register</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('purchaseVatRegister')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/purchase-vat-report">Purchase Vat Register</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('purchaseRtnVatRegister')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/purchaseReturn-vat-report">Purchase Return Register</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('monthlyVatSummary')) && (
                            <li className="menu-item">
                              <Link to="/api/retailer/monthly-vat-summary">Monthly Vat Summary</Link>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* Configuration Menu */}
              {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                user?.isAdmin || user?.menuPermissions?.get('configurationHeader')) && (
                  <li className="menu-item dropdown">
                    <Link to="#" className="active">
                      Configuration
                    </Link>
                    <div className="sub-menu-wrapper slideInUp">
                      <ul className="sub-menu">
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('voucherConfiguration')) && (
                            <li className="menu-item">
                              <Link to="/settings">Voucher Configuration</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('changeFiscalYear')) && (
                            <li className="menu-item">
                              <Link to="/change-fiscal-year">Change Fiscal Year</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('existingFiscalYear')) && (
                            <li className="menu-item">
                              <Link to="/switch-fiscal-year">Existing Fiscal Year</Link>
                            </li>
                          )}
                        {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                          user?.isAdmin || user?.menuPermissions?.get('importExportSubHeader')) && (
                            <li className="menu-item dropdown">
                              <Link to="#">Import</Link>
                              <ul className="sub-menu">
                                {(user?.role === 'ADMINISTRATOR' || user?.role === 'Supervisor' ||
                                  user?.isAdmin || user?.menuPermissions?.get('itemsImport')) && (
                                    <>
                                      <li className="menu-item">
                                        <Link to="/items-import">Items Import</Link>
                                      </li>
                                      <li className="menu-item">
                                        <Link to="/accounts-import">Accounts Import</Link>
                                      </li>
                                    </>
                                  )}
                              </ul>
                            </li>
                          )}
                      </ul>
                    </div>
                  </li>
                )}

              {/* User Profile Menu */}
              <li className="menu-item dropdown">
                <Link to="#" className="active">
                  <i className="bi bi-person" style={{ fontSize: '20px' }}></i>
                </Link>
                <div className="sub-menu-wrapper slideInUp">
                  <ul className="sub-menu">
                    {isAdminOrSupervisor ? (
                      <li className="menu-item">
                        <Link to={`/api/auth/admin/users/view/${user?._id}`}>{user?.name}</Link>
                      </li>
                    ) : (
                      <li className="menu-item">
                        <Link to={`/api/auth/account/users/view/${user?._id}`}>{user?.name}</Link>
                      </li>
                    )}
                    <li className="menu-item">
                      <Link to="/api/auth/user/change-password">Change Password</Link>
                    </li>
                    {isAdminOrSupervisor && (
                      <>
                        <li className="menu-item">
                          <Link to="/api/auth/admin/users/list">Users</Link>
                        </li>
                      </>
                    )}
                    <li className="menu-item">
                      <Link to="/dashboard">My Company</Link>
                    </li>
                    <li className="menu-item">
                      <button
                        onClick={logout}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              </li>

              {/* Theme Toggle */}
              <li className="menu-item theme-toggle-container">
                <div className="theme-toggle">
                  <button
                    id="theme-switcher"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={toggleTheme}
                  >
                    {theme === 'light' ? <BiMoon /> : <BiSun />}
                  </button>
                </div>
              </li>
            </ul>

            {/* Mobile Menu Toggle */}
            <button
              id="three-dots"
              className="mobile-toggler"
              onClick={toggleMobileMenu}
            >
              {mobileMenuOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        </div>
      </header>
    </div>
  );
};

export default Header;
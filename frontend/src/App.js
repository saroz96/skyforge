import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/retailer/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Unauthorized from './components/retailer/Unauthorized';
import WelcomePage from './components/retailer/welcome';
import LoginForm from './components/credential/Login';
import Dashboard from './components/company/Dashboard';
import RegisterForm from './components/credential/Registration';
import VerifyEmail from './components/credential/VerifyEmail';
import ResendVerification from './components/credential/ResendVerification';
import ForgotPassword from './components/credential/ForgotPassword';
import ResetPassword from './components/credential/ResetPassword';
import CompanyForm from './components/company/CompanyForm';
import CompanyDetails from './components/company/CompanyDetails';
import EditCompanyForm from './components/company/EditCompanyForm';
import DashboardV1 from './components/retailer/dashboard/dashboardV1';
import Categories from './components/retailer/Category';
import ItemsCompany from './components/retailer/itemsCompany';
import Units from './components/retailer/Unit';
import MainUnits from './components/retailer/MainUnit';
import Compositions from './components/retailer/Composition';
import Accounts from './components/retailer/Account';
import AccountGroups from './components/retailer/AccountGroup';
import ViewItems from './components/ViewItems';
import AccountDetails from './components/retailer/ViewAccount';
import AddPurchase from './components/retailer/purchase/AddPurchase';
import PurchaseBillsList from './components/retailer/purchase/List';
import EditPurchase from './components/retailer/purchase/EditPurchase';
import { PageNotRefreshProvider } from './components/retailer/PageNotRefreshContext';
import FindPurchase from './components/retailer/purchase/FindPurchase';
import AddSales from './components/retailer/sales/AddSales';
import AddSalesOpen from './components/retailer/sales/AddSalesOpen';
import SalesBillsList from './components/retailer/sales/List';
import PurchaseBillPrint from './components/retailer/purchase/Print';
import SalesBillPrint from './components/retailer/sales/Print';
import AddCashSales from './components/retailer/sales/AddCashSales';
import AddCashSalesOpen from './components/retailer/sales/AddCashSalesOpen';
import AddPurcRtn from './components/retailer/purchaseReturn/AddPurcRtn';
import PurchaseReturnList from './components/retailer/purchaseReturn/List';
import PurchaseReturnPrint from './components/retailer/purchaseReturn/Print';
import AddSalesReturn from './components/retailer/salesReturn/AddSalesReturn';
import SalesReturnList from './components/retailer/salesReturn/List';
import AddCashSalesReturn from './components/retailer/salesReturn/AddCashSalesReturn';
import SalesReturnPrint from './components/retailer/salesReturn/Print';
import SalesVatReport from './components/retailer/sales/SalesVatReport';
import PurchaseVatReport from './components/retailer/purchase/PurchaseVatReport';
import SalesReturnVatReport from './components/retailer/salesReturn/SalesReturnVatRreport';
import PurchaseReturnVatReport from './components/retailer/purchaseReturn/PurchaseReturnVatReport';
import MonthlyVatSummary from './components/retailer/miscellaneous/MonthlyVatSummary';
import AddPayment from './components/retailer/payment/AddPayment';
import PaymentsList from './components/retailer/payment/List';
import PaymentVoucherPrint from './components/retailer/payment/Print';
import EditPayment from './components/retailer/payment/EditPayment';
import VoucherNumberForm from './components/retailer/payment/VoucherNumber';
import AddReceipt from './components/retailer/receipt/AddReceipt';
import ReceiptsList from './components/retailer/receipt/List';
import ReceiptVoucherPrint from './components/retailer/receipt/Print';
import EditReceipt from './components/retailer/receipt/EditReceipt';
import ReceiptVoucherForm from './components/retailer/receipt/VoucherNumber';
import ChangePassword from './components/credential/ChangePassword';
import UserList from './components/credential/UserList';
import CreateUser from './components/credential/CreateUser';
import UserDetail from './components/credential/UserDetail';
import UserPermission from './components/credential/UserPermission';
import ViewAdmin from './components/credential/ViewAdmin';
import Items from './components/retailer/Items/Items';
import AddStockAdjustment from './components/retailer/stockAdjustment/AddStockAdjustment';
import StockAdjustmentsList from './components/retailer/stockAdjustment/List';
import ItemsLedger from './components/retailer/miscellaneous/ItemsLedger';
import StockStatus from './components/retailer/miscellaneous/StockStatus';
import ItemsReOrderLevel from './components/retailer/miscellaneous/ItemsReOrder';
import Statement from './components/retailer/miscellaneous/Statement';
function AppContent() {
  const { currentUser } = useAuth();
  return (
    <Router>
      <PageNotRefreshProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/api/auth/register" element={<RegisterForm />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/auth/verify-email" element={<ResendVerification />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route
            path="/api/auth/login"
            element={!currentUser ? <LoginForm /> : <Navigate to="/dashboard" replace />}
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/api/company/new" element={
            <ProtectedRoute>
              <CompanyForm user={!currentUser} />
            </ProtectedRoute>
          }
          />
          <Route path="/api/company/:id" element={
            <ProtectedRoute>
              <CompanyDetails user={!currentUser} />
            </ProtectedRoute>
          }
          />
          <Route path="/api/company/edit/:id" element={
            <ProtectedRoute>
              <EditCompanyForm user={!currentUser} />
            </ProtectedRoute>
          }
          />
          {/**dashboardV1 */}
          <Route path="/retailerDashboard/indexv1" element={
            <ProtectedRoute>
              <DashboardV1 user={!currentUser} />
            </ProtectedRoute>
          }
          />

          {/**Items */}
          <Route
            path="/api/retailer/items"
            element={
              <ProtectedRoute>
                <Items />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/items/:id"
            element={
              <ProtectedRoute>
                <ViewItems />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/items-ledger"
            element={
              <ProtectedRoute>
                <ItemsLedger />
              </ProtectedRoute>
            }
          />

          <Route
            path="/api/retailer/categories"
            element={
              <ProtectedRoute>
                <Categories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/items-company"
            element={
              <ProtectedRoute>
                <ItemsCompany />
              </ProtectedRoute>
            }
          />

          <Route
            path="/api/retailer/units"
            element={
              <ProtectedRoute>
                <Units />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/mainUnits"
            element={
              <ProtectedRoute>
                <MainUnits />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/compositions"
            element={
              <ProtectedRoute>
                <Compositions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/accounts"
            element={
              <ProtectedRoute>
                <Accounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/companies/:id"
            element={
              <ProtectedRoute>
                <AccountDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/account-group"
            element={
              <ProtectedRoute>
                <AccountGroups />
              </ProtectedRoute>
            }
          />

          {/**Purchase */}
          <Route
            path="/api/retailer/purchase"
            element={
              <ProtectedRoute>
                <AddPurchase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/purchase/edit/:id"
            element={
              <ProtectedRoute>
                <EditPurchase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/purchase-register"
            element={
              <ProtectedRoute>
                <PurchaseBillsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/purchase/finds"
            element={
              <ProtectedRoute>
                <FindPurchase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/purchase/:id/print"
            element={
              <ProtectedRoute>
                <PurchaseBillPrint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/purchase-vat-report"
            element={
              <ProtectedRoute>
                <PurchaseVatReport />
              </ProtectedRoute>
            }
          />

          {/**Sales */}
          <Route
            path="/api/retailer/credit-sales"
            element={
              <ProtectedRoute>
                <AddSales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/credit-sales/open"
            element={
              <ProtectedRoute>
                <AddSalesOpen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/sales-register"
            element={
              <ProtectedRoute>
                <SalesBillsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/cash-sales"
            element={
              <ProtectedRoute>
                <AddCashSales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/cash-sales/open"
            element={
              <ProtectedRoute>
                <AddCashSalesOpen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/sales-vat-report"
            element={
              <ProtectedRoute>
                <SalesVatReport />
              </ProtectedRoute>
            }
          />

          <Route
            path="/api/retailer/sales/:id/print"
            element={
              <ProtectedRoute>
                <SalesBillPrint />
              </ProtectedRoute>
            }
          />
          {/**Purchase Return */}
          <Route
            path="/api/retailer/purchase-return"
            element={
              <ProtectedRoute>
                <AddPurcRtn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/purchase-return/register"
            element={
              <ProtectedRoute>
                <PurchaseReturnList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/purchase-return/:id/print"
            element={
              <ProtectedRoute>
                <PurchaseReturnPrint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/purchaseReturn-vat-report"
            element={
              <ProtectedRoute>
                <PurchaseReturnVatReport />
              </ProtectedRoute>
            }
          />

          {/**Sales Return */}
          <Route
            path="/api/retailer/sales-return"
            element={
              <ProtectedRoute>
                <AddSalesReturn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/cash/sales-return"
            element={
              <ProtectedRoute>
                <AddCashSalesReturn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/sales-return/register"
            element={
              <ProtectedRoute>
                <SalesReturnList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/sales-return/:id/print"
            element={
              <ProtectedRoute>
                <SalesReturnPrint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/salesReturn-vat-report"
            element={
              <ProtectedRoute>
                <SalesReturnVatReport />
              </ProtectedRoute>
            }
          />

          {/**Stock Adjustment */}
          <Route
            path="/api/retailer/stockAdjustments/new"
            element={
              <ProtectedRoute>
                <AddStockAdjustment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/stockAdjustments/register"
            element={
              <ProtectedRoute>
                <StockAdjustmentsList />
              </ProtectedRoute>
            }
          />

          {/**Monthly Vat Summary */}
          <Route
            path="/api/retailer/monthly-vat-summary"
            element={
              <ProtectedRoute>
                <MonthlyVatSummary />
              </ProtectedRoute>
            }
          />
          {/**Payment */}
          <Route
            path="/api/retailer/payments"
            element={
              <ProtectedRoute>
                <AddPayment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/payments/register"
            element={
              <ProtectedRoute>
                <PaymentsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/payments/:id/print"
            element={
              <ProtectedRoute>
                <PaymentVoucherPrint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/payments/finds"
            element={
              <ProtectedRoute>
                <VoucherNumberForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/payments/:id"
            element={
              <ProtectedRoute>
                <EditPayment />
              </ProtectedRoute>
            }
          />
          {/**Receipt */}
          <Route
            path="/api/retailer/receipts"
            element={
              <ProtectedRoute>
                <AddReceipt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/receipts/register"
            element={
              <ProtectedRoute>
                <ReceiptsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/receipts/finds"
            element={
              <ProtectedRoute>
                <ReceiptVoucherForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/receipts/:id"
            element={
              <ProtectedRoute>
                <EditReceipt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/receipts/:id/print"
            element={
              <ProtectedRoute>
                <ReceiptVoucherPrint />
              </ProtectedRoute>
            }
          />
          {/**Change Password */}
          <Route
            path="/api/auth/user/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            }
          />
          {/**User List */}
          <Route
            path="/api/auth/admin/users/list"
            element={
              <ProtectedRoute>
                <UserList />
              </ProtectedRoute>
            }
          />
          {/**Create New User */}
          <Route
            path="/api/auth/admin/create-user/new"
            element={
              <ProtectedRoute>
                <CreateUser />
              </ProtectedRoute>
            }
          />
          {/**View Individual User Detail */}
          <Route
            path="/api/auth/users/view/:id"
            element={
              <ProtectedRoute>
                <UserDetail />
              </ProtectedRoute>
            }
          />

          {/**User Permissions */}
          <Route
            path="/api/auth/admin/users/user-permissions/:id"
            element={
              <ProtectedRoute>
                <UserPermission />
              </ProtectedRoute>
            }
          />

          {/**View Admin Details */}
          <Route
            path="/api/auth/admin/users/view/:id"
            element={
              <ProtectedRoute>
                <ViewAdmin />
              </ProtectedRoute>
            }
          />

          {/**Miscellaneous */}
          <Route
            path="/api/retailer/stock-status"
            element={
              <ProtectedRoute>
                <StockStatus />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/items/reorder"
            element={
              <ProtectedRoute>
                <ItemsReOrderLevel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api/retailer/statement"
            element={
              <ProtectedRoute>
                <Statement />
              </ProtectedRoute>
            }
          />

          <Route path="/unauthorized" element={<Unauthorized />} />
        </Routes>
      </PageNotRefreshProvider>

    </Router>

  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
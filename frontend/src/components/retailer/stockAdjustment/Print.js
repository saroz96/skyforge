// import React, { useState, useEffect, useRef } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import { Container, Card, Button, Table } from 'react-bootstrap';
// import { BiPrinter, BiArrowBack, BiSolidFilePdf } from 'react-icons/bi';
// import jsPDF from 'jspdf';
// import html2canvas from 'html2canvas';
// import Loader from '../../Loader';

// const StockAdjustmentPrint = () => {
//     const { id } = useParams();
//     const navigate = useNavigate();
//     const [adjustmentData, setAdjustmentData] = useState(null);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const printableRef = useRef();

//     useEffect(() => {
//         const fetchAdjustmentData = async () => {
//             try {
//                 const response = await fetch(`/api/retailer/stockAdjustments/${id}/print`, {
//                     credentials: 'include'
//                 });
//                 const data = await response.json();

//                 if (!response.ok) {
//                     throw new Error(data.error || 'Failed to fetch stock adjustment data');
//                 }

//                 setAdjustmentData(data.data);
//                 setLoading(false);
//             } catch (err) {
//                 setError(err.message);
//                 setLoading(false);
//             }
//         };

//         fetchAdjustmentData();
//     }, [id]);

//     const printAdjustment = () => {
//         const printContents = document.getElementById('printableContent').cloneNode(true);
//         const styles = document.getElementById('printStyles').innerHTML;

//         const printWindow = window.open('', '_blank', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');

//         printWindow.document.write(`
//         <html>
//             <head>
//                 <title>Stock_Adjustment_${adjustmentData.stockAdjustment.billNumber}</title>
//                 <style>${styles}</style>
//             </head>
//             <body>
//                 ${printContents.innerHTML}
//                 <script>
//                     window.onload = function() {
//                         setTimeout(function() {
//                             window.print();
//                             window.close();
//                         }, 200);
//                     };
//                 </script>
//             </body>
//         </html>
//     `);

//         printWindow.document.close();
//     };

//     const generatePdf = async () => {
//         if (!printableRef.current) return;

//         try {
//             const originalText = document.querySelector('.pdf-button-text');
//             if (originalText) {
//                 originalText.textContent = 'Generating PDF...';
//             }

//             const element = printableRef.current.cloneNode(true);
//             element.style.display = 'block';
//             element.style.width = '210mm';
//             element.style.margin = '0 auto';

//             const tempContainer = document.createElement('div');
//             tempContainer.style.position = 'absolute';
//             tempContainer.style.left = '-9999px';
//             tempContainer.appendChild(element);
//             document.body.appendChild(tempContainer);

//             const canvas = await html2canvas(element, {
//                 scale: 2,
//                 useCORS: true,
//                 allowTaint: true,
//                 scrollX: 0,
//                 scrollY: 0,
//                 windowWidth: element.scrollWidth,
//                 windowHeight: element.scrollHeight
//             });

//             document.body.removeChild(tempContainer);

//             const imgData = canvas.toDataURL('image/png');
//             const pdf = new jsPDF({
//                 orientation: 'portrait',
//                 unit: 'mm',
//                 format: 'a4'
//             });

//             const imgWidth = 210;
//             const pageHeight = 295;
//             const imgHeight = canvas.height * imgWidth / canvas.width;

//             let heightLeft = imgHeight;
//             let position = 0;

//             pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
//             heightLeft -= pageHeight;

//             while (heightLeft >= 0) {
//                 position = heightLeft - imgHeight;
//                 pdf.addPage();
//                 pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
//                 heightLeft -= pageHeight;
//             }

//             pdf.save(`Stock_Adjustment_${adjustmentData.stockAdjustment.billNumber}.pdf`);

//             if (originalText) {
//                 originalText.textContent = 'PDF';
//             }
//         } catch (error) {
//             console.error('Error generating PDF:', error);
//             alert('Failed to generate PDF. Please try again.');

//             const originalText = document.querySelector('.pdf-button-text');
//             if (originalText) {
//                 originalText.textContent = 'PDF';
//             }
//         }
//     };

//     const numberToWords = (num) => {
//         const ones = [
//             '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
//             'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
//             'Seventeen', 'Eighteen', 'Nineteen'
//         ];

//         const tens = [
//             '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
//         ];

//         const scales = ['', 'Thousand', 'Million', 'Billion'];

//         const convertHundreds = (num) => {
//             let words = '';

//             if (num > 99) {
//                 words += ones[Math.floor(num / 100)] + ' Hundred ';
//                 num %= 100;
//             }

//             if (num > 19) {
//                 words += tens[Math.floor(num / 10)] + ' ';
//                 num %= 10;
//             }

//             if (num > 0) {
//                 words += ones[num] + ' ';
//             }

//             return words.trim();
//         };

//         if (num === 0) return 'Zero';
//         if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

//         let words = '';

//         for (let i = 0; i < scales.length; i++) {
//             let unit = Math.pow(1000, scales.length - i - 1);
//             let currentNum = Math.floor(num / unit);

//             if (currentNum > 0) {
//                 words += convertHundreds(currentNum) + ' ' + scales[scales.length - i - 1] + ' ';
//             }

//             num %= unit;
//         }

//         return words.trim();
//     };

//     const numberToWordsWithPaisa = (amount) => {
//         const rupees = Math.floor(amount);
//         const paisa = Math.round((amount - rupees) * 100);

//         let result = numberToWords(rupees) + ' Rupees';

//         if (paisa > 0) {
//             result += ' and ' + numberToWords(paisa) + ' Paisa';
//         }

//         return result;
//     };

//     const formatTo2Decimal = (num) => {
//         const rounded = Math.round(num * 100) / 100;
//         const parts = rounded.toString().split(".");
//         if (!parts[1]) return parts[0] + ".00";
//         if (parts[1].length === 1) return parts[0] + "." + parts[1] + "0";
//         return rounded.toString();
//     };

//     const handleBack = () => {
//         navigate(-1);
//     };

//     if (loading) return <Loader />;
//     if (error) return <div>Error: {error}</div>;
//     if (!adjustmentData) return <div>No stock adjustment data found</div>;

//     return (
//         <>
//             <style id="printStyles">
//                 {`
//                 @media print {
//                     @page {
//                         size: A4;
//                         margin: 5mm;
//                     }

//                     body {
//                         font-family: 'Arial Narrow', Arial, sans-serif;
//                         font-size: 9pt;
//                         line-height: 1.2;
//                         color: #000;
//                         background: white;
//                         margin: 0;
//                         padding: 0;
//                     }

//                     .print-adjustment-container {
//                         width: 100%;
//                         max-width: 210mm;
//                         margin: 0 auto;
//                         padding: 2mm;
//                     }

//                     .print-adjustment-header {
//                         text-align: center;
//                         margin-bottom: 3mm;
//                         border-bottom: 1px dashed #000;
//                         padding-bottom: 2mm;
//                     }

//                     .print-company-name {
//                         font-size: 16pt;
//                         font-weight: bold;
//                     }

//                     .print-company-details {
//                         font-size: 8pt;
//                         font-weight: bold;
//                         margin: 1mm 0;
//                     }

//                     .print-adjustment-title {
//                         font-size: 12pt;
//                         font-weight: bold;
//                         margin: 2mm 0;
//                         text-transform: uppercase;
//                     }

//                     .print-adjustment-details {
//                         display: flex;
//                         justify-content: space-between;
//                         margin: 2mm 0;
//                         font-size: 8pt;
//                     }

//                     .print-adjustment-table {
//                         width: 100%;
//                         border-collapse: collapse;
//                         margin: 3mm 0;
//                         font-size: 8pt;
//                         border: none;
//                     }

//                     .print-adjustment-table thead {
//                         border-top: 1px dashed #000;
//                         border-bottom: 1px dashed #000;
//                     }

//                     .print-adjustment-table th {
//                         background-color: transparent;
//                         border: none;
//                         padding: 1mm;
//                         text-align: left;
//                         font-weight: bold;
//                     }

//                     .print-adjustment-table td {
//                         border: none;
//                         padding: 1mm;
//                         border-bottom: 1px solid #eee;
//                     }

//                     .print-text-right {
//                         text-align: right;
//                     }

//                     .print-text-center {
//                         text-align: center;
//                     }

//                     .print-amount-in-words {
//                         font-size: 8pt;
//                         margin: 2mm 0;
//                         padding: 1mm;
//                         border: 1px dashed #000;
//                     }

//                     .print-signature-area {
//                         display: flex;
//                         justify-content: space-between;
//                         margin-top: 5mm;
//                         font-size: 8pt;
//                     }

//                     .print-signature-box {
//                         text-align: center;
//                         width: 30%;
//                         border-top: 1px dashed #000;
//                         padding-top: 1mm;
//                         font-weight: bold;
//                     }

//                     .print-totals-table {
//                         width: 60%;
//                         margin-left: auto;
//                         border-collapse: collapse;
//                         font-size: 8pt;
//                     }

//                     .print-totals-table td {
//                         padding: 1mm;
//                     }

//                     .no-print {
//                         display: none;
//                     }

//                     .screen-version {
//                         display: none;
//                     }
//                 }

//                 @media screen {
//                     .print-version {
//                         display: none;
//                     }

//                     .container {
//                         max-width: 100%;
//                         padding: 10px;
//                     }

//                     .card {
//                         border: 1px solid #ddd;
//                         margin: 10px 0;
//                         padding: 15px;
//                         box-shadow: 0 0 10px rgba(0,0,0,0.1);
//                     }

//                     .header {
//                         text-align: center;
//                         margin-bottom: 15px;
//                     }

//                     .header h1 {
//                         margin: 0;
//                         font-size: 30px;
//                         font-weight: bold;
//                     }

//                     .header h3 {
//                         font-size: 18px;
//                         margin: 10px 0;
//                     }

//                     .details-container {
//                         display: flex;
//                         justify-content: space-between;
//                         margin-bottom: 15px;
//                         font-size: 13px;
//                     }

//                     .left, .right {
//                         width: 48%;
//                     }

//                     .right {
//                         text-align: right;
//                     }

//                     .table {
//                         width: 100%;
//                         border-collapse: collapse;
//                         margin-top: 10px;
//                         font-size: 13px;
//                     }

//                     .table th {
//                         background-color: #f0f0f0;
//                         border: 1px solid #ddd;
//                         padding: 8px;
//                         text-align: left;
//                     }

//                     .table td {
//                         border: 1px solid #ddd;
//                         padding: 8px;
//                         text-align: left;
//                     }

//                     .amount-in-words {
//                         font-style: italic;
//                         margin-top: 10px;
//                         font-size: 13px;
//                     }

//                     .signature-area {
//                         margin-top: 50px;
//                         display: flex;
//                         justify-content: space-between;
//                     }

//                     .signature-box {
//                         width: 30%;
//                         text-align: center;
//                         border-top: 1px dashed #000;
//                         padding-top: 10px;
//                         font-size: 13px;
//                     }

//                     .user-details {
//                         text-decoration: overline;
//                         text-align: center;
//                         display: block;
//                         margin-top: 10px;
//                         white-space: nowrap;
//                     }

//                     hr {
//                         border-top: 1px solid #000;
//                         margin: 10px 0;
//                     }
//                 }
//                 `}
//             </style>

//             {/* Screen Version */}
//             <div className="screen-version">
//                 <Container>
//                     <div className="d-flex justify-content-between mb-3">
//                         <Button variant="secondary" onClick={handleBack}>
//                             <BiArrowBack /> Back
//                         </Button>
//                         <div>
//                             <Button variant="primary" className="me-2" onClick={generatePdf}>
//                                 <BiSolidFilePdf /> <span className="pdf-button-text">PDF</span>
//                             </Button>
//                             <Button variant="info" onClick={printAdjustment}>
//                                 <BiPrinter /> Print
//                             </Button>
//                         </div>
//                     </div>

//                     <Card>
//                         <div className="header">
//                             <h1>{adjustmentData.currentCompanyName}</h1>
//                             <h4>
//                                 {adjustmentData.currentCompany.address}-{adjustmentData.currentCompany.ward}, {adjustmentData.currentCompany.city},
//                                 {adjustmentData.currentCompany.country}
//                                 <br />
//                                 Tel.: {adjustmentData.currentCompany.phone}, Email: {adjustmentData.currentCompany.email}
//                                 <br />
//                                 VAT NO.: {adjustmentData.currentCompany.pan}
//                             </h4>
//                             <h3>Stock Adjustment</h3>
//                             <hr style={{ border: '0.5px solid gray' }} />
//                         </div>

//                         <div className="details-container">
//                             <div className="right">
//                                 <br />
//                                 <strong>Vch. No:</strong> {adjustmentData.stockAdjustment.billNumber}
//                                 | <strong>Adjustment Type:</strong> {adjustmentData.stockAdjustment.adjustmentType}
//                                 | <strong>Date:</strong> {new Date(adjustmentData.stockAdjustment.date).toLocaleDateString()}
//                             </div>
//                         </div>

//                         <div className="container">
//                             <Table bordered className="items-table">
//                                 <thead>
//                                     <tr>
//                                         <th>S.N.</th>
//                                         <th>#</th>
//                                         <th>HSN</th>
//                                         <th>Description of Goods</th>
//                                         <th>Batch</th>
//                                         <th>Expiry</th>
//                                         <th>Quantity</th>
//                                         <th>Reason</th>
//                                         <th>Unit</th>
//                                         <th>Rate (Rs.)</th>
//                                         <th>Total (Rs.)</th>
//                                     </tr>
//                                 </thead>
//                                 <tbody>
//                                     {adjustmentData.stockAdjustment.items.map((item, i) => (
//                                         <tr key={i}>
//                                             <td>{i + 1}</td>
//                                             <td>{item.item.uniqueNumber || 'N/A'}</td>
//                                             <td>{item.item.hscode || 'N/A'}</td>
//                                             <td>
//                                                 {item.vatStatus === 'vatExempt' ? (
//                                                     <>
//                                                         {item.item.name} *
//                                                     </>
//                                                 ) : (
//                                                     item.item.name
//                                                 )}
//                                             </td>
//                                             <td>{item.batchNumber || 'N/A'}</td>
//                                             <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</td>
//                                             <td>{formatTo2Decimal(item.quantity)}</td>
//                                             <td>{item.reason || 'N/A'}</td>
//                                             <td>{item.unit ? item.unit.name : 'N/A'}</td>
//                                             <td>{formatTo2Decimal(item.puPrice)}</td>
//                                             <td>{formatTo2Decimal(item.quantity * item.puPrice)}</td>
//                                         </tr>
//                                     ))}
//                                 </tbody>
//                             </Table>

//                             <Table style={{ float: 'right', width: 'auto' }}>
//                                 <tbody>
//                                     <tr>
//                                         <td colSpan="6" className="text-right"><strong>Sub Total :</strong></td>
//                                         <td>{formatTo2Decimal(adjustmentData.stockAdjustment.subTotal || 0)}</td>
//                                     </tr>
//                                     <tr>
//                                         <td colSpan="6" className="text-right"><strong>Discount :</strong></td>
//                                         <td>{formatTo2Decimal(adjustmentData.stockAdjustment.discountAmount || 0)}</td>
//                                     </tr>
//                                     <tr>
//                                         <td colSpan="6" className="text-right"><strong>Non Taxable :</strong></td>
//                                         <td>{formatTo2Decimal(adjustmentData.stockAdjustment.nonVatAdjustment || 0)}</td>
//                                     </tr>
//                                     <tr>
//                                         <td colSpan="6" className="text-right"><strong>Taxable Amount :</strong></td>
//                                         <td>{formatTo2Decimal(adjustmentData.stockAdjustment.taxableAmount || 0)}</td>
//                                     </tr>
//                                     {!adjustmentData.stockAdjustment.isVatExempt && (
//                                         <>
//                                             <tr>
//                                                 <td colSpan="6" className="text-right">
//                                                     <strong>VAT {adjustmentData.stockAdjustment.vatPercentage}% :</strong>
//                                                 </td>
//                                                 <td>
//                                                     {formatTo2Decimal(
//                                                         (adjustmentData.stockAdjustment.taxableAmount * adjustmentData.stockAdjustment.vatPercentage) / 100
//                                                     )}
//                                                 </td>
//                                             </tr>
//                                             <tr>
//                                                 <td colSpan="6" className="text-right"><strong>Round Off :</strong></td>
//                                                 <td>{formatTo2Decimal(adjustmentData.stockAdjustment.roundOffAmount || 0)}</td>
//                                             </tr>
//                                             <tr>
//                                                 <td colSpan="6" className="text-right"><strong>Grand Total :</strong></td>
//                                                 <td>{formatTo2Decimal(adjustmentData.stockAdjustment.totalAmount || 0)}</td>
//                                             </tr>
//                                         </>
//                                     )}
//                                 </tbody>
//                             </Table>

//                             <div className="amount-in-words">
//                                 <strong>In Words:</strong> {numberToWordsWithPaisa(adjustmentData.stockAdjustment.totalAmount || 0)} Only.
//                             </div>
//                         </div>

//                         <hr style={{ border: '0.5px solid gray' }} />

//                         {adjustmentData.stockAdjustment.note && (
//                             <div>
//                                 <p><strong>Note:</strong> {adjustmentData.stockAdjustment.note}</p>
//                             </div>
//                         )}

//                         <div className="signature-area">
//                             <div className="signature-box">
//                                 <br />
//                                 <br />
//                                 <p><strong className="user-details">Received By:</strong></p>
//                             </div>
//                             <div className="signature-box">
//                                 <br />
//                                 <p>{adjustmentData.stockAdjustment.user.name}</p>
//                                 <p><strong className="user-details">Prepared By:</strong></p>
//                             </div>
//                             <div className="signature-box">
//                                 <br />
//                                 <br />
//                                 <strong className="user-details">For: {adjustmentData.currentCompanyName}</strong>
//                             </div>
//                         </div>
//                     </Card>
//                 </Container>
//             </div>

//             {/* Printable Version */}
//             <div id="printableContent" className="print-version" ref={printableRef}>
//                 <div className="print-adjustment-container">
//                     <div className="print-adjustment-header">
//                         <div className="print-company-name">{adjustmentData.currentCompanyName}</div>
//                         <div className="print-company-details">
//                             {adjustmentData.currentCompany.address}-{adjustmentData.currentCompany.ward}, {adjustmentData.currentCompany.city},
//                             {adjustmentData.currentCompany.country}
//                             <br />
//                             Tel.: {adjustmentData.currentCompany.phone}, Email: {adjustmentData.currentCompany.email}
//                             <br />
//                             VAT NO.: {adjustmentData.currentCompany.pan}
//                         </div>
//                         <div className="print-adjustment-title">Stock Adjustment</div>
//                     </div>

//                     <div className="print-adjustment-details">
//                         <div></div>
//                         <div>
//                             <strong>Vch. No:</strong> {adjustmentData.stockAdjustment.billNumber}
//                             | <strong>Adjustment Type:</strong> {adjustmentData.stockAdjustment.adjustmentType}
//                             | <strong>Date:</strong> {new Date(adjustmentData.stockAdjustment.date).toLocaleDateString()}
//                         </div>
//                     </div>

//                     <table className="print-adjustment-table">
//                         <thead>
//                             <tr>
//                                 <th>S.N.</th>
//                                 <th>#</th>
//                                 <th>HSN</th>
//                                 <th>Description of Goods</th>
//                                 <th>Batch</th>
//                                 <th>Expiry</th>
//                                 <th>Quantity</th>
//                                 <th>Reason</th>
//                                 <th>Unit</th>
//                                 <th>Rate (Rs.)</th>
//                                 <th>Total (Rs.)</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {adjustmentData.stockAdjustment.items.map((item, i) => (
//                                 <tr key={i}>
//                                     <td>{i + 1}</td>
//                                     <td>{item.item.uniqueNumber || 'N/A'}</td>
//                                     <td>{item.item.hscode || 'N/A'}</td>
//                                     <td>
//                                         {item.vatStatus === 'vatExempt' ? (
//                                             <>
//                                                 {item.item.name} *
//                                             </>
//                                         ) : (
//                                             item.item.name
//                                         )}
//                                     </td>
//                                     <td>{item.batchNumber || 'N/A'}</td>
//                                     <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</td>
//                                     <td>{formatTo2Decimal(item.quantity)}</td>
//                                     <td>{item.reason || 'N/A'}</td>
//                                     <td>{item.unit ? item.unit.name : 'N/A'}</td>
//                                     <td>{formatTo2Decimal(item.puPrice)}</td>
//                                     <td>{formatTo2Decimal(item.quantity * item.puPrice)}</td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>

//                     <table className="print-totals-table">
//                         <tbody>
//                             <tr>
//                                 <td><strong>Sub Total:</strong></td>
//                                 <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.subTotal || 0)}</td>
//                             </tr>
//                             <tr>
//                                 <td><strong>Discount:</strong></td>
//                                 <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.discountAmount || 0)}</td>
//                             </tr>
//                             <tr>
//                                 <td><strong>Non Taxable:</strong></td>
//                                 <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.nonVatAdjustment || 0)}</td>
//                             </tr>
//                             <tr>
//                                 <td><strong>Taxable Amount:</strong></td>
//                                 <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.taxableAmount || 0)}</td>
//                             </tr>
//                             {!adjustmentData.stockAdjustment.isVatExempt && (
//                                 <>
//                                     <tr>
//                                         <td><strong>VAT {adjustmentData.stockAdjustment.vatPercentage}%:</strong></td>
//                                         <td className="print-text-right">
//                                             {formatTo2Decimal(
//                                                 (adjustmentData.stockAdjustment.taxableAmount * adjustmentData.stockAdjustment.vatPercentage) / 100
//                                             )}
//                                         </td>
//                                     </tr>
//                                     <tr>
//                                         <td><strong>Round Off:</strong></td>
//                                         <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.roundOffAmount || 0)}</td>
//                                     </tr>
//                                     <tr>
//                                         <td><strong>Grand Total:</strong></td>
//                                         <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.totalAmount || 0)}</td>
//                                     </tr>
//                                 </>
//                             )}
//                         </tbody>
//                     </table>

//                     <div className="print-amount-in-words">
//                         <strong>In Words:</strong> {numberToWordsWithPaisa(adjustmentData.stockAdjustment.totalAmount || 0)} Only.
//                     </div>

//                     {adjustmentData.stockAdjustment.note && (
//                         <div style={{ marginTop: '3mm', fontSize: '8pt' }}>
//                             <strong>Note:</strong> {adjustmentData.stockAdjustment.note}
//                         </div>
//                     )}

//                     <div className="print-signature-area">
//                         <div className="print-signature-box">Received By</div>
//                         <div className="print-signature-box">
//                             {adjustmentData.stockAdjustment.user.name}
//                             <br />
//                             Prepared By
//                         </div>
//                         <div className="print-signature-box">For: {adjustmentData.currentCompanyName}</div>
//                     </div>
//                 </div>
//             </div>
//         </>
//     );
// };

// export default StockAdjustmentPrint;


import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Table } from 'react-bootstrap';
import { BiPrinter, BiArrowBack, BiSolidFilePdf } from 'react-icons/bi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Loader from '../../Loader';

const StockAdjustmentPrint = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [adjustmentData, setAdjustmentData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const printableRef = useRef();

    useEffect(() => {
        const fetchAdjustmentData = async () => {
            try {
                const response = await fetch(`/api/retailer/stockAdjustments/${id}/print`, {
                    credentials: 'include'
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch stock adjustment data');
                }

                setAdjustmentData(data.data);
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchAdjustmentData();
    }, [id]);

    const printAdjustment = () => {
        const printContents = document.getElementById('printableContent').cloneNode(true);
        const styles = document.getElementById('printStyles').innerHTML;

        const printWindow = window.open('', '_blank', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');

        printWindow.document.write(`
        <html>
            <head>
                <title>Stock_Adjustment_${adjustmentData.stockAdjustment.billNumber}</title>
                <style>${styles}</style>
            </head>
            <body>
                ${printContents.innerHTML}
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
    };

    const generatePdf = async () => {
        if (!printableRef.current) return;

        try {
            const originalText = document.querySelector('.pdf-button-text');
            if (originalText) {
                originalText.textContent = 'Generating PDF...';
            }

            const element = printableRef.current.cloneNode(true);
            element.style.display = 'block';
            element.style.width = '210mm';
            element.style.margin = '0 auto';

            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.appendChild(element);
            document.body.appendChild(tempContainer);

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });

            document.body.removeChild(tempContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = canvas.height * imgWidth / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Stock_Adjustment_${adjustmentData.stockAdjustment.billNumber}.pdf`);

            if (originalText) {
                originalText.textContent = 'PDF';
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');

            const originalText = document.querySelector('.pdf-button-text');
            if (originalText) {
                originalText.textContent = 'PDF';
            }
        }
    };

    const numberToWords = (num) => {
        const ones = [
            '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen'
        ];

        const tens = [
            '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
        ];

        const scales = ['', 'Thousand', 'Million', 'Billion'];

        const convertHundreds = (num) => {
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
        };

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
    };

    const numberToWordsWithPaisa = (amount) => {
        const rupees = Math.floor(amount);
        const paisa = Math.round((amount - rupees) * 100);

        let result = numberToWords(rupees) + ' Rupees';

        if (paisa > 0) {
            result += ' and ' + numberToWords(paisa) + ' Paisa';
        }

        return result;
    };

    const formatTo2Decimal = (num) => {
        const rounded = Math.round(num * 100) / 100;
        const parts = rounded.toString().split(".");
        if (!parts[1]) return parts[0] + ".00";
        if (parts[1].length === 1) return parts[0] + "." + parts[1] + "0";
        return rounded.toString();
    };

    const handleBack = () => {
        navigate(-1);
    };

    if (loading) return <Loader />;
    if (error) return <div>Error: {error}</div>;
    if (!adjustmentData) return <div>No stock adjustment data found</div>;

    return (
        <>
            <style id="printStyles">
                {`
                @media print {
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

                    .print-adjustment-container {
                        width: 100%;
                        max-width: 210mm;
                        margin: 0 auto;
                        padding: 2mm;
                    }

                    .print-adjustment-header {
                        text-align: center;
                        margin-bottom: 3mm;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 2mm;
                    }

                    .print-adjustment-title {
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
                        font-weight: bold;
                        margin: 1mm 0;
                    }

                    .print-adjustment-details {
                        display: flex;
                        justify-content: space-between;
                        margin: 2mm 0;
                        font-size: 8pt;
                    }

                    .print-adjustment-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 3mm 0;
                        font-size: 8pt;
                        border: none;
                    }

                    .print-adjustment-table thead {
                        border-top: 1px dashed #000;
                        border-bottom: 1px dashed #000;
                    }

                    .print-adjustment-table th {
                        background-color: transparent;
                        border: none;
                        padding: 1mm;
                        text-align: left;
                        font-weight: bold;
                    }

                    .print-adjustment-table td {
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

                    .print-footer {
                        text-align: center;
                        font-size: 7pt;
                        margin-top: 3mm;
                        border-top: 1px dashed #000;
                        padding-top: 1mm;
                    }

                    .no-print {
                        display: none;
                    }

                    /* Hide screen version when printing */
                    .screen-version {
                        display: none;
                    }
                }

                @media screen {
                    /* Hide print version on screen */
                    .print-version {
                        display: none;
                    }

                    .container {
                        max-width: 100%;
                        padding: 10px;
                    }

                    .card {
                        border: 1px solid #ddd;
                        margin: 10px 0;
                        padding: 15px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }

                    .header {
                        text-align: center;
                        margin-bottom: 15px;
                    }

                    .header h1 {
                        margin: 0;
                        font-size: 30px;
                        font-weight: bold;
                    }

                    .header h2 {
                        font-size: 18px;
                        margin: 10px 0;
                    }

                    .header h4 {
                        font-size: 14px;
                        margin: 10px 0;
                    }

                    .details-container {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 15px;
                        font-size: 13px;
                    }

                    .table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                        font-size: 13px;
                    }

                    .table th {
                        background-color: #f0f0f0;
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }

                    .table td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }

                    .amount-in-words {
                        font-style: italic;
                        margin-top: 10px;
                        font-size: 13px;
                    }

                    .signature-area {
                        margin-top: 50px;
                        display: flex;
                        justify-content: space-between;
                    }

                    .signature-box {
                        width: 30%;
                        text-align: center;
                        border-top: 1px dashed #000;
                        padding-top: 10px;
                        font-size: 13px;
                    }

                    .total-table {
                        width: 40%;
                        float: right;
                        margin-top: 20px;
                        font-size: 13px;
                    }

                    hr {
                        border-top: 1px solid #000;
                        margin: 10px 0;
                    }

                    .bordered {
                        border: 1px solid #000;
                        padding: 5px;
                        display: inline-block;
                    }
                }
                `}
            </style>

            {/* Screen Version (visible only on screen) */}
            <div className="screen-version">
                <Container>
                    <div className="d-flex justify-content-end mb-3">
                        <Button variant="secondary" className="me-2" onClick={handleBack}>
                            <BiArrowBack /> Back
                        </Button>
                        <Button variant="primary" className="me-2" onClick={generatePdf}>
                            <BiSolidFilePdf /> <span className="pdf-button-text">PDF</span>
                        </Button>
                        <Button variant="info" onClick={printAdjustment}>
                            <BiPrinter /> Print
                        </Button>
                    </div>

                    <Card>
                        <div className="header">
                            <h1>{adjustmentData.currentCompanyName}</h1>
                            <h4>
                                {adjustmentData.currentCompany.address}-{adjustmentData.currentCompany.ward}, {adjustmentData.currentCompany.city},
                                {adjustmentData.currentCompany.country}
                                <br />
                                Tel: {adjustmentData.currentCompany.phone} | PAN: {adjustmentData.currentCompany.pan}
                            </h4>
                            <h2 className="bordered">STOCK ADJUSTMENT</h2>
                        </div>

                        <div className="details-container">
                            <div className="left">
                                <div><strong>Adjustment Type:</strong> {adjustmentData.stockAdjustment.adjustmentType}</div>
                                <div><strong>Date:</strong> {new Date(adjustmentData.stockAdjustment.date).toLocaleDateString()}</div>
                            </div>
                            <div className="right">
                                <div><strong>Voucher No:</strong> {adjustmentData.stockAdjustment.billNumber}</div>
                                <div><strong>Prepared By:</strong> {adjustmentData.stockAdjustment.user.name}</div>
                            </div>
                        </div>

                        <hr />

                        <Table bordered>
                            <thead>
                                <tr>
                                    <th>S.N</th>
                                    <th>Code</th>
                                    <th>HSN</th>
                                    <th>Description of Goods</th>
                                    <th>Batch</th>
                                    <th>Expiry</th>
                                    <th>Quantity</th>
                                    <th>Reason</th>
                                    <th>Unit</th>
                                    <th>Rate (Rs.)</th>
                                    <th>Total (Rs.)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adjustmentData.stockAdjustment.items.map((item, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td>{item.item.uniqueNumber || 'N/A'}</td>
                                        <td>{item.item.hscode || 'N/A'}</td>
                                        <td>
                                            {item.vatStatus === 'vatExempt' ? (
                                                <>
                                                    {item.item.name} <span style={{ color: 'red' }}>*</span>
                                                </>
                                            ) : (
                                                item.item.name
                                            )}
                                        </td>
                                        <td>{item.batchNumber || 'N/A'}</td>
                                        <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</td>
                                        <td>{formatTo2Decimal(item.quantity)}</td>
                                        <td>{item.reason || 'N/A'}</td>
                                        <td>{item.unit ? item.unit.name : 'N/A'}</td>
                                        <td>{formatTo2Decimal(item.puPrice)}</td>
                                        <td>{formatTo2Decimal(item.quantity * item.puPrice)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>

                        <div className="total-table">
                            <table className="table">
                                <tbody>
                                    <tr>
                                        <td><strong>Sub Total:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.subTotal || 0)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Discount:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.discountAmount || 0)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Non Taxable:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.nonVatAdjustment || 0)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Taxable Amount:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.taxableAmount || 0)}</td>
                                    </tr>
                                    {!adjustmentData.stockAdjustment.isVatExempt && (
                                        <>
                                            <tr>
                                                <td><strong>VAT ({adjustmentData.stockAdjustment.vatPercentage}%):</strong></td>
                                                <td className="text-right">
                                                    {formatTo2Decimal(
                                                        (adjustmentData.stockAdjustment.taxableAmount * adjustmentData.stockAdjustment.vatPercentage) / 100
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td><strong>Round Off:</strong></td>
                                                <td className="text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.roundOffAmount || 0)}</td>
                                            </tr>
                                        </>
                                    )}
                                    <tr>
                                        <td><strong>Grand Total:</strong></td>
                                        <td className="text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.totalAmount || 0)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="amount-in-words">
                            <strong>In Words:</strong> {numberToWordsWithPaisa(adjustmentData.stockAdjustment.totalAmount || 0)} Only.
                        </div>

                        {adjustmentData.stockAdjustment.note && (
                            <div style={{ marginTop: '15px' }}>
                                <p><strong>Note:</strong> {adjustmentData.stockAdjustment.note}</p>
                            </div>
                        )}

                        <div className="signature-area">
                            <div className="signature-box">Received By</div>
                            <div className="signature-box">Prepared By</div>
                            <div className="signature-box">For: {adjustmentData.currentCompanyName}</div>
                        </div>
                    </Card>
                </Container>
            </div>

            {/* Printable Version (hidden on screen, visible when printing) */}
            <div id="printableContent" className="print-version" ref={printableRef}>
                <div className="print-adjustment-container">
                    <div className="print-adjustment-header">
                        <div className="print-company-name">{adjustmentData.currentCompanyName}</div>
                        <div className="print-company-details">
                            {adjustmentData.currentCompany.address}-{adjustmentData.currentCompany.ward}, {adjustmentData.currentCompany.city},
                            {adjustmentData.currentCompany.country} |
                            Tel: {adjustmentData.currentCompany.phone} | PAN: {adjustmentData.currentCompany.pan}
                        </div>
                        <div className="print-adjustment-title">STOCK ADJUSTMENT</div>
                    </div>

                    <div className="print-adjustment-details">
                        <div>
                            <div><strong>Adjustment Type:</strong> {adjustmentData.stockAdjustment.adjustmentType}</div>
                            <div><strong>Date:</strong> {new Date(adjustmentData.stockAdjustment.date).toLocaleDateString()}</div>
                        </div>
                        <div>
                            <div><strong>Voucher No:</strong> {adjustmentData.stockAdjustment.billNumber}</div>
                            <div><strong>Prepared By:</strong> {adjustmentData.stockAdjustment.user.name}</div>
                        </div>
                    </div>

                    <table className="print-adjustment-table">
                        <thead>
                            <tr>
                                <th>SN</th>
                                <th>Code</th>
                                <th>HSN</th>
                                <th>Description of Goods</th>
                                <th>Batch</th>
                                <th>Expiry</th>
                                <th>Quantity</th>
                                <th>Reason</th>
                                <th>Unit</th>
                                <th>Rate (Rs.)</th>
                                <th>Total (Rs.)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adjustmentData.stockAdjustment.items.map((item, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{item.item.uniqueNumber || 'N/A'}</td>
                                    <td>{item.item.hscode || 'N/A'}</td>
                                    <td>
                                        {item.vatStatus === 'vatExempt' ? (
                                            <>
                                                {item.item.name} <span style={{ color: 'red' }}>*</span>
                                            </>
                                        ) : (
                                            item.item.name
                                        )}
                                    </td>
                                    <td>{item.batchNumber || 'N/A'}</td>
                                    <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</td>
                                    <td>{formatTo2Decimal(item.quantity)}</td>
                                    <td>{item.reason || 'N/A'}</td>
                                    <td>{item.unit ? item.unit.name : 'N/A'}</td>
                                    <td>{formatTo2Decimal(item.puPrice)}</td>
                                    <td>{formatTo2Decimal(item.quantity * item.puPrice)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tr>
                            <td colSpan="11" style={{ borderBottom: '1px dashed #000' }}></td>
                        </tr>
                    </table>

                    <table className="print-totals-table">
                        <tbody>
                            <tr>
                                <td><strong>Sub Total:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.subTotal || 0)}</td>
                            </tr>
                            <tr>
                                <td><strong>Discount:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.discountAmount || 0)}</td>
                            </tr>
                            <tr>
                                <td><strong>Non Taxable:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.nonVatAdjustment || 0)}</td>
                            </tr>
                            <tr>
                                <td><strong>Taxable Amount:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.taxableAmount || 0)}</td>
                            </tr>
                            {!adjustmentData.stockAdjustment.isVatExempt && (
                                <>
                                    <tr>
                                        <td><strong>VAT ({adjustmentData.stockAdjustment.vatPercentage}%):</strong></td>
                                        <td className="print-text-right">
                                            {formatTo2Decimal(
                                                (adjustmentData.stockAdjustment.taxableAmount * adjustmentData.stockAdjustment.vatPercentage) / 100
                                            )}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>Round Off:</strong></td>
                                        <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.roundOffAmount || 0)}</td>
                                    </tr>
                                </>
                            )}
                            <tr>
                                <td><strong>Grand Total:</strong></td>
                                <td className="print-text-right">{formatTo2Decimal(adjustmentData.stockAdjustment.totalAmount || 0)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="print-amount-in-words">
                        <strong>In Words:</strong> {numberToWordsWithPaisa(adjustmentData.stockAdjustment.totalAmount || 0)} Only.
                    </div>

                    {adjustmentData.stockAdjustment.note && (
                        <div style={{ marginTop: '3mm', fontSize: '8pt' }}>
                            <strong>Note:</strong> {adjustmentData.stockAdjustment.note}
                        </div>
                    )}

                    <br /><br />
                    <div className="print-signature-area">
                        <div className="print-signature-box">Received By</div>
                        <div className="print-signature-box">Prepared By</div>
                        <div className="print-signature-box">For: {adjustmentData.currentCompanyName}</div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default StockAdjustmentPrint;
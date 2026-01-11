import React, { useState } from 'react';
import { generateReceiptContent, calculateTotals, formatCurrency, formatDuration } from '../../utils/receiptUtils';

const ReceiptModal = ({ appointment, isOpen, onClose }) => {
  const [downloadLoading, setDownloadLoading] = useState(false);

  if (!isOpen || !appointment) {
    return null;
  }

  const { 
    serviceTotal, 
    offeringTotal, 
    grandTotal, 
    amountPaid, 
    changeAmount 
  } = calculateTotals(appointment);

  const serviceDuration = appointment.service_duration || appointment.services?.duration_minutes || 60;
  const durationText = formatDuration(serviceDuration);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setDownloadLoading(true);
    try {
      // Load libraries dynamically
      const [html2canvas, jsPDF] = await Promise.all([
        import('html2canvas').then(m => m.default),
        import('jspdf').then(m => m.jsPDF)
      ]);

      const receiptElement = document.getElementById('receipt-content');
      const canvas = await html2canvas(receiptElement, { scale: 2, useCORS: true });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${appointment.receipt_number || 'receipt'}.pdf`);
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('Failed to download PDF. Please try again or use Print instead.');
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <div className="receipt-modal-overlay">
      <div className="receipt-modal-container">
        <div className="receipt-modal-header">
          <h2>Receipt</h2>
          <button className="receipt-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="receipt-modal-content" id="receipt-content">
          <div className="receipt-modal-receipt">
            <div className="receipt-modal-header-section">
              <div className="receipt-modal-org-name">ROMAN CATHOLIC ARCHBISHOP OF CEBU (RCAC)</div>
              <div className="receipt-modal-church-name">ST. FRANCIS OF ASSISI PARISH</div>
              <div className="receipt-modal-address">Pili, Madrdejos, Cebu</div>
              <hr className="receipt-modal-divider" />
              <div className="receipt-modal-title">Official Receipt</div>
            </div>

            <div className="receipt-modal-section">
              <div className="receipt-modal-receipt-info">
                <div><strong>Receipt:</strong> {appointment.receipt_number || 'N/A'}</div>
                <div><strong>Date:</strong> {new Date(appointment.appointment_date).toLocaleDateString('en-PH')}</div>
                <div><strong>Time:</strong> {appointment.appointment_time}</div>
              </div>
            </div>

            <hr className="receipt-modal-divider" />

            <div className="receipt-modal-section">
              <div className="receipt-modal-section-title">CUSTOMER INFORMATION</div>
              <div><strong>Name:</strong> {appointment.customer_first_name} {appointment.customer_last_name}</div>
              <div><strong>Email:</strong> {appointment.customer_email || 'N/A'}</div>
              {appointment.customer_phone && (
                <div><strong>Phone:</strong> +63{appointment.customer_phone}</div>
              )}
            </div>

            <hr className="receipt-modal-divider" />

            <div className="receipt-modal-section">
              <div className="receipt-modal-section-title">SERVICE DETAILS</div>
              <div><strong>Service:</strong> {appointment.service_type || 'N/A'}</div>
              <div><strong>Duration:</strong> {durationText}</div>
              <div><strong>Scheduled Date:</strong> {new Date(appointment.appointment_date).toLocaleDateString('en-PH')}</div>
              <div><strong>Scheduled Time:</strong> {appointment.appointment_time}</div>
            </div>

            <hr className="receipt-modal-divider" />

            <div className="receipt-modal-section">
              <div className="receipt-modal-section-title">ITEMS</div>
              {serviceTotal > 0 && (
                <div className="receipt-modal-item">
                  <div>{appointment.service_type || 'Service'}</div>
                  <div>{formatCurrency(serviceTotal)}</div>
                </div>
              )}
              
              {(appointment.appointment_products || appointment.offerings || []).map((item, idx) => {
                const productName = item.products?.product_name || item.product_name || 'Offering';
                const quantity = item.quantity || 1;
                const total = item.total_price || (quantity * (item.unit_price || 0));
                
                return (
                  <div key={idx} className="receipt-modal-item">
                    <div>{productName} x{quantity}</div>
                    <div>{formatCurrency(total)}</div>
                  </div>
                );
              })}

              {(appointment.appointment_products || appointment.offerings || []).length === 0 && serviceTotal === 0 && (
                <div className="receipt-modal-item">
                  <div>No items</div>
                </div>
              )}
            </div>

            <hr className="receipt-modal-divider" />

            <div className="receipt-modal-section">
              <div className="receipt-modal-section-title">SUMMARY</div>
              {serviceTotal > 0 && (
                <div className="receipt-modal-summary-row">
                  <div>Service Fee:</div>
                  <div>{formatCurrency(serviceTotal)}</div>
                </div>
              )}
              
              {offeringTotal > 0 && (
                <div className="receipt-modal-summary-row">
                  <div>Offerings:</div>
                  <div>{formatCurrency(offeringTotal)}</div>
                </div>
              )}
              
              <div className="receipt-modal-total-section">
                <div className="receipt-modal-summary-row">
                  <div><strong>Grand Total:</strong></div>
                  <div><strong>{formatCurrency(grandTotal)}</strong></div>
                </div>
                <div className="receipt-modal-summary-row">
                  <div>Amount Paid:</div>
                  <div>{formatCurrency(amountPaid)}</div>
                </div>
                <div className="receipt-modal-summary-row">
                  <div>Change:</div>
                  <div>{formatCurrency(changeAmount)}</div>
                </div>
              </div>
            </div>

            <hr className="receipt-modal-divider" />

            <div className="receipt-modal-section">
              <div className="receipt-modal-section-title">PAYMENT METHOD</div>
              <div><strong>Method:</strong> {appointment.payment_method || 'Cash'}</div>
              <div><strong>Status:</strong> {appointment.payment_status || 'Paid'}</div>
            </div>

            <hr className="receipt-modal-divider" />

            <div className="receipt-modal-footer">
              <div className="receipt-modal-footer-text">THANK YOU FOR YOUR SUPPORT!</div>
              <div className="receipt-modal-footer-text">May God bless you abundantly.</div>
              <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '11px', borderTop: '1px dashed #ccc', paddingTop: '5px' }}>
                OFFICIAL RECEIPT - COPY
              </div>
            </div>
          </div>
        </div>

        <div className="receipt-modal-actions">
          <button 
            className="receipt-modal-button receipt-modal-button-print"
            onClick={handlePrint}
          >
            🖨️ Print Receipt
          </button>
          <button 
            className="receipt-modal-button receipt-modal-button-download"
            onClick={handleDownloadPDF}
            disabled={downloadLoading}
          >
            {downloadLoading ? '⬇️ Downloading...' : '⬇️ Download as PDF'}
          </button>
          <button 
            className="receipt-modal-button receipt-modal-button-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        .receipt-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .receipt-modal-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          max-width: 600px;
          width: 90%;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .receipt-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 2px solid #f0f0f0;
          background: #f8f9fa;
        }

        .receipt-modal-header h2 {
          margin: 0;
          font-size: 24px;
          color: #2d3748;
        }

        .receipt-modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #718096;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .receipt-modal-close:hover {
          background: #e2e8f0;
          color: #2d3748;
        }

        .receipt-modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 30px;
          background: #ffffff;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
        }

        .receipt-modal-receipt {
          max-width: 350px;
          margin: 0 auto;
        }

        .receipt-modal-header-section {
          text-align: center;
          margin-bottom: 15px;
        }

        .receipt-modal-org-name {
          font-weight: bold;
          font-size: 11px;
          margin-bottom: 3px;
        }

        .receipt-modal-church-name {
          font-weight: bold;
          font-size: 13px;
          margin-bottom: 3px;
        }

        .receipt-modal-address {
          font-size: 11px;
          margin-bottom: 8px;
          color: #555;
        }

        .receipt-modal-title {
          font-weight: bold;
          font-size: 12px;
          margin-top: 8px;
        }

        .receipt-modal-divider {
          border: none;
          border-top: 1px dashed #ccc;
          margin: 10px 0;
        }

        .receipt-modal-section {
          margin-bottom: 10px;
        }

        .receipt-modal-section-title {
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .receipt-modal-section > div:not(.receipt-modal-section-title) {
          margin-bottom: 3px;
          font-size: 12px;
        }

        .receipt-modal-receipt-info {
          text-align: center;
        }

        .receipt-modal-receipt-info > div {
          margin-bottom: 3px;
          font-size: 12px;
        }

        .receipt-modal-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 12px;
          padding: 0 5px;
        }

        .receipt-modal-total-section {
          border-top: 2px solid #000;
          padding-top: 8px;
          margin-top: 8px;
        }

        .receipt-modal-summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;
          padding: 0 5px;
        }

        .receipt-modal-footer {
          text-align: center;
          margin-top: 10px;
          font-size: 11px;
        }

        .receipt-modal-footer-text {
          margin-bottom: 3px;
          font-weight: bold;
        }

        .receipt-modal-actions {
          display: flex;
          gap: 10px;
          padding: 20px;
          background: #f8f9fa;
          border-top: 2px solid #e2e8f0;
          justify-content: center;
          flex-wrap: wrap;
        }

        .receipt-modal-button {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
          min-width: 150px;
        }

        .receipt-modal-button-print {
          background: #4CAF50;
          color: white;
        }

        .receipt-modal-button-print:hover {
          background: #45a049;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        }

        .receipt-modal-button-download {
          background: #2196F3;
          color: white;
        }

        .receipt-modal-button-download:hover {
          background: #0b7dda;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        }

        .receipt-modal-button-download:disabled {
          background: #90caf9;
          cursor: not-allowed;
          transform: none;
        }

        .receipt-modal-button-close {
          background: #666;
          color: white;
        }

        .receipt-modal-button-close:hover {
          background: #555;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        @media print {
          .receipt-modal-overlay,
          .receipt-modal-header,
          .receipt-modal-actions {
            display: none !important;
          }

          .receipt-modal-container {
            position: static;
            box-shadow: none;
            max-width: 100%;
            width: 100%;
            max-height: 100%;
            background: white;
            border-radius: 0;
          }

          .receipt-modal-content {
            padding: 10px;
            max-height: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ReceiptModal;

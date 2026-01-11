// Helper function to format duration
const formatDuration = (minutes) => {
  if (!minutes) return 'N/A';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Format Philippine Peso currency
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₱0.00';
  
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
};

// Format date to local string
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// Format time to local string
const formatTime = (timeString) => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Calculate totals correctly
const calculateTotals = (appointment) => {
  // Service total
  const serviceTotal = appointment.payment_amount || 0;
  
  // Offering total
  let offeringTotal = 0;
  if (appointment.offering_total !== undefined) {
    // Use the pre-calculated offering_total from database
    offeringTotal = appointment.offering_total;
  } else if (appointment.appointment_products) {
    // Calculate from appointment_products
    offeringTotal = appointment.appointment_products.reduce(
      (sum, item) => sum + (item.total_price || 0), 
      0
    );
  } else if (appointment.offerings) {
    // Calculate from offerings
    offeringTotal = appointment.offerings.reduce(
      (sum, item) => sum + (item.total_price || (item.quantity * item.unit_price) || 0), 
      0
    );
  }
  
  // Grand total
  const grandTotal = serviceTotal + offeringTotal;
  
  // Amount paid and change
  const amountPaid = appointment.amount_paid || 0;
  const changeAmount = Math.max(0, amountPaid - grandTotal);
  
  return {
    serviceTotal,
    offeringTotal,
    grandTotal,
    amountPaid,
    changeAmount
  };
};

// Generate receipt content
export const generateReceiptContent = (appointment) => {
  const now = new Date();
  const printDate = now.toLocaleDateString('en-PH');
  const printTime = now.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  // Calculate totals CORRECTLY
  const { 
    serviceTotal, 
    offeringTotal, 
    grandTotal, 
    amountPaid, 
    changeAmount 
  } = calculateTotals(appointment);
  
  // Get service duration
  const serviceDuration = appointment.service_duration || appointment.services?.duration_minutes || 60;
  const durationText = formatDuration(serviceDuration);
  
  // Header
  let content = '================================\n';
  content += 'ROMAN CATHOLIC ARCHBISHOP OF CEBU (RCAC)\n';
  content += 'ST. FRANCIS OF ASSISI PARISH\n';
  content += 'Pili, Madrdejos, Cebu\n';
  content += '================================\n';
  content += `Date: ${printDate}\n`;
  content += `Time: ${printTime}\n`;
  content += `Receipt: ${appointment.receipt_number || 'N/A'}\n`;
  content += '--------------------------------\n';
  
  // Customer Information
  content += 'CUSTOMER INFORMATION\n';
  content += '--------------------------------\n';
  content += `Name: ${appointment.customer_first_name || ''} ${appointment.customer_last_name || ''}\n`;
  content += `Email: ${appointment.customer_email || 'N/A'}\n`;
  if (appointment.customer_phone) {
    content += `Phone: +63${appointment.customer_phone}\n`;
  }
  content += '--------------------------------\n';
  
  // Service Information
  content += 'SERVICE DETAILS\n';
  content += '--------------------------------\n';
  content += `Service: ${appointment.service_type || 'N/A'}\n`;
  content += `Duration: ${durationText}\n`;
  content += `Date: ${formatDate(appointment.appointment_date)}\n`;
  content += `Time: ${formatTime(appointment.appointment_time)}\n`;
  content += '--------------------------------\n';
  
  // Items
  content += 'ITEMS\n';
  content += '--------------------------------\n';
  
  // Service Fee
  if (serviceTotal > 0) {
    content += `${appointment.service_type || 'Service'}\n`;
    content += `  ${formatCurrency(serviceTotal)}\n`;
  }
  
  // Offerings
  const offerings = appointment.appointment_products || appointment.offerings || [];
  if (offerings.length > 0) {
    offerings.forEach((item, index) => {
      const productName = item.products?.product_name || item.product_name || 'Offering';
      const quantity = item.quantity || 1;
      const unitPrice = item.unit_price || item.price || 0;
      const total = item.total_price || (quantity * unitPrice);
      
      content += `${productName} x${quantity}\n`;
      content += `  ${formatCurrency(total)}\n`;
    });
  }
  
  // Summary - CORRECT CALCULATIONS
  content += '--------------------------------\n';
  content += 'SUMMARY\n';
  content += '--------------------------------\n';
  
  if (serviceTotal > 0) {
    content += `Service Fee: ${formatCurrency(serviceTotal)}\n`;
  }
  
  if (offeringTotal > 0) {
    content += `Offerings: ${formatCurrency(offeringTotal)}\n`;
  }
  
  content += `Grand Total: ${formatCurrency(grandTotal)}\n`;
  content += `Amount Paid: ${formatCurrency(amountPaid)}\n`;
  content += `Change: ${formatCurrency(changeAmount)}\n`;
  content += '--------------------------------\n';
  
  // Payment Method
  content += 'PAYMENT METHOD\n';
  content += '--------------------------------\n';
  content += `Method: ${appointment.payment_method || 'Cash'}\n`;
  content += `Status: ${appointment.payment_status || 'Paid'}\n`;
  content += '--------------------------------\n';
  
  // Footer
  content += 'THANK YOU FOR YOUR SUPPORT!\n';
  content += 'May God bless you abundantly.\n';
  content += '================================\n';
  content += '    OFFICIAL RECEIPT - COPY    \n';
  content += '================================\n';
  
  return content;
};

// Print receipt using browser print dialog
export const printReceipt = (appointment) => {
  try {
    // Generate receipt content
    const receiptContent = generateReceiptContent(appointment);
    
    // Create a printable window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      console.error('Failed to open print window. Please allow popups.');
      alert('Please allow popups to print receipt.');
      return;
    }
    
    // Get current date and time
    const now = new Date();
    const printDate = now.toLocaleDateString('en-PH');
    const printTime = now.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Get service duration
    const serviceDuration = appointment.service_duration || appointment.services?.duration_minutes || 60;
    const durationText = formatDuration(serviceDuration);
    
    // Calculate totals CORRECTLY
    const { 
      serviceTotal, 
      offeringTotal, 
      grandTotal, 
      amountPaid, 
      changeAmount 
    } = calculateTotals(appointment);
    
    // Create printable HTML with CORRECT calculations
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${appointment.receipt_number || 'N/A'}</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <style>
          @media print {
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.2;
              margin: 0;
              padding: 10px;
            }
            
            .receipt {
              max-width: 300px;
              margin: 0 auto;
            }
            
            .text-center {
              text-align: center;
            }
            
            .text-right {
              text-align: right;
            }
            
            .separator {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            
            .bold {
              font-weight: bold;
            }
            
            .uppercase {
              text-transform: uppercase;
            }
            
            .mt-1 {
              margin-top: 4px;
            }
            
            .mt-2 {
              margin-top: 8px;
            }
            
            .mb-1 {
              margin-bottom: 4px;
            }
            
            .mb-2 {
              margin-bottom: 8px;
            }
            
            .total-section {
              border-top: 2px solid #000;
              padding-top: 8px;
              margin-top: 8px;
            }
            
            .footer {
              font-size: 10px;
              margin-top: 20px;
              text-align: center;
            }
            
            .no-print {
              display: none;
            }
            
            @page {
              margin: 10mm;
              size: 80mm 297mm;
            }
          }
          
          @media screen {
            body {
              font-family: 'Courier New', monospace;
              font-size: 14px;
              line-height: 1.3;
              margin: 20px;
              background: #f5f5f5;
            }
            
            .receipt {
              background: white;
              padding: 20px;
              max-width: 300px;
              margin: 0 auto;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              border-radius: 4px;
            }
            
            .text-center {
              text-align: center;
            }
            
            .text-right {
              text-align: right;
            }
            
            .separator {
              border-top: 1px dashed #ccc;
              margin: 10px 0;
            }
            
            .bold {
              font-weight: bold;
            }
            
            .uppercase {
              text-transform: uppercase;
            }
            
            .mt-1 {
              margin-top: 5px;
            }
            
            .mt-2 {
              margin-top: 10px;
            }
            
            .mb-1 {
              margin-bottom: 5px;
            }
            
            .mb-2 {
              margin-bottom: 10px;
            }
            
            .total-section {
              border-top: 2px solid #333;
              padding-top: 10px;
              margin-top: 10px;
            }
            
            .footer {
              font-size: 11px;
              margin-top: 25px;
              text-align: center;
              color: #666;
            }
            
            .print-button {
              display: block;
              width: 200px;
              margin: 20px auto;
              padding: 10px 20px;
              background: #4CAF50;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            }
            
            .print-button:hover {
              background: #45a049;
            }
            
            .download-button {
              display: block;
              width: 200px;
              margin: 10px auto;
              padding: 10px 20px;
              background: #2196F3;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            }
            
            .download-button:hover {
              background: #0b7dda;
            }
            
            .close-button {
              display: block;
              width: 200px;
              margin: 10px auto;
              padding: 10px 20px;
              background: #666;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            }
            
            .close-button:hover {
              background: #555;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="text-center bold mb-1">
            ROMAN CATHOLIC ARCHBISHOP OF CEBU (RCAC)
          </div>
          <div class="text-center bold mb-1">
            ST. FRANCIS OF ASSISI PARISH
          </div>
          <div class="text-center mb-1">
            Pili, Madrdejos, Cebu
          </div>
          <div class="text-center mb-2">
            Official Receipt
          </div>
          
          <div class="separator"></div>
          
          <div class="text-center mb-2">
            <div class="bold">Receipt: ${appointment.receipt_number || 'N/A'}</div>
            <div>Date: ${printDate}</div>
            <div>Time: ${printTime}</div>
          </div>
          
          <div class="separator"></div>
          
          <div class="bold mb-2">CUSTOMER INFORMATION</div>
          <div>Name: ${appointment.customer_first_name || ''} ${appointment.customer_last_name || ''}</div>
          <div>Email: ${appointment.customer_email || 'N/A'}</div>
          ${appointment.customer_phone ? `<div>Phone: +63${appointment.customer_phone}</div>` : ''}
          
          <div class="separator"></div>
          
          <div class="bold mb-2">SERVICE DETAILS</div>
          <div>Service: ${appointment.service_type || 'N/A'}</div>
          <div>Duration: ${durationText}</div>
          <div>Date: ${formatDate(appointment.appointment_date)}</div>
          <div>Time: ${formatTime(appointment.appointment_time)}</div>
          
          <div class="separator"></div>
          
          <div class="bold mb-2">ITEMS</div>
          
          ${serviceTotal > 0 ? `
            <div class="mb-2">
              <div>${appointment.service_type || 'Service'}</div>
              <div class="text-right">${formatCurrency(serviceTotal)}</div>
            </div>
          ` : ''}
          
          ${(appointment.appointment_products || appointment.offerings || []).map(item => {
            const productName = item.products?.product_name || item.product_name || 'Offering';
            const quantity = item.quantity || 1;
            const unitPrice = item.unit_price || item.price || 0;
            const total = item.total_price || (quantity * unitPrice);
            
            return `
              <div class="mb-2">
                <div>${productName} x${quantity}</div>
                <div class="text-right">${formatCurrency(total)}</div>
              </div>
            `;
          }).join('')}
          
          ${(appointment.appointment_products || appointment.offerings || []).length === 0 && serviceTotal === 0 ? 
            '<div class="mb-2 text-center">No items</div>' : ''}
          
          <div class="separator"></div>
          
          <div class="bold mb-2">SUMMARY</div>
          
          ${serviceTotal > 0 ? `
            <div class="mb-1">
              <div>Service Fee:</div>
              <div class="text-right">${formatCurrency(serviceTotal)}</div>
            </div>
          ` : ''}
          
          ${offeringTotal > 0 ? `
            <div class="mb-1">
              <div>Offerings:</div>
              <div class="text-right">${formatCurrency(offeringTotal)}</div>
            </div>
          ` : ''}
          
          <div class="total-section">
            <div class="bold mb-1">
              <div>Grand Total:</div>
              <div class="text-right">${formatCurrency(grandTotal)}</div>
            </div>
            
            <div class="mb-1">
              <div>Amount Paid:</div>
              <div class="text-right">${formatCurrency(amountPaid)}</div>
            </div>
            
            <div class="mb-1">
              <div>Change:</div>
              <div class="text-right">${formatCurrency(changeAmount)}</div>
            </div>
          </div>
          
          <div class="separator"></div>
          
          <div class="bold mb-2">PAYMENT METHOD</div>
          <div>Method: ${appointment.payment_method || 'Cash'}</div>
          <div>Status: ${appointment.payment_status || 'Paid'}</div>
          
          <div class="separator"></div>
          
          <div class="footer">
            <div class="bold mb-1">THANK YOU FOR YOUR SUPPORT!</div>
            <div class="mb-1">May God bless you abundantly.</div>
            <div class="separator mt-2"></div>
            <div class="mt-1">OFFICIAL RECEIPT - COPY</div>
          </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd;">
          <button class="print-button" onclick="window.print()">🖨️ Print Receipt</button>
          <button class="print-button" onclick="downloadPDF()" style="background: #2196F3; margin-top: 10px;">⬇️ Download as PDF</button>
          <button class="close-button" onclick="window.close()" style="margin-top: 10px;">Close Window</button>
        </div>
        
        <script>
          async function downloadPDF() {
            try {
              const { jsPDF } = window.jspdf;
              const html2canvas = window.html2canvas;
              
              if (!jsPDF || !html2canvas) {
                alert('PDF library not loaded. Please try again or use Print instead.');
                return;
              }
              
              const receiptElement = document.querySelector('.receipt');
              const canvas = await html2canvas(receiptElement, { scale: 2, useCORS: true });
              
              const imgData = canvas.toDataURL('image/png');
              const pdf = new jsPDF({
                unit: 'px',
                format: [canvas.width, canvas.height]
              });
              
              pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
              pdf.save('${appointment.receipt_number || 'receipt'}.pdf');
            } catch (error) {
              console.error('PDF download failed:', error);
              alert('Failed to download PDF. Please use Print instead.');
            }
          }
        </script>
      </body>
      </html>
    `;
    
    // Try to automatically generate a PDF and download using html2canvas + jsPDF
    const tryAutoPdf = async () => {
      try {
        const { default: html2canvas } = await import('html2canvas');
        const { jsPDF } = await import('jspdf');

        // Create a hidden iframe to render the receipt HTML (preserves head styles)
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        document.body.appendChild(iframe);

        const idoc = iframe.contentDocument || iframe.contentWindow.document;
        idoc.open();
        idoc.write(htmlContent);
        idoc.close();

        // Wait for resources to load
        await new Promise((resolve) => {
          iframe.onload = () => setTimeout(resolve, 250);
        });

        const receiptEl = idoc.querySelector('.receipt') || idoc.body;

        const canvas = await html2canvas(receiptEl, { scale: 2, useCORS: true, windowWidth: receiptEl.scrollWidth, windowHeight: receiptEl.scrollHeight });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

        const filename = `${appointment.receipt_number || 'receipt'}.pdf`;
        pdf.save(filename);

        // cleanup
        document.body.removeChild(iframe);
        return true;
      } catch (err) {
        console.warn('Auto PDF generation failed, falling back to print:', err);
        return false;
      }
    };

    // Attempt auto PDF; if it fails, fall back to printable window
    return tryAutoPdf().then(success => {
      if (success) return true;

      // Write content to window and open print dialog as fallback
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      return true;
    }).catch(() => {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      return true;
    });

  } catch (error) {
    console.error('Error printing receipt:', error);
    
    // Fallback to alert with receipt content
    const receiptContent = generateReceiptContent(appointment);
    
    // Create a simple popup with the receipt
    const fallbackWindow = window.open('', '_blank', 'width=400,height=600');
    if (fallbackWindow) {
      fallbackWindow.document.write(`
        <html>
        <head>
          <title>Receipt - ${appointment.receipt_number || 'N/A'}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              white-space: pre-wrap;
              padding: 20px;
              background: white;
            }
            .receipt-text {
              line-height: 1.5;
            }
            .print-btn {
              margin-top: 20px;
              padding: 10px 20px;
              background: #4CAF50;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            .print-btn:hover {
              background: #45a049;
            }
          </style>
        </head>
        <body>
          <div class="receipt-text">${receiptContent.replace(/\n/g, '<br>')}</div>
          <button class="print-btn" onclick="window.print()">Print</button>
          <button class="print-btn" onclick="window.close()" style="background: #666; margin-left: 10px;">Close</button>
        </body>
        </html>
      `);
      fallbackWindow.document.close();
    } else {
      // Last resort - alert
      alert(`Receipt generated:\n\n${receiptContent}\n\nPlease take a screenshot or copy this receipt.`);
    }
    
    return false;
  }
};

// Generate receipt for standalone offerings
export const generateOfferingReceipt = (offeringData) => {
  const now = new Date();
  const printDate = now.toLocaleDateString('en-PH');
  const printTime = now.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  const offeringTotal = offeringData.items?.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_price);
  }, 0) || 0;
  
  const amountPaid = offeringData.amount_paid || 0;
  const changeAmount = Math.max(0, amountPaid - offeringTotal);
  
  let content = '================================\n';
  content += '         CHURCH OFFERINGS        \n';
  content += '================================\n';
  content += `Date: ${printDate}\n`;
  content += `Time: ${printTime}\n`;
  content += `Receipt: ${offeringData.receipt_number || 'N/A'}\n`;
  content += '--------------------------------\n';
  
  content += 'CUSTOMER INFORMATION\n';
  content += '--------------------------------\n';
  content += `Name: ${offeringData.customer_name || 'N/A'}\n`;
  if (offeringData.customer_email) {
    content += `Email: ${offeringData.customer_email}\n`;
  }
  if (offeringData.customer_phone) {
    content += `Phone: +63${offeringData.customer_phone}\n`;
  }
  content += '--------------------------------\n';
  
  content += 'OFFERING ITEMS\n';
  content += '--------------------------------\n';
  
  offeringData.items?.forEach((item, index) => {
    const productName = item.product_name || 'Offering';
    const quantity = item.quantity || 1;
    const unitPrice = item.unit_price || 0;
    const total = quantity * unitPrice;
    
    content += `${productName} x${quantity}\n`;
    content += `  ${formatCurrency(total)}\n`;
  });
  
  content += '--------------------------------\n';
  content += 'SUMMARY\n';
  content += '--------------------------------\n';
  content += `Total Offerings: ${formatCurrency(offeringTotal)}\n`;
  content += `Amount Paid: ${formatCurrency(amountPaid)}\n`;
  content += `Change: ${formatCurrency(changeAmount)}\n`;
  content += '--------------------------------\n';
  
  content += 'PAYMENT METHOD\n';
  content += '--------------------------------\n';
  content += 'Method: Cash\n';
  content += 'Status: Paid\n';
  content += '--------------------------------\n';
  
  content += 'THANK YOU FOR YOUR GENEROSITY!\n';
  content += 'May God bless you abundantly.\n';
  content += '================================\n';
  content += '    OFFERING RECEIPT - COPY    \n';
  content += '================================\n';
  
  return content;
};

// Print offering receipt
export const printOfferingReceipt = (offeringData) => {
  try {
    // Create appointment-like object for consistency
    const appointmentData = {
      receipt_number: offeringData.receipt_number,
      service_type: 'Offering Only',
      payment_amount: 0,
      offering_total: offeringData.items?.reduce((sum, item) => 
        sum + (item.quantity * item.unit_price), 0
      ) || 0,
      amount_paid: offeringData.amount_paid,
      change_amount: Math.max(0, (offeringData.amount_paid || 0) - (offeringData.items?.reduce((sum, item) => 
        sum + (item.quantity * item.unit_price), 0
      ) || 0)),
      customer_first_name: offeringData.customer_name?.split(' ')[0] || '',
      customer_last_name: offeringData.customer_name?.split(' ').slice(1).join(' ') || '',
      customer_email: offeringData.customer_email || '',
      customer_phone: offeringData.customer_phone || '',
      appointment_date: new Date().toISOString().split('T')[0],
      appointment_time: new Date().toLocaleTimeString('en-PH', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      payment_method: 'Cash',
      payment_status: 'Paid',
      appointment_products: offeringData.items?.map(item => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      })) || []
    };
    
    printReceipt(appointmentData);
  } catch (error) {
    console.error('Error printing offering receipt:', error);
    
    const receiptContent = generateOfferingReceipt(offeringData);
    alert(`Offering receipt:\n\n${receiptContent}\n\nPlease take a screenshot or copy this receipt.`);
  }
};

// Export helper functions for use elsewhere
export { formatDuration, formatCurrency, formatDate, formatTime, calculateTotals };
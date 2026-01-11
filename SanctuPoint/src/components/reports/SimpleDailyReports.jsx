import { useState, useEffect } from 'react';
import { appointmentService } from '../../services/appointmentService';
import { authService } from '../../auth/authService';

const SimpleDailyReports = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  const generateReport = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      setError('Only administrators can generate reports');
      return;
    }

    setLoading(true);
    setError('');
    setReport(null);

    try {
      const result = await appointmentService.getDailyReport(date);
      
      if (result.success) {
        setReport(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    if (!report) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Daily Report - ${date}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .report { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { margin: 20px 0; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 10px; text-align: left; }
            th { background: #f0f0f0; }
            .total { font-weight: bold; background: #f8f8f8; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div class="report">
            <div class="header">
              <p style="margin: 0; font-weight: bold;">ROMAN CATHOLIC ARCHBISHOP OF CEBU (RCAC)</p>
              <h1 style="margin: 5px 0;">ST. FRANCIS OF ASSISI PARISH</h1>
              <p style="margin: 0; font-size: 14px;">Pili, Madrdejos, Cebu</p>
              <hr style="margin: 15px 0; border: none; border-top: 1px solid #000;" />
              <h2>Daily Payment Report</h2>
              <h3>${new Date(date).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            </div>
            
            <div class="summary">
              <h4>Daily Summary</h4>
              <p>Total Paid Appointments: ${report.totals.totalAppointments}</p>
              <p>Total Payments: ₱${report.totals.totalPayments.toFixed(2)}</p>
              <p>Total Change Given: ₱${report.totals.totalChange.toFixed(2)}</p>
              <p>Net Revenue: ₱${report.totals.netRevenue.toFixed(2)}</p>
            </div>
            
            ${report.appointments.length > 0 ? `
              <h4>Transaction Details (${report.appointments.length})</h4>
              <table class="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Receipt No</th>
                    <th>Fee</th>
                    <th>Paid</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  ${report.appointments.map(app => `
                    <tr>
                      <td>${app.appointment_time}</td>
                      <td>${app.customer_first_name} ${app.customer_last_name}</td>
                      <td>${app.service_type}</td>
                      <td>${app.receipt_number || 'N/A'}</td>
                      <td>₱${(app.payment_amount || 0).toFixed(2)}</td>
                      <td>₱${(app.amount_paid || 0).toFixed(2)}</td>
                      <td>₱${(app.change_amount || 0).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p>No transactions for this date</p>'}
            
            <div style="margin-top: 40px; text-align: center;">
              <p>Generated on: ${new Date().toLocaleDateString('en-PH')}</p>
              <p>ST. FRANCIS OF ASSISI PARISH - Accounting Department</p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <button onclick="window.print()">Print Report</button>
              <button onclick="window.close()">Close</button>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="page-container">
        <div className="page-content">
          <h2>Access Denied</h2>
          <p>Only administrators can access daily reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="reports-header">
          <h1>Daily Payment Report</h1>
          <p>Generate daily accounting summary</p>
        </div>

        {error && <div className="message error">{error}</div>}

        <div className="report-controls">
          <div className="date-control">
            <label>Select Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          
          <button
            onClick={generateReport}
            disabled={loading}
            className="btn-generate"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {report && (
          <div className="report-display">
            <div className="report-header">
              <h3>Daily Report - {new Date(report.reportDate).toLocaleDateString('en-PH')}</h3>
              <button onClick={printReport} className="btn-print">
                🖨️ Print Report
              </button>
            </div>
            
            <div className="summary-cards">
              <div className="summary-card">
                <div className="card-label">Paid Appointments</div>
                <div className="card-value">{report.totals.totalAppointments}</div>
              </div>
              
              <div className="summary-card">
                <div className="card-label">Total Payments</div>
                <div className="card-value">₱{report.totals.totalPayments.toFixed(2)}</div>
              </div>
              
              <div className="summary-card">
                <div className="card-label">Total Change</div>
                <div className="card-value">₱{report.totals.totalChange.toFixed(2)}</div>
              </div>
              
              <div className="summary-card highlight">
                <div className="card-label">Net Revenue</div>
                <div className="card-value">₱{report.totals.netRevenue.toFixed(2)}</div>
              </div>
            </div>

            {report.appointments.length > 0 && (
              <div className="appointments-list">
                <h4>Transactions ({report.appointments.length})</h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Receipt</th>
                        <th>Fee</th>
                        <th>Paid</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.appointments.map(app => (
                        <tr key={app.appointment_id}>
                          <td>{app.appointment_time}</td>
                          <td>{app.customer_first_name} {app.customer_last_name}</td>
                          <td>{app.service_type}</td>
                          <td>{app.receipt_number}</td>
                          <td>₱{(app.payment_amount || 0).toFixed(2)}</td>
                          <td>₱{(app.amount_paid || 0).toFixed(2)}</td>
                          <td>₱{(app.change_amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .report-controls {
          display: flex;
          gap: 15px;
          align-items: flex-end;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }
        
        .date-control {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .date-control label {
          font-weight: 600;
          color: #4a5568;
        }
        
        .date-control input {
          padding: 10px 12px;
          border: 2px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
        }
        
        .btn-generate {
          padding: 10px 20px;
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .btn-generate:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
        }
        
        .report-display {
          background: #f8fafc;
          border-radius: 12px;
          padding: 25px;
          margin-top: 20px;
        }
        
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e2e8f0;
        }
        
        .report-header h3 {
          margin: 0;
          color: #2d3748;
        }
        
        .btn-print {
          padding: 8px 16px;
          background: #718096;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .btn-print:hover {
          background: #4a5568;
        }
        
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .summary-card {
          background: white;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .summary-card.highlight {
          border: 2px solid #48bb78;
          background: #f0fff4;
        }
        
        .card-label {
          color: #718096;
          font-size: 14px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .card-value {
          font-size: 24px;
          font-weight: 700;
          color: #2d3748;
        }
        
        .summary-card.highlight .card-value {
          color: #276749;
        }
        
        .table-container {
          overflow-x: auto;
          margin-top: 20px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }
        
        th {
          background: #2d3748;
          color: white;
          padding: 12px 15px;
          text-align: left;
          font-weight: 600;
          font-size: 14px;
        }
        
        td {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
        }
        
        tr:hover {
          background: #f7fafc;
        }
      `}</style>
    </div>
  );
};

export default SimpleDailyReports;
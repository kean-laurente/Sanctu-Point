const HomePage = ({ user }) => {
  return (
    <div className="page-container">
      <div className="page-content">
        <h1>Dashboard</h1>
        <div className="blank-page">
          <div className="blank-content">
            <h2>Welcome to your Dashboard, {user?.first_name}!</h2>
            <p>This is your main dashboard page. Content will be added here soon.</p>
            <div className="placeholder-box">
              <p>📊 Dashboard metrics and overview will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
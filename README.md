# 📦 Warehouse Monitoring

A simple web-based project to monitor and visualize warehouse activity.  
This project demonstrates how HTML, CSS, and JavaScript can be combined to build an interactive dashboard for warehouse operations.
Warehouse Monitoring Link: https://kenrk.github.io/warehouse-monitoring/

---

## 🚀 Features
- **Real-time Monitoring**: JavaScript logic (`script.js`) handles dynamic updates and interactions.
- **Responsive UI**: Styled with `styles.css` for clean and adaptive layouts.
- **Dashboard Interface**: `index.html` provides a structured view for monitoring warehouse data

## 📊 Data Source: Google Sheets

This project uses **Google Sheets** as the backend data source for warehouse monitoring. The Google Sheets is from **warehouse** project.

### How It Works
- The Google Sheet is published to the web (File → Share → Publish to web).
- `script.js` retrieves the sheet data using the **Google Visualization API** or a direct CSV/JSON feed.
- The data is parsed and displayed dynamically on the dashboard (`index.html`).
- Updates made in the Google Sheet are reflected in real time on the monitoring interface.

### Example Setup
1. Create a Google Sheet
2. Publish the sheet:
- Go to **File → Share → Publish to web**.
- Copy the generated link.
3. In `script.js`, update the fetch URL:
```javascript
const sheetURL = "https://docs.google.com/spreadsheets/d/<YOUR_SHEET_ID>/gviz/tq?tqx=out:json";
```
### 🔒 Notes
1. Ensure the sheet is shared with "Anyone with the link" for public dashboards.

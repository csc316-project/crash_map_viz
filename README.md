# Plane Crashes Heat Map by Country - D3 Globe Visualization

A dynamic, interactive heat map visualization of historical plane crashes displayed by country on a 3D globe using D3.js.

## Features

- **3D Globe Visualization**: Interactive globe that can be rotated and zoomed
- **Country-Based Heat Map**: Countries are colored based on crash frequency (blue = low, red = high)
- **Time Slider**: Filter crashes by year with an interactive slider
- **Animation**: Play button to animate crashes over time
- **Interactive Controls**: 
  - Drag to rotate the globe
  - Mouse wheel to zoom in/out
  - Year slider to filter by time period
  - Hover over countries to see crash statistics

## Setup Instructions

### 1. Download the Dataset

1. Go to [Kaggle Dataset: Historical Plane Crash Data](https://www.kaggle.com/datasets/abeperez/historical-plane-crash-data)
2. Download the dataset (you may need to create a Kaggle account)
3. Extract the CSV file from the downloaded archive

### 2. Verify Your Data

The visualization works directly with the CSV file as long as it has:
- **Date** column (for filtering by year)
- **Country** column (for the heat map)

No data processing is required! The visualization will automatically:
- Extract years from dates
- Match country names to the world map
- Aggregate crashes by country
- Color countries based on crash frequency

### 3. Run the Visualization

**Option 1: Using Python HTTP Server (Recommended)**

```bash
python -m http.server 8000
```

Then open your browser and navigate to:
```
http://localhost:8000
```

**Option 2: Using Node.js HTTP Server**

```bash
npx http-server -p 8000
```

**Option 3: Using PHP**

```bash
php -S localhost:8000
```

**Note**: You cannot simply open `index.html` directly in the browser due to CORS restrictions when loading CSV files. You must use a local server.

## File Structure

```
csc316-proj/
├── index.html              # Main HTML file with the visualization
├── globe-visualization.js  # D3.js visualization code
├── process_data.py         # Python script to process the dataset
├── plane_crashes.csv       # Processed CSV file (generated)
└── README.md              # This file
```

## Requirements

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3 (for data processing script)
- Internet connection (for loading D3.js and TopoJSON libraries from CDN)

## Usage

1. **Rotate the Globe**: Click and drag on the globe to rotate it
2. **Zoom**: Use your mouse wheel to zoom in and out
3. **Filter by Year**: Use the year slider to see crashes up to a specific year
4. **Animate**: Click the "Play" button to automatically animate through the years
5. **Reset**: Click "Reset" to go back to the earliest year

## Data Format

The CSV file should have the following columns:
- `Date`: Date of the crash (format: MM/DD/YYYY or YYYY-MM-DD) - **Required**
- `Country`: Country name where the crash occurred - **Required**
- `Total fatalities` or `Fatalities`: Number of fatalities (optional, for statistics)
- `Crash location`: Location description (optional, for tooltips)
- `Operator`: Aircraft operator (optional, for tooltips)

**Note:** The visualization automatically matches country names from your CSV to the world map. Common variations (like "United States of America" → "United States") are handled automatically.

## Troubleshooting

### "Error loading data" message
- Make sure `Plane Crashes.csv` or `plane_crashes.csv` is in the same directory as `index.html`
- Verify you're running a local server (not opening the file directly)
- Check the browser console for specific error messages

### Countries not showing colors
- Verify the CSV file has a `Country` column
- Check that country names are spelled correctly (common variations are handled automatically)
- Check the browser console to see if there are country name matching issues
- Some countries might not match if they have very different names - check the console for unmatched countries

### Globe not displaying
- Check your internet connection (needs to load D3.js and TopoJSON)
- Open browser developer console to see any JavaScript errors

## Customization

You can customize the visualization by editing `globe-visualization.js`:

- **Colors**: Modify the `colorScale` in the `drawHeatMap` function
- **Point Size**: Adjust the radius calculation in `drawCrashPoints`
- **Animation Speed**: Change the interval in the play button handler (currently 100ms)
- **Globe Size**: Modify the `scale` parameter in the `projection` definition

## License

This project is for educational purposes. The dataset is from Kaggle and subject to their terms of use.

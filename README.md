# Plane Crashes Heat Map by Country - D3 Globe Visualization

## https://csc316-project.github.io/crash_map_viz/

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


### Run the Visualization Locally

** Using Python HTTP Server **

```bash
python -m http.server 8000
```

Then open your browser and navigate to:
```
http://localhost:8000
```

**Note**: You cannot simply open `index.html` directly in the browser due to CORS restrictions when loading CSV files. You must use a local server.

This 316 project is for educational purposes. The dataset is from Kaggle and subject to their terms of use.

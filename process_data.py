#!/usr/bin/env python3
"""
Script to process the plane crashes dataset from Kaggle.
This script helps prepare the data for the D3 visualization.

Usage:
    python process_data.py <input_csv> <output_csv>

If no arguments are provided, it will look for 'Aircraft_Crashes_and_Fatalities_Since_1908.csv'
in the current directory and output 'plane_crashes.csv'
"""

import sys
import pandas as pd
import numpy as np

def process_crash_data(input_file, output_file):
    """
    Process the plane crashes CSV file to ensure it has the required columns
    and format for the D3 visualization.
    """
    try:
        # Read the CSV file
        df = pd.read_csv(input_file)
        
        print(f"Original dataset shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()}")
        
        # Standardize column names (handle different possible column names)
        column_mapping = {}
        
        # Map common variations of column names
        for col in df.columns:
            col_lower = col.lower()
            if 'date' in col_lower:
                column_mapping[col] = 'Date'
            elif 'location' in col_lower:
                column_mapping[col] = 'Location'
            elif 'latitude' in col_lower or 'lat' in col_lower:
                column_mapping[col] = 'Latitude'
            elif 'longitude' in col_lower or 'lon' in col_lower or 'lng' in col_lower:
                column_mapping[col] = 'Longitude'
            elif 'operator' in col_lower:
                column_mapping[col] = 'Operator'
            elif 'fatalities' in col_lower or 'fatal' in col_lower:
                column_mapping[col] = 'Fatalities'
        
        df = df.rename(columns=column_mapping)
        
        # Ensure required columns exist
        required_columns = ['Date', 'Latitude', 'Longitude']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            print(f"Warning: Missing columns: {missing_columns}")
            print("Available columns:", df.columns.tolist())
            return False
        
        # Clean the data
        # Convert latitude and longitude to numeric
        df['Latitude'] = pd.to_numeric(df['Latitude'], errors='coerce')
        df['Longitude'] = pd.to_numeric(df['Longitude'], errors='coerce')
        
        # Remove rows with invalid coordinates
        initial_count = len(df)
        df = df.dropna(subset=['Latitude', 'Longitude'])
        removed_count = initial_count - len(df)
        
        if removed_count > 0:
            print(f"Removed {removed_count} rows with invalid coordinates")
        
        # Validate coordinate ranges
        df = df[
            (df['Latitude'] >= -90) & (df['Latitude'] <= 90) &
            (df['Longitude'] >= -180) & (df['Longitude'] <= 180)
        ]
        
        # Ensure other columns exist with defaults
        if 'Location' not in df.columns:
            df['Location'] = 'Unknown'
        if 'Operator' not in df.columns:
            df['Operator'] = 'Unknown'
        if 'Fatalities' not in df.columns:
            df['Fatalities'] = 0
        
        # Fill NaN values
        df['Location'] = df['Location'].fillna('Unknown')
        df['Operator'] = df['Operator'].fillna('Unknown')
        df['Fatalities'] = pd.to_numeric(df['Fatalities'], errors='coerce').fillna(0)
        
        # Save processed data
        df.to_csv(output_file, index=False)
        
        print(f"\nProcessed dataset saved to: {output_file}")
        print(f"Final dataset shape: {df.shape}")
        print(f"Valid crashes with coordinates: {len(df)}")
        
        # Print some statistics
        if 'Date' in df.columns:
            dates = pd.to_datetime(df['Date'], errors='coerce')
            valid_dates = dates.dropna()
            if len(valid_dates) > 0:
                print(f"Date range: {valid_dates.min()} to {valid_dates.max()}")
        
        print(f"Total fatalities: {df['Fatalities'].sum():.0f}")
        
        return True
        
    except Exception as e:
        print(f"Error processing data: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
    elif len(sys.argv) == 2:
        input_file = sys.argv[1]
        output_file = "plane_crashes.csv"
    else:
        # Default filenames
        input_file = "Aircraft_Crashes_and_Fatalities_Since_1908.csv"
        output_file = "plane_crashes.csv"
    
    print(f"Processing {input_file}...")
    success = process_crash_data(input_file, output_file)
    
    if success:
        print("\n✓ Data processing complete!")
        print(f"Now you can open index.html in a web browser.")
        print("\nNote: For local development, you may need to run a local server:")
        print("  python -m http.server 8000")
        print("Then open: http://localhost:8000")
    else:
        print("\n✗ Data processing failed. Please check the error messages above.")
        sys.exit(1)

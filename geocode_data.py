#!/usr/bin/env python3
"""
Script to geocode plane crash locations and add latitude/longitude coordinates.
This script uses the geopy library to convert location names to coordinates.

Installation:
    pip install geopy pandas

Usage:
    python geocode_data.py "Plane Crashes.csv" plane_crashes.csv
"""

import sys
import pandas as pd
import numpy as np
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import time
from tqdm import tqdm

# Initialize geocoder
geolocator = Nominatim(user_agent="plane_crash_visualization")

def geocode_location(location, country=None, max_retries=3):
    """
    Geocode a location string to get latitude and longitude.
    """
    if pd.isna(location) or location == "NA" or location == "":
        return None, None
    
    # Try with country if available
    query = location
    if country and not pd.isna(country):
        query = f"{location}, {country}"
    
    for attempt in range(max_retries):
        try:
            time.sleep(1)  # Rate limiting - be respectful to the service
            location_obj = geolocator.geocode(query, timeout=10)
            if location_obj:
                return location_obj.latitude, location_obj.longitude
        except (GeocoderTimedOut, GeocoderServiceError) as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
                continue
            else:
                print(f"  Geocoding failed for '{query}': {e}")
                return None, None
        except Exception as e:
            print(f"  Unexpected error geocoding '{query}': {e}")
            return None, None
    
    return None, None

def process_and_geocode(input_file, output_file, sample_size=None):
    """
    Process the CSV file and geocode locations.
    """
    try:
        print(f"Reading {input_file}...")
        df = pd.read_csv(input_file)
        
        print(f"Original dataset shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()}")
        
        # Check if coordinates already exist
        has_lat = any('lat' in col.lower() for col in df.columns)
        has_lon = any('lon' in col.lower() for col in df.columns)
        
        if has_lat and has_lon:
            print("Dataset already has latitude/longitude columns!")
            # Just process and save
            df['Latitude'] = pd.to_numeric(df.iloc[:, [i for i, col in enumerate(df.columns) if 'lat' in col.lower()][0]], errors='coerce')
            df['Longitude'] = pd.to_numeric(df.iloc[:, [i for i, col in enumerate(df.columns) if 'lon' in col.lower()][0]], errors='coerce')
        else:
            # Need to geocode
            print("No latitude/longitude columns found. Geocoding locations...")
            print("This may take a while. Please be patient...")
            
            # Initialize new columns
            df['Latitude'] = np.nan
            df['Longitude'] = np.nan
            
            # Get location and country columns
            location_col = None
            country_col = None
            
            for col in df.columns:
                col_lower = col.lower()
                if 'crash location' in col_lower or ('location' in col_lower and 'crash' in col_lower):
                    location_col = col
                elif 'country' in col_lower:
                    country_col = col
            
            if not location_col:
                print("Error: Could not find location column!")
                return False
            
            print(f"Using location column: {location_col}")
            if country_col:
                print(f"Using country column: {country_col}")
            
            # Limit to sample if specified (for testing)
            if sample_size:
                print(f"Processing sample of {sample_size} rows...")
                df_sample = df.head(sample_size).copy()
            else:
                df_sample = df.copy()
            
            # Geocode locations
            print("Geocoding locations (this may take 30+ minutes for full dataset)...")
            for idx, row in tqdm(df_sample.iterrows(), total=len(df_sample), desc="Geocoding"):
                location = row[location_col] if location_col else None
                country = row[country_col] if country_col else None
                
                lat, lon = geocode_location(location, country)
                df_sample.at[idx, 'Latitude'] = lat
                df_sample.at[idx, 'Longitude'] = lon
            
            df = df_sample
        
        # Clean the data
        print("\nCleaning data...")
        initial_count = len(df)
        
        # Convert to numeric
        df['Latitude'] = pd.to_numeric(df['Latitude'], errors='coerce')
        df['Longitude'] = pd.to_numeric(df['Longitude'], errors='coerce')
        
        # Remove rows with invalid coordinates
        df = df.dropna(subset=['Latitude', 'Longitude'])
        removed_count = initial_count - len(df)
        
        if removed_count > 0:
            print(f"Removed {removed_count} rows with invalid coordinates")
        
        # Validate coordinate ranges
        df = df[
            (df['Latitude'] >= -90) & (df['Latitude'] <= 90) &
            (df['Longitude'] >= -180) & (df['Longitude'] <= 180)
        ]
        
        # Standardize column names for the visualization
        column_mapping = {
            'Date': 'Date',
            'Crash location': 'Location',
            'Operator': 'Operator',
            'Total fatalities': 'Fatalities'
        }
        
        # Only rename columns that exist
        rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns}
        df = df.rename(columns=rename_dict)
        
        # Ensure required columns exist
        if 'Location' not in df.columns:
            df['Location'] = df.get('Crash location', 'Unknown')
        if 'Operator' not in df.columns:
            df['Operator'] = 'Unknown'
        if 'Fatalities' not in df.columns:
            df['Fatalities'] = df.get('Total fatalities', 0)
        
        # Fill NaN values
        df['Location'] = df['Location'].fillna('Unknown')
        df['Operator'] = df['Operator'].fillna('Unknown')
        df['Fatalities'] = pd.to_numeric(df['Fatalities'], errors='coerce').fillna(0)
        
        # Save processed data
        print(f"\nSaving to {output_file}...")
        df.to_csv(output_file, index=False)
        
        print(f"\n✓ Processing complete!")
        print(f"Final dataset shape: {df.shape}")
        print(f"Valid crashes with coordinates: {len(df)}")
        
        # Print statistics
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
        input_file = "Plane Crashes.csv"
        output_file = "plane_crashes.csv"
    
    # Check if user wants to process a sample first
    sample_size = None
    if "--sample" in sys.argv:
        try:
            idx = sys.argv.index("--sample")
            sample_size = int(sys.argv[idx + 1])
        except (ValueError, IndexError):
            print("Warning: --sample requires a number. Processing full dataset.")
    
    print(f"Processing {input_file}...")
    if sample_size:
        print(f"NOTE: Processing only first {sample_size} rows as a sample.")
        print("Remove --sample flag to process full dataset.")
    
    success = process_and_geocode(input_file, output_file, sample_size)
    
    if success:
        print("\n✓ Data processing complete!")
        print(f"Output file: {output_file}")
        print("\nNote: For local development, you may need to run a local server:")
        print("  python -m http.server 8000")
        print("Then open: http://localhost:8000")
    else:
        print("\n✗ Data processing failed. Please check the error messages above.")
        sys.exit(1)

// D3 Globe Heat Map Visualization for Plane Crashes

const width = 960;
const height = 600;
let currentYear = 2023;
let isPlaying = false;
let playInterval = null;
let crashesData = [];
let filteredCrashes = [];
let crashPoints = []; // Store crash points with screen coordinates for click detection
let selectedCrashes = []; // All crashes at the clicked location
let currentCrashIndex = 0; // Current index in the selected crashes list
let autoRotateEnabled = true; // Auto-rotate state
let autoRotateInterval = null; // Auto-rotate interval reference
let animationSpeed = 1.0; // Years per second for timeline animation

console.log("Initializing globe visualization...");

// Click detection variables (shared between drag and click handlers)
let clickStartTime = 0;
let clickStartPos = { x: 0, y: 0 };
let wasDragging = false;
const CLICK_THRESHOLD = 5; // pixels - if moved more than this, it's a drag not a click
const CLICK_DURATION = 200; // ms - if longer than this, its a drag not a click

// Remove loading message but keep the button
d3.select("#globe-container")
    .select(".loading")
    .remove();

console.log("Setting up SVG and canvas...");

// Create SVG container
const svg = d3.select("#globe-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

// Create canvas for heat map overlay
const canvas = d3.select("#globe-container")
    .append("canvas")
    .attr("width", width)
    .attr("height", height);

const ctx = canvas.node().getContext("2d");
console.log("Canvas context created");

// Projection for the globe - using orthographic projection
const projection = d3.geoOrthographic()
    .scale(300)
    .translate([width / 2, height / 2])
    .clipAngle(90);

const path = d3.geoPath().projection(projection);

// Rotation state - track x and y rotation
let rotation = { x: 0, y: 0 };
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

console.log("Globe setup complete, rotation:", rotation);


// Load world map data
function loadCSV() {
    console.log("Attempting to load Plane_Crashes_with_Coordinates.csv...");
    return d3.csv("Plane_Crashes_with_Coordinates.csv")
        .catch(error => {
            console.error("File failed to load:", error);
            throw new Error("Could not find 'Plane_Crashes_with_Coordinates.csv'.");
        });
}

console.log("Loading world map and crash data...");

Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
    loadCSV()
]).then(function([world, crashes]) {
    console.log("Data loaded! World features:", world.objects.countries.geometries.length);
    console.log("Raw crashes count:", crashes.length);
    
    crashesData = crashes;
    
    // Process crash data with coordinates - extract lat/lon and other fields
    crashesData = crashesData.map(d => {
        console.log("Processing crash:", d);
        // Get coordinates from various possible column names
        let lat = parseFloat(d.Latitude || d.latitude || d.Lat || d.lat);
        let lon = parseFloat(d.Longitude || d.longitude || d.Lon || d.lon || d.Lng || d.lng);
        
        // Extract year from date (format: YYYY-MM-DD or MM/DD/YYYY)
        let year = null;
        if (d.Date) {
            const dateStr = d.Date.trim();
            if (dateStr.includes('-')) {
                year = parseInt(dateStr.split('-')[0]);
            } else if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                year = parseInt(parts[parts.length - 1]);
            }
        }
        
        return {
            lat: isNaN(lat) ? null : lat,
            lon: isNaN(lon) ? null : lon,
            year: isNaN(year) ? null : year,
            location: d["Crash location"] || d.Location || d.location || "Unknown",
            operator: d.Operator || d.operator || "Unknown",
            fatalities: parseInt(d["Total fatalities"] || d.Fatalities || d.fatalities || 0) || 0,
            country: d.Country || d.country || "Unknown"
        };
    }).filter(d => d.lat !== null && d.lon !== null && d.year !== null);

    console.log("Filtered crashes with valid coords:", crashesData.length);
    console.log("Year range:", d3.min(crashesData, d => d.year), "to", d3.max(crashesData, d => d.year));

    // Draw the globe
    drawGlobe(world);
    console.log("Globe drawn");
    
    // Filter and draw crashes for current year
    filterAndDrawCrashes();
    console.log("Crashes filtered and drawn");
    
    // Setup controls
    setupControls();
    console.log("Controls setup");
    
    // Setup drag interaction
    setupDragInteraction();
    console.log("Drag interaction setup");
    
    // Setup click detection for crash points
    setupClickDetection();
    console.log("Click detection setup");
    
    // Start auto-rotate
    startAutoRotate();
    console.log("Auto-rotate started");
    
    console.log(`Loaded ${crashesData.length} crashes with valid coordinates`);
}).catch(function(error) {
    console.error("Error loading data:", error);
    // Remove loading message
    d3.select("#globe-container")
        .select(".loading")
        .remove();
});

function drawGlobe(world) {
    console.log("Drawing globe with", world.objects.countries.geometries.length, "countries");
    
    // Draw countries with improved styling
    svg.append("g")
        .selectAll("path")
        .data(topojson.feature(world, world.objects.countries).features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#1a1a2e")
        .attr("stroke", "#16213e")
        .attr("stroke-width", 0.8);

    // Draw graticule
    const graticule = d3.geoGraticule();
    svg.append("path")
        .datum(graticule)
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "rgba(255, 255, 255, 0.15)")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.4);

    // Draw globe outline with glow effect
    svg.append("circle")
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .attr("r", projection.scale())
        .attr("fill", "none")
        .attr("stroke", "rgba(255, 255, 255, 0.4)")
        .attr("stroke-width", 2)
        .attr("opacity", 0.5);
    
    // Add outer glow
    svg.append("circle")
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .attr("r", projection.scale() + 2)
        .attr("fill", "none")
        .attr("stroke", "rgba(255, 255, 255, 0.1)")
        .attr("stroke-width", 1)
        .attr("opacity", 0.3);
}

function filterAndDrawCrashes() {
    console.log("Filtering crashes for year:", currentYear);
    
    // Filter crashes by year
    filteredCrashes = crashesData.filter(d => d.year <= currentYear);
    
    console.log("Filtered crashes count:", filteredCrashes.length);
    
    // Update crash count
    d3.select("#crash-count").text(filteredCrashes.length);
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Create heat map data
    const heatMapData = createHeatMapData(filteredCrashes);
    
    // Draw heat map
    drawHeatMap(heatMapData);
    
    // Draw individual crash points
    drawCrashPoints(filteredCrashes);
    
    // Update dynamic legend
    updateLegend(heatMapData);
}

function createHeatMapData(crashes) {
    console.log("Creating heat map data for", crashes.length, "crashes");
    
    // Create a grid for heat map - aggregate crashes by location
    const grid = {};
    const cellSize = 3; // degrees - smaller for more detail
    
    crashes.forEach(crash => {
        const gridX = Math.floor((crash.lon + 180) / cellSize);
        const gridY = Math.floor((crash.lat + 90) / cellSize);
        const key = `${gridX},${gridY}`;
        
        if (!grid[key]) {
            grid[key] = {
                lon: gridX * cellSize - 180 + cellSize / 2,
                lat: gridY * cellSize - 90 + cellSize / 2,
                count: 0,
                fatalities: 0
            };
        }
        grid[key].count++;
        grid[key].fatalities += crash.fatalities;
    });
    
    const result = Object.values(grid);
    console.log("Heat map grid created with", result.length, "cells");
    return result;
}

function drawHeatMap(heatMapData) {
    if (heatMapData.length === 0) {
        console.log("No heat map data to draw");
        return;
    }
    
    console.log("Drawing heat map with", heatMapData.length, "cells");
    
    // Find max count for normalization
    const maxCount = d3.max(heatMapData, d => d.count) || 1;
    console.log("Max count in heat map:", maxCount);
    
    // Color scale - using a custom color scheme for better visibility
    const colorScale = d3.scaleSequential()
        .domain([0, maxCount])
        .interpolator(t => {
            // Custom color interpolation: blue -> cyan -> yellow -> red
            if (t < 0.25) {
                // Blue to Cyan
                const s = t / 0.25;
                return d3.rgb(0, Math.floor(s * 255), 128 + Math.floor(s * 127));
            } else if (t < 0.5) {
                // Cyan to Yellow
                const s = (t - 0.25) / 0.25;
                return d3.rgb(Math.floor(s * 255), 255, Math.floor((1 - s) * 255));
            } else if (t < 0.75) {
                // Yellow to Orange
                const s = (t - 0.5) / 0.25;
                return d3.rgb(255, Math.floor((1 - s * 0.5) * 255), 0);
            } else {
                // Orange to Red
                const s = (t - 0.75) / 0.25;
                return d3.rgb(255, Math.floor((0.5 - s * 0.5) * 255), 0);
            }
        });
    
    heatMapData.forEach(cell => {
        const [x, y] = projection([cell.lon, cell.lat]);
        
        // Check if point is visible (not behind the globe)
        if (x === null || y === null || isNaN(x) || isNaN(y)) return;
        
        // Check if point is within visible area
        const distance = Math.sqrt(Math.pow(x - width/2, 2) + Math.pow(y - height/2, 2));
        if (distance > projection.scale() + 50) return; // Outside globe radius
        
        // Calculate radius based on count
        const radius = Math.sqrt(cell.count / maxCount) * 50;
        
        // Create gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const color = d3.rgb(colorScale(cell.count));
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`);
        gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`);
        gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function drawCrashPoints(crashes) {
    console.log("Drawing", crashes.length, "crash points");
    
    // Reset crash points array
    crashPoints = [];
    
    // Draw all crash points
    crashes.forEach(crash => {
        const [x, y] = projection([crash.lon, crash.lat]);
        
        // Check if point is visible
        if (x === null || y === null || isNaN(x) || isNaN(y)) return;
        
        // Check if point is within visible area
        const distance = Math.sqrt(Math.pow(x - width/2, 2) + Math.pow(y - height/2, 2));
        if (distance > projection.scale() + 50) return;
        
        // Store crash point for click detection
        crashPoints.push({
            crash: crash,
            x: x,
            y: y,
            radius: crash.fatalities > 0 ? Math.min(3, 1 + crash.fatalities / 100) : 1.5
        });
        
        // Check if this crash is in the selected list
        const isSelected = selectedCrashes.length > 0 && 
            selectedCrashes.some(sc => 
                sc.lat === crash.lat && 
                sc.lon === crash.lon &&
                sc.year === crash.year
            );
        
        // Draw point with size based on fatalities
        const pointSize = crash.fatalities > 0 ? Math.min(3, 1 + crash.fatalities / 100) : 1.5;
        
        if (isSelected) {
            // Highlight selected location
            ctx.fillStyle = "rgba(255, 200, 50, 0.9)";
            ctx.beginPath();
            ctx.arc(x, y, pointSize + 1, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = "rgba(255, 255, 255, 1)";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.fillStyle = "rgba(255, 100, 100, 0.6)";
            ctx.beginPath();
            ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    });
}

function setupControls() {
    console.log("Setting up controls...");
    
    const yearSlider = d3.select("#year-slider");
    const yearDisplay = d3.select("#year-display");
    const playPauseBtn = d3.select("#play-pause");
    const resetBtn = d3.select("#reset");
    const autoRotateBtn = d3.select("#auto-rotate-btn");
    const speedSlider = d3.select("#speed-slider");
    const speedDisplay = d3.select("#speed-display");
    
    // Get min and max years from data
    const years = crashesData.map(d => d.year).filter(d => d !== null);
    const minYear = d3.min(years);
    const maxYear = d3.max(years);
    
    console.log("Year range for slider:", minYear, "to", maxYear);
    
    yearSlider
        .attr("min", minYear)
        .attr("max", maxYear)
        .attr("value", maxYear)
        .on("input", function() {
            currentYear = parseInt(this.value);
            yearDisplay.text(currentYear);
            filterAndDrawCrashes();
            updateGlobe();
        });
    
    currentYear = maxYear;
    yearDisplay.text(currentYear);
    
    // Speed control
    speedSlider
        .on("input", function() {
            animationSpeed = parseFloat(this.value);
            speedDisplay.text(animationSpeed.toFixed(1));
            
            // Restart animation with new speed if playing
            if (isPlaying) {
                if (playInterval) {
                    clearInterval(playInterval);
                }
                startAnimation();
            }
        });
    
    speedDisplay.text(animationSpeed.toFixed(1));
    
    function startAnimation() {
        // Calculate interval based on speed (years per second)
        const intervalMs = Math.max(50, Math.floor(1000 / animationSpeed));
        
        playInterval = setInterval(() => {
            currentYear = parseInt(yearSlider.property("value"));
            if (currentYear >= maxYear) {
                currentYear = minYear;
            } else {
                currentYear++;
            }
            yearSlider.property("value", currentYear);
            yearDisplay.text(currentYear);
            filterAndDrawCrashes();
            updateGlobe();
        }, intervalMs);
    }
    
    playPauseBtn.on("click", function() {
        isPlaying = !isPlaying;
        console.log("Play/pause clicked, isPlaying:", isPlaying);
        
        if (isPlaying) {
            playPauseBtn.text("Pause");
            startAnimation();
            console.log("Animation started");
        } else {
            playPauseBtn.text("Play");
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
                console.log("Animation stopped");
            }
        }
    });
    
    resetBtn.on("click", function() {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
        isPlaying = false;
        playPauseBtn.text("Play");
        currentYear = minYear;
        yearSlider.property("value", currentYear);
        yearDisplay.text(currentYear);
        filterAndDrawCrashes();
        updateGlobe();
    });
    
    autoRotateBtn.on("click", function() {
        autoRotateEnabled = !autoRotateEnabled;
        console.log("Auto-rotate toggled:", autoRotateEnabled);
        
        if (autoRotateEnabled) {
            autoRotateBtn.text("Stop Auto-Rotate");
            startAutoRotate();
            console.log("Auto-rotate started");
        } else {
            autoRotateBtn.text("Start Auto-Rotate");
            stopAutoRotate();
            console.log("Auto-rotate stopped");
        }
    });
}

function startAutoRotate() {
    console.log("Starting auto-rotate");
    
    if (autoRotateInterval) {
        clearInterval(autoRotateInterval);
    }
    
    autoRotateInterval = setInterval(() => {
        if (!isDragging && autoRotateEnabled) {
            rotation.y += 0.2;
            updateGlobe();
        }
    }, 50);
    
    console.log("Auto-rotate interval set");
}

function stopAutoRotate() {
    console.log("Stopping auto-rotate");
    
    if (autoRotateInterval) {
        clearInterval(autoRotateInterval);
        autoRotateInterval = null;
        console.log("Auto-rotate interval cleared");
    }
}

function setupDragInteraction() {
    let touchStartDistance = 0;
    let touchStartScale = projection.scale();
    let touchStartAngle = 0;
    let touchStartCenter = { x: 0, y: 0 };
    
    // Mouse drag interaction - works when auto-rotate is stopped
    const handleMouseDown = function(event) {
        if (autoRotateEnabled) {
            console.log("Drag blocked - auto rotate is on");
            return; // Don't allow drag when auto-rotating
        }
        
        console.log("Mouse down - starting drag");
        
        event.preventDefault();
        event.stopPropagation();
        
        isDragging = true;
        previousMousePosition = { 
            x: event.clientX, 
            y: event.clientY 
        };
        
        console.log("Drag started at:", previousMousePosition);
        
        // Change cursor
        svg.style("cursor", "grabbing");
        canvas.style("cursor", "grabbing");
        
        // Prevent text selection
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        
    };
    
    const handleMouseMove = function(event) {
        if (!isDragging || autoRotateEnabled) {
            if (!isDragging && !autoRotateEnabled) {
                svg.style("cursor", "grab");
                canvas.style("cursor", "grab");
            }
            return;
        }
        
        
        event.preventDefault();
        event.stopPropagation();
        
        const currentX = event.clientX;
        const currentY = event.clientY;
        
        const dx = currentX - previousMousePosition.x;
        const dy = currentY - previousMousePosition.y;
        
        // Rotate based on mouse movement
        rotation.y += dx * 0.5;
        rotation.x += dy * 0.5;
        
        // Clamp vertical rotation to prevent flipping
        rotation.x = Math.max(-90, Math.min(90, rotation.x));
        
        // Directly update projection and redraw (faster than calling updateGlobe)
        projection.rotate([rotation.y, -rotation.x]);
        svg.selectAll("path").attr("d", path);
        
        // Clear canvas and redraw crashes with updated coordinates
        // This ensures click detection works after rotation
        ctx.clearRect(0, 0, width, height);
        
        // Redraw heat map and crashes if we have filtered data
        // This updates crashPoints array with new screen coordinates
        if (filteredCrashes.length > 0) {
            // Redraw heat map first
            const heatMapData = createHeatMapData(filteredCrashes);
            drawHeatMap(heatMapData);
            
            // Then redraw crash points (this updates crashPoints array with new coordinates)
            drawCrashPoints(filteredCrashes);
        }
        
        previousMousePosition = { x: currentX, y: currentY };
    };
    
    const handleMouseUp = function(event) {
        if (isDragging) {
            console.log("Mouse up - ending drag");
            
            // Check if this was actually a drag (moved more than threshold)
            const dragDistance = clickStartTime > 0 ? Math.sqrt(
                Math.pow(event.clientX - clickStartPos.x, 2) + 
                Math.pow(event.clientY - clickStartPos.y, 2)
            ) : 0;
            
            console.log("Drag distance:", dragDistance);
            
            if (dragDistance > CLICK_THRESHOLD) {
                wasDragging = true;
                console.log("Marked as drag (not click)");
            }
            
            isDragging = false;
            svg.style("cursor", "grab");
            canvas.style("cursor", "grab");
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        }
    };
    
    // Add mouse events to SVG and canvas
    svg.on("mousedown.drag", handleMouseDown);
    canvas.on("mousedown.drag", handleMouseDown);
    
    // Also add to container for better coverage
    d3.select("#globe-container").on("mousedown.drag", handleMouseDown);
    
    // Use document-level events for smooth dragging
    d3.select(document)
        .on("mousemove.globe", handleMouseMove)
        .on("mouseup.globe", handleMouseUp);
    
    // Add zoom with mouse wheel
    const handleWheel = function(event) {
        if (autoRotateEnabled) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        // Smooth zoom factor
        const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
        const currentScale = projection.scale();
        const newScale = currentScale * zoomFactor;
        
        // Clamp scale
        const clampedScale = Math.max(150, Math.min(600, newScale));
        projection.scale(clampedScale);
        
        updateGlobe();
    };
    
    svg.on("wheel", handleWheel);
    canvas.on("wheel", handleWheel);
    
    // Touch support for pinch/zoom and rotation (only when auto-rotate is stopped)
    const handleTouchStart = function(event) {
        if (autoRotateEnabled || event.touches.length === 0) return;
        
        if (event.touches.length === 1) {
            // Single touch - start rotation
            isDragging = true;
            previousMousePosition = { 
                x: event.touches[0].clientX, 
                y: event.touches[0].clientY 
            };
        } else if (event.touches.length === 2) {
            // Two touches - start pinch/zoom and rotation
            isDragging = false;
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            // Calculate distance for zoom
            touchStartDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            touchStartScale = projection.scale();
            
            // Calculate angle for rotation
            touchStartAngle = Math.atan2(
                touch2.clientY - touch1.clientY,
                touch2.clientX - touch1.clientX
            );
            
            // Calculate center point
            touchStartCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
    };
    
    const handleTouchMove = function(event) {
        if (autoRotateEnabled) return;
        
        event.preventDefault();
        
        if (event.touches.length === 1 && isDragging) {
            // Single touch - rotate
            const dx = event.touches[0].clientX - previousMousePosition.x;
            const dy = event.touches[0].clientY - previousMousePosition.y;
            
            rotation.x += dy * 0.5;
            rotation.y += dx * 0.5;
            
            updateGlobe();
            
            previousMousePosition = { 
                x: event.touches[0].clientX, 
                y: event.touches[0].clientY 
            };
        } else if (event.touches.length === 2) {
            // Two touches - pinch/zoom and rotation
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            // Calculate current distance for zoom
            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            // Calculate current angle for rotation
            const currentAngle = Math.atan2(
                touch2.clientY - touch1.clientY,
                touch2.clientX - touch1.clientX
            );
            
            // Calculate angle difference (rotation)
            const angleDelta = currentAngle - touchStartAngle;
            
            // Apply rotation based on angle change
            rotation.y += angleDelta * 100; // Convert radians to rotation amount
            
            // Apply zoom based on distance change
            const scaleFactor = currentDistance / touchStartDistance;
            const newScale = touchStartScale * scaleFactor;
            projection.scale(Math.max(100, Math.min(500, newScale)));
            
            // Also allow rotation based on center movement (optional - for better UX)
            const currentCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
            
            const centerDx = currentCenter.x - touchStartCenter.x;
            const centerDy = currentCenter.y - touchStartCenter.y;
            
            rotation.x += centerDy * 0.3;
            rotation.y += centerDx * 0.3;
            
            updateGlobe();
            
            // Update start values for next frame
            touchStartAngle = currentAngle;
            touchStartCenter = currentCenter;
            touchStartDistance = currentDistance;
            touchStartScale = projection.scale();
        }
    };
    
    const handleTouchEnd = function(event) {
        isDragging = false;
        touchStartDistance = 0;
        touchStartAngle = 0;
    };
    
    svg.on("touchstart", handleTouchStart);
    svg.on("touchmove", handleTouchMove);
    svg.on("touchend", handleTouchEnd);
    
    canvas.on("touchstart", handleTouchStart);
    canvas.on("touchmove", handleTouchMove);
    canvas.on("touchend", handleTouchEnd);
}

function setupClickDetection() {
    const infoBox = d3.select("#crash-info-box");
    const infoContent = d3.select(".info-box-content");
    
    // Track clicks separately from drags (variables declared globally)
    canvas.on("mousedown.clickdetect", function(event) {
        // Track all mousedown events for click detection (even when auto-rotate is on)
        clickStartTime = Date.now();
        clickStartPos = { 
            x: event.clientX, 
            y: event.clientY 
        };
        wasDragging = false;
    });
    
    // Track if mouse moved during mousedown (to distinguish drag from click)
    d3.select(document).on("mousemove.clickdetect", function(event) {
        if (clickStartTime > 0 && isDragging) {
            const dragDistance = Math.sqrt(
                Math.pow(event.clientX - clickStartPos.x, 2) + 
                Math.pow(event.clientY - clickStartPos.y, 2)
            );
            if (dragDistance > CLICK_THRESHOLD) {
                wasDragging = true;
            }
        }
    });
    
    canvas.on("click", function(event) {
        // Don't process if we just finished dragging
        if (isDragging) {
            console.log("Click blocked: still dragging");
            return;
        }
        
        console.log("Click event fired!");
        
        // Don't treat as click if it was a drag
        const clickDuration = clickStartTime > 0 ? Date.now() - clickStartTime : 0;
        const dragDistance = clickStartTime > 0 ? Math.sqrt(
            Math.pow(event.clientX - clickStartPos.x, 2) + 
            Math.pow(event.clientY - clickStartPos.y, 2)
        ) : 0;
        
        console.log("Click metrics:", { clickDuration, dragDistance, wasDragging });
        
        // If it was a drag, don't process as click
        if (wasDragging || dragDistance > CLICK_THRESHOLD || (clickStartTime > 0 && clickDuration > CLICK_DURATION)) {
            console.log("Click blocked: was a drag", { wasDragging, dragDistance, clickDuration });
            clickStartTime = 0;
            wasDragging = false;
            return;
        }
        
        event.stopPropagation();
        event.preventDefault();
        
        const rect = canvas.node().getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        console.log("Click detected at:", mouseX, mouseY);
        console.log("Total crash points available:", crashPoints.length);
        
        // Find the closest crash point
        let closestPoint = null;
        let minDistance = Infinity;
        const clickRadius = 15; // pixels
        
        crashPoints.forEach(point => {
            const distance = Math.sqrt(
                Math.pow(mouseX - point.x, 2) + 
                Math.pow(mouseY - point.y, 2)
            );
            
            if (distance < clickRadius && distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        
        console.log("Closest point:", closestPoint ? "Found!" : "None", "Distance:", minDistance < Infinity ? minDistance.toFixed(2) : "N/A");
        
        if (closestPoint) {
            console.log("Processing click on crash:", closestPoint.crash);
            console.log("Crash location:", closestPoint.crash.location);
            console.log("Crash year:", closestPoint.crash.year);
            
            // Find all crashes at the exact same location (exact coordinates)
            const clickedCrash = closestPoint.crash;
            
            selectedCrashes = filteredCrashes.filter(crash => {
                // Exact match: same latitude and longitude
                return crash.lat === clickedCrash.lat && crash.lon === clickedCrash.lon;
            });
            
            console.log("Found", selectedCrashes.length, "crashes at this location");
            if (selectedCrashes.length > 1) {
                console.log("Multiple crashes! Will show navigation buttons");
            }
            
            // Sort by fatalities (descending)
            selectedCrashes.sort((a, b) => (b.fatalities || 0) - (a.fatalities || 0));
            
            // Reset to first crash
            currentCrashIndex = 0;
            
            // Show the first crash
            if (selectedCrashes.length > 0) {
                selectedCrash = selectedCrashes[0];
                console.log("Showing crash info for:", selectedCrash);
                showCrashInfo(selectedCrashes[0], infoBox, infoContent);
                filterAndDrawCrashes(); // Redraw to highlight selected location
            } else {
                console.log("No crashes found to display");
            }
        } else {
            console.log("No crash point found near click");
            // Clicked on empty space, clear selection
            selectedCrashes = [];
            currentCrashIndex = 0;
            selectedCrash = null;
            hideCrashInfo(infoBox, infoContent);
            filterAndDrawCrashes();
        }
        
        // Reset click tracking
        clickStartTime = 0;
        wasDragging = false;
    });
    
    // Allow clicking on SVG background to deselect (only if not dragging)
    svg.on("click", function(event) {
        if (wasDragging) return;
        
        const clickDuration = Date.now() - clickStartTime;
        const dragDistance = Math.sqrt(
            Math.pow(event.clientX - clickStartPos.x, 2) + 
            Math.pow(event.clientY - clickStartPos.y, 2)
        );
        
        if (dragDistance <= CLICK_THRESHOLD && clickDuration < CLICK_DURATION) {
            selectedCrashes = [];
            currentCrashIndex = 0;
            hideCrashInfo(infoBox, infoContent);
            filterAndDrawCrashes();
        }
    });
    
    // Update cursor to pointer when near crash points
    canvas.on("mousemove", function(event) {
        if (isDragging) return;
        
        const rect = canvas.node().getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        let nearPoint = false;
        const hoverRadius = 15;
        
        crashPoints.forEach(point => {
            const distance = Math.sqrt(
                Math.pow(mouseX - point.x, 2) + 
                Math.pow(mouseY - point.y, 2)
            );
            
            if (distance < hoverRadius) {
                nearPoint = true;
            }
        });
        
        canvas.style("cursor", nearPoint ? "pointer" : "default");
    });
}

function showCrashInfo(crash, infoBox, infoContent) {
    console.log("Showing crash info for:", crash);
    console.log("Crash details:", {
        year: crash.year,
        location: crash.location,
        fatalities: crash.fatalities
    });
    
    // Format date
    let dateStr = "Unknown";
    if (crash.year) {
        dateStr = crash.year.toString();
    }
    
    // Format location - handle missing data
    const location = crash.location || "Unknown";
    const country = crash.country || "Unknown";
    const operator = crash.operator || "Unknown";
    const fatalities = crash.fatalities || 0;
    
    console.log("Formatted values:", { dateStr, location, country, operator, fatalities });
    
    // Navigation buttons
    const hasPrevious = currentCrashIndex > 0;
    const hasNext = currentCrashIndex < selectedCrashes.length - 1;
    const totalCrashes = selectedCrashes.length;
    
    // Create info HTML with navigation
    const infoHTML = `
        <div class="crash-details">
            <div class="crash-title">Plane Crash Details ${totalCrashes > 1 ? `(${currentCrashIndex + 1} of ${totalCrashes})` : ''}</div>
            ${totalCrashes > 1 ? `
            <div class="crash-navigation">
                <button id="prev-crash" class="nav-button" ${!hasPrevious ? 'disabled' : ''}>Previous</button>
                <span class="nav-info">${currentCrashIndex + 1} / ${totalCrashes}</span>
                <button id="next-crash" class="nav-button" ${!hasNext ? 'disabled' : ''}>Next</button>
            </div>
            ` : ''}
            <div class="crash-detail-item">
                <div class="crash-detail-label">Date</div>
                <div class="crash-detail-value">${dateStr}</div>
            </div>
            <div class="crash-detail-item">
                <div class="crash-detail-label">Location</div>
                <div class="crash-detail-value">${location}</div>
            </div>
            <div class="crash-detail-item">
                <div class="crash-detail-label">Country</div>
                <div class="crash-detail-value">${country}</div>
            </div>
            <div class="crash-detail-item">
                <div class="crash-detail-label">Operator</div>
                <div class="crash-detail-value">${operator}</div>
            </div>
            <div class="crash-detail-item">
                <div class="crash-detail-label">Fatalities</div>
                <div class="crash-detail-value ${fatalities > 0 ? 'highlight' : ''}">${fatalities.toLocaleString()}</div>
            </div>
        </div>
    `;
    
    infoContent.html(infoHTML);
    infoBox.classed("active", true);
    
    console.log("Info box activated, total crashes:", totalCrashes);
    
    // Setup navigation button handlers
    if (totalCrashes > 1) {
        console.log("Setting up navigation buttons");
        
        // Remove old handlers first to prevent duplicates
        d3.select("#prev-crash").on("click", null);
        d3.select("#next-crash").on("click", null);
        
        d3.select("#prev-crash").on("click", function(event) {
            event.stopPropagation();
            event.preventDefault();
            console.log("Previous button clicked, current index:", currentCrashIndex);
            
            if (currentCrashIndex > 0) {
                currentCrashIndex--;
                console.log("Moving to previous crash, new index:", currentCrashIndex);
                showCrashInfo(selectedCrashes[currentCrashIndex], infoBox, infoContent);
            } else {
                console.log("Already at first crash");
            }
        });
        
        d3.select("#next-crash").on("click", function(event) {
            event.stopPropagation();
            event.preventDefault();
            console.log("Next button clicked, current index:", currentCrashIndex);
            
            if (currentCrashIndex < selectedCrashes.length - 1) {
                currentCrashIndex++;
                console.log("Moving to next crash, new index:", currentCrashIndex);
                showCrashInfo(selectedCrashes[currentCrashIndex], infoBox, infoContent);
            } else {
                console.log("Already at last crash");
            }
        });
    }
}

function hideCrashInfo(infoBox, infoContent) {
    infoContent.html('<p class="info-placeholder">Click on a crash point to see details</p>');
    infoBox.classed("active", false);
}

function updateLegend(heatMapData) {
    console.log("Updating legend with", heatMapData.length, "heat map cells");
    
    if (heatMapData.length === 0) {
        d3.select("#legend-items").html('<div class="legend-item">No crashes to display</div>');
        return;
    }
    
    const maxCount = d3.max(heatMapData, d => d.count) || 1;
    console.log("Max count for legend:", maxCount);
    
    // Create color scale function
    const colorScale = d3.scaleSequential()
        .domain([0, maxCount])
        .interpolator(t => {
            if (t < 0.25) {
                const s = t / 0.25;
                return d3.rgb(0, Math.floor(s * 255), 128 + Math.floor(s * 127));
            } else if (t < 0.5) {
                const s = (t - 0.25) / 0.25;
                return d3.rgb(Math.floor(s * 255), 255, Math.floor((1 - s) * 255));
            } else if (t < 0.75) {
                const s = (t - 0.5) / 0.25;
                return d3.rgb(255, Math.floor((1 - s * 0.5) * 255), 0);
            } else {
                const s = (t - 0.75) / 0.25;
                return d3.rgb(255, Math.floor((0.5 - s * 0.5) * 255), 0);
            }
        });
    
    // Create gradient colors for the bar
    const gradientColors = [];
    for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const color = colorScale(t * maxCount);
        gradientColors.push(`rgb(${color.r}, ${color.g}, ${color.b})`);
    }
    
    // Create legend items with sample values
    const gradientSteps = 5;
    const legendItems = [];
    
    for (let i = 0; i <= gradientSteps; i++) {
        const value = Math.floor((i / gradientSteps) * maxCount);
        const color = colorScale(value);
        const colorStr = `rgb(${color.r}, ${color.g}, ${color.b})`;
        
        legendItems.push(`
            <div class="legend-item">
                <span class="legend-color" style="background: ${colorStr};"></span>
                <span>${value} crash${value !== 1 ? 'es' : ''}</span>
            </div>
        `);
    }
    
    d3.select("#legend-items").html(`
        <div class="legend-item" style="width: 100%; margin-bottom: 10px; justify-content: center;">
            <span class="legend-gradient" style="background: linear-gradient(to right, ${gradientColors.join(', ')});"></span>
        </div>
        ${legendItems.join('')}
        <div class="legend-item" style="width: 100%; margin-top: 10px; font-size: 0.75em; opacity: 0.7; justify-content: center;">
            Max: ${maxCount} crash${maxCount !== 1 ? 'es' : ''} per location
        </div>
    `);
}

function updateGlobe() {
    // Update rotation - apply current rotation values
    projection.rotate([rotation.y, -rotation.x]);
    
    // Redraw globe paths
    svg.selectAll("path").attr("d", path);
    
    // console.log("Globe updated, rotation:", rotation); 
    
    // Redraw crashes (only if we have filtered data)
    if (filteredCrashes.length > 0) {
        filterAndDrawCrashes();
        
        // If crashes are selected, update the list and re-show current crash
        if (selectedCrashes.length > 0) {
            // Re-filter selected crashes to only include those still visible (exact coordinates)
            const firstSelected = selectedCrashes[0];
            
            selectedCrashes = filteredCrashes.filter(crash => {
                // Exact match: same latitude and longitude
                return crash.lat === firstSelected.lat && crash.lon === firstSelected.lon;
            });
            
            // Re-sort by fatalities
            selectedCrashes.sort((a, b) => (b.fatalities || 0) - (a.fatalities || 0));
            
            // Adjust index if needed
            if (currentCrashIndex >= selectedCrashes.length) {
                currentCrashIndex = Math.max(0, selectedCrashes.length - 1);
            }
            
            // Re-show current crash if still available
            // Don't recreate the info box if it's already active
            if (selectedCrashes.length > 0) {
                const infoBox = d3.select("#crash-info-box");
                
                // Only update if info box is not active, or if the crash index changed
                // This prevents frequent recreation during auto-rotate
                if (!infoBox.classed("active")) {
                    const infoContent = d3.select(".info-box-content");
                    showCrashInfo(selectedCrashes[currentCrashIndex], infoBox, infoContent);
                }
                // If already active, don't recreate - just let the navigation buttons work
            } else {
                // No crashes at this location anymore, clear selection
                selectedCrashes = [];
                currentCrashIndex = 0;
                const infoBox = d3.select("#crash-info-box");
                const infoContent = d3.select(".info-box-content");
                hideCrashInfo(infoBox, infoContent);
            }
        }
    } else {
        // No crashes visible, clear selection
        selectedCrashes = [];
        currentCrashIndex = 0;
        const infoBox = d3.select("#crash-info-box");
        const infoContent = d3.select(".info-box-content");
        hideCrashInfo(infoBox, infoContent);
    }
}


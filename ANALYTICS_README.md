# Mingleo Analytics Dashboard

## Overview
The Mingleo Analytics Dashboard is a comprehensive data visualization platform built with Streamlit to provide real-time insights and analytics for the Mingleo social media platform. This dashboard helps administrators and stakeholders track user engagement, content performance, and AI feature usage.

## Features

### Dashboard Page
- Key metrics overview: Users, Posts, Average Likes, AI Enhanced Posts percentage
- Post activity trends over time
- Comparison of AI vs. Regular posts performance
- Filter popularity visualization

### User Analytics Page
- User growth trends by month
- User engagement metrics table
- Visual correlation between followers and engagement
- User posting frequency analysis

### Content Insights Page
- Best performing days of the week for content
- Engagement heatmap by hour and day
- Content performance by type

### AI Filter Performance Page
- Filter usage statistics and comparison
- Average likes by filter type
- AI vs. regular filter adoption rates
- Filter popularity trends over time
- Comparative engagement analysis for AI-enhanced content

### Real-time Monitor Page
- Current active users tracking
- API performance metrics
- Endpoint performance analysis
- Real-time filter usage statistics
- AI processing metrics and OpenAI API usage

### Image Editor Page
- Interactive tool to test different filters on uploaded images
- AI enhancement simulation
- Image detail and metadata analysis

## Technical Implementation

### Database Connection
The dashboard connects to the Mingleo PostgreSQL database to fetch real-time data for analysis. When the database connection is unavailable, the system falls back to sample data for demonstration purposes.

### Real-time Data Processing
The dashboard processes real data from the application, including:
- User activity and engagement metrics
- Content performance analysis
- Filter usage statistics
- AI processing performance

### Visualization Technologies
- Interactive charts and graphs using Matplotlib
- Visual data representation through bar charts, line graphs, and heatmaps
- Custom metric cards for key performance indicators

## Running the Dashboard

To run the Mingleo Analytics Dashboard:

1. Ensure all required packages are installed:
   ```
   pip install streamlit pandas numpy matplotlib pillow psycopg2-binary
   ```

2. Run the dashboard:
   ```
   streamlit run app.py
   ```

3. Or use the provided shell script:
   ```
   ./run_streamlit.sh
   ```

4. To run both the main application and the analytics dashboard simultaneously:
   ```
   ./run_all.sh
   ```

The dashboard will be available at http://localhost:8501

## Integration with Mingleo

The analytics dashboard integrates with the main Mingleo application by:
1. Connecting to the same PostgreSQL database
2. Analyzing the same data used by the main application
3. Providing insights into user behavior and feature usage
4. Monitoring API performance and system metrics

This integration provides a unified view of the platform's performance and user engagement, helping to make data-driven decisions for future development and feature improvements.
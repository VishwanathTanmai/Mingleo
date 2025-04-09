import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image, ImageFilter, ImageEnhance
import io
import base64
import json
import os
import requests
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

# Set page config
st.set_page_config(
    page_title="Mingleo Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        background: linear-gradient(90deg, #ff6b6b, #7a77ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
        margin-bottom: 1rem;
    }
    .subheader {
        font-size: 1.5rem;
        margin-bottom: 1rem;
    }
    .card {
        padding: 1rem;
        border-radius: 0.5rem;
        background-color: #f8f9fa;
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
        margin-bottom: 1rem;
    }
    .metric-card {
        text-align: center;
        padding: 1.5rem;
        border-radius: 0.5rem;
        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
    }
    .metric-value {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }
    .metric-label {
        font-size: 0.875rem;
        color: #6c757d;
    }
</style>
""", unsafe_allow_html=True)

# Sample data (in a real application, this would come from the main app's database)
# For now, we'll simulate this data
def generate_sample_data():
    # Users data
    users = [
        {"id": 1, "username": "alex_smith", "joined": "2023-01-15", "posts": 42, "followers": 1250, "following": 350},
        {"id": 2, "username": "emma_jones", "joined": "2023-02-20", "posts": 87, "followers": 3200, "following": 420},
        {"id": 3, "username": "mike_wilson", "joined": "2023-01-05", "posts": 29, "followers": 980, "following": 210},
        {"id": 4, "username": "sarah_davis", "joined": "2023-03-10", "posts": 63, "followers": 1850, "following": 275},
        {"id": 5, "username": "james_brown", "joined": "2023-02-01", "posts": 51, "followers": 1620, "following": 310},
    ]
    
    # Posts data - simulate the last 30 days
    today = datetime.now()
    posts = []
    for i in range(200):
        date = (today - timedelta(days=np.random.randint(0, 30))).strftime("%Y-%m-%d")
        user_id = np.random.randint(1, 6)
        ai_enhanced = np.random.choice([True, False], p=[0.7, 0.3])  # 70% are AI enhanced
        likes = np.random.randint(10, 500)
        comments = np.random.randint(0, 50)
        filter_type = np.random.choice(["normal", "bw", "vivid", "dream"])
        
        posts.append({
            "id": i+1,
            "user_id": user_id,
            "date": date,
            "ai_enhanced": ai_enhanced,
            "likes": likes,
            "comments": comments,
            "filter": filter_type
        })
    
    # Convert to dataframes for easier manipulation
    users_df = pd.DataFrame(users)
    posts_df = pd.DataFrame(posts)
    posts_df['date'] = pd.to_datetime(posts_df['date'])
    
    return users_df, posts_df

# Database connection function
def get_db_connection():
    try:
        # Use environment variables for connection
        conn = psycopg2.connect(
            host=os.environ.get('PGHOST'),
            database=os.environ.get('PGDATABASE'),
            user=os.environ.get('PGUSER'),
            password=os.environ.get('PGPASSWORD'),
            port=os.environ.get('PGPORT')
        )
        return conn
    except Exception as e:
        st.error(f"Failed to connect to database: {e}")
        return None

# Function to fetch data from database
def fetch_real_data():
    conn = get_db_connection()
    if not conn:
        st.warning("Using sample data as database connection failed")
        return generate_sample_data()
    
    try:
        # Create cursor
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Fetch users
        cur.execute("SELECT * FROM users")
        users_data = cur.fetchall()
        
        # Fetch posts
        cur.execute("SELECT * FROM posts")
        posts_data = cur.fetchall()
        
        # Convert to pandas DataFrames
        users_df = pd.DataFrame(users_data) if users_data else pd.DataFrame()
        posts_df = pd.DataFrame(posts_data) if posts_data else pd.DataFrame()
        
        # Process dates
        if not posts_df.empty and 'createdAt' in posts_df.columns:
            posts_df['date'] = pd.to_datetime(posts_df['createdAt'])
        
        # Close connection
        cur.close()
        conn.close()
        
        # If we have real data, return it, otherwise fall back to sample data
        if not users_df.empty and not posts_df.empty:
            return users_df, posts_df
        else:
            st.info("No data found in database, using sample data")
            return generate_sample_data()
            
    except Exception as e:
        st.error(f"Error fetching data: {e}")
        conn.close()
        return generate_sample_data()

# Sidebar for navigation
st.sidebar.title("Mingleo Analytics")
page = st.sidebar.radio("Select Page", ["Dashboard", "User Analytics", "Content Insights", "AI Filter Performance", "Real-time Monitor"])

# Load the simulated data
users_df, posts_df = generate_sample_data()

# Main content based on selected page
if page == "Dashboard":
    st.markdown('<h1 class="main-header">Mingleo Analytics Dashboard</h1>', unsafe_allow_html=True)
    
    # Key metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-value">{len(users_df)}</div>
            <div class="metric-label">Total Users</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        total_posts = len(posts_df)
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-value">{total_posts}</div>
            <div class="metric-label">Total Posts</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        avg_likes = int(posts_df['likes'].mean())
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-value">{avg_likes}</div>
            <div class="metric-label">Avg. Likes per Post</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col4:
        ai_percentage = int(posts_df['ai_enhanced'].mean() * 100)
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-value">{ai_percentage}%</div>
            <div class="metric-label">AI Enhanced Posts</div>
        </div>
        """, unsafe_allow_html=True)
    
    # Posts over time chart
    st.markdown('<h2 class="subheader">Post Activity Over Time</h2>', unsafe_allow_html=True)
    posts_by_date = posts_df.groupby(posts_df['date'].dt.date).size().reset_index(name='count')
    posts_by_date.columns = ['date', 'posts']
    
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(posts_by_date['date'], posts_by_date['posts'], marker='o', linestyle='-', color='#7a77ff')
    ax.set_title('Number of Posts per Day')
    ax.set_xlabel('Date')
    ax.set_ylabel('Number of Posts')
    ax.grid(True, linestyle='--', alpha=0.7)
    st.pyplot(fig)
    
    # AI vs Regular posts
    st.markdown('<h2 class="subheader">AI vs Regular Posts Performance</h2>', unsafe_allow_html=True)
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Group by AI enhanced and calculate average likes
        ai_performance = posts_df.groupby('ai_enhanced')['likes'].mean().reset_index()
        ai_performance['ai_enhanced'] = ai_performance['ai_enhanced'].map({True: 'AI Enhanced', False: 'Regular'})
        
        fig, ax = plt.subplots(figsize=(8, 5))
        bars = ax.bar(ai_performance['ai_enhanced'], ai_performance['likes'], color=['#7a77ff', '#ff6b6b'])
        ax.set_title('Average Likes: AI vs Regular Posts')
        ax.set_ylabel('Average Likes')
        ax.grid(True, axis='y', linestyle='--', alpha=0.7)
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 5, f'{int(height)}', 
                    ha='center', va='bottom', fontweight='bold')
        
        st.pyplot(fig)
    
    with col2:
        # Filter popularity
        filter_counts = posts_df['filter'].value_counts().reset_index()
        filter_counts.columns = ['filter', 'count']
        
        fig, ax = plt.subplots(figsize=(8, 5))
        colors = ['#ff6b6b', '#ffc145', '#4bc0c0', '#7a77ff']
        wedges, texts, autotexts = ax.pie(filter_counts['count'], 
                                         labels=filter_counts['filter'],
                                         autopct='%1.1f%%',
                                         startangle=90,
                                         colors=colors)
        ax.set_title('Filter Popularity')
        ax.axis('equal')  # Equal aspect ratio ensures the pie chart is circular
        
        # Style the percentages inside the wedges
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontweight('bold')
        
        st.pyplot(fig)

elif page == "User Analytics":
    st.markdown('<h1 class="main-header">User Analytics</h1>', unsafe_allow_html=True)
    
    # User growth chart
    users_df['joined'] = pd.to_datetime(users_df['joined'])
    users_df['month'] = users_df['joined'].dt.to_period('M')
    users_by_month = users_df.groupby('month').size().reset_index(name='new_users')
    users_by_month['month'] = users_by_month['month'].astype(str)
    
    st.markdown('<h2 class="subheader">User Growth</h2>', unsafe_allow_html=True)
    
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.bar(users_by_month['month'], users_by_month['new_users'], color='#7a77ff')
    ax.set_title('New Users by Month')
    ax.set_xlabel('Month')
    ax.set_ylabel('Number of New Users')
    ax.grid(True, axis='y', linestyle='--', alpha=0.7)
    st.pyplot(fig)
    
    # User engagement
    st.markdown('<h2 class="subheader">User Engagement</h2>', unsafe_allow_html=True)
    
    # Merge users and posts data
    user_activity = posts_df.groupby('user_id').agg({
        'id': 'count',
        'likes': 'sum',
        'comments': 'sum'
    }).reset_index()
    user_activity.columns = ['user_id', 'total_posts', 'total_likes', 'total_comments']
    
    user_metrics = pd.merge(users_df, user_activity, left_on='id', right_on='user_id', how='left')
    user_metrics = user_metrics.fillna(0)
    
    # Display as table
    st.dataframe(user_metrics[['username', 'followers', 'following', 'total_posts', 'total_likes', 'total_comments']])
    
    # User engagement correlation
    st.markdown('<h2 class="subheader">Correlation Between Followers and Engagement</h2>', unsafe_allow_html=True)
    
    fig, ax = plt.subplots(figsize=(10, 6))
    scatter = ax.scatter(user_metrics['followers'], 
                        user_metrics['total_likes'], 
                        s=user_metrics['total_posts']*20, 
                        alpha=0.7,
                        c=user_metrics['total_comments'], 
                        cmap='viridis')
    
    # Add labels for each point
    for i, txt in enumerate(user_metrics['username']):
        ax.annotate(txt, (user_metrics['followers'].iloc[i], user_metrics['total_likes'].iloc[i]))
    
    ax.set_xlabel('Number of Followers')
    ax.set_ylabel('Total Likes Received')
    ax.grid(True, linestyle='--', alpha=0.7)
    ax.set_title('User Engagement Analysis')
    
    # Add a colorbar
    cbar = plt.colorbar(scatter)
    cbar.set_label('Total Comments')
    
    # Add a legend for the size of the points
    handles, labels = scatter.legend_elements(prop="sizes", alpha=0.6, num=3)
    legend = ax.legend(handles, labels, loc="upper right", title="Total Posts")
    
    st.pyplot(fig)

elif page == "Content Insights":
    st.markdown('<h1 class="main-header">Content Insights</h1>', unsafe_allow_html=True)
    
    # Posts performance by day of week
    posts_df['day_of_week'] = posts_df['date'].dt.day_name()
    day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    # Average likes by day
    day_performance = posts_df.groupby('day_of_week')['likes'].mean().reset_index()
    # Ensure days are in correct order
    day_performance['day_of_week'] = pd.Categorical(day_performance['day_of_week'], categories=day_order, ordered=True)
    day_performance = day_performance.sort_values('day_of_week')
    
    st.markdown('<h2 class="subheader">Best Performing Days</h2>', unsafe_allow_html=True)
    
    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.bar(day_performance['day_of_week'], day_performance['likes'], color='#7a77ff')
    ax.set_title('Average Likes by Day of Week')
    ax.set_xlabel('Day of Week')
    ax.set_ylabel('Average Likes')
    ax.grid(True, axis='y', linestyle='--', alpha=0.7)
    
    # Add value labels on bars
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 5, f'{int(height)}', 
                ha='center', va='bottom', fontweight='bold')
    
    st.pyplot(fig)
    
    # Engagement heat map by hour and day
    # For simulation, let's create some random hour data
    np.random.seed(42)
    posts_df['hour'] = np.random.randint(0, 24, size=len(posts_df))
    
    # Create a pivot table for the heatmap
    heatmap_data = posts_df.pivot_table(
        index='day_of_week', 
        columns='hour',
        values='likes',
        aggfunc='mean'
    ).fillna(0)
    
    # Ensure days are in correct order
    heatmap_data = heatmap_data.reindex(day_order)
    
    st.markdown('<h2 class="subheader">Engagement Heatmap (Likes by Hour & Day)</h2>', unsafe_allow_html=True)
    
    fig, ax = plt.subplots(figsize=(12, 7))
    im = ax.imshow(heatmap_data, cmap='YlGnBu')
    
    # Set ticks and labels
    ax.set_xticks(np.arange(24))
    ax.set_xticklabels([f'{h}:00' for h in range(24)])
    ax.set_yticks(np.arange(len(day_order)))
    ax.set_yticklabels(day_order)
    
    # Rotate x-tick labels
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
    
    # Add colorbar
    cbar = ax.figure.colorbar(im, ax=ax)
    cbar.set_label('Average Likes')
    
    # Title and labels
    ax.set_title('Engagement Heatmap by Hour and Day')
    ax.set_xlabel('Hour of Day')
    
    # Loop over data dimensions and create text annotations
    for i in range(len(day_order)):
        for j in range(24):
            if heatmap_data.iloc[i, j] > 0:
                text = ax.text(j, i, int(heatmap_data.iloc[i, j]),
                              ha="center", va="center", color="white" if heatmap_data.iloc[i, j] > 150 else "black")
    
    fig.tight_layout()
    st.pyplot(fig)

elif page == "AI Filter Performance":
    st.markdown('<h1 class="main-header">AI Filter Performance Analysis</h1>', unsafe_allow_html=True)
    
    # Filter performance
    filter_performance = posts_df.groupby('filter').agg({
        'id': 'count',
        'likes': 'mean',
        'comments': 'mean'
    }).reset_index()
    filter_performance.columns = ['filter', 'count', 'avg_likes', 'avg_comments']
    
    st.markdown('<h2 class="subheader">Filter Performance Metrics</h2>', unsafe_allow_html=True)
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig, ax = plt.subplots(figsize=(8, 5))
        bars = ax.bar(filter_performance['filter'], filter_performance['avg_likes'], color=['#ff6b6b', '#ffc145', '#4bc0c0', '#7a77ff'])
        ax.set_title('Average Likes by Filter Type')
        ax.set_xlabel('Filter')
        ax.set_ylabel('Average Likes')
        ax.grid(True, axis='y', linestyle='--', alpha=0.7)
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 5, f'{int(height)}', 
                    ha='center', va='bottom', fontweight='bold')
        
        st.pyplot(fig)
    
    with col2:
        # AI vs non-AI filter adoption
        filter_ai_map = {
            'normal': 'Regular',
            'bw': 'Regular',
            'vivid': 'Regular',
            'dream': 'AI Enhanced'
        }
        posts_df['filter_type'] = posts_df['filter'].map(filter_ai_map)
        filter_type_counts = posts_df['filter_type'].value_counts()
        
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.pie(filter_type_counts, labels=filter_type_counts.index, autopct='%1.1f%%', startangle=90,
              colors=['#7a77ff', '#ff6b6b'])
        ax.set_title('AI vs Regular Filter Usage')
        ax.axis('equal')
        
        st.pyplot(fig)
    
    # Filter performance over time
    st.markdown('<h2 class="subheader">Filter Popularity Over Time</h2>', unsafe_allow_html=True)
    posts_df['week'] = posts_df['date'].dt.isocalendar().week
    
    filter_time_data = posts_df.groupby(['week', 'filter']).size().reset_index(name='count')
    
    # Pivot the data for plotting
    filter_pivot = filter_time_data.pivot(index='week', columns='filter', values='count').fillna(0)
    
    fig, ax = plt.subplots(figsize=(12, 6))
    filter_pivot.plot(kind='line', marker='o', ax=ax)
    ax.set_title('Filter Usage Over Time')
    ax.set_xlabel('Week Number')
    ax.set_ylabel('Number of Posts')
    ax.grid(True, linestyle='--', alpha=0.7)
    ax.legend(title='Filter Type')
    
    st.pyplot(fig)
    
    # AI filter impact on engagement
    st.markdown('<h2 class="subheader">AI Filter Impact on Engagement</h2>', unsafe_allow_html=True)
    
    # Compare engagement between AI and regular filters
    filter_engagement = posts_df.groupby('filter_type').agg({
        'likes': ['mean', 'std'],
        'comments': ['mean', 'std']
    })
    
    filter_engagement.columns = ['avg_likes', 'std_likes', 'avg_comments', 'std_comments']
    filter_engagement = filter_engagement.reset_index()
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig, ax = plt.subplots(figsize=(8, 5))
        bars = ax.bar(filter_engagement['filter_type'], filter_engagement['avg_likes'],
                     yerr=filter_engagement['std_likes'], capsize=10,
                     color=['#7a77ff', '#ff6b6b'])
        ax.set_title('Average Likes by Filter Category')
        ax.set_ylabel('Average Likes (with standard deviation)')
        ax.grid(True, axis='y', linestyle='--', alpha=0.7)
        
        st.pyplot(fig)
    
    with col2:
        fig, ax = plt.subplots(figsize=(8, 5))
        bars = ax.bar(filter_engagement['filter_type'], filter_engagement['avg_comments'],
                     yerr=filter_engagement['std_comments'], capsize=10,
                     color=['#7a77ff', '#ff6b6b'])
        ax.set_title('Average Comments by Filter Category')
        ax.set_ylabel('Average Comments (with standard deviation)')
        ax.grid(True, axis='y', linestyle='--', alpha=0.7)
        
        st.pyplot(fig)

elif page == "Real-time Monitor":
    st.markdown('<h1 class="main-header">Real-time Activity Monitor</h1>', unsafe_allow_html=True)
    
    # Add real-time monitoring section
    st.markdown("""
    <div class="card">
        <p>This section shows real-time user activity and system performance metrics for Mingleo.</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Create tabs for different real-time metrics
    rt_tab1, rt_tab2, rt_tab3 = st.tabs(["Active Users", "API Performance", "Filter Usage"])
    
    with rt_tab1:
        st.subheader("Current Active Users")
        
        # Simulated active user count with a visual representation
        active_users = np.random.randint(12, 35)
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-value">{active_users}</div>
            <div class="metric-label">Users Currently Online</div>
        </div>
        """, unsafe_allow_html=True)
        
        # Sample data for real-time user activity
        times = pd.date_range(start=pd.Timestamp.now() - pd.Timedelta(hours=1), 
                             end=pd.Timestamp.now(), 
                             freq='5min')
        active_data = pd.DataFrame({
            'time': times,
            'users': np.random.randint(10, 40, size=len(times))
        })
        
        # Plot real-time user activity
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(active_data['time'], active_data['users'], marker='o', linestyle='-', color='#7a77ff')
        ax.set_title('Active Users (Last Hour)')
        ax.set_xlabel('Time')
        ax.set_ylabel('Number of Users')
        ax.grid(True, linestyle='--', alpha=0.7)
        fig.autofmt_xdate()
        st.pyplot(fig)
        
        # User activity by page
        st.subheader("Current User Activity by Section")
        
        page_data = {
            'Feed': np.random.randint(5, 15),
            'Stories': np.random.randint(3, 10),
            'Profile': np.random.randint(2, 8),
            'Messages': np.random.randint(4, 12),
            'AR/VR Filters': np.random.randint(1, 6)
        }
        
        # Create and display chart for page activity
        page_df = pd.DataFrame({'Page': list(page_data.keys()), 'Users': list(page_data.values())})
        fig, ax = plt.subplots(figsize=(10, 5))
        bars = ax.barh(page_df['Page'], page_df['Users'], color='#7a77ff')
        ax.set_title('Current User Activity by Section')
        ax.set_xlabel('Number of Active Users')
        
        # Add value labels on bars
        for bar in bars:
            width = bar.get_width()
            ax.text(width + 0.3, bar.get_y() + bar.get_height()/2, f'{int(width)}', 
                    ha='left', va='center', fontweight='bold')
        
        st.pyplot(fig)
        
    with rt_tab2:
        st.subheader("API Performance Metrics")
        
        # Simulated API metrics
        api_metrics = {
            'Average Response Time': f"{np.random.randint(30, 120)} ms",
            'Requests per Minute': f"{np.random.randint(100, 500)}",
            'Error Rate': f"{np.random.uniform(0.1, 1.5):.2f}%",
            'Cache Hit Rate': f"{np.random.uniform(70, 95):.1f}%"
        }
        
        # Display metrics in a grid
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-value">{api_metrics['Average Response Time']}</div>
                <div class="metric-label">Average Response Time</div>
            </div>
            """, unsafe_allow_html=True)
            
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-value">{api_metrics['Error Rate']}</div>
                <div class="metric-label">Error Rate</div>
            </div>
            """, unsafe_allow_html=True)
        
        with col2:
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-value">{api_metrics['Requests per Minute']}</div>
                <div class="metric-label">Requests per Minute</div>
            </div>
            """, unsafe_allow_html=True)
            
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-value">{api_metrics['Cache Hit Rate']}</div>
                <div class="metric-label">Cache Hit Rate</div>
            </div>
            """, unsafe_allow_html=True)
        
        # Simulated endpoint performance
        st.subheader("Endpoint Performance")
        
        endpoints = ['/api/posts', '/api/stories', '/api/messages', '/api/filters', '/api/ai/analyze-image']
        response_times = np.random.randint(20, 150, size=len(endpoints))
        requests = np.random.randint(50, 300, size=len(endpoints))
        
        endpoint_df = pd.DataFrame({
            'Endpoint': endpoints,
            'Response Time (ms)': response_times,
            'Requests': requests
        })
        
        st.dataframe(endpoint_df, use_container_width=True)
        
        # Plot response time by endpoint
        fig, ax = plt.subplots(figsize=(10, 5))
        bars = ax.bar(endpoint_df['Endpoint'], endpoint_df['Response Time (ms)'], color='#7a77ff')
        ax.set_title('Average Response Time by Endpoint')
        ax.set_xlabel('Endpoint')
        ax.set_ylabel('Response Time (ms)')
        plt.xticks(rotation=45, ha='right')
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 3, f'{int(height)}', 
                    ha='center', va='bottom', fontweight='bold')
        
        fig.tight_layout()
        st.pyplot(fig)
        
    with rt_tab3:
        st.subheader("Real-time Filter Usage")
        
        # Simulated current filter usage
        filters = ['Normal', 'Black & White', 'Vivid', 'Dream (AI)', 'AR Face', 'AR World', 'VR Space']
        usage_counts = np.random.randint(5, 50, size=len(filters))
        
        # Create and display filter usage chart
        filter_df = pd.DataFrame({
            'Filter': filters,
            'Usage Count': usage_counts
        })
        
        fig, ax = plt.subplots(figsize=(10, 5))
        bars = ax.bar(filter_df['Filter'], filter_df['Usage Count'], color=['#cccccc', '#999999', '#ff6b6b', '#7a77ff', '#ffc145', '#4bc0c0', '#9370db'])
        ax.set_title('Current Filter Usage')
        ax.set_xlabel('Filter Type')
        ax.set_ylabel('Number of Uses')
        plt.xticks(rotation=45, ha='right')
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 1, f'{int(height)}', 
                    ha='center', va='bottom', fontweight='bold')
        
        fig.tight_layout()
        st.pyplot(fig)
        
        # AI processing metrics
        st.subheader("AI Processing Metrics")
        
        col1, col2 = st.columns(2)
        
        with col1:
            # AI requests pie chart
            ai_requests = {
                'Image Analysis': np.random.randint(20, 100),
                'AR Face Filters': np.random.randint(15, 80),
                'AR World Filters': np.random.randint(10, 50),
                'VR Environments': np.random.randint(5, 30)
            }
            
            fig, ax = plt.subplots(figsize=(8, 8))
            wedges, texts, autotexts = ax.pie(
                list(ai_requests.values()), 
                labels=list(ai_requests.keys()),
                autopct='%1.1f%%',
                startangle=90,
                colors=['#7a77ff', '#ff6b6b', '#ffc145', '#4bc0c0']
            )
            ax.set_title('AI Request Distribution')
            
            # Style the percentages inside the wedges
            for autotext in autotexts:
                autotext.set_color('white')
                autotext.set_fontweight('bold')
            
            st.pyplot(fig)
        
        with col2:
            # AI processing time
            ai_processing = {
                'Image Analysis': np.random.uniform(0.2, 0.8),
                'AR Face Filters': np.random.uniform(0.5, 1.2),
                'AR World Filters': np.random.uniform(0.8, 1.5),
                'VR Environments': np.random.uniform(1.0, 2.0)
            }
            
            fig, ax = plt.subplots(figsize=(8, 5))
            bars = ax.barh(
                list(ai_processing.keys()), 
                list(ai_processing.values()),
                color=['#7a77ff', '#ff6b6b', '#ffc145', '#4bc0c0']
            )
            ax.set_title('Average AI Processing Time')
            ax.set_xlabel('Time (seconds)')
            
            # Add value labels on bars
            for bar in bars:
                width = bar.get_width()
                ax.text(width + 0.05, bar.get_y() + bar.get_height()/2, f'{width:.2f}s', 
                        ha='left', va='center', fontweight='bold')
            
            st.pyplot(fig)
            
            # OpenAI API metrics
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-value">{np.random.randint(1000, 5000)}</div>
                <div class="metric-label">OpenAI API Tokens Used Today</div>
            </div>
            """, unsafe_allow_html=True)

elif page == "Image Editor":
    st.markdown('<h1 class="main-header">AI Image Filter Playground</h1>', unsafe_allow_html=True)
    
    st.markdown("""
    <div class="card">
        <p>Upload an image and apply different filters to see how they affect your content. 
        Test our AI enhancement features and see the difference they make!</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Image upload
    uploaded_file = st.file_uploader("Choose an image...", type=["jpg", "jpeg", "png"])
    
    if uploaded_file is not None:
        # Read the image
        image = Image.open(uploaded_file)
        
        # Display original image
        st.markdown('<h2 class="subheader">Original Image</h2>', unsafe_allow_html=True)
        st.image(image, caption="Original Image", use_column_width=True)
        
        # Filter options
        st.markdown('<h2 class="subheader">Apply Filters</h2>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            filter_type = st.selectbox(
                "Select Filter",
                ["Normal", "Black & White", "Vivid", "Dream (AI)"]
            )
        
        with col2:
            ai_enhance = st.checkbox("Apply AI Enhancement", value=False)
        
        # Apply the selected filter
        filtered_image = image.copy()
        
        if filter_type == "Black & White":
            filtered_image = filtered_image.convert("L").convert("RGB")
        elif filter_type == "Vivid":
            # Increase saturation and contrast
            enhancer = ImageEnhance.Color(filtered_image)
            filtered_image = enhancer.enhance(1.5)
            enhancer = ImageEnhance.Contrast(filtered_image)
            filtered_image = enhancer.enhance(1.2)
        elif filter_type == "Dream (AI)":
            # Apply a "dreamy" filter - hue shift and soft glow
            filtered_image = filtered_image.convert("RGB")
            r, g, b = filtered_image.split()
            filtered_image = Image.merge("RGB", (b, r, g))  # Shift color channels
            filtered_image = filtered_image.filter(ImageFilter.GaussianBlur(radius=1))
            enhancer = ImageEnhance.Color(filtered_image)
            filtered_image = enhancer.enhance(1.2)
        
        # Apply AI enhancement if selected
        if ai_enhance:
            # Simulate AI enhancement
            # Increase sharpness and subtle color adjustment
            enhancer = ImageEnhance.Sharpness(filtered_image)
            filtered_image = enhancer.enhance(1.5)
            enhancer = ImageEnhance.Brightness(filtered_image)
            filtered_image = enhancer.enhance(1.05)
            enhancer = ImageEnhance.Contrast(filtered_image)
            filtered_image = enhancer.enhance(1.1)
        
        # Display filtered image
        st.markdown('<h2 class="subheader">Filtered Image</h2>', unsafe_allow_html=True)
        st.image(filtered_image, caption=f"Filter: {filter_type}" + (" with AI Enhancement" if ai_enhance else ""), use_column_width=True)
        
        # Add a download button for the filtered image
        buf = io.BytesIO()
        filtered_image.save(buf, format="JPEG")
        byte_im = buf.getvalue()
        
        st.download_button(
            label="Download Filtered Image",
            data=byte_im,
            file_name="mingleo_filtered_image.jpg",
            mime="image/jpeg",
        )
        
        # Image stats and metadata
        with st.expander("Image Details"):
            col1, col2 = st.columns(2)
            
            with col1:
                st.write("**Image Information**")
                st.write(f"Format: {image.format}")
                st.write(f"Size: {image.size}")
                st.write(f"Mode: {image.mode}")
            
            with col2:
                st.write("**Filter Information**")
                st.write(f"Filter: {filter_type}")
                st.write(f"AI Enhanced: {ai_enhance}")
                
                # Calculate image stats
                img_array = np.array(filtered_image)
                st.write(f"Mean RGB: [{img_array[:,:,0].mean():.1f}, {img_array[:,:,1].mean():.1f}, {img_array[:,:,2].mean():.1f}]")

# Add footer
st.markdown("""
<div style="text-align: center; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee;">
    <p style="color: #6c757d; font-size: 0.8rem;">Mingleo Analytics Dashboard © 2024 - Built with Streamlit</p>
</div>
""", unsafe_allow_html=True)
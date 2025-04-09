#!/bin/bash

# Start the main Node.js app
echo "Starting main Mingleo app..."
npm run dev &
NODE_PID=$!

# Start Streamlit app
echo "Starting Mingleo Analytics Dashboard..."
streamlit run app.py --server.port 8501 --server.address 0.0.0.0 &
STREAMLIT_PID=$!

# Function to handle script termination
function cleanup {
  echo "Shutting down applications..."
  kill $NODE_PID
  kill $STREAMLIT_PID
  exit
}

# Set up trap to catch termination signals
trap cleanup SIGINT SIGTERM

echo "Both applications are running!"
echo "Main app: http://localhost:3000"
echo "Analytics dashboard: http://localhost:8501"
echo "Press Ctrl+C to stop both applications"

# Wait for both processes
wait $NODE_PID $STREAMLIT_PID
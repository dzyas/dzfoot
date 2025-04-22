import os
from app import app, db

# Create all database tables if they don't exist
with app.app_context():
    from app import Conversation, Message
    db.create_all()
    print("Database tables created successfully")

# Run the Flask application
if __name__ == '__main__':
    # Get port from environment or use 5000 as default
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

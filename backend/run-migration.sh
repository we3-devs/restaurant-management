#!/bin/bash

# Migration Runner for bill_number_counters
# This script applies the CreateBillNumberCounters migration to your database

set -e

echo "🚀 Starting migration for bill_number_counters..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found in backend directory"
    echo "Please create a .env file with your database credentials"
    exit 1
fi

# Source the .env file to get DB credentials
export $(cat .env | grep -v '#' | xargs)

# Check required environment variables
if [ -z "$DB_HOST" ] || [ -z "$DB_DATABASE" ] || [ -z "$DB_USERNAME" ]; then
    echo "❌ Error: Missing required database environment variables"
    echo "Required: DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD"
    exit 1
fi

echo "📝 Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: ${DB_PORT:-5432}"
echo "  Database: $DB_DATABASE"
echo "  User: $DB_USERNAME"
echo ""

# Run the migration
echo "⏳ Running migration..."
npm run migration:run

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "The bill_number_counters table has been created and is ready for use."
    echo "You can now run the diagnostic test:"
    echo ""
    echo "  k6 run load-tests/rms-diagnostic-1vu.js --env BASE_URL=... --env LOAD_ADMIN_EMAIL=... --env LOAD_ADMIN_PASSWORD=..."
else
    echo ""
    echo "❌ Migration failed. Check the error message above."
    exit 1
fi

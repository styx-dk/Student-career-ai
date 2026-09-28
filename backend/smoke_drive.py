"""Read-only external checks and a fictional Gemini extraction. No remote data writes."""
import json
import argparse
from sqlalchemy import inspect, text
from app.core.database import engine
from app.core.config import settings
from app.services.storage import list_buckets
from app.services.llm import provider_for
from app.schemas.document_analysis import DocumentAnalysis

parser = argparse.ArgumentParser()
parser.add_argument('--skip-ai', action='store_true')
args = parser.parse_args()
results = {}
try:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
        inspector = inspect(connection)
        tables = inspector.get_table_names()
        results['database'] = 'connected'
        results['folders_table'] = 'folders' in tables
        results['initial_tables_present'] = all(t in tables for t in ['documents', 'student_profiles', 'career_records'])
        results['document_folder_column'] = 'documents' in tables and 'folder_id' in {c['name'] for c in inspector.get_columns('documents')}
except Exception as exc:
    results['database'] = type(exc).__name__
try:
    buckets = list_buckets()
    results['private_document_bucket'] = any(b['name'] == settings.supabase_document_bucket and not b.get('public', False) for b in buckets)
    results['document_bucket_exists'] = any(b['name'] == settings.supabase_document_bucket for b in buckets)
except Exception as exc:
    results['storage'] = type(exc).__name__
try:
    if args.skip_ai:
        print(json.dumps(results, indent=2))
        raise SystemExit(0)
    provider = provider_for('text')
    example = 'EXAMPLE TEST DOCUMENT, fictional: A student implemented a library search API using Python and PostgreSQL. AWS was discussed as future work only; no cloud deployment was completed. No dates or organization were supplied.'
    result = provider.analyze_text_document(example, DocumentAnalysis)
    results['provider'] = provider.name
    results['structured_analysis'] = result.model_dump(mode='json')
except Exception as exc:
    results['analysis_error'] = type(exc).__name__
print(json.dumps(results, indent=2))

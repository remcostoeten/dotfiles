#!/usr/bin/env python3

import os
import json
import requests
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

@dataclass
class TTableStats:
    name: str
    row_count: int
    total_size: int
    index_size: int
    index_usage: Dict[str, int]
    seq_scans: int
    index_scans: int

@dataclass
class TIndexRecommendation:
    table_name: str
    columns: List[str]
    reason: str
    estimated_impact: str
    priority: str  # 'HIGH', 'MEDIUM', 'LOW'

class DatabaseAnalyzer:
    def __init__(self, connection_url: str):
        self.conn_url = connection_url
        self._conn = None
        self._cursor = None
        self.api_key = os.getenv("GEMINI_API_KEY")

    def connect(self) -> Tuple[bool, str]:
        try:
            self._conn = psycopg2.connect(self.conn_url)
            self._conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            self._cursor = self._conn.cursor()
            return True, "Connected successfully"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"

    def disconnect(self):
        if self._cursor:
            self._cursor.close()
        if self._conn:
            self._conn.close()
        self._cursor = None
        self._conn = None

    def get_table_stats(self) -> List[TTableStats]:
        query = """
        WITH index_stats AS (
            SELECT
                schemaname || '.' || tablename as table_name,
                indexrelname as index_name,
                idx_scan as scans
            FROM pg_stat_user_indexes
        ),
        table_stats AS (
            SELECT
                schemaname || '.' || relname as table_name,
                n_live_tup as row_count,
                seq_scan as sequential_scans,
                idx_scan as index_scans
            FROM pg_stat_user_tables
        ),
        size_stats AS (
            SELECT
                schemaname || '.' || tablename as table_name,
                pg_total_relation_size(schemaname || '.' || tablename) as total_size,
                pg_indexes_size(schemaname || '.' || tablename) as index_size
            FROM pg_tables
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        )
        SELECT
            t.table_name,
            t.row_count,
            s.total_size,
            s.index_size,
            t.sequential_scans,
            t.index_scans,
            json_object_agg(COALESCE(i.index_name, 'no_indexes'), COALESCE(i.scans, 0)) as index_usage
        FROM table_stats t
        JOIN size_stats s ON t.table_name = s.table_name
        LEFT JOIN index_stats i ON t.table_name = i.table_name
        GROUP BY t.table_name, t.row_count, s.total_size, s.index_size, t.sequential_scans, t.index_scans
        """
        
        self._cursor.execute(query)
        results = self._cursor.fetchall()
        
        return [
            TTableStats(
                name=row[0],
                row_count=row[1],
                total_size=row[2],
                index_size=row[3],
                seq_scans=row[4],
                index_scans=row[5],
                index_usage=row[6]
            )
            for row in results
        ]

    def get_query_patterns(self) -> List[Dict]:
        """Get common query patterns from pg_stat_statements if available"""
        try:
            self._cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 
                    FROM pg_extension 
                    WHERE extname = 'pg_stat_statements'
                )
            """)
            has_extension = self._cursor.fetchone()[0]
            
            if not has_extension:
                return []
                
            query = """
            SELECT 
                query,
                calls,
                total_exec_time / calls as avg_time,
                rows / calls as avg_rows,
                100.0 * shared_blks_hit /
                NULLIF(shared_blks_hit + shared_blks_read, 0) as hit_ratio
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
            ORDER BY total_exec_time DESC
            LIMIT 10;
            """
            
            self._cursor.execute(query)
            results = self._cursor.fetchall()
            
            return [{
                'query': row[0],
                'calls': row[1],
                'avg_time_ms': round(row[2], 2),
                'avg_rows': round(row[3], 2),
                'cache_hit_ratio': round(row[4], 2) if row[4] is not None else None
            } for row in results]
            
        except Exception:
            return []

    def analyze_database(self) -> Dict:
        """Collect comprehensive database statistics and patterns"""
        table_stats = self.get_table_stats()
        query_patterns = self.get_query_patterns()
        
        analysis = {
            'tables': [],
            'potential_issues': [],
            'recommendations': []
        }
        
        for table in table_stats:
            table_analysis = {
                'name': table.name,
                'stats': {
                    'rows': table.row_count,
                    'total_size_mb': round(table.total_size / (1024 * 1024), 2),
                    'index_size_mb': round(table.index_size / (1024 * 1024), 2),
                    'index_ratio': round(table.index_scans / (table.seq_scans + 1), 2)
                }
            }
            
            # Detect potential issues
            if table.seq_scans > 100 and table.row_count > 10000:
                analysis['potential_issues'].append(
                    f"Table {table.name} has high number of sequential scans ({table.seq_scans}) "
                    f"with {table.row_count} rows - might need index optimization"
                )
            
            if table.index_size > table.total_size * 0.5:
                analysis['potential_issues'].append(
                    f"Table {table.name} has large index size ratio "
                    f"({round(table.index_size/table.total_size * 100, 1)}% of table size) "
                    "- consider removing unused indexes"
                )
            
            analysis['tables'].append(table_analysis)

        # Add query pattern analysis
        if query_patterns:
            slow_queries = [q for q in query_patterns if q['avg_time_ms'] > 100]
            for query in slow_queries:
                analysis['potential_issues'].append(
                    f"Slow query detected (avg {query['avg_time_ms']}ms): {query['query'][:100]}..."
                )

        return analysis

    def get_ai_recommendations(self, analysis: Dict) -> Tuple[bool, str]:
        """Get AI-powered recommendations using Gemini"""
        if not self.api_key:
            return False, "GEMINI_API_KEY environment variable not set"

        system_prompt = """
        You are a PostgreSQL database optimization expert. Analyze the provided database statistics
        and suggest specific improvements. Focus on:
        1. Index recommendations based on table access patterns
        2. Table structure optimization opportunities
        3. Query optimization suggestions
        4. Performance improvement priorities
        
        Format your response in clear sections with actionable items.
        """

        user_prompt = json.dumps(analysis, indent=2)
        
        url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent"
        headers = {"x-goog-api-key": self.api_key}
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": system_prompt}]},
                {"role": "user", "parts": [{"text": user_prompt}]}
            ]
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            response.raise_for_status()
            recommendations = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            return True, recommendations
        except Exception as e:
            return False, f"Failed to get AI recommendations: {str(e)}"
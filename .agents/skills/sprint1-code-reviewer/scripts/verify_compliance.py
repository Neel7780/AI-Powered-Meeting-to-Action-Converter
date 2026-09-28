#!/usr/bin/env python3
"""
Sprint 1 Code Compliance & Architecture Scanner for AI-Powered Meeting-to-Action Converter.
Designed for Team Leads (Neel) to audit code contributions and AI-generated PRs before merge.
"""

import sys
import os
import re
import argparse

VALID_TABLES = {
    'profiles', 'workspaces', 'workspace_members', 'meetings',
    'meeting_participants', 'transcripts', 'transcript_segments',
    'extracted_items', 'tasks', 'task_assignees', 'consents',
    'notifications', 'push_subscriptions', 'llm_runs', 'audit_log'
}

HALLUCINATED_TABLE_MAP = {
    'users': "Use 'profiles' (public schema) or reference auth.users(id)",
    'meeting_notes': "Use 'transcripts'",
    'notes': "Use 'transcripts'",
    'action_items': "Use 'extracted_items' for candidate items or 'tasks' for confirmed tasks",
    'user_tasks': "Use 'task_assignees' junction table",
    'workspace_users': "Use 'workspace_members'",
    'attendees': "Use 'meeting_participants'"
}

FORBIDDEN_IMPORTS = [
    (r'from\s+openai\s+import|import\s+openai', "OpenAI API detected. Sprint 1 requires Gemini 3.1 Flash-Lite (free) / Sarvam 105B."),
    (r'from\s+resend\s+import|import\s+resend|@resend/node|resend', "Resend detected. Sprint 1 uses free SMTP (Brevo / Gmail SMTP with app password)."),
    (r'import\s+anthropic|from\s+anthropic', "Anthropic API detected. Use Gemini 3.1 Flash-Lite free tier."),
    (r'@slack/web-api|from\s+slack_sdk', "Slack SDK detected. Slack export is Post-MVP (deferred)."),
    (r'from\s+twilio\s+import|import\s+twilio|require\(["\']twilio["\']\)', "Twilio detected in production code. WhatsApp Business is zero-cost via 'wa.me' link + Web Push; Twilio is for demo sandbox only.")
]

RLS_FRONTEND_MUTATION_TRAPS = [
    (r'supabase\s*\.\s*from\s*\(\s*[\'"`]tasks[\'"`]\s*\)\s*\.\s*insert', "Direct client-side task insert detected! Task creation is BACKEND-ONLY via FastAPI service-role upon organiser approval."),
    (r'supabase\s*\.\s*from\s*\(\s*[\'"`]extracted_items[\'"`]\s*\)\s*\.\s*(insert|update|upsert)', "Direct client-side extracted_items mutation detected! Extraction and review state updates must be handled by the FastAPI backend."),
    (r'supabase\s*\.\s*from\s*\(\s*[\'"`]workspaces[\'"`]\s*\)\s*\.\s*insert', "Direct workspaces insert detected! Must use RPC: `supabase.rpc('create_workspace', { p_name: '...' })` to establish atomic Admin role.")
]

SECRET_PATTERNS = [
    (r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+', "Potential hardcoded JWT or service_role secret key!"),
    (r'AIzaSy[a-zA-Z0-9_-]{33}', "Potential hardcoded Google AI / Gemini API key!"),
    (r'NEXT_PUBLIC_[A-Z0-9_]*SECRET', "Sensitive secret exposed in NEXT_PUBLIC_ client-side environment variable!"),
    (r'VITE_[A-Z0-9_]*SECRET|VITE_SUPABASE_SERVICE_ROLE', "Sensitive secret exposed in VITE_ client-side environment variable!")
]

STORAGE_PATH_TRAPS = [
    (r'\.upload\s*\(\s*[\'"`](?!.*\/.*\/)[^\'"`]+[\'"`]', "Storage upload path is missing workspace_id/meeting_id! Path must strictly be: `meeting-transcripts/{workspace_id}/{meeting_id}/{filename}` to pass Supabase RLS.")
]

def scan_file(filepath):
    issues = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception as e:
        return [("ERROR", f"Could not read file {filepath}: {e}", 0)]

    is_frontend = any(filepath.endswith(ext) for ext in ('.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte')) and ('frontend' in filepath or 'src' in filepath or 'pages' in filepath or 'app' in filepath or 'components' in filepath)

    for idx, line in enumerate(lines, 1):
        # 1. Secret leaks
        for pat, msg in SECRET_PATTERNS:
            if re.search(pat, line):
                issues.append(("CRITICAL", f"Line {idx}: {msg}", idx))

        # 2. Paid / Disallowed API imports
        for pat, msg in FORBIDDEN_IMPORTS:
            if re.search(pat, line):
                issues.append(("FAIL", f"Line {idx}: {msg}", idx))

        # 3. RLS Frontend Mutation Traps
        if is_frontend:
            for pat, msg in RLS_FRONTEND_MUTATION_TRAPS:
                if re.search(pat, line):
                    issues.append(("FAIL", f"Line {idx}: {msg}", idx))

            for pat, msg in STORAGE_PATH_TRAPS:
                if re.search(pat, line):
                    issues.append(("WARNING", f"Line {idx}: {msg}", idx))

        # 4. Table name hallucinations
        table_matches = re.findall(r'from\s*\(\s*[\'"`]([a-zA-Z0-9_]+)[\'"`]\s*\)', line)
        for tbl in table_matches:
            if tbl in HALLUCINATED_TABLE_MAP:
                issues.append(("FAIL", f"Line {idx}: Invalid table name '{tbl}'. {HALLUCINATED_TABLE_MAP[tbl]}.", idx))
            elif tbl not in VALID_TABLES and not tbl.startswith('test_'):
                issues.append(("WARNING", f"Line {idx}: Table '{tbl}' not found in official schema.sql. Verify table name.", idx))

    return issues

def main():
    parser = argparse.ArgumentParser(description="Audit Sprint 1 code for schema alignment and architecture compliance.")
    parser.add_argument("paths", nargs="+", help="Files or directories to scan.")
    args = parser.parse_args()

    files_to_scan = []
    for p in args.paths:
        if os.path.isfile(p):
            if os.path.abspath(p) != os.path.abspath(__file__):
                files_to_scan.append(p)
        elif os.path.isdir(p):
            for root, _, files in os.walk(p):
                if any(ignored in root for ignored in ('node_modules', '.git', '.next', '__pycache__', 'venv', '.agents')):
                    continue
                for f in files:
                    if f.endswith(('.ts', '.tsx', '.py', '.js', '.jsx', '.sql')):
                        target_f = os.path.join(root, f)
                        if os.path.abspath(target_f) != os.path.abspath(__file__):
                            files_to_scan.append(target_f)

    if not files_to_scan:
        print("No source files found to scan.")
        sys.exit(0)

    total_critical = 0
    total_fail = 0
    total_warn = 0

    print(f"\n=======================================================")
    print(f"🔍 SPRINT 1 CODE COMPLIANCE AUDIT (Scanning {len(files_to_scan)} files)")
    print(f"=======================================================\n")

    for fpath in files_to_scan:
        issues = scan_file(fpath)
        if issues:
            print(f"📄 {fpath}:")
            for severity, msg, line in issues:
                if severity == "CRITICAL":
                    total_critical += 1
                    print(f"  🚨 [CRITICAL] {msg}")
                elif severity == "FAIL":
                    total_fail += 1
                    print(f"  ❌ [FAIL] {msg}")
                else:
                    total_warn += 1
                    print(f"  ⚠️ [WARN] {msg}")
            print()

    print("-------------------------------------------------------")
    print(f"Audit Summary: {total_critical} Critical, {total_fail} Failures, {total_warn} Warnings.")
    if total_critical > 0 or total_fail > 0:
        print("❌ RESULT: PR DOES NOT MEET SPRINT 1 DEFINITION OF DONE. REQUEST CHANGES.")
        sys.exit(1)
    else:
        print("✅ RESULT: PASSED SPRINT 1 ARCHITECTURAL CHECKS!")
        sys.exit(0)

if __name__ == "__main__":
    main()
